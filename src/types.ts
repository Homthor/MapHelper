export interface LatLngPoint {
  lat: number;
  lng: number;
}

export type LaneStatus = 'best' | 'normal' | 'avoid';

export interface LaneConfig {
  offsetIndex: number; // Signed lane index relative to baseLanes (e.g. -1 = left pocket, 0..baseLanes-1 = main lanes, baseLanes = right pocket)
  status: LaneStatus;
  label?: string; // Optional short tag like "А", "Только налево", etc.
}

export interface LaneChangeArrow {
  id: string;
  fromOffsetIndex: number;
  toOffsetIndex: number;
  progress: number; // 0.2 to 0.8 along the section
  note?: string;
}

export interface RoadSection {
  id: string;
  lanes: LaneConfig[]; // Ordered from leftmost (min offsetIndex) to rightmost (max offsetIndex)
  laneChanges: LaneChangeArrow[];
  note?: string;
}

export interface RoadStrip {
  id: string;
  name: string;
  points: LatLngPoint[]; // N waypoints -> N-1 sections
  baseLanes: number; // Initial lane count used as alignment reference
  laneWidthMeters: number; // Default ~2.0m
  opacity?: number; // 0.15..0.90 (default 0.5)
  sections: RoadSection[]; // Length is always points.length - 1
}

export type TurnKind = 'uturn' | 'left' | 'right';
export type TurnStatus = 'best' | 'caution' | 'forbidden';

export interface TurnTrajectory {
  id: string;
  kind: TurnKind;
  status: TurnStatus;
  start: LatLngPoint;
  control: LatLngPoint; // Draggable Bezier control point
  end: LatLngPoint;
  scale?: number; // Line & arrow scale multiplier (0.5..2.5, default 1.0)
  title: string;
  note: string;
}

export type PinCategory =
  | 'uturn'
  | 'stop_allowed'
  | 'stop_forbidden'
  | 'trap'
  | 'speed'
  | 'gibdd';

export interface ExamPin {
  id: string;
  category: PinCategory;
  position: LatLngPoint;
  heading: number; // 0..360 degrees for Panorama view direction
  scale?: number; // Badge scale multiplier (0.5..2.0, default 1.0)
  title: string;
  note: string;
}

export interface MarkerStroke {
  id: string;
  points: LatLngPoint[];
  color: string; // Hex color e.g. '#f59e0b', '#10b981', '#ef4444', '#3b82f6'
  width: number; // Stroke width in pixels (e.g. 4..32, default 12)
  opacity: number; // 0.2..0.95 (default 0.65)
  dashed?: boolean;
  arrowEnd?: boolean;
  title?: string;
  note?: string;
}

export interface MapBookmark {
  id: string;
  title: string;
  center: LatLngPoint;
  zoom: number;
}

export interface LayerVisibility {
  roadStrips: boolean;
  laneChanges: boolean;
  turnTrajectories: boolean;
  markerStrokes: boolean;
  pinsUturn: boolean;
  pinsStop: boolean;
  pinsTrap: boolean;
  pinsSpeed: boolean;
}

export type BaseMapType = 'scheme' | 'satellite' | 'hybrid';

export type ActiveTool =
  | 'select'
  | 'draw_road'
  | 'draw_turn'
  | 'draw_marker'
  | 'add_pin'
  | 'panorama';

export interface MapHelperData {
  version: number;
  cityName?: string;
  initialCenter?: LatLngPoint;
  roadStrips: RoadStrip[];
  turnTrajectories: TurnTrajectory[];
  markerStrokes?: MarkerStroke[];
  pins: ExamPin[];
  bookmarks: MapBookmark[];
  yandexApiKey?: string;
}
