import { ExamPin, LatLngPoint, PinCategory } from '../types';

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export async function fetchOsmTrafficSigns(
  bounds: BoundingBox,
  existingPins: ExamPin[] = []
): Promise<{ newPins: ExamPin[]; totalFetched: number }> {
  // Overpass query for visible area
  const { south, west, north, east } = bounds;

  // Limit bbox span to max ~0.08 deg (~8-9 km) to avoid overloading Overpass API
  const maxSpan = 0.08;
  const s = Math.max(south, (south + north) / 2 - maxSpan / 2);
  const n = Math.min(north, (south + north) / 2 + maxSpan / 2);
  const w = Math.max(west, (west + east) / 2 - maxSpan / 2);
  const e = Math.min(east, (west + east) / 2 + maxSpan / 2);

  const query = `[out:json][timeout:20];
(
  node["highway"="give_way"](${s},${w},${n},${e});
  node["highway"="stop"](${s},${w},${n},${e});
  node["highway"="traffic_signals"](${s},${w},${n},${e});
  node["highway"="speed_camera"](${s},${w},${n},${e});
  node["traffic_sign"](${s},${w},${n},${e});
);
out body 120;`;

  const url = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(url, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MapHelperApp/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Ошибка сервера OpenStreetMap (HTTP ${response.status})`);
  }

  const data = await response.json();
  const elements: any[] = data.elements || [];

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

    const sign = (tags.traffic_sign || '').toString();
    const highway = tags.highway;

    if (highway === 'give_way' || sign.includes('2.4') || sign.toLowerCase().includes('give_way')) {
      category = 'trap';
      title = 'Знак 2.4 «Уступите дорогу»';
      note = 'Обязательно уступите дорогу ТС, движущимся по пересекаемой главной дороге.';
    } else if (highway === 'stop' || sign.includes('2.5') || sign.toLowerCase().includes('stop')) {
      category = 'stop_forbidden';
      title = 'Знак 2.5 «Движение без остановки запрещено»';
      note = 'Обязательна полная фиксация остановки перед стоп-линией или краем проезжей части!';
    } else if (highway === 'traffic_signals') {
      category = 'trap';
      title = 'Светофорный объект';
      note = 'Внимание: регулируемый перекрёсток/пешеходный переход. Контролируйте стрелки и фазы.';
    } else if (highway === 'speed_camera' || sign.includes('3.24') || tags.maxspeed) {
      category = 'speed';
      title = tags.maxspeed ? `Ограничение скорости: ${tags.maxspeed} км/ч` : 'Камера / Контроль скорости';
      note = 'Контролируйте скоростной режим на экзамене.';
    } else if (sign.includes('3.19')) {
      category = 'uturn';
      title = 'Знак 3.19 «Разворот запрещён»';
      note = 'Разворот на этом участке запрещён ПДД!';
    } else if (sign.includes('3.1')) {
      category = 'stop_forbidden';
      title = 'Знак 3.1 «Въезд запрещён»';
      note = 'Въезд под кирпич запрещён!';
    } else if (sign.includes('2.1')) {
      category = 'trap';
      title = 'Знак 2.1 «Главная дорога»';
      note = 'Главная дорога. Следите за знаком 8.13 (направление главной дороги).';
    } else if (sign.includes('5.5')) {
      category = 'trap';
      title = 'Знак 5.5 «Одностороннее движение»';
      note = 'Движение по всей ширине проезжей части в одном направлении. Поворот налево с крайнего левого положения.';
    } else if (sign.includes('4.1')) {
      category = 'trap';
      title = `Предписывающий знак (${sign})`;
      note = 'Движение только в указанных направлениях.';
    } else {
      title = tags.description || tags.name || `Знак (${sign || highway || 'OSM'})`;
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
