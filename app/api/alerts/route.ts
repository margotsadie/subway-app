import { NextResponse } from "next/server"
import GtfsRealtimeBindings from "gtfs-realtime-bindings"

export const runtime = "nodejs"

const SUBWAY_ROUTES = new Set([
  "1", "2", "3", "4", "5", "6", "6X", "7", "7X",
  "A", "B", "C", "D", "E", "F", "G",
  "J", "L", "M", "N", "Q", "R", "S", "W", "Z",
  "GS", "FS", "H", "SI", "SIR",
])

function displayRoute(id: string): string {
  if (id === "6X") return "6"
  if (id === "7X") return "7"
  if (id === "SIR") return "SI"
  return id
}

function sortRoutes(a: string, b: string): number {
  const aNum = /^\d/.test(a)
  const bNum = /^\d/.test(b)
  if (aNum && !bNum) return -1
  if (!aNum && bNum) return 1
  return a.localeCompare(b)
}

function pickTranslation(
  ts?: { translation?: Array<{ text?: string; language?: string }> }
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

  const now = Date.now() / 1000
  const alerts: Array<{
    id: string
    type: "delay" | "change"
    routes: string[]
    header: string
    description: string
  }> = []
  const seen = new Set<string>()

  for (const entity of feed.entity ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alert = entity.alert as any
    if (!alert) continue

    // Only include alerts active right now
    const periods = alert.activePeriod ?? []
    if (periods.length > 0) {
      const isActiveNow = periods.some((p: { start?: number; end?: number }) => {
        const start = Number(p.start ?? 0)
        const end = Number(p.end ?? 0)
        return start <= now && (end === 0 || end >= now)
      })
      if (!isActiveNow) continue
    }

    const headerText = pickTranslation(alert.headerText)
    const descText = pickTranslation(alert.descriptionText)
    if (!headerText && !descText) continue

    const routes = new Set<string>()
    for (const ie of alert.informedEntity ?? []) {
      const rid = (ie.routeId ?? "").trim()
      if (rid && SUBWAY_ROUTES.has(rid)) {
        routes.add(displayRoute(rid))
      }
    }
    if (routes.size === 0) continue

    // Deduplicate by content
    const sig = `${headerText}|||${descText}`
    if (seen.has(sig)) continue
    seen.add(sig)

    alerts.push({
      id: entity.id ?? `alert-${Math.random().toString(16).slice(2)}`,
      type: (entity.id ?? "").startsWith("lmm:alert:") ? "delay" : "change",
      routes: [...routes].sort(sortRoutes),
      header: headerText || "Service alert",
      description: descText,
    })
  }

  // Delays first, then changes
  alerts.sort((a, b) => {
    if (a.type !== b.type) return a.type === "delay" ? -1 : 1
    return 0
  })

  const affectedLines = [...new Set(alerts.flatMap((a) => a.routes))].sort(sortRoutes)

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    alerts,
    affectedLines,
  })
}