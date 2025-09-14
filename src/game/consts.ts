export const JUDGEMENT = {
  PERFECT: 0,
  GOOD: 1,
  MISS: 2
} as const

export const WINDOWS_MS = {
  PERFECT: 35,
  GOOD: 80
}

export type Judgement = (typeof JUDGEMENT)[keyof typeof JUDGEMENT]

export function judge(deltaMs: number): Judgement {
  const a = Math.abs(deltaMs)
  if (a <= WINDOWS_MS.PERFECT) return JUDGEMENT.PERFECT
  if (a <= WINDOWS_MS.GOOD) return JUDGEMENT.GOOD
  return JUDGEMENT.MISS
}

export const LANES = 6

