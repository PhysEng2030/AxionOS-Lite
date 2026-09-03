import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:1.7b";

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
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: body?.model || DEFAULT_MODEL, prompt, images, stream: false }),
      // Vision models can take minutes to cold-load a 7+ GB image model.
      signal: AbortSignal.timeout(300000),
    });
    const data = (await response.json().catch(() => ({}))) as { response?: string; error?: string };
    if (!response.ok) return NextResponse.json({ ok: false, error: data.error ?? `Ollama returned HTTP ${response.status}` }, { status: 502 });
    return NextResponse.json({ ok: true, response: data.response ?? "" });
  } catch {
    return NextResponse.json({ ok: false, error: "AXION is offline — start Ollama, then try again." }, { status: 503 });
  }
}
