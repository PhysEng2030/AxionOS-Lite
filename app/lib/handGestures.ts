/**
 * Hand-gesture classifier for the Tinkercad viewer.
 *
 * Input is MediaPipe's 21 normalized landmarks per hand (already mirrored).
 * The classifier is dependency-free — pure math on landmark geometry, so it
 * stays fast on Chromebook-class hardware. Output is an intent the viewer
 * maps to pan / zoom / lock actions.
 */

export interface Pt {
  x: number;
  y: number;
  z?: number;
}

export interface GestureFrame {
  /** Pinch strength 0..1 (thumb-index distance, 0 = touching). */
  pinch: number;
  /** 1 = pinch active this frame. */
  pinchActive: boolean;
  /** Open palm (4+ fingers extended) — pan/rotate intent. */
  palm: boolean;
  /** Fist (no fingers extended) — viewer lock. */
  fist: boolean;
  /** Victory ✌ (index+middle only) — reset view. */
  victory: boolean;
  /** Point ☝ (index only) — cursor / inspect. */
  point: boolean;
  /** Number of extended fingers 0..5. */
  fingers: number;
  /** Index fingertip in mirrored normalized coords. */
  cursor: { x: number; y: number };
  /** Palm center in mirrored normalized coords. */
  palmCenter: { x: number; y: number };
  /** Wrist→middle-MCP distance; the hand's own scale for normalizing. */
  handScale: number;
}

/** MediaPipe hand landmark indices. */
const TIPS = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIPS = { thumb: 3, index: 6, middle: 10, ring: 14, pinky: 18 };
const MCPS = { index: 5, middle: 9, ring: 13, pinky: 17 };
const WRIST = 0;

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Fingertip farther from wrist than its PIP joint ⇒ finger extended. */
function isExtended(tip: number, pip: number, landmarks: Pt[]): boolean {
  return (
    dist(landmarks[tip], landmarks[WRIST]) >
    dist(landmarks[pip], landmarks[WRIST]) * 1.08
  );
}

/**
 * Classify one hand's landmarks into a gesture frame.
 * `landmarks` must already be mirrored (x -> 1 - x) for the user-facing camera.
 */
export function classifyHand(landmarks: Pt[]): GestureFrame {
  const extended = {
    thumb:
      dist(landmarks[TIPS.thumb], landmarks[MCPS.index]) >
      dist(landmarks[PIPS.thumb], landmarks[MCPS.index]) * 1.12,
    index: isExtended(TIPS.index, PIPS.index, landmarks),
    middle: isExtended(TIPS.middle, PIPS.middle, landmarks),
    ring: isExtended(TIPS.ring, PIPS.ring, landmarks),
    pinky: isExtended(TIPS.pinky, PIPS.pinky, landmarks),
  };

  const fingers =
    Number(extended.index) +
    Number(extended.middle) +
    Number(extended.ring) +
    Number(extended.pinky) +
    (extended.thumb ? 1 : 0);

  // Pinch: thumb-index tip distance normalized by hand scale (wrist→middle-MCP).
  const handScale = Math.max(
    dist(landmarks[WRIST], landmarks[MCPS.middle]),
    1e-4,
  );
  const pinchDist =
    dist(landmarks[TIPS.thumb], landmarks[TIPS.index]) / handScale;
  const pinchActive = pinchDist < 0.45;
  const pinch = Math.min(1, Math.max(0, (0.55 - pinchDist) / 0.45));

  const palm = fingers >= 4;
  const fist = fingers === 0;
  const victory =
    extended.index && extended.middle && !extended.ring && !extended.pinky;
  const point =
    extended.index && !extended.middle && !extended.ring && !extended.pinky;

  // Palm center = mean of wrist + finger MCPs.
  const cx =
    (landmarks[WRIST].x +
      landmarks[MCPS.index].x +
      landmarks[MCPS.middle].x +
      landmarks[MCPS.ring].x +
      landmarks[MCPS.pinky].x) /
    5;
  const cy =
    (landmarks[WRIST].y +
      landmarks[MCPS.index].y +
      landmarks[MCPS.middle].y +
      landmarks[MCPS.ring].y +
      landmarks[MCPS.pinky].y) /
    5;

  return {
    pinch,
    pinchActive,
    palm,
    fist,
    victory,
    point,
    fingers,
    cursor: { x: landmarks[TIPS.index].x, y: landmarks[TIPS.index].y },
    palmCenter: { x: cx, y: cy },
    handScale,
  };
}

/**
 * Two-hand zoom: both palms open, hands horizontally apart → spread-to-zoom.
 * Returns separation in hand-scale units, or null when this isn't a spread.
 */
export function spreadDistance(
  a: GestureFrame,
  b: GestureFrame,
): number | null {
  if (!(a.palm && b.palm)) return null;
  return (
    Math.hypot(
      a.palmCenter.x - b.palmCenter.x,
      a.palmCenter.y - b.palmCenter.y,
    ) / Math.max((a.handScale + b.handScale) / 2, 1e-4)
  );
}
