import { LANES } from '../consts'

export type NoteType = 'tap' | 'scratch'

export type Note = {
  tMs: number
  lane: number // 0..5 for taps, 6 reserved for scratch logical lane
  type: NoteType
}

export type Chart = {
  songId: string
  notes: Note[]
  meta?: {
    bpm?: number
  }
}

export function sortChart(c: Chart): Chart {
  return { ...c, notes: [...c.notes].sort((a, b) => a.tMs - b.tMs) }
}

export function clampLane(lane: number) {
  return Math.max(0, Math.min(LANES - 1, lane))
}

