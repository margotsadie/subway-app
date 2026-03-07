"use client"

import React, { useEffect, useState } from "react"
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

function LineBullet({
  line,
  size = "md",
  dimmed = false,
}: {
  line: string
  size?: "sm" | "md"
  dimmed?: boolean
}) {
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
        opacity: dimmed ? 0.2 : 1,
        flexShrink: 0,
      }}
    >
      {line}
    </span>
  )
}

function LineGrid({ affected }: { affected: Set<string> }) {
  return (
    <div className="grid grid-cols-7 gap-2 justify-items-center">
      {ALL_LINES.map((l) => (
        <LineBullet key={l} line={l} dimmed={!affected.has(l)} />
      ))}
    </div>
  )
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left rounded-xl bg-white dark:bg-zinc-900 p-3 shadow-sm"
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
  const affected = new Set(payload.affectedLines)
  const delays = payload.alerts.filter((a) => a.type === "delay")
  const changes = payload.alerts.filter((a) => a.type === "change")

  return (
    <div className="fixed inset-0 z-20 overflow-auto bg-zinc-100 dark:bg-black pt-16 pb-6 px-4">
      <div className="mx-auto max-w-md space-y-5">
        {/* Line status grid */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wide">
            Line Status
          </div>
          <LineGrid affected={affected} />
          <div className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500 text-center">
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
                <AlertCard key={a.id} alert={a} />
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
                <AlertCard key={a.id} alert={a} />
              ))}
            </div>
          </div>
        )}

        {/* All clear */}
        {payload.alerts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-3xl mb-2 text-green-500 font-bold">Good Service</div>
            <div className="text-sm text-zinc-500">
              All lines running normally
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MapViewer() {
  return (
    <div className="h-screen w-screen bg-white dark:bg-black">
      <TransformWrapper
        minScale={0.5}
        maxScale={12}
        initialScale={1}
        panning={{ velocityDisabled: false }}
        pinch={{ step: 5 }}
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
        limitToBounds
        centerOnInit
      >
        {({ resetTransform }) => (
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
              wrapperProps={{ style: { touchAction: "none" } }}
            >
              <img
                src="/map.png"
                alt="Subway map"
                className="block w-screen h-auto select-none"
                draggable={false}
              />
            </TransformComponent>
          </>
        )}
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