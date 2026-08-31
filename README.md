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
