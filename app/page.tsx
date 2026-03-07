"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"

type Mode = "map" | "alerts"

type AlertItem = {
  id: string
  header: string
  description: string
}

type AlertsPayload = {
  updatedAt: string
  byLine: Record<string, AlertItem[]>
}

const MOCK: AlertsPayload = {
  updatedAt: new Date().toISOString(),
  byLine: {
    A: [
      {
        id: "a1",
        header: "Delays on A",
        description: "Expect longer headways due to signal issues near Midtown",
      },
    ],
    6: [
      {
        id: "61",
        header: "Service change on 6",
        description: "Trains run local only in Manhattan during overnight hours",
      },
    ],
  },
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
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
          Map + Alerts
        </button>
      </div>
    </div>
  )
}

function MapViewer() {
  const MIN_SCALE = 0.6
  const MAX_SCALE = 12
  const latestRef = useRef({ x: 0, y: 0, scale: 1 })

  return (
    <div className="h-screen w-screen bg-white dark:bg-black">
      <TransformWrapper
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        initialScale={1}
        panning={{ disabled: false, velocityDisabled: false }}
        pinch={{ step: 12 }}
        wheel={{ disabled: true }}
        doubleClick={{ disabled: true }}
        limitToBounds
        centerOnInit
      >
        {({ resetTransform, setTransform, state, centerView }) => {
          latestRef.current = {
            x: state?.positionX ?? latestRef.current.x,
            y: state?.positionY ?? latestRef.current.y,
            scale: state?.scale ?? latestRef.current.scale,
          }

          useEffect(() => {
            centerView(1)
          }, [centerView])

          const onWheelCapture = (e: React.WheelEvent) => {
            e.preventDefault()

            const { x, y, scale } = latestRef.current

            const isZoom =
              (e as any).ctrlKey === true || (e as any).altKey === true

            if (isZoom) {
              const factor = Math.exp(-e.deltaY * 0.01)
              const nextScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE)
              setTransform(x, y, nextScale, 0)
            } else {
              setTransform(x - e.deltaX, y - e.deltaY, scale, 0)
            }
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
                  onWheelCapture,
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

function BottomSheet({ payload }: { payload: AlertsPayload }) {
  const [expanded, setExpanded] = useState(false)
  const lines = useMemo(
    () =>
      Object.entries(payload.byLine).filter(([, items]) => items.length > 0),
    [payload]
  )

  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto w-full max-w-md px-3 pb-3">
        <div
          className="rounded-2xl bg-white shadow-xl dark:bg-zinc-950"
          style={{
            height: expanded ? "60vh" : "90px",
            transition: "height 200ms ease",
          }}
        >
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 pt-4 text-left"
          >
            <div className="text-sm font-semibold">
              Service Alerts
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              Updated {new Date(payload.updatedAt).toLocaleTimeString()}
            </div>
          </button>

          {expanded && (
            <div className="mt-2 h-[calc(60vh-80px)] overflow-auto px-3 pb-3">
              {lines.length === 0 && (
                <div className="text-sm">No alerts</div>
              )}

              {lines.map(([line, items]) => (
                <div key={line} className="mb-4">
                  <div className="font-bold text-sm mb-2">{line}</div>
                  {items.map((a) => (
                    <div key={a.id} className="mb-2 text-sm">
                      <div className="font-semibold">{a.header}</div>
                      <div className="text-zinc-600 dark:text-zinc-400">
                        {a.description}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("map")
  const [payload, setPayload] = useState<AlertsPayload>(MOCK)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/alerts")
        if (!res.ok) return
        const data = await res.json()
        if (data.byLine) setPayload(data)
      } catch {}
    }

    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <Segmented mode={mode} setMode={setMode} />
      <MapViewer />
      {mode === "alerts" && <BottomSheet payload={payload} />}
    </main>
  )
}