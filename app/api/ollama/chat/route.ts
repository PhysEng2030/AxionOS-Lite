import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
/** Preferred fallback, honored only if it is actually installed. */
const PREFERRED_MODEL = process.env.OLLAMA_MODEL ?? "";

interface InstalledModel {
  name: string;
  size: number;
}

/**
 * List installed models. Cheap call (~ms) — always fresh so an uninstalled
 * model name can never reach /api/generate.
 */
async function listInstalledModels(): Promise<InstalledModel[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name?: string; size?: number }[] };
    return (data.models ?? [])
      .filter((m): m is { name: string; size?: number } => Boolean(m.name))
      .map((m) => ({ name: m.name, size: m.size ?? 0 }));
  } catch {
    return [];
  }
}

/**
 * Resolve which model to actually run:
 *   1. the requested model, if installed;
 *   2. OLLAMA_MODEL env preference, if installed;
 *   3. the smallest installed model (Chromebook-friendly default);
 *   4. the requested name unchanged — Ollama will error with a precise
 *      message (e.g. when Ollama is down entirely).
 */
async function resolveModel(requested: string | undefined): Promise<string> {
  const installed = await listInstalledModels();
  if (installed.length === 0) return requested ?? PREFERRED_MODEL ?? "qwen3:1.7b";
  const names = new Set(installed.map((m) => m.name));
  if (requested && names.has(requested)) return requested;
  if (PREFERRED_MODEL && names.has(PREFERRED_MODEL)) return PREFERRED_MODEL;
  const smallest = [...installed].sort((a, b) => a.size - b.size)[0];
  return smallest.name;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { prompt?: string; model?: string; imageDataUrl?: string }
    | null;
  const prompt = body?.prompt?.trim();
  if (!prompt) return NextResponse.json({ ok: false, error: "A prompt is required." }, { status: 400 });

  // Optional image payload (data URL) → Ollama's multimodal `images` field
  // (base64 without the data: prefix).
  const imageDataUrl = body?.imageDataUrl?.trim() || "";
  const images = imageDataUrl
    ? [imageDataUrl.replace(/^data:image\/\w+;base64,/, "")]
    : [];

  try {
    const model = await resolveModel(body?.model);
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, images, stream: false }),
      // Vision models can take minutes to cold-load a 7+ GB image model.
      signal: AbortSignal.timeout(300000),
    });
    const data = (await response.json().catch(() => ({}))) as { response?: string; error?: string };
    if (!response.ok) return NextResponse.json({ ok: false, model, error: data.error ?? `Ollama returned HTTP ${response.status}` }, { status: 502 });
    // `model` echoes what actually ran so the UI can sync its selector.
    return NextResponse.json({ ok: true, response: data.response ?? "", model });
  } catch {
    return NextResponse.json({ ok: false, error: "AXION is offline — start Ollama, then try again." }, { status: 503 });
  }
}
