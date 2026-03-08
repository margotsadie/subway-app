"use client"

import React, { useEffect, useRef, useState } from "react"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"

// ---------- Types ----------

type Mode = "map" | "alerts"

type AlertItem = {
  id: string
  type: "delay" | "change"
  routes: string[]
  header: string
  description: string
}

type AlertsPayload = {
  updatedAt: string
  alerts: AlertItem[]
  affectedLines: string[]
}

// ---------- MTA line colors ----------

const LINE_COLORS: Record<string, string> = {
  "1": "#EE352E", "2": "#EE352E", "3": "#EE352E",
  "4": "#00933C", "5": "#00933C", "6": "#00933C",
  "7": "#B933AD",
  A: "#0039A6", C: "#0039A6", E: "#0039A6",
  B: "#FF6319", D: "#FF6319", F: "#FF6319", M: "#FF6319",
  G: "#6CBE45",
  J: "#996633", Z: "#996633",
  L: "#A7A9AC",
  N: "#FCCC0A", Q: "#FCCC0A", R: "#FCCC0A", W: "#FCCC0A",
  S: "#808183", GS: "#808183", FS: "#808183", H: "#808183",
  SI: "#0039A6",
}
const DARK_TEXT = new Set(["N", "Q", "R", "W"])
const ALL_LINES = [
  "1", "2", "3", "4", "5", "6", "7",
  "A", "B", "C", "D", "E", "F", "G",
  "J", "L", "M", "N", "Q", "R", "W",
  "Z", "GS", "H", "SI",
]

// ---------- Small components ----------

/** Colored subway line circle used inside alert cards */
function LineBullet({ line, size = "md" }: { line: string; size?: "sm" | "md" }) {
  const px = size === "sm" ? 24 : 36
  const fs = size === "sm" ? (line.length > 1 ? 9 : 12) : line.length > 1 ? 13 : 16
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: px,
        height: px,
        borderRadius: "50%",
        backgroundColor: LINE_COLORS[line] ?? "#808183",
        color: DARK_TEXT.has(line) ? "#000" : "#fff",
        fontSize: fs,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {line}
    </span>
  )
}

/** Line bubble in the status grid — toggleable, shows badge dot + selected ring */
function GridBubble({
  line,
  status,
  selected,
  onTap,
}: {
  line: string
  status: "ok" | "delay" | "change"
  selected: boolean
  onTap: () => void
}) {
  const isOk = status === "ok"
  const bg = isOk ? "#d4d4d8" : (LINE_COLORS[line] ?? "#808183")
  const fg = isOk ? "#a1a1aa" : DARK_TEXT.has(line) ? "#000" : "#fff"
  const dotColor = status === "delay" ? "#ef4444" : status === "change" ? "#f59e0b" : undefined
  const fs = line.length > 1 ? 13 : 16

  return (
    <button
      onClick={isOk ? undefined : onTap}
      disabled={isOk}
      style={{ position: "relative", cursor: isOk ? "default" : "pointer" }}
      aria-label={`${line} line — ${isOk ? "good service" : status}${selected ? " (selected)" : ""}`}
    >
      {/* Selected ring */}
      {selected && (
        <span
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: "2.5px solid #3b82f6",
          }}
        />
      )}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          backgroundColor: bg,
          color: fg,
          fontSize: fs,
          fontWeight: 700,
        }}
      >
        {line}
      </span>
      {dotColor && (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: dotColor,
            border: "2px solid white",
          }}
        />
      )}
      {isOk && (
        <span
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 14,
            height: 14,
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            border: "2px solid white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          ✓
        </span>
      )}
    </button>
  )
}

function LineGrid({
  lineStatus,
  selectedLines,
  onLineTap,
}: {
  lineStatus: Map<string, "ok" | "delay" | "change">
  selectedLines: Set<string>
  onLineTap: (line: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-3 justify-items-center">
      {ALL_LINES.map((l) => (
        <GridBubble
          key={l}
          line={l}
          status={lineStatus.get(l) ?? "ok"}
          selected={selectedLines.has(l)}
          onTap={() => onLineTap(l)}
        />
      ))}
    </div>
  )
}

function AlertCard({
  alert,
  highlighted,
}: {
  alert: AlertItem
  highlighted: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <button
      id={`alert-${alert.id}`}
      onClick={() => setOpen(!open)}
      className={`w-full text-left rounded-xl p-3 shadow-sm transition-colors duration-500 ${
        highlighted
          ? "bg-amber-50 ring-2 ring-amber-400 dark:bg-amber-950/30"
          : "bg-white dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-wrap gap-1 pt-0.5">
          {alert.routes.map((r) => (
            <LineBullet key={r} line={r} size="sm" />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-snug">{alert.header}</div>
          {open && alert.description && (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
              {alert.description}
            </div>
          )}
        </div>
        <span className="text-zinc-400 text-xs mt-1 shrink-0">
          {open ? "\u25B2" : "\u25BC"}
        </span>
      </div>
    </button>
  )
}

// ---------- Views ----------

function AlertsView({ payload }: { payload: AlertsPayload }) {
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())

  // Build line → worst alert type map
  const lineStatus = new Map<string, "ok" | "delay" | "change">()
  for (const l of ALL_LINES) lineStatus.set(l, "ok")
  for (const a of payload.alerts) {
    for (const r of a.routes) {
      const current = lineStatus.get(r)
      if (a.type === "delay") lineStatus.set(r, "delay")
      else if (a.type === "change" && current !== "delay") lineStatus.set(r, "change")
    }
  }

  // Toggle a line on/off
  const handleLineTap = (line: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }

  // Filter alerts: if nothing selected show all, otherwise only matching lines
  const hasFilter = selectedLines.size > 0
  const visible = hasFilter
    ? payload.alerts.filter((a) => a.routes.some((r) => selectedLines.has(r)))
    : payload.alerts
  const delays = visible.filter((a) => a.type === "delay")
  const changes = visible.filter((a) => a.type === "change")

  return (
    <div className="fixed inset-0 z-20 overflow-auto bg-zinc-100 dark:bg-black pt-16 pb-6 px-4">
      <div className="mx-auto max-w-md space-y-5">
        {/* Line status grid */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wide">
            Tap lines to filter alerts
          </div>
          <LineGrid
            lineStatus={lineStatus}
            selectedLines={selectedLines}
            onLineTap={handleLineTap}
          />
          <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-zinc-400 dark:text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Delay
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Change
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Good
            </span>
          </div>
          {hasFilter && (
            <button
              onClick={() => setSelectedLines(new Set())}
              className="mt-2 w-full text-center text-xs text-blue-500 font-medium"
            >
              Clear filter — show all
            </button>
          )}
          <div className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500 text-center">
            Updated {new Date(payload.updatedAt).toLocaleTimeString()}
          </div>
        </div>

        {/* Delays */}
        {delays.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-1 h-4 rounded-full bg-red-500" />
              <span className="text-sm font-bold">
                Delays ({delays.length})
              </span>
            </div>
            <div className="space-y-2">
              {delays.map((a) => (
                <AlertCard key={a.id} alert={a} highlighted={false} />
              ))}
            </div>
          </div>
        )}

        {/* Service changes */}
        {changes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-1 h-4 rounded-full bg-amber-500" />
              <span className="text-sm font-bold">
                Service Changes ({changes.length})
              </span>
            </div>
            <div className="space-y-2">
              {changes.map((a) => (
                <AlertCard key={a.id} alert={a} highlighted={false} />
              ))}
            </div>
          </div>
        )}

        {/* All clear / no matches */}
        {visible.length === 0 && (
          <div className="text-center py-12">
            {hasFilter ? (
              <>
                <div className="text-3xl mb-2 text-green-500 font-bold">Good Service</div>
                <div className="text-sm text-zinc-500">
                  No active alerts for selected lines
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl mb-2 text-green-500 font-bold">Good Service</div>
                <div className="text-sm text-zinc-500">
                  All lines running normally
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MapViewer() {
  const stateRef = useRef({ x: 0, y: 0, scale: 1 })
  const MIN_SCALE = 0.5
  const MAX_SCALE = 12

  return (
    <div className="h-screen w-screen bg-white dark:bg-black">
      <TransformWrapper
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        initialScale={1}
        panning={{ velocityDisabled: false }}
        pinch={{ step: 5 }}
        wheel={{ disabled: true }}
        doubleClick={{ disabled: true }}
        limitToBounds
        centerOnInit
      >
        {({ setTransform, resetTransform, instance }) => {
          // Track transform state for wheel handler
          const ts = instance.transformState
          stateRef.current = {
            x: ts.positionX,
            y: ts.positionY,
            scale: ts.scale,
          }

          return (
            <>
              <div className="fixed bottom-4 right-4 z-30">
                <button
                  onClick={() => resetTransform()}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow dark:bg-zinc-900 dark:text-white"
                >
                  Reset
                </button>
              </div>
              <TransformComponent
                wrapperClass="!w-screen !h-screen"
                wrapperProps={{
                  onWheelCapture: (e: React.WheelEvent) => {
                    e.preventDefault()
                    const { x, y, scale } = stateRef.current
                    // ctrl/meta + scroll or trackpad pinch = zoom
                    // regular scroll/trackpad swipe = pan
                    const isZoom = e.ctrlKey || e.metaKey
                    if (isZoom) {
                      const factor = Math.exp(-e.deltaY * 0.01)
                      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor))
                      setTransform(x, y, next, 0)
                    } else {
                      setTransform(x - e.deltaX, y - e.deltaY, scale, 0)
                    }
                  },
                  style: { touchAction: "none" },
                }}
              >
                <img
                  src="/map.png"
                  alt="Subway map"
                  className="block w-screen h-auto select-none"
                  draggable={false}
                />
              </TransformComponent>
            </>
          )
        }}
      </TransformWrapper>
    </div>
  )
}

function Segmented({
  mode,
  setMode,
}: {
  mode: Mode
  setMode: (m: Mode) => void
}) {
  return (
    <div className="fixed left-0 right-0 top-0 z-30 p-3">
      <div className="mx-auto flex w-full max-w-md rounded-full bg-white/85 p-1 shadow-sm backdrop-blur dark:bg-zinc-950/80">
        <button
          onClick={() => setMode("map")}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold ${
            mode === "map"
              ? "bg-zinc-900 text-white shadow dark:bg-white dark:text-black"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          Map
        </button>
        <button
          onClick={() => setMode("alerts")}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold ${
            mode === "alerts"
              ? "bg-zinc-900 text-white shadow dark:bg-white dark:text-black"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          Alerts
        </button>
      </div>
    </div>
  )
}

// ---------- Root ----------

export default function Home() {
  const [mode, setMode] = useState<Mode>("map")
  const [payload, setPayload] = useState<AlertsPayload>({
    updatedAt: new Date().toISOString(),
    alerts: [],
    affectedLines: [],
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/alerts")
        if (!res.ok) return
        const data = await res.json()
        if (data.alerts) setPayload(data)
      } catch {}
    }
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <MapViewer />
      {mode === "alerts" && <AlertsView payload={payload} />}
      <Segmented mode={mode} setMode={setMode} />
    </main>
  )
}