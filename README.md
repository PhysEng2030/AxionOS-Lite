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
