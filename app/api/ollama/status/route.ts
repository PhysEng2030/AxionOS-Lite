import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
/** Preferred fallback, honored only if it is actually installed. */
const PREFERRED_MODEL = process.env.OLLAMA_MODEL ?? "";

export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) {
      return NextResponse.json({ online: false, models: [], error: `Ollama returned HTTP ${response.status}` });
    }
    const data = (await response.json()) as { models?: { name?: string; size?: number }[] };
    const models = (data.models ?? [])
      .filter((m): m is { name: string; size?: number } => Boolean(m.name))
      .map((m) => ({ name: m.name, size: m.size ?? 0 }));

    // Server-resolved default: env preference if installed, else the
    // smallest installed model (Chromebook-friendly). The chat route uses
    // the same chain, so the selector can trust this value.
    const names = new Set(models.map((m) => m.name));
    const defaultModel =
      (PREFERRED_MODEL && names.has(PREFERRED_MODEL) && PREFERRED_MODEL) ||
      [...models].sort((a, b) => a.size - b.size)[0]?.name ||
      null;

    return NextResponse.json({
      online: true,
      models: models.map((m) => m.name),
      defaultModel,
    });
  } catch {
    return NextResponse.json({ online: false, models: [], error: "Ollama is not reachable" });
  }
}
