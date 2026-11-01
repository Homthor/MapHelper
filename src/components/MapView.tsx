import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ActiveTool,
  BaseMapType,
  ExamPin,
  LatLngPoint,
  LayerVisibility,
  MarkerStroke,
  RoadStrip,
  TurnTrajectory,
} from '../types';
import {
  computeArrowHead,
  computeLaneChangePoints,
  computeSectionLanesGeometry,
  sampleQuadraticBezier,
} from '../geometry';
import { MARKER_COLOR_PALETTE } from './MarkerEditorPanel';
import { fetchOsmTrafficSigns } from '../services/osmSignsService';

// Fix Leaflet 1.9.4 Draggable bug where getSizedParentNode crashes with "Cannot read properties of null (reading 'offsetWidth')"
// and ensure Draggable._dragging is never left stuck on error, outside clicks, or unmounts.
if ((L as any).Draggable && !(L as any).Draggable.__safePatched) {
  (L as any).Draggable.__safePatched = true;
  const proto = (L as any).Draggable.prototype;

  proto._onDown = function (e: any) {
    if (!this._enabled) { return; }

    this._moved = false;

    if (L.DomUtil.hasClass(this._element, 'leaflet-zoom-anim')) { return; }

    if (e.touches && e.touches.length !== 1) {
      if ((L as any).Draggable._dragging === this) {
        this.finishDrag();
      }
      return;
    }

    if ((L as any).Draggable._dragging || e.shiftKey || ((e.which !== 1) && (e.button !== 1) && !e.touches)) { return; }
    (L as any).Draggable._dragging = this;

    if (this._preventOutline) {
      L.DomUtil.preventOutline(this._element);
    }

    (L.DomUtil as any).disableImageDrag();
    (L.DomUtil as any).disableTextSelection();

    if (this._moving) { return; }

    this.fire('down');

    const first = e.touches ? e.touches[0] : e;
    let sizedParent: HTMLElement | null = this._element ? this._element.parentElement : null;
    while (sizedParent && sizedParent !== document.body && (!sizedParent.offsetWidth || !sizedParent.offsetHeight)) {
      sizedParent = sizedParent.parentElement;
    }
    if (!sizedParent) sizedParent = document.body;

    this._startPoint = new L.Point(first.clientX, first.clientY);
    this._startPos = L.DomUtil.getPosition(this._element);

    const rect = sizedParent.getBoundingClientRect();
    this._parentScale = new L.Point(
      (sizedParent.offsetWidth ? rect.width / sizedParent.offsetWidth : 1) || 1,
      (sizedParent.offsetHeight ? rect.height / sizedParent.offsetHeight : 1) || 1
    );

    const mouseevent = e.type === 'mousedown';
    L.DomEvent.on(document as any, mouseevent ? 'mousemove' : 'touchmove', this._onMove, this);
    L.DomEvent.on(document as any, mouseevent ? 'mouseup' : 'touchend touchcancel', this._onUp, this);
  };

  const origFinishDrag = proto.finishDrag;
  proto.finishDrag = function (noInertia: any) {
    try {
      origFinishDrag.call(this, noInertia);
    } finally {
      (L as any).Draggable._dragging = false;
    }
  };

  const origOnMove = proto._onMove;
  proto._onMove = function (e: any) {
    try {
      origOnMove.call(this, e);
    } catch (err) {
      console.warn('Leaflet Draggable._onMove recovered:', err);
      try {
        this.finishDrag();
      } catch {}
      (L as any).Draggable._dragging = false;
    }
  };

  if ((L as any).DomUtil) {
    const origAddClass = L.DomUtil.addClass;
    L.DomUtil.addClass = function (el: any, name: string) {
      if (!el) return;
      return origAddClass.call(this, el, name);
    };
    const origRemoveClass = L.DomUtil.removeClass;
    L.DomUtil.removeClass = function (el: any, name: string) {
      if (!el) return;
      return origRemoveClass.call(this, el, name);
    };
  }

  if (typeof window !== 'undefined' && !(window as any).__leaflet_drag_guard_installed) {
    (window as any).__leaflet_drag_guard_installed = true;
    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.buttons === 0 && (L as any).Draggable && (L as any).Draggable._dragging) {
        if (typeof (L as any).Draggable._dragging.finishDrag === 'function') {
          try {
            (L as any).Draggable._dragging.finishDrag();
          } catch {}
        }
        (L as any).Draggable._dragging = false;
      }
    });
  }
}

declare global {
  interface Window {
    ymaps3?: any;
  }
}

let ymaps3LoadPromise: Promise<any> | null = null;
let ymaps3LoadedKey = '';

function loadYMaps3Script(apiKey: string): Promise<any> {
  if (window.ymaps3 && ymaps3LoadedKey === apiKey) {
    return window.ymaps3.ready.then(() => window.ymaps3);
  }
  if (ymaps3LoadPromise && ymaps3LoadedKey === apiKey) {
    return ymaps3LoadPromise;
  }

  ymaps3LoadedKey = apiKey;
  ymaps3LoadPromise = new Promise((resolve, reject) => {
    const scriptId = 'ymaps-v3-api-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    const expectedSrc = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = expectedSrc;
      script.async = true;
      document.head.appendChild(script);
    } else if (script.src !== expectedSrc) {
      script.src = expectedSrc;
    }

    script.onload = async () => {
      try {
        if (!window.ymaps3) throw new Error('window.ymaps3 not found after script load');
        await window.ymaps3.ready;
        resolve(window.ymaps3);
      } catch (err) {
        reject(err);
      }
    };

    script.onerror = (e) => {
      ymaps3LoadPromise = null;
      reject(e);
    };

    if (window.ymaps3) {
      window.ymaps3.ready.then(() => resolve(window.ymaps3)).catch(reject);
    }
  });

  return ymaps3LoadPromise;
}

interface MapViewProps {
  center: LatLngPoint;
  zoom: number;
  baseMap: BaseMapType;
  yandexApiKey?: string;
  onOpenSettings?: () => void;
  roadStrips: RoadStrip[];
  turnTrajectories: TurnTrajectory[];
  markerStrokes: MarkerStroke[];
  pins: ExamPin[];
  layerVisibility: LayerVisibility;
  studyMode: boolean;
  activeTool: ActiveTool;
  selectedStripId: string | null;
  selectedSectionIndex: number | null;
  selectedTurnId: string | null;
  selectedMarkerId: string | null;
  selectedPinId: string | null;
  onSelectSection: (stripId: string, sectionIndex: number) => void;
  onSelectTurn: (turnId: string) => void;
  onSelectMarker: (markerId: string) => void;
  onSelectPin: (pinId: string) => void;
  onAddRoadPoint: (pt: LatLngPoint) => void;
  drawingRoadPoints: LatLngPoint[];
  onFinishDrawingRoad: (options?: { baseLanes?: number; laneWidthMeters?: number }) => void;
  onCreateTemplateRoadAt: (center: LatLngPoint, baseLanes: number, laneWidthMeters: number) => void;
  onCancelDrawing: () => void;
  drawingTurnPoints: LatLngPoint[];
  onAddTurnPoint: (pt: LatLngPoint) => void;
  onAddPinAt: (pt: LatLngPoint) => void;
  onOpenPanoramaAt: (pt: LatLngPoint) => void;
  onUpdateRoadPoint: (stripId: string, pointIndex: number, newPt: LatLngPoint) => void;
  onMoveRoadStrip: (stripId: string, dLat: number, dLng: number) => void;
  onUpdateTurnPoints: (
    turnId: string,
    patch: Partial<Pick<TurnTrajectory, 'start' | 'control' | 'end'>>
  ) => void;
  onMoveTurn: (turnId: string, dLat: number, dLng: number) => void;
  onUpdatePinPosition: (pinId: string, newPt: LatLngPoint) => void;
  onAddMarkerStroke: (stroke: Omit<MarkerStroke, 'id'>) => void;
  onMoveMarkerStroke: (markerId: string, dLat: number, dLng: number) => void;
  onUpdateMarkerPoint: (markerId: string, pointIndex: number, newPt: LatLngPoint) => void;
  onDeselectAll?: () => void;
  onAddMultiplePins?: (pins: ExamPin[]) => void;
  osmTrigger?: number;
}

const PIN_ICONS: Record<string, string> = {
  gibdd: '🚔',
  uturn: '↶',
  stop_allowed: '🅿️',
  stop_forbidden: '🚫',
  trap: '⚠️',
  speed: '🚀',
};

// Кастомизация для скрытия коммерческого шума (магазины, кафе, заправки, памятники, отели),
// с сохранением дорожной разметки (road_marking, road_surface), остановок, трамвайных линий, светофоров и переходов.
// Используются только строгие системные теги protobuf-схемы Яндекс Карт 3.0 (g.basemap.Tag) и валидные типы элементов (label, geometry).
const CLEAN_DRIVING_CUSTOMIZATION = [
  {
    tags: {
      any: [
        'poi',
        'food_and_drink',
        'shopping',
        'commercial_services',
        'fuel_station',
        'hotel',
        'major_landmark',
        'outdoor',
        'cemetery',
        'medical',
        'discovery',
      ],
      none: [
        'transit',
        'transit_location',
        'transit_stop',
        'transit_entrance',
        'transit_line',
        'transit_schema',
        'traffic_light',
        'crosswalk',
        'parking',
        'road',
        'road_surface',
        'road_marking',
      ],
    },
    elements: ['label', 'geometry'],
    stylers: [{ visibility: 'off' }],
  },
];

// Дополнительное усиление контрастности дорожной разметки через теги road_marking и road_surface
const ENHANCED_MARKING_RULES = [
  {
    tags: { any: ['road_surface'] },
    elements: ['geometry'],
    stylers: [{ lightness: -0.18 }],
  },
  {
    tags: { any: ['road_marking'] },
    elements: ['geometry'],
    stylers: [{ scale: 1.35, lightness: 0.25 }],
  },
];

export const MapView: React.FC<MapViewProps> = ({
  center,
  zoom,
  baseMap,
  yandexApiKey,
  onOpenSettings,
  roadStrips,
  turnTrajectories,
  markerStrokes,
  pins,
  layerVisibility,
  studyMode,
  activeTool,
  selectedStripId,
  selectedSectionIndex,
  selectedTurnId,
  selectedMarkerId,
  selectedPinId,
  onSelectSection,
  onSelectTurn,
  onSelectMarker,
  onSelectPin,
  onAddRoadPoint,
  drawingRoadPoints,
  onFinishDrawingRoad,
  onCreateTemplateRoadAt,
  onCancelDrawing,
  drawingTurnPoints,
  onAddTurnPoint,
  onAddPinAt,
  onOpenPanoramaAt,
  onUpdateRoadPoint,
  onMoveRoadStrip,
  onUpdateTurnPoints,
  onMoveTurn,
  onUpdatePinPosition,
  onAddMarkerStroke,
  onMoveMarkerStroke,
  onUpdateMarkerPoint,
  onDeselectAll,
  onAddMultiplePins,
  osmTrigger,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const ymaps3ContainerRef = useRef<HTMLDivElement>(null);
  const ymaps3InstanceRef = useRef<any>(null);
  const ymaps3SchemeLayerRef = useRef<any>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseLayersRef = useRef<{ [key: string]: L.LayerGroup }>({});
  const drawingLayerRef = useRef<L.LayerGroup | null>(null);
  const featuresLayerRef = useRef<L.LayerGroup | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);
  const [isImportingOsm, setIsImportingOsm] = useState<boolean>(false);
  const [osmImportMessage, setOsmImportMessage] = useState<string | null>(null);
  const [v3Status, setV3Status] = useState<'none' | 'loading' | 'ready' | 'error'>('none');
  const [v3ErrorDetails, setV3ErrorDetails] = useState<string>('');
  const [retryTrigger, setRetryTrigger] = useState<number>(0);
  const [cleanPoiMode, setCleanPoiMode] = useState<boolean>(true);
  const [contrastMarkings, setContrastMarkings] = useState<boolean>(false);

  // Настройки по умолчанию при создании новой дороги и рисовании маркером
  const [newRoadLanes, setNewRoadLanes] = useState<number>(2);
  const [newRoadWidth, setNewRoadWidth] = useState<number>(2.0);
  const [markerColor, setMarkerColor] = useState<string>('#f59e0b');
  const [markerWidth, setMarkerWidth] = useState<number>(10);
  const [markerOpacity, setMarkerOpacity] = useState<number>(0.65);
  const [markerArrowEnd, setMarkerArrowEnd] = useState<boolean>(false);
  const [drawingMarkerPoints, setDrawingMarkerPoints] = useState<LatLngPoint[]>([]);
  const isPaintingMarkerRef = useRef<boolean>(false);
  const paintedPointsRef = useRef<LatLngPoint[]>([]);

  const getActiveCustomization = (cleanPoi: boolean, contrast: boolean) => {
    const rules = [
      ...(cleanPoi ? CLEAN_DRIVING_CUSTOMIZATION : []),
      ...(contrast ? ENHANCED_MARKING_RULES : []),
    ];
    return rules.length > 0 ? rules : undefined;
  };

  const handleImportOsmSigns = async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const b = map.getBounds();
    setIsImportingOsm(true);
    setOsmImportMessage(null);
    try {
      const { newPins, totalFetched } = await fetchOsmTrafficSigns(
        {
          south: b.getSouth(),
          west: b.getWest(),
          north: b.getNorth(),
          east: b.getEast(),
        },
        pins
      );
      if (newPins.length > 0) {
        if (onAddMultiplePins) {
          onAddMultiplePins(newPins);
        } else {
          newPins.forEach((p) => onAddPinAt(p.position));
        }
        setOsmImportMessage(`✅ Добавлено знаков из OpenStreetMap: ${newPins.length}`);
      } else if (totalFetched > 0) {
        setOsmImportMessage(`ℹ️ Все найденные знаки (${totalFetched}) уже на карте.`);
      } else {
        setOsmImportMessage('ℹ️ В этой области не найдено знаков. Попробуйте приблизить перекрёсток.');
      }
    } catch (err: any) {
      setOsmImportMessage(`⚠️ ${err?.message || 'Не удалось загрузить знаки'}`);
    } finally {
      setIsImportingOsm(false);
      setTimeout(() => setOsmImportMessage(null), 6000);
    }
  };

  useEffect(() => {
    if (osmTrigger && osmTrigger > 0) {
      handleImportOsmSigns();
    }
  }, [osmTrigger]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Remove any leftover event listeners or DOM state on container from previous mounts
    if (mapContainerRef.current) {
      L.DomEvent.off(mapContainerRef.current);
      delete (mapContainerRef.current as any)._leaflet_id;
      mapContainerRef.current.innerHTML = '';
    }
    (L as any).Draggable._dragging = false;

    // Yandex uses EPSG:3395 projection
    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.EPSG3395,
      center: [center.lat, center.lng],
      zoom: zoom,
      minZoom: 4,
      maxZoom: 21,
      zoomControl: true,
      zoomAnimation: false,
    });

    mapInstanceRef.current = map;

    // Yandex Scheme tiles (fallback when v3 vector API is not active)
    const schemeLayer = L.tileLayer(
      'https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=2&lang=ru_RU',
      {
        maxNativeZoom: 19,
        maxZoom: 21,
        subdomains: [],
        attribution: '&copy; Yandex',
      }
    );

    // Yandex Satellite tiles
    const satLayer = L.tileLayer(
      'https://core-sat.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}&scale=1&lang=ru_RU',
      {
        maxNativeZoom: 19,
        maxZoom: 21,
        subdomains: [],
        attribution: '&copy; Yandex',
      }
    );

    // Yandex Hybrid (Satellite + Skeleton labels)
    const hybridGroup = L.layerGroup([
      satLayer,
      L.tileLayer(
        'https://core-renderer-tiles.maps.yandex.net/tiles?l=skl&x={x}&y={y}&z={z}&scale=2&lang=ru_RU',
        {
          maxNativeZoom: 19,
          maxZoom: 21,
          subdomains: [],
          attribution: '&copy; Yandex',
        }
      ),
    ]);

    baseLayersRef.current = {
      scheme: L.layerGroup([schemeLayer]),
      satellite: L.layerGroup([satLayer]),
      hybrid: hybridGroup,
    };

    baseLayersRef.current[baseMap]?.addTo(map);

    featuresLayerRef.current = L.layerGroup().addTo(map);
    drawingLayerRef.current = L.layerGroup().addTo(map);

    const syncYMap = () => {
      if (ymaps3InstanceRef.current && mapInstanceRef.current) {
        const c = mapInstanceRef.current.getCenter();
        const z = mapInstanceRef.current.getZoom();
        try {
          ymaps3InstanceRef.current.setLocation({
            center: [c.lng, c.lat],
            zoom: z,
            duration: 0,
          });
        } catch {
          // ignore
        }
      }
    };

    const handleZoomEnd = () => {
      if (mapInstanceRef.current) {
        setCurrentZoom(mapInstanceRef.current.getZoom());
      }
    };
    map.on('zoomend', handleZoomEnd);
    map.on('move zoom moveend zoomend viewreset resize', syncYMap);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      syncYMap();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.off('zoomend', handleZoomEnd);
      map.off('move zoom moveend zoomend viewreset resize', syncYMap);
      map.remove();
      if (mapContainerRef.current) {
        L.DomEvent.off(mapContainerRef.current);
        delete (mapContainerRef.current as any)._leaflet_id;
        mapContainerRef.current.innerHTML = '';
      }
      mapInstanceRef.current = null;
      (L as any).Draggable._dragging = false;
    };
  }, []);

  // Load & Initialize Yandex Maps JS API 3.0 Vector Map (vmap3 with HD road markings)
  useEffect(() => {
    const cleanKey = yandexApiKey?.trim();
    if (!cleanKey) {
      setV3Status('none');
      return;
    }

    let cancelled = false;
    setV3Status('loading');

    const init = async () => {
      try {
        const y3 = await loadYMaps3Script(cleanKey);
        if (cancelled || !ymaps3ContainerRef.current) return;

        if (ymaps3InstanceRef.current) {
          try {
            ymaps3InstanceRef.current.destroy();
          } catch {
            // ignore
          }
          ymaps3InstanceRef.current = null;
        }

        ymaps3ContainerRef.current.innerHTML = '';
        const map = mapInstanceRef.current;
        const curCenter = map ? map.getCenter() : center;
        const curZoom = map ? map.getZoom() : zoom;

        const {
          YMap,
          YMapDefaultSchemeLayer,
          YMapDefaultFeaturesLayer,
          YMapContextProvider,
          TypeContext,
        } = y3;
        const ymap = new YMap(ymaps3ContainerRef.current, {
          location: {
            center: [curCenter.lng, curCenter.lat],
            zoom: curZoom,
          },
        });
        const schemeLayer = new YMapDefaultSchemeLayer({
          customization: getActiveCustomization(cleanPoiMode, contrastMarkings),
        });
        // Режим future-map (через публичный TypeContext) включает отображение слоёв
        // hd_road_surface и hd_road_marking_* (теги road_surface и road_marking) на бесплатном тарифе
        if (YMapContextProvider && TypeContext) {
          const typeProvider = new YMapContextProvider({
            context: TypeContext,
            value: { type: 'future-map' },
          });
          ymap.addChild(typeProvider);
          typeProvider.addChild(schemeLayer);
        } else {
          ymap.addChild(schemeLayer);
        }
        ymaps3SchemeLayerRef.current = schemeLayer;
        if (YMapDefaultFeaturesLayer) {
          ymap.addChild(new YMapDefaultFeaturesLayer({}));
        }
        ymaps3InstanceRef.current = ymap;
        setV3Status('ready');
        setV3ErrorDetails('');
      } catch (err: any) {
        if (!cancelled) {
          console.error('Yandex Maps v3 init error:', err);
          setV3Status('error');
          setV3ErrorDetails(err?.message || 'Ошибка инициализации API 3.0');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [yandexApiKey, retryTrigger]);

  // Toggle Clean Driving Map customization & road_marking contrast enhancement
  useEffect(() => {
    if (ymaps3SchemeLayerRef.current && v3Status === 'ready') {
      try {
        ymaps3SchemeLayerRef.current.update({
          customization: getActiveCustomization(cleanPoiMode, contrastMarkings),
        });
      } catch {
        // ignore
      }
    }
  }, [cleanPoiMode, contrastMarkings, v3Status]);

  // Update Base Map (hide raster scheme when v3 vector map is ready)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !baseLayersRef.current) return;

    Object.values(baseLayersRef.current).forEach((layer) => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });

    if (baseMap === 'scheme' && v3Status === 'ready') {
      // Vector map v3 is visible right underneath the transparent Leaflet container!
      return;
    }

    const targetLayer = baseLayersRef.current[baseMap];
    if (targetLayer) {
      targetLayer.addTo(map);
    }
  }, [baseMap, v3Status]);

  // Handle center / zoom changes when selecting bookmark
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const curCenter = map.getCenter();
    const dLat = Math.abs(curCenter.lat - center.lat);
    const dLng = Math.abs(curCenter.lng - center.lng);
    if (dLat > 0.0001 || dLng > 0.0001 || map.getZoom() !== zoom) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
      setCurrentZoom(zoom);
    }
  }, [center.lat, center.lng, zoom]);

  // Clear temporary marker points when switching tools & ensure map dragging is enabled
  useEffect(() => {
    setDrawingMarkerPoints([]);
    isPaintingMarkerRef.current = false;
    paintedPointsRef.current = [];
    const map = mapInstanceRef.current;
    if (map) {
      map.dragging.enable();
    }
    if ((L as any).Draggable?._dragging) {
      (L as any).Draggable._dragging = null;
    }
  }, [activeTool]);

  // Keyboard Enter to finish road or marker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (activeTool === 'draw_road' && drawingRoadPoints.length >= 2) {
          onFinishDrawingRoad({
            baseLanes: newRoadLanes,
            laneWidthMeters: newRoadWidth,
          });
        } else if (activeTool === 'draw_marker' && drawingMarkerPoints.length >= 2) {
          onAddMarkerStroke({
            points: drawingMarkerPoints,
            color: markerColor,
            width: markerWidth,
            opacity: markerOpacity,
            arrowEnd: markerArrowEnd,
          });
          setDrawingMarkerPoints([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTool,
    drawingRoadPoints,
    drawingMarkerPoints,
    newRoadLanes,
    newRoadWidth,
    markerColor,
    markerWidth,
    markerOpacity,
    markerArrowEnd,
    onFinishDrawingRoad,
    onAddMarkerStroke,
  ]);

  // Handle Map Clicks & Freehand Marker Painting based on activeTool
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Ensure map dragging is in proper state when tool changes
    if (activeTool !== 'draw_marker') {
      map.dragging.enable();
    }

    const handleClick = (e: L.LeafletMouseEvent) => {
      const pt: LatLngPoint = { lat: e.latlng.lat, lng: e.latlng.lng };

      if (activeTool === 'draw_road') {
        onAddRoadPoint(pt);
      } else if (activeTool === 'draw_turn') {
        onAddTurnPoint(pt);
      } else if (activeTool === 'add_pin') {
        onAddPinAt(pt);
      } else if (activeTool === 'panorama') {
        onOpenPanoramaAt(pt);
      } else if (activeTool === 'select') {
        onDeselectAll?.();
      }
    };

    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      if (activeTool !== 'draw_marker') return;
      map.dragging.disable();
      isPaintingMarkerRef.current = true;
      const pt: LatLngPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
      paintedPointsRef.current = [pt];
      setDrawingMarkerPoints((prev) => [...prev, pt]);
    };

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (activeTool !== 'draw_marker' || !isPaintingMarkerRef.current) return;
      const pts = paintedPointsRef.current;
      const last = pts[pts.length - 1];
      if (!last) return;
      const p1 = map.latLngToContainerPoint([last.lat, last.lng]);
      const p2 = map.latLngToContainerPoint(e.latlng);
      if (p1.distanceTo(p2) >= 5) {
        const nextPt: LatLngPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
        paintedPointsRef.current = [...pts, nextPt];
        setDrawingMarkerPoints([...paintedPointsRef.current]);
      }
    };

    const handleGlobalMouseUp = () => {
      if (activeTool === 'draw_marker' && isPaintingMarkerRef.current) {
        isPaintingMarkerRef.current = false;
        map.dragging.enable();
        if (paintedPointsRef.current.length >= 2) {
          onAddMarkerStroke({
            points: paintedPointsRef.current,
            color: markerColor,
            width: markerWidth,
            opacity: markerOpacity,
            arrowEnd: markerArrowEnd,
          });
          paintedPointsRef.current = [];
          setDrawingMarkerPoints([]);
        }
      } else if (map && !map.dragging.enabled()) {
        map.dragging.enable();
      }
    };

    map.on('click', handleClick);
    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      map.off('click', handleClick);
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      map.dragging.enable();
      if ((L as any).Draggable?._dragging) {
        (L as any).Draggable._dragging = null;
      }
    };
  }, [
    activeTool,
    markerColor,
    markerWidth,
    markerOpacity,
    markerArrowEnd,
    onAddRoadPoint,
    onAddTurnPoint,
    onAddPinAt,
    onOpenPanoramaAt,
    onAddMarkerStroke,
    onDeselectAll,
  ]);

  // Render Drawing In-Progress Feedback
  useEffect(() => {
    const layer = drawingLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    // Road in progress
    if (drawingRoadPoints.length > 0) {
      const latlngs = drawingRoadPoints.map((p) => [p.lat, p.lng] as [number, number]);
      L.polyline(latlngs, {
        color: '#3b82f6',
        dashArray: '6, 8',
        weight: 4,
        opacity: 0.9,
      }).addTo(layer);

      drawingRoadPoints.forEach((p, idx) => {
        const isLast = idx === drawingRoadPoints.length - 1 && drawingRoadPoints.length >= 2;
        const m = L.circleMarker([p.lat, p.lng], {
          radius: isLast ? 8 : 6,
          color: '#ffffff',
          fillColor: isLast ? '#10b981' : '#3b82f6',
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip(
          isLast
            ? `Точка #${idx + 1} (кликните сюда или нажмите Готово для завершения)`
            : `Точка #${idx + 1}`,
          { permanent: false }
        );
        if (isLast) {
          m.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            onFinishDrawingRoad({
              baseLanes: newRoadLanes,
              laneWidthMeters: newRoadWidth,
            });
          });
        }
        m.addTo(layer);
      });
    }

    // Marker in progress
    if (drawingMarkerPoints.length > 0) {
      const latlngs = drawingMarkerPoints.map((p) => [p.lat, p.lng] as [number, number]);
      if (latlngs.length >= 2) {
        L.polyline(latlngs, {
          color: markerColor,
          weight: markerWidth,
          opacity: markerOpacity,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer);
      } else {
        L.circleMarker(latlngs[0], {
          radius: Math.max(4, markerWidth / 2),
          color: '#ffffff',
          fillColor: markerColor,
          fillOpacity: markerOpacity,
          weight: 2,
        }).addTo(layer);
      }
    }

    // Turn in progress
    if (drawingTurnPoints.length === 1) {
      const p = drawingTurnPoints[0];
      L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: '#10b981',
        fillColor: '#ffffff',
        fillOpacity: 1,
        weight: 3,
      })
        .bindTooltip('Начало манёвра. Кликните вторую точку для завершения.', {
          permanent: true,
          direction: 'top',
        })
        .addTo(layer);
    }
  }, [
    drawingRoadPoints,
    drawingTurnPoints,
    drawingMarkerPoints,
    markerColor,
    markerWidth,
    markerOpacity,
    newRoadLanes,
    newRoadWidth,
    onFinishDrawingRoad,
  ]);

  // Render Features: Roads, Lanes, Lane-changes, Turns, Pins
  useEffect(() => {
    const layer = featuresLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    // 1. Road Strips
    if (layerVisibility.roadStrips) {
      roadStrips.forEach((strip) => {
        for (let secIdx = 0; secIdx < strip.sections.length; secIdx++) {
          const section = strip.sections[secIdx];
          const isSelectedSec =
            strip.id === selectedStripId && secIdx === selectedSectionIndex;
          const geomMap = computeSectionLanesGeometry(strip, secIdx);

          section.lanes.forEach((lane) => {
            const geom = geomMap.get(lane.offsetIndex);
            if (!geom) return;

            let fillColor = '#60a5fa'; // normal
            const defaultOpacity = lane.status === 'best' ? 0.6 : lane.status === 'avoid' ? 0.55 : 0.45;
            let fillOpacity = strip.opacity ?? defaultOpacity;

            if (studyMode) {
              fillColor = '#64748b'; // neutral in study mode
              fillOpacity = (strip.opacity ?? 0.45) * 0.75;
            } else if (lane.status === 'best') {
              fillColor = '#10b981'; // best green
            } else if (lane.status === 'avoid') {
              fillColor = '#ef4444'; // avoid red
            }

            const polyCoords = geom.polygon.map(
              (p) => [p.lat, p.lng] as [number, number]
            );

            const polygon = L.polygon(polyCoords, {
              color: isSelectedSec ? '#ffffff' : '#334155',
              weight: isSelectedSec ? 2 : 1,
              fillColor,
              fillOpacity,
              className: 'lane-polygon',
            });

            polygon.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              onSelectSection(strip.id, secIdx);
            });

            polygon.bindTooltip(
              `<b>${strip.name || 'Улица'}</b><br/>Секция ${secIdx + 1}, Полоса ${
                section.lanes.findIndex((l) => l.offsetIndex === lane.offsetIndex) + 1
              } (${
                lane.status === 'best'
                  ? '🟢 Лучшая'
                  : lane.status === 'avoid'
                  ? '🔴 Избегать'
                  : '🔵 Обычная'
              })${section.note ? `<br/><i>Совет: ${section.note}</i>` : ''}`,
              { sticky: true }
            );

            polygon.addTo(layer);

            // Lane Divider Dashed Line (left edge of lane)
            const leftEdge = geom.leftEdge.map(
              (p) => [p.lat, p.lng] as [number, number]
            );
            L.polyline(leftEdge, {
              color: '#ffffff',
              weight: 1.5,
              dashArray: '3, 5',
              opacity: 0.7,
            }).addTo(layer);
          });

          // Lane Change Arrows
          if (layerVisibility.laneChanges) {
            section.laneChanges.forEach((arrow) => {
              const pts = computeLaneChangePoints(strip, secIdx, arrow);
              if (!pts) return;

              const curveLatLngs = pts.curve.map(
                (p) => [p.lat, p.lng] as [number, number]
              );
              L.polyline(curveLatLngs, {
                color: '#ffffff',
                weight: 4,
                opacity: 0.95,
              }).addTo(layer);

              const headLatLngs = pts.headPolygon.map(
                (p) => [p.lat, p.lng] as [number, number]
              );
              L.polygon(headLatLngs, {
                color: '#ffffff',
                fillColor: '#ffffff',
                fillOpacity: 1,
                weight: 1,
              }).addTo(layer);
            });
          }
        }

        // Draggable vertex handles & center move handle when road is selected
        if (strip.id === selectedStripId) {
          strip.points.forEach((pt, ptIdx) => {
            const vIcon = L.divIcon({
              className: 'custom-vertex-handle',
              html: `<div class="vertex-handle-dot" title="Вершина #${ptIdx + 1}. Перетащите для изменения формы"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });
            const vMarker = L.marker([pt.lat, pt.lng], {
              icon: vIcon,
              draggable: true,
            });

            vMarker.on('dragend', (e: any) => {
              const p = e.target.getLatLng();
              onUpdateRoadPoint(strip.id, ptIdx, { lat: p.lat, lng: p.lng });
            });

            vMarker.addTo(layer);
          });

          // Center move handle (✥)
          if (strip.points.length > 0) {
            const avgLat = strip.points.reduce((acc, p) => acc + p.lat, 0) / strip.points.length;
            const avgLng = strip.points.reduce((acc, p) => acc + p.lng, 0) / strip.points.length;
            const moveIcon = L.divIcon({
              className: 'custom-move-handle',
              html: '<div class="move-handle-badge" title="Перетащите, чтобы сдвинуть дорогу целиком">✥</div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });
            const moveMarker = L.marker([avgLat, avgLng], {
              icon: moveIcon,
              draggable: true,
            });
            const startLatLng = L.latLng(avgLat, avgLng);
            moveMarker.on('dragend', (e: any) => {
              const cur = e.target.getLatLng();
              const dLat = cur.lat - startLatLng.lat;
              const dLng = cur.lng - startLatLng.lng;
              onMoveRoadStrip(strip.id, dLat, dLng);
            });
            moveMarker.addTo(layer);
          }
        }
      });
    }

    // 2. Turn Trajectories
    if (layerVisibility.turnTrajectories) {
      turnTrajectories.forEach((turn) => {
        const isSelected = turn.id === selectedTurnId;
        const scale = turn.scale ?? 1;
        const pts = sampleQuadraticBezier(turn.start, turn.control, turn.end, 28);
        const curveCoords = pts.map((p) => [p.lat, p.lng] as [number, number]);

        const color =
          turn.status === 'best'
            ? '#10b981'
            : turn.status === 'caution'
            ? '#f59e0b'
            : '#ef4444';

        const turnZoomFactor = Math.max(0.35, Math.min(2.5, Math.pow(1.35, currentZoom - 18)));
        const effectiveTurnWeight = Math.max(2, Math.min(30, Math.round((isSelected ? 6 : 4) * scale * turnZoomFactor)));

        const polyline = L.polyline(curveCoords, {
          color,
          weight: effectiveTurnWeight,
          opacity: 0.9,
          dashArray: turn.kind === 'uturn' ? '8, 6' : undefined,
        });

        polyline.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectTurn(turn.id);
        });

        polyline.bindTooltip(
          `<b>${turn.title || 'Манёвр'}</b><br/>${turn.note || ''}`,
          { sticky: true }
        );

        polyline.addTo(layer);

        // Arrow Head at the end of the turn
        if (pts.length >= 2) {
          const headPts = computeArrowHead(
            pts[pts.length - 2],
            pts[pts.length - 1],
            2.8 * scale * turnZoomFactor
          );
          L.polygon(
            headPts.map((p) => [p.lat, p.lng] as [number, number]),
            {
              color,
              fillColor: color,
              fillOpacity: 1,
              weight: 1,
            }
          ).addTo(layer);
        }

        // Draggable handles for start, control, and end points when selected
        if (isSelected) {
          const createPointDragHandle = (
            pt: LatLngPoint,
            label: string,
            onUpdate: (newPt: LatLngPoint) => void
          ) => {
            const hIcon = L.divIcon({
              className: 'custom-turn-handle',
              html: `<div class="turn-handle-dot" style="background:${color};" title="${label} (перетащите)"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });
            const hMarker = L.marker([pt.lat, pt.lng], {
              icon: hIcon,
              draggable: true,
            });

            hMarker.on('dragend', (e: any) => {
              const p = e.target.getLatLng();
              onUpdate({ lat: p.lat, lng: p.lng });
            });

            hMarker.addTo(layer);
          };

          createPointDragHandle(turn.start, 'Начало манёвра', (newPt) =>
            onUpdateTurnPoints(turn.id, { start: newPt })
          );
          createPointDragHandle(turn.control, 'Точка изгиба траектории', (newPt) =>
            onUpdateTurnPoints(turn.id, { control: newPt })
          );
          createPointDragHandle(turn.end, 'Конец манёвра', (newPt) =>
            onUpdateTurnPoints(turn.id, { end: newPt })
          );

          // Center move handle (✥) for whole turn
          const midLat = (turn.start.lat + turn.control.lat + turn.end.lat) / 3;
          const midLng = (turn.start.lng + turn.control.lng + turn.end.lng) / 3;
          const moveIcon = L.divIcon({
            className: 'custom-move-handle',
            html: '<div class="move-handle-badge" title="Перетащите, чтобы сдвинуть манёвр целиком">✥</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });
          const moveMarker = L.marker([midLat, midLng], {
            icon: moveIcon,
            draggable: true,
          });
          const startLatLng = L.latLng(midLat, midLng);
          moveMarker.on('dragend', (e: any) => {
            const cur = e.target.getLatLng();
            const dLat = cur.lat - startLatLng.lat;
            const dLng = cur.lng - startLatLng.lng;
            onMoveTurn(turn.id, dLat, dLng);
          });
          moveMarker.addTo(layer);
        } else {
          // Subtle control point indicator when not selected
          const controlMarker = L.circleMarker([turn.control.lat, turn.control.lng], {
            radius: 4,
            color: '#ffffff',
            fillColor: color,
            fillOpacity: 0.8,
            weight: 1.5,
          });
          controlMarker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectTurn(turn.id);
          });
          controlMarker.addTo(layer);
        }
      });
    }

    // 3. Marker Strokes (Highlighter tool)
    if (layerVisibility.markerStrokes) {
      markerStrokes.forEach((stroke) => {
        const isSelected = stroke.id === selectedMarkerId;
        const latlngs = stroke.points.map((p) => [p.lat, p.lng] as [number, number]);
        if (latlngs.length < 2) return;

        // Scale stroke geographically with map zoom level (doubles every zoom level, matching road lanes)
        const zoomWidthFactor = Math.pow(2, currentZoom - 18);
        const effectiveWeight = Math.max(2, Math.min(120, Math.round(stroke.width * (isSelected ? 1.25 : 1) * zoomWidthFactor)));

        const polyline = L.polyline(latlngs, {
          color: stroke.color,
          weight: effectiveWeight,
          opacity: stroke.opacity,
          dashArray: stroke.dashed ? '8, 8' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        });

        polyline.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectMarker(stroke.id);
        });

        if (stroke.title || stroke.note) {
          polyline.bindTooltip(
            `<b>${stroke.title || 'Маркер'}</b>${stroke.note ? `<br/>${stroke.note}` : ''}`,
            { sticky: true }
          );
        }

        polyline.addTo(layer);

        // Arrow head if configured (scaled with zoom)
        if (stroke.arrowEnd && stroke.points.length >= 2) {
          const pPrev = stroke.points[stroke.points.length - 2];
          const pLast = stroke.points[stroke.points.length - 1];
          const arrowMeters = Math.max(1.5, Math.min(60, stroke.width * 0.4 * zoomWidthFactor));
          const headPts = computeArrowHead(pPrev, pLast, arrowMeters);
          L.polygon(
            headPts.map((p) => [p.lat, p.lng] as [number, number]),
            {
              color: stroke.color,
              fillColor: stroke.color,
              fillOpacity: stroke.opacity,
              weight: 1,
            }
          ).addTo(layer);
        }

        // Handles for selected marker stroke
        if (isSelected) {
          // Draggable handles on start, middle, and end
          const handleIndices = [0, Math.floor(stroke.points.length / 2), stroke.points.length - 1];
          const uniqueIndices = Array.from(new Set(handleIndices));

          uniqueIndices.forEach((idx) => {
            const pt = stroke.points[idx];
            const hIcon = L.divIcon({
              className: 'custom-marker-handle',
              html: `<div class="marker-handle-dot" style="background:${stroke.color};" title="${
                idx === 0 ? 'Начало линии' : idx === stroke.points.length - 1 ? 'Конец линии' : 'Точка линии'
              } (перетащите)"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });
            const hMarker = L.marker([pt.lat, pt.lng], {
              icon: hIcon,
              draggable: true,
            });

            hMarker.on('dragend', (e: any) => {
              const p = e.target.getLatLng();
              onUpdateMarkerPoint(stroke.id, idx, { lat: p.lat, lng: p.lng });
            });

            hMarker.addTo(layer);
          });

          // Center move handle (✥)
          const avgLat = stroke.points.reduce((acc, p) => acc + p.lat, 0) / stroke.points.length;
          const avgLng = stroke.points.reduce((acc, p) => acc + p.lng, 0) / stroke.points.length;
          const moveIcon = L.divIcon({
            className: 'custom-move-handle',
            html: '<div class="move-handle-badge" title="Перетащите, чтобы сдвинуть маркер целиком">✥</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });
          const moveMarker = L.marker([avgLat, avgLng], {
            icon: moveIcon,
            draggable: true,
          });
          const startLatLng = L.latLng(avgLat, avgLng);
          moveMarker.on('dragend', (e: any) => {
            const cur = e.target.getLatLng();
            const dLat = cur.lat - startLatLng.lat;
            const dLng = cur.lng - startLatLng.lng;
            onMoveMarkerStroke(stroke.id, dLat, dLng);
          });
          moveMarker.addTo(layer);
        }
      });
    }

    // 4. Exam Pins
    pins.forEach((pin) => {
      const isVisible =
        (pin.category === 'gibdd' && true) ||
        (pin.category === 'uturn' && layerVisibility.pinsUturn) ||
        ((pin.category === 'stop_allowed' || pin.category === 'stop_forbidden') &&
          layerVisibility.pinsStop) ||
        (pin.category === 'trap' && layerVisibility.pinsTrap) ||
        (pin.category === 'speed' && layerVisibility.pinsSpeed);

      if (!isVisible) return;

      const isSelected = pin.id === selectedPinId;
      // Proportional zoom factor: smoothly scales badges down when zooming out and up when zooming in
      const zoomFactor = Math.max(0.35, Math.min(1.4, Math.pow(1.3, currentZoom - 18)));
      const scale = (pin.scale ?? 1) * (isSelected ? 1.25 : 1) * zoomFactor;
      const emoji = PIN_ICONS[pin.category] || '📍';
      const basePx = Math.max(14, Math.round(32 * zoomFactor));
      const anchorPx = Math.round(basePx / 2);

      const customIcon = L.divIcon({
        className: 'custom-exam-pin',
        html: `<div class="pin-badge pin-${pin.category}" style="transform: scale(${scale}); ${
          isSelected ? 'box-shadow: 0 0 16px #38bdf8;' : ''
        }">${emoji}</div>`,
        iconSize: [basePx, basePx],
        iconAnchor: [anchorPx, anchorPx],
      });

      const marker = L.marker([pin.position.lat, pin.position.lng], {
        icon: customIcon,
        draggable: true,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectPin(pin.id);
      });

      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        onUpdatePinPosition(pin.id, { lat: pos.lat, lng: pos.lng });
      });

      marker.bindTooltip(
        `<b>${pin.title}</b><br/>${pin.note || 'Нажмите для просмотра панорамы (или перетащите для перемещения)'}`,
        { direction: 'top', offset: [0, -16] }
      );

      marker.addTo(layer);
    });
  }, [
    roadStrips,
    turnTrajectories,
    markerStrokes,
    pins,
    layerVisibility,
    studyMode,
    selectedStripId,
    selectedSectionIndex,
    selectedTurnId,
    selectedMarkerId,
    selectedPinId,
    onSelectSection,
    onSelectTurn,
    onSelectMarker,
    onSelectPin,
    onUpdateRoadPoint,
    onMoveRoadStrip,
    onUpdateTurnPoints,
    onMoveTurn,
    onUpdatePinPosition,
    onMoveMarkerStroke,
    onUpdateMarkerPoint,
    currentZoom,
  ]);

  return (
    <div className="map-container">
      {/* Yandex Maps JS API 3.0 Vector Canvas (vmap3 with HD road markings) */}
      <div
        ref={ymaps3ContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          opacity: baseMap === 'scheme' && v3Status === 'ready' ? 1 : 0,
          visibility: baseMap === 'scheme' && v3Status === 'ready' ? 'visible' : 'hidden',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Interactive Leaflet Overlay */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          background: 'transparent',
        }}
      />

      {/* Vector Road Markings Status Badge */}
      {baseMap === 'scheme' && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            zIndex: 800,
            background: 'rgba(18, 21, 28, 0.92)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {v3Status === 'ready' && (
            <>
              <span style={{ color: '#10b981', fontWeight: 600 }}>
                🟢 Разметка Яндекс 3.0 активна
              </span>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  marginLeft: 8,
                  paddingLeft: 10,
                  borderLeft: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                }}
                title="Скрыть заправки, магазины, кафе и памятники, оставив остановки, светофоры, переходы и трамвайные линии"
              >
                <input
                  type="checkbox"
                  checked={cleanPoiMode}
                  onChange={(e) => setCleanPoiMode(e.target.checked)}
                />
                <span>Без магазинов/АЗС</span>
              </label>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  marginLeft: 6,
                  paddingLeft: 10,
                  borderLeft: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                }}
                title="Усилить контрастность дорожного полотна (road_surface) и линий разметки (road_marking)"
              >
                <input
                  type="checkbox"
                  checked={contrastMarkings}
                  onChange={(e) => setContrastMarkings(e.target.checked)}
                />
                <span>Контрастная разметка (road_marking)</span>
              </label>
            </>
          )}
          {v3Status === 'loading' && (
            <span style={{ color: '#60a5fa' }}>
              ⏳ Загрузка векторной разметки Яндекс 3.0...
            </span>
          )}
          {v3Status === 'none' && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>
                ℹ️ Включена базовая схема (без разметки полос).
              </span>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="btn btn-primary btn-sm"
                >
                  Вставить ключ Яндекс 3.0 для разметки
                </button>
              )}
            </>
          )}
          {v3Status === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#f59e0b' }}>
                ⏳ <b>Ответ Яндекс API:</b> {v3ErrorDetails || 'Активация на серверах...'} (автопроверка через 15 сек)
              </span>
              <button
                onClick={() => setRetryTrigger((r) => r + 1)}
                className="btn btn-primary btn-sm"
                title="Отправить повторный запрос к серверам Яндекса прямо сейчас"
              >
                🔄 Проверить сейчас
              </button>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="btn btn-secondary btn-sm"
                >
                  Настройки ключа
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* In-progress drawing banner */}
      {activeTool === 'draw_road' && (
        <div className="drawing-banner" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>
            🛣️ <b>Рисование дороги</b> ({drawingRoadPoints.length} точек):
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Полос:</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                className={`btn btn-sm ${newRoadLanes === n ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '2px 8px' }}
                onClick={() => setNewRoadLanes(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ширина:</span>
            {[1.5, 2.0, 2.8].map((w) => (
              <button
                key={w}
                type="button"
                className={`btn btn-sm ${newRoadWidth === w ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '2px 8px' }}
                onClick={() => setNewRoadWidth(w)}
              >
                {w}м
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onCreateTemplateRoadAt(center, newRoadLanes, newRoadWidth)}
            title="Создать готовый отрезок улицы прямо по центру карты"
          >
            ➕ Шаблон в центре
          </button>
          {drawingRoadPoints.length >= 2 && (
            <button
              onClick={() =>
                onFinishDrawingRoad({
                  baseLanes: newRoadLanes,
                  laneWidthMeters: newRoadWidth,
                })
              }
              className="btn btn-primary btn-sm"
            >
              ✅ Завершить дорогу (Enter)
            </button>
          )}
          <button
            onClick={onCancelDrawing}
            className="btn btn-secondary btn-sm"
          >
            Отмена (Esc)
          </button>
        </div>
      )}

      {activeTool === 'draw_marker' && (
        <div className="drawing-banner" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>
            🖍️ <b>Маркер:</b> зажмите левую кнопку мыши и рисуйте по карте (или кликайте по точкам).
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {MARKER_COLOR_PALETTE.map((item) => (
              <button
                key={item.color}
                type="button"
                onClick={() => setMarkerColor(item.color)}
                title={item.label}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: item.color,
                  border: markerColor === item.color ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Толщина:</span>
            {[6, 10, 16, 24].map((w) => (
              <button
                key={w}
                type="button"
                className={`btn btn-sm ${markerWidth === w ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '2px 7px' }}
                onClick={() => setMarkerWidth(w)}
              >
                {w}px
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={markerArrowEnd}
              onChange={(e) => setMarkerArrowEnd(e.target.checked)}
            />
            <span>Стрелка на конце</span>
          </label>
          {drawingMarkerPoints.length >= 2 && (
            <button
              onClick={() => {
                onAddMarkerStroke({
                  points: drawingMarkerPoints,
                  color: markerColor,
                  width: markerWidth,
                  opacity: markerOpacity,
                  arrowEnd: markerArrowEnd,
                });
                setDrawingMarkerPoints([]);
              }}
              className="btn btn-primary btn-sm"
            >
              ✅ Готово
            </button>
          )}
          <button
            onClick={() => {
              setDrawingMarkerPoints([]);
              onCancelDrawing();
            }}
            className="btn btn-secondary btn-sm"
          >
            Отмена (Esc)
          </button>
        </div>
      )}

      {activeTool === 'draw_turn' && (
        <div className="drawing-banner" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>
            {drawingTurnPoints.length === 0
              ? 'Кликните точку начала манёвра на дороге'
              : 'Кликните точку завершения манёвра (в целевой полосе)'}
          </span>
          <button
            onClick={onCancelDrawing}
            className="btn btn-secondary btn-sm"
          >
            Отмена (Esc)
          </button>
        </div>
      )}

      {activeTool === 'add_pin' && (
        <div className="drawing-banner" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>Кликните на карту, чтобы установить экзаменационную метку</span>
          <button
            type="button"
            onClick={handleImportOsmSigns}
            disabled={isImportingOsm}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Автоматически найти и расставить дорожные знаки (уступи дорогу, стоп, светофоры, камеры) в видимой области через OpenStreetMap"
          >
            {isImportingOsm ? '⏳ Поиск в OpenStreetMap...' : '📥 Загрузить знаки из OpenStreetMap'}
          </button>
          {osmImportMessage && (
            <span style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 500 }}>
              {osmImportMessage}
            </span>
          )}
          <button
            onClick={onCancelDrawing}
            className="btn btn-secondary btn-sm"
          >
            Отмена (Esc)
          </button>
        </div>
      )}

      {activeTool === 'panorama' && (
        <div className="drawing-banner" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Кликните на дорогу, чтобы открыть панораму и дорожные знаки</span>
          <button
            onClick={onCancelDrawing}
            className="btn btn-secondary btn-sm"
          >
            Отмена (Esc)
          </button>
        </div>
      )}
    </div>
  );
};
