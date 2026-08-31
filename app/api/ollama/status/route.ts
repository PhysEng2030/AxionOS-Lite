import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) {
      return NextResponse.json({ online: false, models: [], error: `Ollama returned HTTP ${response.status}` });
    }
    const data = (await response.json()) as { models?: { name?: string }[] };
    return NextResponse.json({ online: true, models: (data.models ?? []).map((model) => model.name).filter(Boolean) });
  } catch {
    return NextResponse.json({ online: false, models: [], error: "Ollama is not reachable" });
  }
}
