import { ExamPin, LatLngPoint, PinCategory } from '../types';

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function fetchOsmTrafficSigns(
  bounds: BoundingBox,
  existingPins: ExamPin[] = []
): Promise<{ newPins: ExamPin[]; totalFetched: number }> {
  const { south, west, north, east } = bounds;

  // Limit bbox span to max ~0.08 deg (~8-9 km) to avoid overloading Overpass API
  const maxSpan = 0.08;
  const s = Math.max(south, (south + north) / 2 - maxSpan / 2);
  const n = Math.min(north, (south + north) / 2 + maxSpan / 2);
  const w = Math.max(west, (west + east) / 2 - maxSpan / 2);
  const e = Math.min(east, (west + east) / 2 + maxSpan / 2);

  const query = `[out:json][timeout:25];
(
  node["highway"="give_way"](${s},${w},${n},${e});
  node["highway"="stop"](${s},${w},${n},${e});
  node["highway"="priority"](${s},${w},${n},${e});
  node["highway"="traffic_signals"](${s},${w},${n},${e});
  node["highway"="crossing"](${s},${w},${n},${e});
  node["highway"="speed_camera"](${s},${w},${n},${e});
  node["traffic_sign"](${s},${w},${n},${e});
  node["traffic_sign:forward"](${s},${w},${n},${e});
  node["traffic_sign:backward"](${s},${w},${n},${e});
  node["priority_road"](${s},${w},${n},${e});
  node["maxspeed"](${s},${w},${n},${e});
  node["parking:lane:both"~"no_stopping|no_parking"](${s},${w},${n},${e});
  node["parking:lane:right"~"no_stopping|no_parking"](${s},${w},${n},${e});
  node["parking:lane:left"~"no_stopping|no_parking"](${s},${w},${n},${e});
);
out body 250;`;

  let responseData: any = null;
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MapHelperApp/1.0',
        },
      });
      if (res.ok) {
        responseData = await res.json();
        break;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!responseData) {
    throw (
      lastError ||
      new Error('Сервер OpenStreetMap (Overpass API) временно недоступен. Попробуйте через несколько секунд.')
    );
  }

  const elements: any[] = responseData.elements || [];
  const newPins: ExamPin[] = [];

  for (const el of elements) {
    if (!el.lat || !el.lon) continue;
    const pt: LatLngPoint = { lat: el.lat, lng: el.lon };

    // Check if a pin already exists within ~8 meters
    const isNearby = [...existingPins, ...newPins].some((p) => {
      const dLat = Math.abs(p.position.lat - pt.lat);
      const dLng = Math.abs(p.position.lng - pt.lng);
      return dLat < 0.0001 && dLng < 0.00015;
    });

    if (isNearby) continue;

    const tags = el.tags || {};
    let category: PinCategory = 'trap';
    let title = 'Дорожный знак (OSM)';
    let note = '';

    const sign = (
      tags.traffic_sign ||
      tags['traffic_sign:forward'] ||
      tags['traffic_sign:backward'] ||
      ''
    ).toString();
    const highway = tags.highway;
    const crossing = tags.crossing;
    const isCrossingSignals =
      tags.crossing === 'traffic_signals' ||
      tags['crossing:signals'] === 'yes' ||
      tags.traffic_signals === 'crossing' ||
      tags['traffic_signals:type'] === 'pedestrian';

    // 1. Светофоры и переходы (регулируемый перекрёсток vs пешеходный светофор vs зебра)
    if (
      isCrossingSignals ||
      (highway === 'crossing' && (crossing === 'traffic_signals' || tags['crossing:signals'] === 'yes'))
    ) {
      category = 'trap';
      title = 'Пешеходный светофор (регулируемый переход)';
      note =
        'Светофор регулирует только пешеходный переход, а не перекрёсток! Движение разрешено, если пешеходам красный и на переходе никого нет.';
    } else if (highway === 'traffic_signals') {
      category = 'trap';
      title = 'Регулируемый перекрёсток (светофор)';
      note =
        'Регулируемый перекрёсток. Контролируйте основные сигналы, стрелки дополнительных секций и разметку стоп-линии.';
    } else if (highway === 'crossing') {
      category = 'trap';
      title = 'Нерегулируемый пешеходный переход (зебра)';
      note =
        'Зона повышенного внимания на экзамене! Обязательно заблаговременно снизить скорость и уступить дорогу пешеходам.';
    }
    // 2. Знаки приоритета (Главная дорога 2.1, Уступите дорогу 2.4, Движение без остановки 2.5)
    else if (
      highway === 'give_way' ||
      sign.includes('2.4') ||
      sign.toLowerCase().includes('give_way')
    ) {
      category = 'trap';
      title = 'Знак 2.4 «Уступите дорогу»';
      note =
        'Нерегулируемый перекрёсток: вы на второстепенной дороге. Обязательно уступите дорогу ТС на главной дороге.';
    } else if (
      highway === 'stop' ||
      sign.includes('2.5') ||
      sign.toLowerCase().includes('stop')
    ) {
      category = 'stop_forbidden';
      title = 'Знак 2.5 «Движение без остановки запрещено»';
      note =
        'Обязательна полная фиксация остановки (колёса не должны вращаться) перед стоп-линией или краем пересекаемой проезжей части!';
    } else if (
      highway === 'priority' ||
      tags.priority_road === 'yes' ||
      tags.priority_road === 'designated' ||
      sign.includes('2.1') ||
      sign.toLowerCase().includes('priority')
    ) {
      category = 'trap';
      title = 'Знак 2.1 «Главная дорога»';
      note =
        'Нерегулируемый перекрёсток: вы движетесь по главной дороге. Следите за табличкой 8.13 (направление главной дороги) и помехой справа при съезде.';
    }
    // 3. Запрет остановки и стоянки (знаки 3.27, 3.28)
    else if (
      sign.includes('3.27') ||
      tags['parking:lane:both'] === 'no_stopping' ||
      tags['parking:lane:right'] === 'no_stopping' ||
      tags['parking:lane:left'] === 'no_stopping'
    ) {
      category = 'stop_forbidden';
      title = 'Знак 3.27 «Остановка запрещена»';
      note =
        'Остановка и стоянка любых ТС строго запрещена! Инспектор на экзамене часто провоцирует фразой «найдите место для остановки».';
    } else if (
      sign.includes('3.28') ||
      tags['parking:lane:both'] === 'no_parking' ||
      tags['parking:lane:right'] === 'no_parking' ||
      tags['parking:lane:left'] === 'no_parking'
    ) {
      category = 'stop_forbidden';
      title = 'Знак 3.28 «Стоянка запрещена»';
      note =
        'Стоянка запрещена (остановка до 5 минут для посадки/высадки пассажиров разрешена).';
    }
    // 4. Ограничения скорости (знак 3.24) и камеры контроля
    else if (highway === 'speed_camera' || sign.includes('3.24') || tags.maxspeed) {
      category = 'speed';
      let speedVal = tags.maxspeed || '';
      if (!speedVal && sign.match(/3\.24\[?(\d+)\]?/)) {
        speedVal = RegExp.$1;
      }
      if (speedVal === 'RU:urban') speedVal = '60';
      if (speedVal === 'RU:rural') speedVal = '90';

      title = speedVal
        ? `Знак 3.24 «Ограничение скорости: ${speedVal} км/ч»`
        : 'Знак 3.24 «Ограничение скорости» / Камера';
      note =
        'Строго контролируйте скоростной режим. На экзамене ГИБДД превышение даже на 1 км/ч является грубым нарушением!';
    }
    // 5. Разворот запрещён (3.19)
    else if (sign.includes('3.19')) {
      category = 'uturn';
      title = 'Знак 3.19 «Разворот запрещён»';
      note =
        'Разворот на этом перекрёстке/участке дороги категорически запрещён ПДД!';
    }
    // 6. Въезд запрещён (3.1 - кирпич)
    else if (sign.includes('3.1')) {
      category = 'stop_forbidden';
      title = 'Знак 3.1 «Въезд запрещён» (Кирпич)';
      note = 'Въезд под «кирпич» строго запрещён!';
    }
    // 7. Повороты запрещены (3.18.1, 3.18.2)
    else if (sign.includes('3.18.1')) {
      category = 'trap';
      title = 'Знак 3.18.1 «Поворот направо запрещён»';
      note = 'Поворот направо на данном пересечении проезжих частей запрещён!';
    } else if (sign.includes('3.18.2')) {
      category = 'trap';
      title = 'Знак 3.18.2 «Поворот налево запрещён»';
      note =
        'Поворот налево запрещён (при этом разворот разрешён, если нет знака 3.19)!';
    }
    // 8. Одностороннее движение (5.5)
    else if (sign.includes('5.5')) {
      category = 'trap';
      title = 'Знак 5.5 «Одностороннее движение»';
      note =
        'Дорога с односторонним движением. Для поворота налево необходимо занять крайнее левое положение у левого бордюра/края дороги!';
    } else {
      title = tags.description || tags.name || `Дорожный знак (${sign || highway || 'OSM'})`;
      note = `Данные OpenStreetMap (node #${el.id})`;
    }

    newPins.push({
      id: `osm-${el.id}`,
      category,
      position: pt,
      heading: 0,
      scale: 1.0,
      title,
      note,
    });
  }

  return { newPins, totalFetched: elements.length };
}
