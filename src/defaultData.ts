import { LatLngPoint, MapHelperData } from './types';

export const DEFAULT_CENTER: LatLngPoint = {
  lat: 54.75354,
  lng: 32.07765,
};

export const DEFAULT_ZOOM = 18;

export const INITIAL_DATA: MapHelperData = {
  version: 1,
  roadStrips: [],
  turnTrajectories: [],
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
  yandexApiKey: '',
};
