"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  classifyHand,
  spreadDistance,
  type GestureFrame,
} from "../lib/handGestures";

export interface TinkThing {
  id: string;
  name: string;
  url: string;
  embedUrl: string;
}

type TrackerStatus = "off" | "starting" | "on" | "error";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/models/hand_landmarker.task";

/** Hand skeleton connections (MediaPipe landmark index pairs). */
const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function gestureLabel(g: GestureFrame | null, twoHands: boolean): string {
  if (!g) return "SHOW A HAND TO THE CAMERA";
  if (twoHands) return "SPREAD HANDS → ZOOM";
  if (g.fist) return "FIST → LOCKED";
  if (g.victory) return "✌ HOLD → RESET VIEW";
  if (g.palm) return "PALM DRAG → PAN";
  if (g.pinchActive) return "PINCH → CURSOR";
  if (g.point) return "POINT → CURSOR";
  return "TRACKING";
}

export default function GestureTinkercadViewer({ thing }: { thing: TinkThing }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);

  // Live transform lives in refs — the rAF loop mutates at 60fps; React state
  // mirrors only coarse status for the HUD.
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const prevRef = useRef<{
    palm?: { x: number; y: number };
    spread?: number;
    victorySince?: number;
  }>({});

  const [status, setStatus] = useState<TrackerStatus>("off");
  const [hud, setHud] = useState("GESTURES OFF");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const applyTransform = useCallback(() => {
    const el = stageRef.current?.querySelector<HTMLElement>(".tink-transform");
    const v = viewRef.current;
    if (el) el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
  }, []);

  const clearOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    clearOverlay();
    setStatus("off");
    setHud("GESTURES OFF");
  }, [clearOverlay]);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    setStatus("starting");
    setErrMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;

      // Hidden video element feeding MediaPipe (kept off-DOM; the visible
      // preview is drawn into the overlay canvas below).
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      videoRef.current = video;

      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      let landmarker: HandLandmarker;
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch {
        // GPU delegate is often unavailable on Chromebooks — CPU fallback.
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 2,
        });
      }
      landmarkerRef.current = landmarker;

      const stage = stageRef.current;
      let lastDetect = 0;
      runningRef.current = true;
      setStatus("on");

      const loop = () => {
        if (!runningRef.current) return;
        const video2 = videoRef.current;
        const lm = landmarkerRef.current;
        if (!video2 || !lm) return;
        const now = performance.now();
        const v = viewRef.current;
        const prev = prevRef.current;

        // Throttle inference to ~30fps; Chromebook CPUs thank us.
        if (now - lastDetect >= 33 && video2.readyState >= 2) {
          lastDetect = now;
          let result: Awaited<ReturnType<typeof lm.detectForVideo>> | undefined;
          try {
            result = lm.detectForVideo(video2, now);
          } catch {
            result = undefined;
          }

          const rawHands: NormalizedLandmark[][] = result?.landmarks ?? [];
          // Mirror x for the user-facing camera so movement feels natural.
          const hands = rawHands.slice(0, 2).map((ls) =>
            ls.map((l) => ({ x: 1 - l.x, y: l.y, z: l.z })),
          );

          drawOverlay(video2, hands);

          const stageW = stage?.clientWidth ?? 640;
          const stageH = stage?.clientHeight ?? 480;

          if (hands.length === 0) {
            prev.palm = undefined;
            prev.spread = undefined;
            prev.victorySince = undefined;
            setHud(gestureLabel(null, false));
          } else {
            const a = classifyHand(hands[0]);
            const b = hands.length > 1 ? classifyHand(hands[1]) : null;

            if (a && b) {
              // Two open palms → spread-to-zoom.
              const spread = spreadDistance(a, b);
              if (spread !== null) {
                if (prev.spread !== undefined) {
                  const factor = 1 + (spread - prev.spread) * 2.5;
                  v.scale = Math.min(3, Math.max(0.4, v.scale * factor));
                  applyTransform();
                }
                prev.spread = spread;
              }
              prev.palm = undefined;
              prev.victorySince = undefined;
              setHud(gestureLabel(a, true));
            } else if (a) {
              prev.spread = undefined;

              // ✌ held ~0.5s → reset view (then requires re-hold).
              if (a.victory) {
                if (prev.victorySince === undefined) prev.victorySince = now;
                else if (now - prev.victorySince > 500) {
                  v.x = 0;
                  v.y = 0;
                  v.scale = 1;
                  applyTransform();
                  prev.victorySince = now + 1500;
                }
              } else {
                prev.victorySince = undefined;
              }

              // Open-palm drag → pan. Fist/pinch/point freeze the transform.
              if (a.palm) {
                const sm = a.palmCenter;
                if (prev.palm) {
                  v.x += (sm.x - prev.palm.x) * stageW;
                  v.y += (sm.y - prev.palm.y) * stageH;
                  v.x = Math.min(stageW * 0.75, Math.max(-stageW * 0.75, v.x));
                  v.y = Math.min(stageH * 0.75, Math.max(-stageH * 0.75, v.y));
                  applyTransform();
                }
                prev.palm = sm;
              } else {
                prev.palm = undefined;
              }
              setHud(gestureLabel(a, false));
            }
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };

      const drawOverlay = (
        videoEl: HTMLVideoElement,
        hands: { x: number; y: number }[][],
      ) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Mirrored camera preview behind the skeleton.
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, 0, 0, w, h);
        ctx.restore();
        ctx.fillStyle = "#050c1555";
        ctx.fillRect(0, 0, w, h);

        for (const ls of hands) {
          ctx.strokeStyle = "#6fb8ff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (const [i, j] of BONES) {
            ctx.moveTo(ls[i].x * w, ls[i].y * h);
            ctx.lineTo(ls[j].x * w, ls[j].y * h);
          }
          ctx.stroke();
          ctx.fillStyle = "#75e0b0";
          for (const p of ls) {
            ctx.fillRect(p.x * w - 1.5, p.y * h - 1.5, 3, 3);
          }
          // Pinch indicator ring between thumb and index tips.
          const pinch = Math.hypot(ls[4].x - ls[8].x, ls[4].y - ls[8].y);
          if (pinch < 0.06) {
            ctx.strokeStyle = "#ffb36b";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
              ((ls[4].x + ls[8].x) / 2) * w,
              ((ls[4].y + ls[8].y) / 2) * h,
              6,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
          }
        }
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      setStatus("error");
      setErrMsg(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera permission denied — allow camera access to use gestures."
          : "Could not start hand tracking on this device.",
      );
      stop();
    }
  }, [stop, applyTransform, clearOverlay]);

  // Reset the view whenever a new Thing loads.
  useEffect(() => {
    viewRef.current = { x: 0, y: 0, scale: 1 };
    applyTransform();
  }, [thing.id, applyTransform]);

  useEffect(() => () => stop(), [stop]);

  function fullscreen() {
    void stageRef.current?.requestFullscreen?.();
  }

  function resetView() {
    viewRef.current = { x: 0, y: 0, scale: 1 };
    applyTransform();
  }

  return (
    <div className="tink-viewer">
      <div className="tink-toolbar">
        {status === "on" ? (
          <button type="button" className="tink-btn active" onClick={stop}>
            GESTURES: ON
          </button>
        ) : (
          <button
            type="button"
            className="tink-btn"
            onClick={() => void start()}
            disabled={status === "starting"}
          >
            {status === "starting" ? "STARTING…" : "ENABLE GESTURES"}
          </button>
        )}
        <button type="button" className="tink-btn" onClick={resetView}>RESET</button>
        <button type="button" className="tink-btn" onClick={fullscreen}>FULLSCREEN</button>
        <a className="tink-btn tink-link" href={thing.url} target="_blank" rel="noreferrer">
          OPEN IN TINKERCAD ↗
        </a>
      </div>
      <div className="tink-stage" ref={stageRef}>
        <div className="tink-transform">
          <iframe
            title={`Tinkercad viewer — ${thing.name}`}
            src={thing.embedUrl}
            allowFullScreen
            className="tink-frame"
            loading="lazy"
          />
        </div>
        <canvas ref={canvasRef} width={220} height={165} className="tink-overlay" />
        <div className="tink-hud" data-status={status}>{hud}</div>
      </div>
      {errMsg && <p className="tink-error">{errMsg}</p>}
      <p className="tink-help">
        Gestures: open-palm drag → pan · two-hand spread → zoom · ✌ hold → reset ·
        fist → freeze · pinch → cursor. Mouse still works — scroll the embed directly.
      </p>
    </div>
  );
}
