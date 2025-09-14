// Simple onset-based auto chart from AudioBuffer
// 1) Compute RMS envelope with hop size
// 2) Detect peaks above moving average + delta
// 3) Quantize to musical grid (using bpm)
// 4) Distribute to 6 lanes and mark some as scratch

import type { Chart } from '../notes/Chart'

type Params = {
  buffer: AudioBuffer
  songId: string
  bpm: number
  densityNps?: number
  scratchRatio?: number
}

export function generateChartFromAudio(params: Params): Chart {
  const { buffer, songId, bpm } = params
  const sr = buffer.sampleRate
  const hop = Math.floor(sr * 0.023) // ~23ms hop
  const env = computeRmsEnvelope(buffer, hop)

  const peaks = detectPeaks(env, 20, 0.25) // window, sensitivity
  const timesSec = peaks.map(i => i * hop / sr)

  const notesMs = quantizeToGrid(timesSec, bpm)
  const filtered = filterMinGap(notesMs, 0.12)

  // Density control
  const targetNps = Math.min(params.densityNps ?? 4, 7)
  const duration = buffer.duration
  const maxNotes = Math.max(1, Math.floor(targetNps * duration))
  const final = filtered.length > maxNotes ? downsampleUniform(filtered, maxNotes) : filtered

  // Lane assign
  const notes: Chart['notes'] = []
  let lane = 0
  for (const tMs of final) {
    notes.push({ tMs, lane: lane % 6, type: 'tap' })
    lane++
  }

  // Scratch conversion
  const ratio = params.scratchRatio ?? 0.06
  const toScratch = Math.floor(notes.length * ratio)
  // Prefer strong beats
  const beatSec = 60 / bpm
  const strong = new Set<number>()
  for (let i = 0; i < final.length; i++) {
    const t = final[i] / 1000
    const beatPos = t / beatSec
    const nearBeat = Math.abs(beatPos - Math.round(beatPos)) < 0.12 // within ~120ms of beat
    if (nearBeat) strong.add(i)
  }
  const idxs = final.map((_, i) => i)
  idxs.sort((a, b) => Number(strong.has(b)) - Number(strong.has(a)))
  for (let i = 0; i < toScratch && i < idxs.length; i++) {
    const n = notes[idxs[i]]
    n.type = 'scratch'
  }

  notes.sort((a, b) => a.tMs - b.tMs)
  return { songId, notes }
}

function computeRmsEnvelope(buffer: AudioBuffer, hop: number): Float32Array {
  const ch0 = buffer.getChannelData(0)
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null
  const len = Math.floor(ch0.length / hop)
  const env = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const start = i * hop
    const end = Math.min(start + hop, ch0.length)
    let sum = 0
    let c = 0
    for (let j = start; j < end; j++) {
      const L = ch0[j]
      const R = ch1 ? ch1[j] : L
      const v = (L + R) * 0.5
      sum += v * v
      c++
    }
    env[i] = Math.sqrt(sum / Math.max(1, c))
  }
  // Normalize
  let max = 1e-6
  for (let i = 0; i < env.length; i++) max = Math.max(max, env[i])
  for (let i = 0; i < env.length; i++) env[i] = env[i] / max
  return env
}

function detectPeaks(env: Float32Array, win: number, sens: number): number[] {
  const peaks: number[] = []
  const avg = movingAverage(env, win)
  for (let i = 1; i < env.length - 1; i++) {
    const th = avg[i] + sens
    if (env[i] > th && env[i] > env[i - 1] && env[i] >= env[i + 1]) {
      peaks.push(i)
    }
  }
  return peaks
}

function movingAverage(arr: Float32Array, win: number): Float32Array {
  const out = new Float32Array(arr.length)
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i >= win) sum -= arr[i - win]
    out[i] = sum / Math.min(i + 1, win)
  }
  return out
}

function quantizeToGrid(timesSec: number[], bpm: number): number[] {
  const beat = 60 / bpm
  const grid = beat / 2 // eighth note
  return timesSec.map(t => Math.round(t / grid) * grid * 1000)
}

function filterMinGap(ms: number[], minGapSec: number): number[] {
  const out: number[] = []
  const minMs = minGapSec * 1000
  ms.sort((a, b) => a - b)
  let last = -1e9
  for (const t of ms) {
    if (t - last >= minMs) {
      out.push(Math.round(t))
      last = t
    }
  }
  return out
}

function downsampleUniform(ms: number[], count: number): number[] {
  const step = ms.length / count
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(ms[Math.floor(i * step)])
  }
  return out
}

