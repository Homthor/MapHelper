import { LatLngPoint, MapHelperData } from './types';

// Нейтральный центр по умолчанию (Москва), если пользователь ещё не указал свой город
export const DEFAULT_CENTER: LatLngPoint = {
  lat: 55.7558,
  lng: 37.6176,
};

export const DEFAULT_ZOOM = 15;

export const INITIAL_DATA: MapHelperData = {
  version: 1,
  cityName: 'Москва',
  initialCenter: DEFAULT_CENTER,
  roadStrips: [],
  turnTrajectories: [],
  pins: [],
  bookmarks: [],
  yandexApiKey: '',
};

// Демонстрационный пресет маршрутов ГИБДД Смоленска (посёлок Тихвинка) для примеров
export const SMOLENSK_DEMO_PRESET: {
  cityName: string;
  center: LatLngPoint;
  zoom: number;
  pins: MapHelperData['pins'];
  bookmarks: MapHelperData['bookmarks'];
} = {
  cityName: 'Смоленск',
  center: { lat: 54.75354, lng: 32.07765 },
  zoom: 18,
  pins: [
    {
      id: 'pin-gibdd-smolensk',
      category: 'gibdd',
      position: { lat: 54.75354, lng: 32.07765 },
      heading: 260,
      title: 'МРЭО ГИБДД (пос. Тихвинка, 25А)',
      note: 'Старт экзаменационных маршрутов. При выезде со двора ГИБДД обратите внимание на знаки приоритета, пешеходов и включение поворотника.',
    },
  ],
  bookmarks: [
    {
      id: 'bm-gibdd-tikhvinka',
      title: '🚔 МРЭО ГИБДД (пос. Тихвинка, 25А)',
      center: { lat: 54.75354, lng: 32.07765 },
      zoom: 18,
    },
    {
      id: 'bm-tikhvinka-main',
      title: '🛣️ Выезд на Тихвинку / Рославльское ш.',
      center: { lat: 54.7539, lng: 32.0748 },
      zoom: 18,
    },
    {
      id: 'bm-ring-stroiteley',
      title: '🔄 Кольцо: Рославльское ш. / пр-т Строителей',
      center: { lat: 54.7618, lng: 32.0785 },
      zoom: 18,
    },
  ],
};
