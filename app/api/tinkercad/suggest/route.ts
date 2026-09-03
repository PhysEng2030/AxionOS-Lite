import { NextResponse } from "next/server";

/**
 * Breadboard → Tinkercad circuit suggestions for AXION Lite.
 *
 * POST { components: string[] } where the entries are the component names
 * identified by the vision model from a breadboard photo.
 *
 * Tinkercad has no public REST API, so this maps components to the parts and
 * gallery search URLs that exist on tinkercad.com itself, plus curated
 * Tinkercad lessons for the classic entry-level breadboard builds.
 */

export const dynamic = "force-dynamic";

interface PartHit {
  /** Canonical Tinkercad components-panel name. */
  part: string;
  /** Human-readable component name from the vision analysis. */
  from: string;
  /** Where to find it in Tinkercad's components panel (search term). */
  search: string;
}

interface Suggestion {
  /** Short title, e.g. "LED blink circuit". */
  title: string;
  why: string;
  /** Tinkercad circuits search URL preloaded for this build. */
  searchUrl: string;
  /** New blank circuits editor. */
  newCircuitUrl: string;
  /** Suggested parts with their Tinkercad panel names. */
  parts: PartHit[];
  /** Curated Tinkercad lessons/guides, when applicable. */
  lessons: { title: string; url: string }[];
}

/** Tinkercad components-panel names for common breadboard parts. */
const PART_LIBRARY: { match: RegExp; part: string; search: string }[] = [
  { match: /arduino\s*uno|uno\b/i, part: "Arduino Uno R3", search: "Arduino Uno R3" },
  { match: /breadboard/i, part: "Small Breadboard", search: "breadboard" },
  { match: /\bled\b|light[- ]emitting/i, part: "LED", search: "LED" },
  { match: /resistor/i, part: "Resistor", search: "Resistor" },
  { match: /capacitor/i, part: "Capacitor", search: "Capacitor" },
  { match: /push[- ]?button|button|switch/i, part: "Pushbutton", search: "pushbutton" },
  { match: /potentiometer|pot\b/i, part: "Potentiometer", search: "Potentiometer" },
  { match: /photoresistor|ldr|light sensor/i, part: "Photoresistor", search: "Photoresistor" },
  { match: /temperature|thermistor|tmp\s?36/i, part: "Temperature Sensor [TMP36]", search: "TMP36" },
  { match: /servo/i, part: "Micro servo", search: "servo" },
  { match: /motor|dc\s*motor/i, part: "DC motor", search: "DC motor" },
  { match: /buzzer|piezo/i, part: "Piezo", search: "Piezo" },
  { match: /lcd|display/i, part: "LCD 16 x 2", search: "LCD" },
  { match: /rgb\s*led/i, part: "RGB LED", search: "RGB LED" },
  { match: /neopixel|ws2812/i, part: "NeoPixel", search: "NeoPixel" },
  { match: /ultrasonic|hc-?sr04|distance/i, part: "Ultrasonic Distance Sensor", search: "Ultrasonic Distance Sensor" },
  { match: /pir|motion/i, part: "PIR sensor", search: "PIR" },
  { match: /relay/i, part: "Relay", search: "Relay" },
  { match: /diode/i, part: "Diode", search: "Diode" },
  { match: /transistor|mosfet/i, part: "Transistor", search: "Transistor" },
  { match: /battery|power\s*(supply|rail)/i, part: "Power supply", search: "Power supply" },
];

const LESSONS: Record<string, { title: string; url: string }> = {
  led: { title: "Tinkercad lesson: Blink an LED with Arduino", url: "https://www.tinkercad.com/learn/circuits/lesson-1-CJ2J2DQ6TDB1LJ5" },
  servo: { title: "Tinkercad lesson: Servo control basics", url: "https://www.tinkercad.com/learn/circuits" },
  ultrasonic: { title: "Tinkercad gallery: ultrasonic distance sensor circuits", url: "https://www.tinkercad.com/search?type=circuits&q=ultrasonic%20sensor" },
  button: { title: "Tinkercad gallery: pushbutton circuits", url: "https://www.tinkercad.com/search?type=circuits&q=pushbutton" },
};

function circuitSearchUrl(terms: string[]): string {
  return `https://www.tinkercad.com/search?type=circuits&q=${encodeURIComponent(terms.slice(0, 3).join(" "))}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { components?: unknown }
    | null;
  const raw = Array.isArray(body?.components) ? body!.components : [];
  const components = raw
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 24);

  if (components.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Provide the identified components as a string array." },
      { status: 400 },
    );
  }

  const parts: PartHit[] = [];
  const matched = new Set<string>();
  for (const comp of components) {
    const hit = PART_LIBRARY.find((p) => p.match.test(comp));
    if (hit && !matched.has(hit.part)) {
      matched.add(hit.part);
      parts.push({ from: comp, part: hit.part, search: hit.search });
    } else if (!hit && !matched.has(comp.toLowerCase())) {
      matched.add(comp.toLowerCase());
      // Unknown part — still give the user a useful search hook.
      parts.push({ from: comp, part: comp, search: comp });
    }
  }

  const has = (re: RegExp) => components.some((c) => re.test(c));
  const suggestions: Suggestion[] = [];

  const hasArduino = has(/arduino\s*uno|uno\b/i);
  const hasLed = has(/\bled\b/i) && !has(/rgb\s*led/i);
  const hasRgb = has(/rgb\s*led/i);

  if (hasArduino && (hasLed || hasRgb)) {
    suggestions.push({
      title: hasRgb ? "RGB LED controlled by Arduino" : "LED blink circuit",
      why: "Arduino + LED on the breadboard is the classic first build — replicate it in Tinkercad, wire through a resistor, and simulate the blink.",
      searchUrl: circuitSearchUrl(["arduino", hasRgb ? "rgb led" : "led", "breadboard"]),
      newCircuitUrl: "https://www.tinkercad.com/dashboard?type=circuits",
      parts: parts.filter((p) => /arduino|led|resistor|breadboard/i.test(p.part)),
      lessons: [LESSONS.led],
    });
  }

  if (has(/servo/i)) {
    suggestions.push({
      title: "Servo control circuit",
      why: "A servo in the photo usually means a positional control build — recreate it in Tinkercad and drive the angle from a simulated Arduino.",
      searchUrl: circuitSearchUrl(["arduino", "servo"]),
      newCircuitUrl: "https://www.tinkercad.com/dashboard?type=circuits",
      parts: parts.filter((p) => /servo|arduino|breadboard|capacitor/i.test(p.part)),
      lessons: [LESSONS.servo],
    });
  }

  if (has(/ultrasonic|hc-?sr04|distance/i)) {
    suggestions.push({
      title: "Distance-sensing circuit",
      why: "An ultrasonic sensor build maps directly to Tinkercad's simulator — measure distance and trigger an output.",
      searchUrl: circuitSearchUrl(["arduino", "ultrasonic"]),
      newCircuitUrl: "https://www.tinkercad.com/dashboard?type=circuits",
      parts: parts.filter((p) => /ultrasonic|arduino|led|buzzer|piezo|breadboard/i.test(p.part)),
      lessons: [LESSONS.ultrasonic],
    });
  }

  if (has(/push[- ]?button|button|switch/i)) {
    suggestions.push({
      title: "Button-input circuit",
      why: "Buttons are the standard digital input — rebuild the wiring in Tinkercad with a pull-down resistor and debounce in code.",
      searchUrl: circuitSearchUrl(["arduino", "button"]),
      newCircuitUrl: "https://www.tinkercad.com/dashboard?type=circuits",
      parts: parts.filter((p) => /pushbutton|arduino|resistor|led|breadboard/i.test(p.part)),
      lessons: [LESSONS.button],
    });
  }

  if (has(/potentiometer|photoresistor|ldr|temperature|thermistor/i)) {
    suggestions.push({
      title: "Analog sensor readout",
      why: "Analog inputs (pot, LDR, temperature) read cleanly in Tinkercad's simulator — rebuild and visualize the values on the Serial Monitor.",
      searchUrl: circuitSearchUrl(["arduino", "sensor", "analog"]),
      newCircuitUrl: "https://www.tinkercad.com/dashboard?type=circuits",
      parts: parts.filter((p) => /potentiometer|photoresistor|temperature|arduino|lcd|breadboard/i.test(p.part)),
      lessons: [],
    });
  }

  // Fallback: at least one actionable suggestion.
  if (suggestions.length === 0) {
    suggestions.push({
      title: "Recreate the breadboard in Tinkercad",
      why: "No specific recipe matched, but the identified parts all exist in Tinkercad's components panel — start a blank circuit and place them.",
      searchUrl: circuitSearchUrl(components.slice(0, 3)),
      newCircuitUrl: "https://www.tinkercad.com/dashboard?type=circuits",
      parts,
      lessons: [],
    });
  }

  return NextResponse.json({
    ok: true,
    components,
    parts,
    suggestions,
    /** One-click: open Tinkercad's circuits editor. */
    editorUrl: "https://www.tinkercad.com/dashboard?type=circuits",
  });
}
