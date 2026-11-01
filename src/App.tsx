import React, { useEffect, useState } from 'react';
import {
  ActiveTool,
  BaseMapType,
  ExamPin,
  LatLngPoint,
  LayerVisibility,
  MapBookmark,
  MapHelperData,
  MarkerStroke,
  RoadSection,
  RoadStrip,
  TurnTrajectory,
} from './types';
import { DEFAULT_CENTER, DEFAULT_ZOOM, INITIAL_DATA } from './defaultData';
import {
  cloneSectionForSplit,
  createDefaultSection,
  interpolateLatLng,
} from './geometry';
import { Toolbar } from './components/Toolbar';
import { MapView } from './components/MapView';
import { RoadEditorPanel } from './components/RoadEditorPanel';
import { TurnEditorPanel } from './components/TurnEditorPanel';
import { PinEditorPanel } from './components/PinEditorPanel';
import { MarkerEditorPanel } from './components/MarkerEditorPanel';
import { PanoramaPanel } from './components/PanoramaPanel';
import { SettingsModal } from './components/SettingsModal';
import { CitySelectModal } from './components/CitySelectModal';
import { SMOLENSK_DEMO_PRESET } from './defaultData';

const STORAGE_KEY = 'maphelper_data_v1';

export const App: React.FC = () => {
  const [data, setData] = useState<MapHelperData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load saved data', e);
    }
    return INITIAL_DATA;
  });

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [baseMap, setBaseMap] = useState<BaseMapType>('scheme');
  const [studyMode, setStudyMode] = useState<boolean>(false);
  const [mapCenter, setMapCenter] = useState<LatLngPoint>(() => data.initialCenter || DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(DEFAULT_ZOOM);
  const [isCityModalOpen, setIsCityModalOpen] = useState<boolean>(false);
  const [osmTrigger, setOsmTrigger] = useState<number>(0);
  const [isImportingOsm, setIsImportingOsm] = useState<boolean>(false);

  // Layer Visibility
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    roadStrips: true,
    laneChanges: true,
    turnTrajectories: true,
    markerStrokes: true,
    pinsUturn: true,
    pinsStop: true,
    pinsTrap: true,
    pinsSpeed: true,
  });

  // Selections
  const [selectedStripId, setSelectedStripId] = useState<string | null>(null);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // In-progress Drawing State
  const [drawingRoadPoints, setDrawingRoadPoints] = useState<LatLngPoint[]>([]);
  const [drawingTurnPoints, setDrawingTurnPoints] = useState<LatLngPoint[]>([]);

  // Panorama Panel
  const [panoramaPoint, setPanoramaPoint] = useState<LatLngPoint | null>(null);
  const [panoramaHeading, setPanoramaHeading] = useState<number>(260);

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to persist MapHelper data', e);
    }
  }, [data]);

  // Keyboard shortcut Esc to reset active tool to select
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool('select');
        setDrawingRoadPoints([]);
        setDrawingTurnPoints([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Selection Handlers
  const handleSelectSection = (stripId: string, sectionIndex: number) => {
    setSelectedStripId(stripId);
    setSelectedSectionIndex(sectionIndex);
    setSelectedTurnId(null);
    setSelectedMarkerId(null);
    setSelectedPinId(null);
  };

  const handleSelectTurn = (turnId: string) => {
    setSelectedTurnId(turnId);
    setSelectedStripId(null);
    setSelectedSectionIndex(null);
    setSelectedMarkerId(null);
    setSelectedPinId(null);
  };

  const handleSelectMarker = (markerId: string) => {
    setSelectedMarkerId(markerId);
    setSelectedStripId(null);
    setSelectedSectionIndex(null);
    setSelectedTurnId(null);
    setSelectedPinId(null);
  };

  const handleSelectPin = (pinId: string) => {
    setSelectedPinId(pinId);
    setSelectedStripId(null);
    setSelectedSectionIndex(null);
    setSelectedTurnId(null);
    setSelectedMarkerId(null);
  };

  const handleCloseSidebar = () => {
    setSelectedStripId(null);
    setSelectedSectionIndex(null);
    setSelectedTurnId(null);
    setSelectedMarkerId(null);
    setSelectedPinId(null);
  };

  // Drawing Road Strip
  const handleAddRoadPoint = (pt: LatLngPoint) => {
    setDrawingRoadPoints((prev) => [...prev, pt]);
  };

  const handleFinishDrawingRoad = (options?: { baseLanes?: number; laneWidthMeters?: number }) => {
    if (drawingRoadPoints.length < 2) return;
    const baseLanes = options?.baseLanes ?? 2;
    const laneWidthMeters = options?.laneWidthMeters ?? 2.0;
    const sections: RoadSection[] = [];
    for (let i = 0; i < drawingRoadPoints.length - 1; i++) {
      sections.push(createDefaultSection(baseLanes));
    }

    const newStrip: RoadStrip = {
      id: crypto.randomUUID(),
      name: 'Участок улицы',
      points: drawingRoadPoints,
      baseLanes,
      laneWidthMeters,
      sections,
    };

    setData((prev) => ({
      ...prev,
      roadStrips: [...prev.roadStrips, newStrip],
    }));

    setDrawingRoadPoints([]);
    setActiveTool('select');
    setSelectedStripId(newStrip.id);
    setSelectedSectionIndex(0);
  };

  const handleCreateTemplateRoadAt = (
    center: LatLngPoint,
    baseLanes: number = 2,
    laneWidthMeters: number = 2.0
  ) => {
    const dLat = 0.0006;
    const p0: LatLngPoint = { lat: center.lat - dLat / 2, lng: center.lng - 0.0005 };
    const p1: LatLngPoint = { lat: center.lat + dLat / 2, lng: center.lng + 0.0005 };
    const sections: RoadSection[] = [createDefaultSection(baseLanes)];
    const newStrip: RoadStrip = {
      id: crypto.randomUUID(),
      name: 'Новый участок дороги',
      points: [p0, p1],
      baseLanes,
      laneWidthMeters,
      sections,
    };
    setData((prev) => ({
      ...prev,
      roadStrips: [...prev.roadStrips, newStrip],
    }));
    setActiveTool('select');
    setSelectedStripId(newStrip.id);
    setSelectedSectionIndex(0);
  };

  const handleUpdateRoadPoint = (stripId: string, pointIndex: number, newPt: LatLngPoint) => {
    setData((prev) => ({
      ...prev,
      roadStrips: prev.roadStrips.map((s) => {
        if (s.id !== stripId) return s;
        const newPoints = [...s.points];
        newPoints[pointIndex] = newPt;
        return { ...s, points: newPoints };
      }),
    }));
  };

  const handleMoveRoadStrip = (stripId: string, dLat: number, dLng: number) => {
    setData((prev) => ({
      ...prev,
      roadStrips: prev.roadStrips.map((s) => {
        if (s.id !== stripId) return s;
        return {
          ...s,
          points: s.points.map((p) => ({ lat: p.lat + dLat, lng: p.lng + dLng })),
        };
      }),
    }));
  };

  // Splitting Road Section
  const handleSplitSection = (sectionIndex: number) => {
    if (!selectedStripId) return;
    const targetStrip = data.roadStrips.find((s) => s.id === selectedStripId);
    if (!targetStrip) return;

    const p0 = targetStrip.points[sectionIndex];
    const p1 = targetStrip.points[sectionIndex + 1];
    const midPoint: LatLngPoint = {
      lat: (p0.lat + p1.lat) / 2,
      lng: (p0.lng + p1.lng) / 2,
    };

    const newPoints = [
      ...targetStrip.points.slice(0, sectionIndex + 1),
      midPoint,
      ...targetStrip.points.slice(sectionIndex + 1),
    ];

    const currentSec = targetStrip.sections[sectionIndex];
    const clonedSec = cloneSectionForSplit(currentSec);

    const newSections = [
      ...targetStrip.sections.slice(0, sectionIndex + 1),
      clonedSec,
      ...targetStrip.sections.slice(sectionIndex + 1),
    ];

    const updatedStrip: RoadStrip = {
      ...targetStrip,
      points: newPoints,
      sections: newSections,
    };

    setData((prev) => ({
      ...prev,
      roadStrips: prev.roadStrips.map((s) =>
        s.id === targetStrip.id ? updatedStrip : s
      ),
    }));
  };

  // Drawing Turn Trajectory
  const handleAddTurnPoint = (pt: LatLngPoint) => {
    if (drawingTurnPoints.length === 0) {
      setDrawingTurnPoints([pt]);
    } else {
      const start = drawingTurnPoints[0];
      const end = pt;
      // Default control point: perpendicular curve midpoint
      const mid = interpolateLatLng(start, end, 0.5);
      const dx = end.lat - start.lat;
      const dy = end.lng - start.lng;
      const control: LatLngPoint = {
        lat: mid.lat - dy * 0.4,
        lng: mid.lng + dx * 0.4,
      };

      const newTurn: TurnTrajectory = {
        id: crypto.randomUUID(),
        kind: 'uturn',
        status: 'best',
        start,
        control,
        end,
        title: 'Разворот',
        note: 'Рекомендуемое место для разворота. Убедитесь в отсутствии помех.',
      };

      setData((prev) => ({
        ...prev,
        turnTrajectories: [...prev.turnTrajectories, newTurn],
      }));

      setDrawingTurnPoints([]);
      setActiveTool('select');
      setSelectedTurnId(newTurn.id);
    }
  };

  // Placing Pins
  const handleAddPinAt = (pt: LatLngPoint) => {
    const newPin: ExamPin = {
      id: crypto.randomUUID(),
      category: 'uturn',
      position: pt,
      heading: 0,
      title: 'Место для разворота',
      note: 'Ориентируйтесь по разметке и видимости дороги.',
    };

    setData((prev) => ({
      ...prev,
      pins: [...prev.pins, newPin],
    }));

    setActiveTool('select');
    setSelectedPinId(newPin.id);
  };

  // Panorama Picker
  const handleOpenPanoramaAt = (pt: LatLngPoint) => {
    setPanoramaPoint(pt);
  };

  const handleOpenPinPanorama = (pin: ExamPin) => {
    setPanoramaPoint(pin.position);
    setPanoramaHeading(pin.heading);
  };

  // Turn update and move handlers
  const handleUpdateTurnPoints = (
    turnId: string,
    patch: Partial<Pick<TurnTrajectory, 'start' | 'control' | 'end'>>
  ) => {
    setData((prev) => ({
      ...prev,
      turnTrajectories: prev.turnTrajectories.map((t) =>
        t.id === turnId ? { ...t, ...patch } : t
      ),
    }));
  };

  const handleMoveTurn = (turnId: string, dLat: number, dLng: number) => {
    setData((prev) => ({
      ...prev,
      turnTrajectories: prev.turnTrajectories.map((t) => {
        if (t.id !== turnId) return t;
        return {
          ...t,
          start: { lat: t.start.lat + dLat, lng: t.start.lng + dLng },
          control: { lat: t.control.lat + dLat, lng: t.control.lng + dLng },
          end: { lat: t.end.lat + dLat, lng: t.end.lng + dLng },
        };
      }),
    }));
  };

  // Pin move handler
  const handleUpdatePinPosition = (pinId: string, newPt: LatLngPoint) => {
    setData((prev) => ({
      ...prev,
      pins: prev.pins.map((p) => (p.id === pinId ? { ...p, position: newPt } : p)),
    }));
  };

  // Marker stroke handlers
  const handleAddMarkerStroke = (stroke: Omit<MarkerStroke, 'id'>) => {
    const newMarker: MarkerStroke = {
      ...stroke,
      id: crypto.randomUUID(),
    };
    setData((prev) => ({
      ...prev,
      markerStrokes: [...(prev.markerStrokes || []), newMarker],
    }));
    setSelectedMarkerId(newMarker.id);
  };

  const handleMoveMarkerStroke = (markerId: string, dLat: number, dLng: number) => {
    setData((prev) => ({
      ...prev,
      markerStrokes: (prev.markerStrokes || []).map((m) => {
        if (m.id !== markerId) return m;
        return {
          ...m,
          points: m.points.map((p) => ({ lat: p.lat + dLat, lng: p.lng + dLng })),
        };
      }),
    }));
  };

  const handleUpdateMarkerPoint = (markerId: string, pointIndex: number, newPt: LatLngPoint) => {
    setData((prev) => ({
      ...prev,
      markerStrokes: (prev.markerStrokes || []).map((m) => {
        if (m.id !== markerId) return m;
        const pts = [...m.points];
        pts[pointIndex] = newPt;
        return { ...m, points: pts };
      }),
    }));
  };

  // Bookmarks
  const handleSelectBookmark = (bm: MapBookmark) => {
    setMapCenter(bm.center);
    setMapZoom(bm.zoom);
  };

  const handleAddBookmark = () => {
    const title = window.prompt('Введите название для этой закладки:');
    if (!title?.trim()) return;
    const newBm: MapBookmark = {
      id: crypto.randomUUID(),
      title: title.trim(),
      center: mapCenter,
      zoom: mapZoom,
    };
    setData((prev) => ({
      ...prev,
      bookmarks: [...prev.bookmarks, newBm],
    }));
  };

  // JSON Export / Import
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maphelper_exam_routes_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && Array.isArray(parsed.roadStrips)) {
            setData(parsed);
            alert('Карта и маршруты успешно импортированы!');
          } else {
            alert('Неверный формат файла MapHelper.');
          }
        } catch {
          alert('Ошибка чтения JSON файла.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Reset / Clear Map Data (preserving current city and API key)
  const handleResetData = () => {
    setData((prev) => ({
      ...INITIAL_DATA,
      cityName: prev.cityName || INITIAL_DATA.cityName,
      initialCenter: prev.initialCenter || INITIAL_DATA.initialCenter,
      yandexApiKey: prev.yandexApiKey,
    }));
    setSelectedStripId(null);
    setSelectedSectionIndex(null);
    setSelectedTurnId(null);
    setSelectedMarkerId(null);
    setSelectedPinId(null);
  };

  const handleLoadSmolenskDemo = () => {
    setData((prev) => ({
      ...prev,
      cityName: SMOLENSK_DEMO_PRESET.cityName,
      initialCenter: SMOLENSK_DEMO_PRESET.center,
      pins: [...SMOLENSK_DEMO_PRESET.pins],
      bookmarks: [...SMOLENSK_DEMO_PRESET.bookmarks],
    }));
    setMapCenter(SMOLENSK_DEMO_PRESET.center);
    setMapZoom(SMOLENSK_DEMO_PRESET.zoom);
    setSelectedStripId(null);
    setSelectedSectionIndex(null);
    setSelectedTurnId(null);
    setSelectedMarkerId(null);
    setSelectedPinId(null);
  };

  const handleSelectCity = (name: string, center: LatLngPoint, zoom: number = 15) => {
    setMapCenter(center);
    setMapZoom(zoom);
    setData((prev) => ({
      ...prev,
      cityName: name,
      initialCenter: center,
    }));
  };

  const handleAddMultiplePins = (newPins: ExamPin[]) => {
    setData((prev) => ({
      ...prev,
      pins: [...prev.pins, ...newPins],
    }));
  };

  // Selected Entities
  const currentStrip = data.roadStrips.find((s) => s.id === selectedStripId);
  const currentTurn = data.turnTrajectories.find((t) => t.id === selectedTurnId);
  const currentMarker = (data.markerStrokes || []).find((m) => m.id === selectedMarkerId);
  const currentPin = data.pins.find((p) => p.id === selectedPinId);

  return (
    <div className="app-container">
      <Toolbar
        cityName={data.cityName}
        onOpenCityModal={() => setIsCityModalOpen(true)}
        activeTool={activeTool}
        onSelectTool={(tool) => {
          setActiveTool(tool);
          setDrawingRoadPoints([]);
          setDrawingTurnPoints([]);
        }}
        onImportOsmSigns={() => setOsmTrigger((t) => t + 1)}
        isImportingOsm={isImportingOsm}
        baseMap={baseMap}
        onSelectBaseMap={setBaseMap}
        studyMode={studyMode}
        onToggleStudyMode={() => setStudyMode((v) => !v)}
        bookmarks={data.bookmarks}
        onSelectBookmark={handleSelectBookmark}
        onAddBookmark={handleAddBookmark}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="main-workspace">
        {/* Floating Layer Filter Box */}
        <div className="layers-box">
          <span className="layers-title">Слои карты</span>
          <label className="layer-item">
            <input
              type="checkbox"
              checked={layerVisibility.roadStrips}
              onChange={(e) =>
                setLayerVisibility((v) => ({ ...v, roadStrips: e.target.checked }))
              }
            />
            <span>Полосы дорог</span>
          </label>
          <label className="layer-item">
            <input
              type="checkbox"
              checked={layerVisibility.laneChanges}
              onChange={(e) =>
                setLayerVisibility((v) => ({ ...v, laneChanges: e.target.checked }))
              }
            />
            <span>Стрелки перестроения</span>
          </label>
          <label className="layer-item">
            <input
              type="checkbox"
              checked={layerVisibility.turnTrajectories}
              onChange={(e) =>
                setLayerVisibility((v) => ({
                  ...v,
                  turnTrajectories: e.target.checked,
                }))
              }
            />
            <span>Траектории поворотов</span>
          </label>
          <label className="layer-item">
            <input
              type="checkbox"
              checked={layerVisibility.markerStrokes}
              onChange={(e) =>
                setLayerVisibility((v) => ({
                  ...v,
                  markerStrokes: e.target.checked,
                }))
              }
            />
            <span>Линии маркера</span>
          </label>
          <label className="layer-item">
            <input
              type="checkbox"
              checked={layerVisibility.pinsUturn}
              onChange={(e) =>
                setLayerVisibility((v) => ({ ...v, pinsUturn: e.target.checked }))
              }
            />
            <span>Места разворотов</span>
          </label>
          <label className="layer-item">
            <input
              type="checkbox"
              checked={layerVisibility.pinsStop}
              onChange={(e) =>
                setLayerVisibility((v) => ({ ...v, pinsStop: e.target.checked }))
              }
            />
            <span>Места остановок</span>
          </label>
          <label className="layer-item">
            <input
              type="checkbox"
              checked={layerVisibility.pinsTrap}
              onChange={(e) =>
                setLayerVisibility((v) => ({ ...v, pinsTrap: e.target.checked }))
              }
            />
            <span>Ловушки и знаки</span>
          </label>
        </div>

        <MapView
          center={mapCenter}
          zoom={mapZoom}
          baseMap={baseMap}
          yandexApiKey={data.yandexApiKey}
          onOpenSettings={() => setIsSettingsOpen(true)}
          roadStrips={data.roadStrips}
          turnTrajectories={data.turnTrajectories}
          markerStrokes={data.markerStrokes || []}
          pins={data.pins}
          layerVisibility={layerVisibility}
          studyMode={studyMode}
          activeTool={activeTool}
          selectedStripId={selectedStripId}
          selectedSectionIndex={selectedSectionIndex}
          selectedTurnId={selectedTurnId}
          selectedMarkerId={selectedMarkerId}
          selectedPinId={selectedPinId}
          onSelectSection={handleSelectSection}
          onSelectTurn={handleSelectTurn}
          onSelectMarker={handleSelectMarker}
          onSelectPin={handleSelectPin}
          onAddRoadPoint={handleAddRoadPoint}
          drawingRoadPoints={drawingRoadPoints}
          onFinishDrawingRoad={handleFinishDrawingRoad}
          onCreateTemplateRoadAt={handleCreateTemplateRoadAt}
          onCancelDrawing={() => {
            setActiveTool('select');
            setDrawingRoadPoints([]);
            setDrawingTurnPoints([]);
          }}
          drawingTurnPoints={drawingTurnPoints}
          onAddTurnPoint={handleAddTurnPoint}
          onAddPinAt={handleAddPinAt}
          onOpenPanoramaAt={handleOpenPanoramaAt}
          onUpdateRoadPoint={handleUpdateRoadPoint}
          onMoveRoadStrip={handleMoveRoadStrip}
          onUpdateTurnPoints={handleUpdateTurnPoints}
          onMoveTurn={handleMoveTurn}
          onUpdatePinPosition={handleUpdatePinPosition}
          onAddMarkerStroke={handleAddMarkerStroke}
          onMoveMarkerStroke={handleMoveMarkerStroke}
          onUpdateMarkerPoint={handleUpdateMarkerPoint}
          onDeselectAll={handleCloseSidebar}
          onAddMultiplePins={handleAddMultiplePins}
          osmTrigger={osmTrigger}
          onOsmLoadingChange={setIsImportingOsm}
        />

        {/* Right Editor Sidebar */}
        {currentStrip && selectedSectionIndex !== null && (
          <RoadEditorPanel
            strip={currentStrip}
            sectionIndex={selectedSectionIndex}
            onUpdateStrip={(updated) =>
              setData((prev) => ({
                ...prev,
                roadStrips: prev.roadStrips.map((s) =>
                  s.id === updated.id ? updated : s
                ),
              }))
            }
            onDeleteStrip={(id) => {
              setData((prev) => ({
                ...prev,
                roadStrips: prev.roadStrips.filter((s) => s.id !== id),
              }));
              handleCloseSidebar();
            }}
            onSplitSection={handleSplitSection}
            onClose={handleCloseSidebar}
          />
        )}

        {currentTurn && (
          <TurnEditorPanel
            turn={currentTurn}
            onUpdateTurn={(updated) =>
              setData((prev) => ({
                ...prev,
                turnTrajectories: prev.turnTrajectories.map((t) =>
                  t.id === updated.id ? updated : t
                ),
              }))
            }
            onDeleteTurn={(id) => {
              setData((prev) => ({
                ...prev,
                turnTrajectories: prev.turnTrajectories.filter((t) => t.id !== id),
              }));
              handleCloseSidebar();
            }}
            onClose={handleCloseSidebar}
          />
        )}

        {currentMarker && (
          <MarkerEditorPanel
            marker={currentMarker}
            onUpdateMarker={(updated) =>
              setData((prev) => ({
                ...prev,
                markerStrokes: (prev.markerStrokes || []).map((m) =>
                  m.id === updated.id ? updated : m
                ),
              }))
            }
            onDeleteMarker={(id) => {
              setData((prev) => ({
                ...prev,
                markerStrokes: (prev.markerStrokes || []).filter((m) => m.id !== id),
              }));
              handleCloseSidebar();
            }}
            onClose={handleCloseSidebar}
          />
        )}

        {currentPin && (
          <PinEditorPanel
            pin={currentPin}
            onUpdatePin={(updated) =>
              setData((prev) => ({
                ...prev,
                pins: prev.pins.map((p) => (p.id === updated.id ? updated : p)),
              }))
            }
            onDeletePin={(id) => {
              setData((prev) => ({
                ...prev,
                pins: prev.pins.filter((p) => p.id !== id),
              }));
              handleCloseSidebar();
            }}
            onOpenPanorama={handleOpenPinPanorama}
            onClose={handleCloseSidebar}
          />
        )}

        {/* Street Panorama Bottom Panel */}
        {panoramaPoint && (
          <PanoramaPanel
            point={panoramaPoint}
            heading={panoramaHeading}
            onHeadingChange={setPanoramaHeading}
            yandexApiKey={data.yandexApiKey}
            onClose={() => setPanoramaPoint(null)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}
      </div>

      {isSettingsOpen && (
        <SettingsModal
          apiKey={data.yandexApiKey || ''}
          onSaveApiKey={(key) =>
            setData((prev) => ({ ...prev, yandexApiKey: key }))
          }
          onResetData={handleResetData}
          onLoadSmolenskDemo={handleLoadSmolenskDemo}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isCityModalOpen && (
        <CitySelectModal
          currentCity={data.cityName}
          onSelectCity={handleSelectCity}
          onClose={() => setIsCityModalOpen(false)}
        />
      )}
    </div>
  );
};
