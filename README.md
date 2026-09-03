# AXION Lite

AXION Lite is a focused, Chromebook-friendly AI assistant for web and engineering workflows.

## Scope

- Web search and API workflows
- MediaPipe gesture interaction
- KiCad schematic and PCB guidance
- Auditable breadboard-image-to-PCB drafts
- Fusion 360 as the mechanical CAD target
- Arduino firmware editing and compilation
- Optional small or remote language/vision models

SolidWorks, security scanners, social integrations, Google Workspace, music, news, and large bundled models are intentionally excluded from the Lite foundation.

## Update — breadboard photo → Tinkercad circuit suggestions

The BREADBOARD → PCB card now feeds directly into the Tinkercad flow:

1. **Analyze** — the uploaded photo goes to a vision-capable Ollama model (e.g. Gemma 4 12B; the route passes the image via Ollama's multimodal `images` field), which returns a JSON component list.
2. **Map** — `POST /api/tinkercad/suggest` (`app/api/tinkercad/suggest/route.ts`) matches the components against a library of Tinkercad components-panel part names (Arduino Uno R3, LED, Resistor, Pushbutton, servo, sensors, …).
3. **Suggest** — the TINKERCAD card renders actionable next steps: recipe titles (LED blink, servo control, distance sensing, button input, analog readout), why the build fits, the exact parts to place, one-click **FIND SIMILAR CIRCUITS** / **START NEW CIRCUIT** links, and curated Tinkercad lessons.

`/api/ollama/chat` now accepts an optional `imageDataUrl` (data URL) and its timeout is raised to 5 min so a cold vision-model load doesn't kill the request. Test the whole chain offline of the UI with `node scripts/test-breadboard-suggest.mjs <imagePath>`.

## Update — gesture control (MediaPipe) for the Tinkercad viewer

The Tinkercad viewer now has in-browser hand tracking — open a design, press **ENABLE GESTURES**, and grant camera access. MediaPipe Hands (WASM + `hand_landmarker.task` vendored under `public/mediapipe/`, no CDN, works offline) runs at ~30 fps with GPU→CPU fallback for Chromebook-class hardware, and a dependency-free landmark classifier (`app/lib/handGestures.ts`) maps gestures to viewer controls:

| Gesture | Action |
| --- | --- |
| Open-palm drag | Pan the viewer |
| Two open palms, spread apart | Zoom (0.4×–3×) |
| ✌ (victory) held 0.5 s | Reset view |
| Fist | Freeze transform |
| Pinch / point | Cursor indicator |

The cross-origin embed can't be scripted, so gestures drive a transform wrapper around the iframe (`app/components/GestureTinkercadViewer.tsx`); a picture-in-picture canvas shows the camera feed with the live hand skeleton and pinch indicator, and the HUD labels the active gesture. The toolbar adds RESET, FULLSCREEN, and OPEN IN TINKERCAD. Camera teardown is complete on stop/unmount.

## Update — Tinkercad bridge

AXION Lite now connects to Tinkercad:

- **Tinkercad card:** paste any `tinkercad.com/things/<id>` URL (or bare id)
  and the design opens inside AXION Lite in a read-only embedded viewer.
- **Bridge route:** `/api/tinkercad` validates the URL server-side, fetches
  the Thing's metadata (title, author, thumbnail) from the page's
  server-rendered tags, and returns Tinkercad's official embed URL
  (`/embed/<id>`).
- **No credentials:** Tinkercad has no public REST API, so the bridge is
  read-only against public Things — nothing is stored, no login involved.
  Editing stays in Tinkercad; open the design in a new tab from the viewer
  when you need to modify it.

Validation: `npm run check` and `npm run build` both pass, and the build
recognizes `/api/tinkercad`. Verified live: open-by-URL, open-by-id, and
rejection of non-Tinkercad URLs; the embed endpoint serves with no
X-Frame-Options / CSP frame-ancestors headers, so the iframe viewer works.

## Update — focused controls, local Ollama, and build reliability

The latest AXION Lite update turns the initial feature cards into working,
interactive entry points instead of static labels.

- **Local model status:** the UI checks Ollama through `/api/ollama/status`,
  lists installed models, and provides a refresh action.
- **Local chat:** `/api/ollama/chat` sends prompts to the configured Ollama
  instance and uses `qwen3:1.7b` as the small-device default.
- **Offline fallback:** when Ollama is unavailable, AXION Lite explains exactly
  how to start it and shows the command `ollama pull qwen3:1.7b`.
- **Actionable feature cards:** Web/API, KiCad, Fusion 360, and Arduino cards
  submit useful example prompts to the local model.
- **Breadboard analysis entry point:** users can select an image, preview it,
  and submit an explicit analysis request. The future conversion workflow must
  keep each component and connection auditable before KiCad output.
- **MediaPipe status:** the gesture card clearly distinguishes camera gestures
  from LLM reasoning, so gesture tracking can remain responsive on low-power
  Chromebooks.
- **Environment template:** `.env.local.example` contains only safe local
  Ollama placeholders. Real `.env.local` files, keys, tokens, and credentials
  are ignored and must not be committed.

The Lite app does not require the large AXION model. For a Chromebook, use a
small local model or configure Ollama on another machine and point `OLLAMA_HOST`
to that service over a trusted network.

Validation for this update:

```bash
npm run check
npm run build
```

Both checks pass, and the build recognizes:

```text
/api/ollama/status
/api/ollama/chat
/api/tinkercad
```

## Local development

```bash
npm install
npm run dev
```
```bash
npm run agent
```
```bash
ollama serve
```
Open `http://localhost:3000`.

## Design safety

Breadboard image analysis produces an auditable draft. Each component and connection must be detectable, inferred, confirmed, edited, or rejected before schematic/PCB generation. AXION Lite will never claim that an external CAD or KiCad application changed unless an active bridge confirms it.

## Model strategy

MediaPipe handles camera gestures independently from language or vision models. Keep models outside the repository and configure them separately. This keeps Axion-Lite small enough for Chromebook and other low-power deployments.

## Planned API routes

- `/api/web/search`
- `/api/web/fetch`
- `/api/breadboard/analyze`
- `/api/breadboard/confirm`
- `/api/breadboard/generate-schematic`
- `/api/breadboard/generate-pcb`
- `/api/breadboard/validate`
- `/api/fusion360/*`
- `/api/arduino/*`
