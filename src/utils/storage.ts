const VERSION = 'v1'

export type ScoreData = {
  [songId: string]: {
    bestScore: number
    maxCombo: number
    counts: { p:number, g:number, m:number }
    grade: string
    fc: boolean
  }
}

export type SettingsData = {
  speed: number
  offsetMs: number
  keymap: { lanes: string[], scratch: string }
  lefty: boolean
  visual: { lowPerf: boolean, effects: boolean }
  gen?: { densityNps: number, scratchRatio: number }
  locale: 'ja' | 'en'
}

const SCORE_KEY = `djrp:${VERSION}:scores`
const SETTINGS_KEY = `djrp:${VERSION}:settings`

export function loadScores(): ScoreData { return JSON.parse(localStorage.getItem(SCORE_KEY) || '{}') }
export function saveScores(d: ScoreData) { localStorage.setItem(SCORE_KEY, JSON.stringify(d)) }

export function loadSettings(): SettingsData {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (raw) return JSON.parse(raw)
  const def: SettingsData = { speed: 1.2, offsetMs: 0, keymap: { lanes: ['a','s','d','j','k','l'], scratch: 'Enter' }, lefty: false, visual: { lowPerf: false, effects: true }, gen: { densityNps: 4, scratchRatio: 0.06 }, locale: 'ja' }
  saveSettings(def); return def
}
export function saveSettings(d: SettingsData) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(d)) }

export function exportAll() {
  const data = { scores: loadScores(), settings: loadSettings() }
  return JSON.stringify(data, null, 2)
}

export function importAll(json: string) {
  const data = JSON.parse(json)
  if (data.scores) saveScores(data.scores)
  if (data.settings) saveSettings(data.settings)
}
