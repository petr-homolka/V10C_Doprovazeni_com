import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Spouští prohlížečové stažení Blobu bez navigace pryč ze stránky (import
 * šablona, export, záloha — M1.5, §5.5). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Tikající čas ve tvaru MM:SS (nebo HH:MM:SS) — Giant Timer (§8.1) i
 * perzistentní banner (§8.2) sdílí stejný formát, dřív duplikované na obou
 * místech zvlášť. */
export function formatElapsedClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
