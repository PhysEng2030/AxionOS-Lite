/**
 * End-to-end test: breadboard image → vision analysis → Tinkercad suggestions.
 * Usage: node scripts/test-breadboard-suggest.mjs [imagePath]
 */
import fs from "node:fs";

const img =
  process.argv[2] ??
  "C:/Users/Coher/OneDrive/Pictures/Screenshots/Screenshot 2026-09-03 102344.png";

const b64 = fs.readFileSync(img).toString("base64");

const BASE = process.env.BASE ?? "http://localhost:3010";

const res = await fetch(`${BASE}/api/ollama/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model:
      "hf.co/HauhauCS/Gemma4-12B-QAT-Uncensored-HauhauCS-Balanced:Q4_K_M",
    imageDataUrl: `data:image/png;base64,${b64}`,
    prompt:
      'You are looking at a photo of an electronics breadboard. List every distinct component you can identify. Respond with ONLY a JSON object like {"components":["Arduino Uno","red LED","220 ohm resistor","pushbutton"]}. No prose, no markdown fences.',
  }),
});
const data = await res.json();
console.log("vision ok:", data.ok);
if (!data.ok) {
  console.log("error:", data.error);
  process.exit(1);
}
const m = data.response.match(/\{[^{}]*\}/)?.[0];
console.log("raw response head:", data.response.slice(0, 220));
const comps = m ? JSON.parse(m).components : [];
console.log("components:", JSON.stringify(comps));
if (!comps.length) process.exit(2);

const res2 = await fetch(`${BASE}/api/tinkercad/suggest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ components: comps }),
});
const d2 = await res2.json();
console.log("suggest ok:", d2.ok);
console.log(
  JSON.stringify(
    d2.suggestions?.map((s) => ({
      title: s.title,
      parts: s.parts.map((p) => p.part),
      lessons: s.lessons.length,
    })),
    null,
    1,
  ),
);
