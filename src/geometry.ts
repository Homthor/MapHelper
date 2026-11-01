import {
  LaneChangeArrow,
  LaneConfig,
  LatLngPoint,
  RoadSection,
  RoadStrip,
} from './types';

const METERS_PER_DEG_LAT = 111320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

interface Vec2 {
  x: number; // East (meters)
  y: number; // North (meters)
}

function toLocalMeters(origin: LatLngPoint, pt: LatLngPoint): Vec2 {
  return {
    x: (pt.lng - origin.lng) * metersPerDegLng(origin.lat),
    y: (pt.lat - origin.lat) * METERS_PER_DEG_LAT,
  };
}

function fromLocalMeters(origin: LatLngPoint, v: Vec2): LatLngPoint {
  return {
    lat: origin.lat + v.y / METERS_PER_DEG_LAT,
    lng: origin.lng + v.x / metersPerDegLng(origin.lat),
  };
}

function getRightNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 1, y: 0 };
  const tx = dx / len;
  const ty = dy / len;
  // Right-hand perpendicular vector when facing from a -> b
  return { x: ty, y: -tx };
}

/**
 * Computes miter right-hand normals at each waypoint of a polyline so sections join seamlessly.
 */
function getVertexMiterNormals(localPts: Vec2[]): Vec2[] {
  const n = localPts.length;
  if (n < 2) return [{ x: 1, y: 0 }];

  const segNormals: Vec2[] = [];
  for (let i = 0; i < n - 1; i++) {
    segNormals.push(getRightNormal(localPts[i], localPts[i + 1]));
  }

  const vertexNormals: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      vertexNormals.push(segNormals[0]);
    } else if (i === n - 1) {
      vertexNormals.push(segNormals[n - 2]);
    } else {
      const n1 = segNormals[i - 1];
      const n2 = segNormals[i];
      let mx = n1.x + n2.x;
      let my = n1.y + n2.y;
      const mLen = Math.hypot(mx, my);
      if (mLen < 1e-4) {
        vertexNormals.push(n2);
      } else {
        mx /= mLen;
        my /= mLen;
        const dot = mx * n2.x + my * n2.y;
        const scale = 1 / Math.max(0.55, dot);
        vertexNormals.push({ x: mx * scale, y: my * scale });
      }
    }
  }
  return vertexNormals;
}

export function laneCenterLateralOffsetMeters(
  offsetIndex: number,
  baseLanes: number,
  laneWidthMeters: number
): number {
  return (offsetIndex - (baseLanes - 1) / 2) * laneWidthMeters;
}

export interface ComputedLaneGeometry {
  polygon: LatLngPoint[];
  centerLine: [LatLngPoint, LatLngPoint];
  leftEdge: [LatLngPoint, LatLngPoint];
  rightEdge: [LatLngPoint, LatLngPoint];
  midPoint: LatLngPoint;
  bearingDeg: number;
}

export function computeSectionLanesGeometry(
  strip: RoadStrip,
  sectionIndex: number
): Map<number, ComputedLaneGeometry> {
  const result = new Map<number, ComputedLaneGeometry>();
  if (sectionIndex < 0 || sectionIndex >= strip.points.length - 1) {
    return result;
  }

  const origin = strip.points[0];
  const localPts = strip.points.map((p) => toLocalMeters(origin, p));
  const miterNormals = getVertexMiterNormals(localPts);

  const pStart = localPts[sectionIndex];
  const pEnd = localPts[sectionIndex + 1];
  const nStart = miterNormals[sectionIndex];
  const nEnd = miterNormals[sectionIndex + 1];

  const dx = pEnd.x - pStart.x;
  const dy = pEnd.y - pStart.y;
  // Bearing in degrees (0 = North, 90 = East)
  const bearingDeg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;

  const section = strip.sections[sectionIndex];
  if (!section) return result;

  const w = strip.laneWidthMeters;

  for (const lane of section.lanes) {
    const centerOffset = laneCenterLateralOffsetMeters(
      lane.offsetIndex,
      strip.baseLanes,
      w
    );
    const leftOffset = centerOffset - w * 0.48;
    const rightOffset = centerOffset + w * 0.48;

    const startLeft = fromLocalMeters(origin, {
      x: pStart.x + nStart.x * leftOffset,
      y: pStart.y + nStart.y * leftOffset,
    });
    const startRight = fromLocalMeters(origin, {
      x: pStart.x + nStart.x * rightOffset,
      y: pStart.y + nStart.y * rightOffset,
    });
    const endRight = fromLocalMeters(origin, {
      x: pEnd.x + nEnd.x * rightOffset,
      y: pEnd.y + nEnd.y * rightOffset,
    });
    const endLeft = fromLocalMeters(origin, {
      x: pEnd.x + nEnd.x * leftOffset,
      y: pEnd.y + nEnd.y * leftOffset,
    });

    const startCenter = fromLocalMeters(origin, {
      x: pStart.x + nStart.x * centerOffset,
      y: pStart.y + nStart.y * centerOffset,
    });
    const endCenter = fromLocalMeters(origin, {
      x: pEnd.x + nEnd.x * centerOffset,
      y: pEnd.y + nEnd.y * centerOffset,
    });

    const midPoint: LatLngPoint = {
      lat: (startCenter.lat + endCenter.lat) / 2,
      lng: (startCenter.lng + endCenter.lng) / 2,
    };

    result.set(lane.offsetIndex, {
      polygon: [startLeft, startRight, endRight, endLeft],
      centerLine: [startCenter, endCenter],
      leftEdge: [startLeft, endLeft],
      rightEdge: [startRight, endRight],
      midPoint,
      bearingDeg,
    });
  }

  return result;
}

export function interpolateLatLng(
  a: LatLngPoint,
  b: LatLngPoint,
  t: number
): LatLngPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

export function computeLaneChangePoints(
  strip: RoadStrip,
  sectionIndex: number,
  arrow: LaneChangeArrow
): { curve: LatLngPoint[]; headPolygon: LatLngPoint[]; mid: LatLngPoint } | null {
  const geomMap = computeSectionLanesGeometry(strip, sectionIndex);
  const fromGeom = geomMap.get(arrow.fromOffsetIndex);
  const toGeom = geomMap.get(arrow.toOffsetIndex);
  if (!fromGeom || !toGeom) return null;

  const t0 = Math.max(0.12, Math.min(0.65, arrow.progress - 0.18));
  const t1 = Math.max(0.35, Math.min(0.88, arrow.progress + 0.18));

  const start = interpolateLatLng(fromGeom.centerLine[0], fromGeom.centerLine[1], t0);
  const end = interpolateLatLng(toGeom.centerLine[0], toGeom.centerLine[1], t1);
  const control = interpolateLatLng(
    interpolateLatLng(fromGeom.centerLine[0], fromGeom.centerLine[1], (t0 + t1) / 2),
    interpolateLatLng(toGeom.centerLine[0], toGeom.centerLine[1], (t0 + t1) / 2),
    0.55
  );

  const curve = sampleQuadraticBezier(start, control, end, 14);
  const headPolygon = computeArrowHead(
    curve[curve.length - 2],
    curve[curve.length - 1],
    1.5
  );
  const mid = curve[Math.floor(curve.length / 2)];
  return { curve, headPolygon, mid };
}

export function sampleQuadraticBezier(
  start: LatLngPoint,
  control: LatLngPoint,
  end: LatLngPoint,
  steps = 24
): LatLngPoint[] {
  const pts: LatLngPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      lat: u * u * start.lat + 2 * u * t * control.lat + t * t * end.lat,
      lng: u * u * start.lng + 2 * u * t * control.lng + t * t * end.lng,
    });
  }
  return pts;
}

export function computeArrowHead(
  fromPt: LatLngPoint,
  tipPt: LatLngPoint,
  sizeMeters = 2.4
): LatLngPoint[] {
  const v = toLocalMeters(tipPt, fromPt);
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-4) return [tipPt, tipPt, tipPt];
  const ux = v.x / len;
  const uy = v.y / len;
  const nx = -uy;
  const ny = ux;

  const backX = ux * sizeMeters;
  const backY = uy * sizeMeters;
  const wing = sizeMeters * 0.58;

  const left = fromLocalMeters(tipPt, {
    x: backX + nx * wing,
    y: backY + ny * wing,
  });
  const right = fromLocalMeters(tipPt, {
    x: backX - nx * wing,
    y: backY - ny * wing,
  });
  return [tipPt, left, right];
}

export function createDefaultSection(baseLanes: number): RoadSection {
  const lanes: LaneConfig[] = [];
  for (let i = 0; i < baseLanes; i++) {
    // Middle lane (or left-middle) defaults to 'best' if >= 2 lanes
    const isBest =
      baseLanes === 1
        ? true
        : baseLanes === 2
        ? i === 0
        : i === Math.floor(baseLanes / 2);
    lanes.push({
      offsetIndex: i,
      status: isBest ? 'best' : 'normal',
    });
  }
  return {
    id: crypto.randomUUID(),
    lanes,
    laneChanges: [],
  };
}

export function cloneSectionForSplit(sec: RoadSection): RoadSection {
  return {
    id: crypto.randomUUID(),
    lanes: sec.lanes.map((l) => ({ ...l })),
    laneChanges: [],
    note: sec.note,
  };
}
