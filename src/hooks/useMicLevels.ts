import { useEffect, useRef, useState } from 'react'

const BAR_COUNT = 24
const IDLE_LEVEL = 0.08

/**
 * Živý zvukový graf (waveform) při nahrávání — Petrem výslovně vyžádáno
 * (2026-07-24) po tom, co viděl diktovací lištu přímo v Claude Code
 * (malé tlačítko + waveform + živý text, žádný "obrazovku zabírající"
 * pulzující kruh). Nezávislé na `useSpeechRecognition` (Web Speech API
 * žádný přístup k surovým audio datům nedává) — vlastní `getUserMedia` +
 * `AnalyserNode`, jen pro vizualizaci hlasitosti, přepis řeči pořád jede
 * paralelně přes `useSpeechRecognition`.
 */
export function useMicLevels(active: boolean): number[] {
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(IDLE_LEVEL))
  const rafRef = useRef<number | undefined>(undefined)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!active) {
      setLevels(Array(BAR_COUNT).fill(IDLE_LEVEL))
      return
    }

    let cancelled = false

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)

        function tick() {
          analyser.getByteFrequencyData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i]
          const avg = Math.max(IDLE_LEVEL, sum / data.length / 255)
          setLevels((prev) => [...prev.slice(1), avg])
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => {
        // Mikrofon nedostupný/zamítnutý — waveform zůstane na klidové
        // úrovni, `useSpeechRecognition` má vlastní chybovou hlášku pro
        // přepis samotný, tady nejde o kritickou funkci.
      })

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      audioCtxRef.current?.close()
      audioCtxRef.current = null
    }
  }, [active])

  return levels
}
