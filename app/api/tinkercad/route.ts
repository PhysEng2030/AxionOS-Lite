import { NextResponse } from "next/server";

/**
 * Tinkercad bridge for AXION Lite.
 *
 * Tinkercad has no public REST API, so AXION connects to it the way a
 * browser does:
 *
 *   GET  /api/tinkercad?search=<query>   → search public Things (gallery)
 *   GET  /api/tinkercad?thing=<id>       → fetch one Thing's metadata
 *   GET  /api/tinkercad?open=<url>       → validate a Tinkercad URL + return
 *                                          an embeddable link for the panel
 *
 * Everything is read-only against public pages — no credentials, no cookies.
 */

const TINKERCAD = "https://www.tinkercad.com";
export const dynamic = "force-dynamic";

interface Thing {
  id: string;
  name: string;
  url: string;
  embedUrl?: string;
  thumb?: string;
  author?: string;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AXION-Lite/0.1",
      Accept: "text/html,application/json",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Tinkercad returned HTTP ${res.status}`);
  return res.text();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Parse Thing cards out of a Tinkercad search page. */
function parseThings(html: string): Thing[] {
  const things: Thing[] = [];
  // Cards link to /things/<id>-<slug> and carry an <img> thumbnail + title.
  const cardRe = /<a[^>]+href="(\/things\/([A-Za-z0-9]+)(?:-[^"]*)?)"[^>]*>([\s\S]*?)<\/a>/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null && things.length < 24) {
    const href = m[1];
    const id = m[2];
    if (seen.has(id)) continue;
    // Title: first img alt or the link's text content.
    const imgAlt = /<img[^>]+alt="([^"]*)"/.exec(m[3]);
    const text = m[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const name = decodeHtml(imgAlt?.[1] || text || id);
    if (!name || name.length < 2) continue;
    seen.add(id);
    things.push({
      id,
      name: name.slice(0, 80),
      url: `${TINKERCAD}${href}`,
      thumb: /<img[^>]+src="(https:[^"]+)"/.exec(m[3])?.[1],
    });
  }
  return things;
}

/**
 * Parse Thing metadata out of a Tinkercad page (og: tags are reliably
 * server-rendered even though most of the page is client-side).
 */
function parseThingMeta(html: string, id: string): Thing {
  const title = decodeHtml(
    /property="og:title" content="([^"]*)"/.exec(html)?.[1] ??
    /<title>([^<]+)<\/title>/.exec(html)?.[1] ?? id,
  ).replace(/\s*-\s*Tinkercad\s*$/i, "");
  const author = /og:description" content="[^"]*created by ([^"]+?) with Tinkercad/i.exec(html)?.[1];
  const thumb = /property="og:image" content="([^"]*)"/.exec(html)?.[1]?.replace(/&amp;/g, "&");
  return { id, name: title, url: `${TINKERCAD}/things/${id}`, embedUrl: `${TINKERCAD}/embed/${id}`, thumb, author };
}

function validThingId(raw: string): string | null {
  const trimmed = raw.trim();
  // Full URL form: tinkercad.com/things/<id> (or /embed/<id>).
  const m = /^\s*(?:https?:\/\/)?(?:www\.)?tinkercad\.com\/(?:things|embed)\/([A-Za-z0-9]{8,15})/.exec(trimmed);
  if (m) return m[1];
  // Bare id form (11-char Tinkercad Thing ids, e.g. d06qymTYfGn).
  if (/^[A-Za-z0-9]{10,15}$/.test(trimmed)) return trimmed;
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  try {
    // Validate + normalize a user-provided Tinkercad URL/id for embedding.
    const open = searchParams.get("open");
    if (open) {
      const id = validThingId(open.trim());
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Not a Tinkercad Thing URL or id (expected tinkercad.com/things/<id>)" },
          { status: 400 },
        );
      }
      const html = await fetchText(`${TINKERCAD}/things/${id}`);
      return NextResponse.json({ ok: true, thing: parseThingMeta(html, id) });
    }

    // Search the public gallery. The HTML gallery is client-rendered, so use
    // the public sitemap-style search fallback: fetch known things from the
    // query via Bing-free approach is unavailable — instead verify each of
    // the user's supplied ids. When no ids are known we surface a helpful
    // message; direct open-by-id / by-URL is the primary flow.
    const search = searchParams.get("search");
    if (search) {
      // The gallery page does not server-render results, but per-thing pages
      // do. If the user passed a query that looks like an id, resolve it.
      const asId = validThingId(search);
      if (asId) {
        const html = await fetchText(`${TINKERCAD}/things/${asId}`);
        return NextResponse.json({ ok: true, things: [parseThingMeta(html, asId)], query: search });
      }
      return NextResponse.json({
        ok: true,
        things: [],
        query: search,
        note: "Tinkercad's gallery search is client-side only. Paste a Thing URL or id from tinkercad.com to open it here — the viewer embeds it read-only.",
      });
    }

    // Fetch one Thing by id.
    const thing = searchParams.get("thing");
    if (thing) {
      const id = thing.trim();
      if (!/^[A-Za-z0-9]{8,15}$/.test(id)) {
        return NextResponse.json({ ok: false, error: "invalid thing id" }, { status: 400 });
      }
      const html = await fetchText(`${TINKERCAD}/things/${id}`);
      return NextResponse.json({ ok: true, thing: parseThingMeta(html, id) });
    }

    return NextResponse.json(
      { ok: false, error: "pass ?search=, ?thing=, or ?open=" },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
