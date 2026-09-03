"use client";

import { ChangeEvent, useEffect, useState } from "react";
import GestureTinkercadViewer from "./components/GestureTinkercadViewer";

interface CircuitSuggestion {
  title: string;
  why: string;
  searchUrl: string;
  newCircuitUrl: string;
  parts: { from: string; part: string; search: string }[];
  lessons: { title: string; url: string }[];
}

const commands = [
  "Axion, search the web for …",
  "Axion, analyze this breadboard",
  "Axion, review this schematic",
  "Axion, generate a KiCad schematic",
  "Axion, open Fusion 360",
  "Axion, create a sketch 40 millimeters by 20 millimeters",
  "Axion, write Arduino firmware for …",
];

const quickActions = [
  { id: "web", title: "WEB / API", description: "Search and summarize engineering documentation.", prompt: "Axion, search the web for the latest KiCad PCB design guidance" },
  { id: "kicad", title: "KICAD PCB", description: "Review schematics and generate PCB checklists.", prompt: "Axion, review a KiCad schematic for power, grounding, footprints, and ERC risks" },
  { id: "fusion", title: "FUSION 360", description: "Plan sketches, dimensions, extrusions, and cuts.", prompt: "Axion, open Fusion 360 and prepare a 40 millimeter by 20 millimeter sketch" },
  { id: "arduino", title: "ARDUINO", description: "Draft and validate firmware for the electronics design.", prompt: "Axion, write Arduino firmware for a blinking status LED" },
];

export default function Home() {
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState("");
  const [model, setModel] = useState("qwen3:1.7b");
  const [models, setModels] = useState<string[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [breadboardImage, setBreadboardImage] = useState<string | null>(null);
  const [tinkUrl, setTinkUrl] = useState("");
  const [tinkThing, setTinkThing] = useState<{ id: string; name: string; url: string; embedUrl: string } | null>(null);
  const [tinkError, setTinkError] = useState<string | null>(null);
  const [tinkLoading, setTinkLoading] = useState(false);
  const [bbBusy, setBbBusy] = useState(false);
  const [bbComponents, setBbComponents] = useState<string[]>([]);
  const [bbSuggestions, setBbSuggestions] = useState<CircuitSuggestion[] | null>(null);
  const [bbError, setBbError] = useState<string | null>(null);

  async function openTinkercad(raw?: string) {
    const value = (raw ?? tinkUrl).trim();
    if (!value || tinkLoading) return;
    setTinkLoading(true);
    setTinkError(null);
    setTinkThing(null);
    try {
      const res = await fetch(`/api/tinkercad?open=${encodeURIComponent(value)}`, { cache: "no-store" });
      const data = await res.json() as { ok?: boolean; thing?: { id: string; name: string; url: string; embedUrl: string }; error?: string };
      if (data.ok && data.thing) {
        setTinkThing(data.thing);
      } else {
        setTinkError(data.error ?? "Could not open that Tinkercad Thing.");
      }
    } catch {
      setTinkError("Tinkercad bridge unreachable — check your connection.");
    } finally {
      setTinkLoading(false);
    }
  }

  /**
   * Breadboard → Tinkercad flow:
   *  1. Send the photo to a vision-capable Ollama model → component list (JSON).
   *  2. Map the components to Tinkercad parts + circuit suggestions.
   */
  async function analyzeBreadboard() {
    if (!breadboardImage || bbBusy) return;
    setBbBusy(true);
    setBbError(null);
    setBbSuggestions(null);
    setBbComponents([]);
    try {
      const res = await fetch("/api/ollama/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          imageDataUrl: breadboardImage,
          prompt:
            'You are looking at a photo of an electronics breadboard. List every distinct component you can identify. Respond with ONLY a JSON object like {"components":["Arduino Uno","red LED","220 ohm resistor","pushbutton"]}. No prose, no markdown fences.',
        }),
      });
      const data = await res.json() as { ok?: boolean; response?: string; error?: string };
      if (!data.ok || !data.response) throw new Error(data.error ?? "Vision analysis failed.");
      // Grab the first JSON object only — some models append extra chatter
      // or a second copy of the JSON after their closing tag.
      const jsonText = data.response.match(/\{[^{}]*\}/)?.[0];
      const parsed = jsonText ? (JSON.parse(jsonText) as { components?: unknown }) : null;
      const comps = Array.isArray(parsed?.components)
        ? parsed!.components.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        : [];
      if (!comps.length) {
        throw new Error("No components identified — try a clearer photo, or pick a vision-capable model (e.g. Gemma 4 12B) in LOCAL MODEL.");
      }
      setBbComponents(comps);
      setOnline(true);

      const res2 = await fetch("/api/tinkercad/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ components: comps }),
      });
      const data2 = await res2.json() as { ok?: boolean; suggestions?: CircuitSuggestion[]; error?: string };
      if (!data2.ok || !data2.suggestions) throw new Error(data2.error ?? "Suggestion mapping failed.");
      setBbSuggestions(data2.suggestions);
      document.querySelector(".tinkercad-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setBbError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setBbBusy(false);
    }
  }

  async function checkOllama() {
    try {
      const result = await fetch("/api/ollama/status", { cache: "no-store" });
      const data = await result.json() as { online: boolean; models?: string[] };
      setOnline(data.online);
      setModels(data.models ?? []);
      if (data.models?.length && !data.models.includes(model)) setModel(data.models[0]);
    } catch {
      setOnline(false);
    }
  }

  useEffect(() => { void checkOllama(); }, []);

  async function submit(value = command) {
    const prompt = value.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setResponse("");
    try {
      const result = await fetch("/api/ollama/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      });
      const data = await result.json() as { ok?: boolean; response?: string; error?: string };
      setResponse(data.ok ? data.response ?? "No response returned." : data.error ?? "AXION is offline.");
      setOnline(Boolean(data.ok));
    } catch {
      setOnline(false);
      setResponse("AXION is offline — local LLM not reachable. Start Ollama and try again.");
    } finally {
      setBusy(false);
      setCommand("");
    }
  }

  function handleBreadboardImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setBreadboardImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <main className="shell">
      <div className="eyebrow">LOCAL ENGINEERING WORKSPACE</div>
      <h1>AXION Lite</h1>
      <p className="subtitle">A focused Chromebook-friendly assistant for web research, KiCad PCB workflows, Fusion 360 design, Arduino firmware, and auditable breadboard-to-PCB conversion.</p>

      <section className="card status-card">
        <div className="status-header"><h2>LOCAL MODEL</h2><span className={online ? "online" : "offline"}>{online === null ? "CHECKING…" : online ? "ONLINE" : "OFFLINE"}</span></div>
        <p>{online ? "Ollama is reachable and ready for local prompts." : "AXION can still show guides offline. Start Ollama to enable local reasoning."}</p>
        <div className="model-row"><select value={model} onChange={(e) => setModel(e.target.value)} disabled={!models.length} aria-label="Ollama model"><option value={model}>{models.length ? model : "qwen3:1.7b (default)"}</option>{models.filter((name) => name !== model).map((name) => <option key={name} value={name}>{name}</option>)}</select><button type="button" onClick={() => void checkOllama()}>CHECK AGAIN</button></div>
        {!online && <code>ollama pull qwen3:1.7b</code>}
      </section>

      <div className="command"><input value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} placeholder="Axion, describe what you want to build…" aria-label="AXION command" /><button type="button" onClick={() => void submit()} disabled={busy}>{busy ? "THINKING…" : "SEND"}</button></div>
      {response && <pre className="response" aria-live="polite">{response}</pre>}

      <section className="grid">
        {quickActions.map((action) => <article className="card" key={action.id}><h2>{action.title}</h2><p>{action.description}</p><button type="button" onClick={() => void submit(action.prompt)} disabled={busy}>TRY EXAMPLE</button></article>)}
        <article className="card"><h2>BREADBOARD → PCB</h2><p>Upload a breadboard image to prepare an auditable analysis request. Every part and connection must be confirmed before KiCad output.</p><label className="upload-button">{breadboardImage ? "IMAGE READY · ANALYZE" : "CHOOSE BREADBOARD IMAGE"}<input type="file" accept="image/*" onChange={handleBreadboardImage} hidden /></label>{breadboardImage && <><img src={breadboardImage} alt="Breadboard selected for analysis" className="breadboard-preview" /><button type="button" onClick={() => void analyzeBreadboard()} disabled={bbBusy}>{bbBusy ? "ANALYZING…" : "ANALYZE → TINKERCAD CIRCUIT"}</button><p className="tink-help">Sends the photo to your local vision model, then maps the found parts to a Tinkercad circuit suggestion.</p></>}{bbError && <p className="tink-error">{bbError}</p>}{bbSuggestions && <div className="bb-results"><p className="tink-ok">✓ Identified: {bbComponents.join(", ")}</p><ul>{bbSuggestions.map((s) => <li key={s.title}><strong>{s.title}</strong> — {s.why} <a href={s.searchUrl} target="_blank" rel="noreferrer">Browse circuits ↗</a>{s.lessons.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer"> · {l.title} ↗</a>)}</li>)}</ul></div>}</article>
        <article className="card tinkercad-card"><h2>TINKERCAD</h2>{bbSuggestions && <div className="bb-suggest"><p className="tink-ok">◈ From your breadboard photo: {bbComponents.join(", ")}</p>{bbSuggestions.map((s) => <div key={s.title} className="bb-suggest-item"><strong>{s.title}</strong><p>{s.why}</p><div className="tink-toolbar"><a className="tink-btn tink-link" href={s.searchUrl} target="_blank" rel="noreferrer">FIND SIMILAR CIRCUITS ↗</a><a className="tink-btn tink-link" href={s.newCircuitUrl} target="_blank" rel="noreferrer">START NEW CIRCUIT ↗</a></div>{s.parts.length > 0 && <p className="tink-help">Parts to place: {s.parts.map((p) => p.part).join(" · ")}</p>}{s.lessons.length > 0 && <p className="tink-help">{s.lessons.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.title} ↗</a>)}</p>}</div>)}</div>}<p>Open a Tinkercad design right here — paste a Thing URL or id from tinkercad.com and it loads in the embedded viewer, read-only.</p><div className="model-row"><input value={tinkUrl} onChange={(e) => setTinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void openTinkercad(); }} placeholder="tinkercad.com/things/… or id" aria-label="Tinkercad Thing URL or id" /><button type="button" onClick={() => void openTinkercad()} disabled={tinkLoading}>{tinkLoading ? "LOADING…" : "OPEN"}</button></div>{tinkError && <p className="tink-error">{tinkError}</p>}{tinkThing && <p className="tink-ok">◈ {tinkThing.name}</p>}{tinkThing && <GestureTinkercadViewer thing={tinkThing} />}</article>
        <article className="card"><h2>MEDIAPIPE GESTURES</h2><p>Gesture tracking runs fully in-browser via MediaPipe — independent of the LLM for responsive Chromebook operation.</p><ul><li>Open-palm drag → pan the Tinkercad viewer</li><li>Two-hand spread → zoom</li><li>✌ hold → reset view</li><li>Fist → freeze · pinch → cursor</li></ul><p className="tink-ok">✓ Live in the TINKERCAD card — open a design, then press ENABLE GESTURES.</p></article>
      </section>

      <section className="card" style={{ marginTop: 14 }}><h2>WAKE-WORD COMMANDS</h2><p>Commands are intentionally explicit and begin with “Axion”.</p><ul>{commands.map((item) => <li key={item}>{item}</li>)}</ul></section>
    </main>
  );
}
