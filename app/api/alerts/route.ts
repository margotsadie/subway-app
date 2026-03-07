import { NextResponse } from "next/server"
import GtfsRealtimeBindings from "gtfs-realtime-bindings"

export const runtime = "nodejs"

// Valid NYC subway route IDs
const SUBWAY_ROUTES = new Set([
  "1", "2", "3", "4", "5", "6", "6X", "7", "7X",
  "A", "B", "C", "D", "E", "F", "G",
  "J", "L", "M", "N", "Q", "R", "S", "W", "Z",
  "GS", "FS", "H", "SI", "SIR",
])

// Normalize express variants for display (6X → 6, 7X → 7)
function displayRoute(id: string): string {
  if (id === "6X") return "6"
  if (id === "7X") return "7"
  if (id === "SIR") return "SI"
  return id
}

/**
 * Pick the best translation from a TranslatedString.
 * MTA provides both "en" (plain text) and "en-html" (HTML) — prefer "en".
 */
function pickTranslation(
  ts?: { translation?: Array<{ text?: string; language?: string }> } | null
): string {
  if (!ts?.translation?.length) return ""

  const plain = ts.translation.find(
    (t) => t.language === "en" && t.text?.trim()
  )
  if (plain?.text) return plain.text.trim()

  const fallback = ts.translation.find((t) => t.text?.trim())
  if (fallback?.text) return stripHtml(fallback.text)

  return ""
}

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export async function GET() {
  const url = process.env.MTA_ALERTS_URL
  if (!url) {
    return NextResponse.json({ error: "MTA_ALERTS_URL missing" }, { status: 500 })
  }

  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream alerts fetch failed", status: res.status },
      { status: 502 }
    )
  }

  const arrayBuffer = await res.arrayBuffer()
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(arrayBuffer)
  )

  const byLine: Record<
    string,
    Array<{ id: string; header: string; description: string }>
  > = {}

  for (const entity of feed.entity ?? []) {
    const alert = entity.alert
    if (!alert) continue

    // The protobuf decoder returns camelCase field names
    const headerText = pickTranslation(alert.headerText)
    const descText = pickTranslation(alert.descriptionText)

    // Drop alerts with no meaningful text
    if (!headerText && !descText) continue

    // Collect subway route IDs from informedEntity
    const routes = new Set<string>()
    for (const ie of alert.informedEntity ?? []) {
      const rid = (ie.routeId ?? "").trim()
      if (rid && SUBWAY_ROUTES.has(rid)) {
        routes.add(displayRoute(rid))
      }
    }

    // Skip alerts not tied to any subway route
    if (routes.size === 0) continue

    for (const line of routes) {
      byLine[line] ??= []
      byLine[line].push({
        id: entity.id ?? `${line}-${Math.random().toString(16).slice(2)}`,
        header: headerText || "Service alert",
        description: descText,
      })
    }
  }

  // Deduplicate within each line bucket
  for (const key of Object.keys(byLine)) {
    const seen = new Set<string>()
    byLine[key] = byLine[key].filter((item) => {
      const sig = `${item.header}|||${item.description}`
      if (seen.has(sig)) return false
      seen.add(sig)
      return true
    })
  }

  // Sort keys: numbers first, then letters
  const sorted: typeof byLine = {}
  const keys = Object.keys(byLine).sort((a, b) => {
    const aNum = /^\d/.test(a)
    const bNum = /^\d/.test(b)
    if (aNum && !bNum) return -1
    if (!aNum && bNum) return 1
    return a.localeCompare(b)
  })
  for (const k of keys) sorted[k] = byLine[k]

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    byLine: sorted,
  })
}