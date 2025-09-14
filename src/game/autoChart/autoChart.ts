import type { Chart } from '../notes/Chart'

type AutoParams = {
  bpm: number
  durationSec: number
  songId: string
  scratchRatio?: number // 0..1
  densityNps?: number // average notes per second target
}

// Simple grid-based autogenerator: places notes on beats/8 with density control.
export function generateAutoChart(params: AutoParams): Chart {
  const { bpm, durationSec, songId } = params
  const scratchRatio = params.scratchRatio ?? 0.06
  const targetNps = Math.min(params.densityNps ?? 4, 7)

  const beatSec = 60 / bpm
  const gridSec = beatSec / 2 // 1/2 beat (eighth-notes)
  const notes = [] as Chart['notes']

  const totalSlots = Math.floor(durationSec / gridSec)
  const p = targetNps * gridSec // probability per slot

  let lane = 0
  for (let i = 0; i < totalSlots; i++) {
    if (Math.random() < p) {
      const tSec = i * gridSec
      const tMs = Math.round(tSec * 1000)
      // assign lane in round-robin to avoid clustering
      notes.push({ tMs, lane: lane % 6, type: 'tap' })
      lane++
    }
  }

  // Convert some notes to scratch by ratio, pick strong beats preferentially
  const strongIdx = new Set<number>()
  const beatSlots = Math.max(1, Math.round(beatSec / gridSec)) // 2 slots per beat
  for (let i = 0; i < totalSlots; i += beatSlots) strongIdx.add(i)

  const taps = notes.filter(n => n.type === 'tap')
  const toScratch = Math.floor(taps.length * scratchRatio)
  taps.sort((a, b) => (strongIdx.has(Math.round(a.tMs / (gridSec*1000))) ? -1 : 1))
  for (let i = 0; i < toScratch && i < taps.length; i++) {
    taps[i].type = 'scratch'
    taps[i].lane = 0 // keep lane 0 for position; PlayScene draws by lane but scratch is judged separately
  }

  notes.sort((a, b) => a.tMs - b.tMs)
  return { songId, notes }
}
