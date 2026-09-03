/**
 * Debug: call Ollama's /api/generate directly with an image payload.
 * Usage: node scripts/debug-vision.mjs [imagePath]
 */
import fs from "node:fs";

const img =
  process.argv[2] ??
  "C:/Users/Coher/OneDrive/Pictures/Screenshots 1/Screenshot 2026-09-03 102617.png";

const b64 = fs.readFileSync(img).toString("base64");
console.log("image bytes:", fs.statSync(img).size, "b64 length:", b64.length);

const t0 = Date.now();
const res = await fetch("http://127.0.0.1:11434/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model:
      "hf.co/HauhauCS/Gemma4-12B-QAT-Uncensored-HauhauCS-Balanced:Q4_K_M",
    prompt:
      'List every distinct component in this breadboard photo. Respond ONLY with {"components":[...]} JSON.',
    images: [b64],
    stream: false,
  }),
  signal: AbortSignal.timeout(180000),
});
console.log("ollama HTTP", res.status, "in", Date.now() - t0, "ms");
const data = await res.json();
console.log("response head:", (data.response ?? JSON.stringify(data)).slice(0, 300));
