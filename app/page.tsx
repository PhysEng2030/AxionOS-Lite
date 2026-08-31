"use client";

import { useState } from "react";

const commands = [
  "Axion, search the web for …",
  "Axion, analyze this breadboard",
  "Axion, review this schematic",
  "Axion, generate a KiCad schematic",
  "Axion, open Fusion 360",
  "Axion, create a sketch 40 millimeters by 20 millimeters",
  "Axion, write Arduino firmware for …",
];

export default function Home() {
  const [command, setCommand] = useState("");
  const [message, setMessage] = useState("");

  function submit() {
    const value = command.trim();
    if (!value) return;
    setMessage(`Queued: ${value}`);
    setCommand("");
  }

  return (
    <main className="shell">
      <div className="eyebrow">LOCAL ENGINEERING WORKSPACE</div>
      <h1>AXION Lite</h1>
      <p className="subtitle">A focused Chromebook-friendly assistant for web research, KiCad PCB workflows, Fusion 360 design, Arduino firmware, and auditable breadboard-to-PCB conversion.</p>

      <div className="command">
        <input value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Axion, describe what you want to build…" aria-label="AXION command" />
        <button type="button" onClick={submit}>SEND</button>
      </div>
      <div className="status" aria-live="polite">{message}</div>

      <section className="grid">
        <article className="card"><h2>WEB / API</h2><p>Search, fetch, summarize, and inspect web documentation with a small tool surface.</p><ul><li>Search the web</li><li>Read datasheets</li><li>Summarize technical pages</li></ul></article>
        <article className="card"><h2>KICAD PCB</h2><p>Generate and audit schematic and PCB drafts with explicit ERC, DRC, footprint, and connection review gates.</p><ul><li>Schematic review</li><li>PCB placement guidance</li><li>ERC/DRC checklist</li></ul></article>
        <article className="card"><h2>FUSION 360</h2><p>Use Fusion 360 as the Lite mechanical-design target for sketches, dimensions, extrusions, cuts, and enclosure planning.</p><ul><li>Unit-aware sketches</li><li>Extrude and cut plans</li><li>Manufacturing checks</li></ul></article>
        <article className="card"><h2>ARDUINO</h2><p>Generate, edit, compile, and synchronize firmware with the electronics design.</p><ul><li>Typed or dictated code</li><li>Compile locally</li><li>Upload when explicitly confirmed</li></ul></article>
        <article className="card"><h2>BREADBOARD → PCB</h2><p>Analyze a photo, identify parts and wires, show confidence, and require an audit decision for each item before KiCad output.</p><ul><li>Evidence crop per part</li><li>Detected vs. inferred labels</li><li>Confirm, edit, or reject</li></ul></article>
        <article className="card"><h2>MEDIAPIPE</h2><p>Keep gesture tracking independent from the LLM for responsive Chromebook operation.</p><ul><li>Point and pinch to select</li><li>Open palm to pan</li><li>Two-hand spread to zoom</li></ul></article>
      </section>

      <section className="card" style={{ marginTop: 14 }}><h2>WAKE-WORD COMMANDS</h2><p>Commands are intentionally explicit and begin with “Axion”.</p><ul>{commands.map((item) => <li key={item}>{item}</li>)}</ul></section>
    </main>
  );
}
