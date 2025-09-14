import { Container, Graphics, Text } from 'pixi.js'
import type { Scene } from '../engine/Scene'
import { AudioEngine } from '../engine/audio/Audio'
import { DEFAULT_KEYMAP, InputManager } from '../game/input/InputManager'
import { judge, JUDGEMENT, LANES } from '../game/consts'
import { getSongById } from '../data/songs'
import { generateAutoChart } from '../game/autoChart/autoChart'
import { generateChartFromAudio } from '../game/autoChart/fromAudio'
import { loadSettings } from '../utils/storage'
import { ResultScene } from './ResultScene'
import { MenuScene } from './MenuScene'

type HitStat = { p: number, g: number, m: number, combo: number, maxCombo: number, score: number }

export class PlayScene implements Scene {
  private stage = new Container()
  app!: any
  change!: (s: Scene) => void

  private audio = new AudioEngine()
  private input = new InputManager(DEFAULT_KEYMAP)
  private stat: HitStat = { p:0,g:0,m:0,combo:0,maxCombo:0,score:0 }
  private chart = { notes: [] as { tMs:number, lane:number, type:'tap'|'scratch' }[] }
  private songId: string
  private started = false
  private lanesGfx: Graphics[] = []
  private mobileButtons: Graphics[] = []
  private scratchDisk?: Graphics
  private scratchSpin = 0
  private scratchX = 0
  private scratchY = 0
  private settings = loadSettings()
  private songDurMs = 0
  private totalNotes = 0
  private paused = false
  private pauseLayer?: Container
  private buffer?: AudioBuffer
  private escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') this.togglePause() }
  private effects: { g: Graphics, life: number, max: number }[] = []
  private pulse = { a: 0, color: 0x000000 }
  private lastNow = performance.now()
  private songOffsetMs = 0
  private floatTexts: { t: Text, life: number, max: number }[] = []
  private comboText?: Text
  private lastComboShown = 0

  constructor(songId: string) { this.songId = songId }

  async init() {
    const { app } = this
    app.stage.addChild(this.stage)

    const song = getSongById(this.songId)
    this.songOffsetMs = song.offsetMs ?? 0
    const info = new Text({ text: `曲: ${song.title}`, style:{ fill:0xffffff, fontSize:18 } })
    info.x = 24; info.y = 24
    this.stage.addChild(info)

    // Lanes setup
    const W = app.renderer.width
    const H = app.renderer.height
    const margin = 40
    const laneW = (W - margin*2) / LANES
    const top = 80
    const bottom = H - 80
    for (let i=0;i<LANES;i++){
      const g = new Graphics()
      const drawX = margin + i*laneW + 4
      g.roundRect(drawX, top, laneW - 8, bottom-top, 10).fill(0x22223a)
      this.stage.addChild(g)
      this.lanesGfx.push(g)
    }

    // Mobile buttons (simple hit pads at bottom)
    const isTouch = matchMedia('(pointer: coarse)').matches
    if (isTouch) {
      const padH = 64
      for (let i=0;i<LANES;i++){
        const g = new Graphics()
        g.roundRect(margin + i*laneW + 6, H - padH - 10, laneW - 12, padH, 10).fill(0x1a1a2a)
        g.eventMode = 'static'; g.cursor = 'pointer'
        const laneIdx = i
        g.on('pointerdown', () => this.tryHit(this.mapLane(laneIdx)))
        this.stage.addChild(g)
        this.mobileButtons.push(g)
      }
      // Scratch disk (bottom-right)
      const disk = new Graphics()
      const r = Math.min(80, Math.min(laneW, padH)*0.9)
      this.scratchX = W - margin - r
      this.scratchY = H - padH - 20 - r
      disk.circle(this.scratchX, this.scratchY, r).fill(0x332244)
      disk.eventMode = 'static'; disk.cursor = 'pointer'
      disk.on('pointerdown', () => this.tryHitScratch())
      this.stage.addChild(disk)
      this.scratchDisk = disk
    }

    // Load audio and autogenerate chart from audio (fallback to grid)
    const buffer = await this.audio.load(song.audioUrl)
    try {
      const density = this.settings.gen?.densityNps ?? 4
      const scratch = this.settings.gen?.scratchRatio ?? 0.06
      this.chart = generateChartFromAudio({ buffer, songId: song.id, bpm: song.bpm, densityNps: density, scratchRatio: scratch })
    } catch {
      const seed = this.songId.split('').reduce((a,c)=>a+c.charCodeAt(0),0)
      const rand = mulberry32(seed)
      const origRandom = Math.random
      ;(Math as any).random = rand
      const density = this.settings.gen?.densityNps ?? 4
      const scratch = this.settings.gen?.scratchRatio ?? 0.06
      this.chart = generateAutoChart({ bpm: song.bpm, durationSec: buffer.duration, songId: song.id, densityNps: density, scratchRatio: scratch })
      ;(Math as any).random = origRandom
    }
    this.totalNotes = this.chart.notes.length
    this.buffer = buffer
    this.songDurMs = buffer.duration * 1000
    await new Promise(r => setTimeout(r, 1000))
    this.audio.play(buffer)
    this.started = true

    // Input handling -> simple feedback highlight
    this.input.on((type, lane) => {
      if (this.paused) return
      if (typeof lane === 'number') {
        const idx = lane
        const visIdx = this.visualLane(idx)
        this.lanesGfx[visIdx].tint = type==='down' ? 0x4a7fff : 0xffffff
        if (type==='down') this.tryHit(idx)
      }
      if (lane === 'scratch' && type==='down') this.tryHitScratch()
    })

    // pause UI and ESC
    this.addPauseButton()
    window.addEventListener('keydown', this.escHandler)
  }

  private visualLane(lane: number){
    return this.settings.lefty ? (LANES - 1 - lane) : lane
  }

  private mapLane(visualLane: number){
    return this.settings.lefty ? (LANES - 1 - visualLane) : visualLane
  }

  private tryHit(lane: number) {
    const tMs = this.audio.time()*1000 + this.settings.offsetMs + this.songOffsetMs
    // Find nearest upcoming note on this lane
    const idx = this.chart.notes.findIndex(n => n.type==='tap' && n.lane===lane && tMs - n.tMs <= 120 && n.tMs - tMs <= 120)
    if (idx>=0){
      const n = this.chart.notes[idx]
      const j = judge(tMs - n.tMs)
      if (j===JUDGEMENT.PERFECT){ this.stat.p++; this.stat.combo++; this.stat.score+=100 }
      else if (j===JUDGEMENT.GOOD){ this.stat.g++; this.stat.combo++; this.stat.score+=70 }
      else { this.stat.m++; this.stat.combo=0 }
      this.stat.maxCombo = Math.max(this.stat.maxCombo, this.stat.combo)
      this.chart.notes.splice(idx,1)
      this.spawnHitEffect(lane, j)
    }
  }

  private tryHitScratch() {
    const tMs = this.audio.time()*1000 + this.settings.offsetMs + this.songOffsetMs
    const idx = this.chart.notes.findIndex(n => n.type==='scratch' && tMs - n.tMs <= 120 && n.tMs - tMs <= 120)
    if (idx>=0){
      const n = this.chart.notes[idx]
      const j = judge(tMs - n.tMs)
      if (j===JUDGEMENT.PERFECT){ this.stat.p++; this.stat.combo++; this.stat.score+=100 }
      else if (j===JUDGEMENT.GOOD){ this.stat.g++; this.stat.combo++; this.stat.score+=70 }
      else { this.stat.m++; this.stat.combo=0 }
      this.stat.maxCombo = Math.max(this.stat.maxCombo, this.stat.combo)
      this.chart.notes.splice(idx,1)
      this.spawnHitEffect(-1, j) // scratch
      this.scratchSpin += 0.8
    }
  }

  update() {
    const now = performance.now()
    const dt = (now - this.lastNow) / 1000
    this.lastNow = now
    const { app } = this
    const W = app.renderer.width
    const H = app.renderer.height
    const margin = 40
    const top = 80
    const bottom = H - 80
    const hitY = bottom - 20

    // Clear note drawings by redrawing lanes (cheap for now)
    for (const g of this.lanesGfx){ g.clear().roundRect(g.x, top, g.width, bottom-top, 10).fill(0x22223a) }

    // Render moving notes
    const speedPxPerSec = 600 * this.settings.speed
    const tMs = this.audio.time()*1000 + this.settings.offsetMs + this.songOffsetMs
    const viewportMs = (bottom - top) / speedPxPerSec * 1000
    // Auto miss for overdue notes
    while (this.chart.notes.length && this.chart.notes[0].tMs < tMs - 120) {
      this.stat.m++; this.stat.combo = 0
      this.chart.notes.shift()
    }
    for (const n of this.chart.notes){
      const dt = n.tMs - tMs
      if (dt < -200 || dt > viewportMs) continue
      const y = top + (dt/1000)*speedPxPerSec
      const g = new Graphics()
      if (n.type==='scratch') {
        const x = this.scratchDisk ? this.scratchX : (W - margin - ((W - margin*2)/LANES)/2)
        g.circle(x, y, 10).fill(0xffd24f)
      } else {
        const visLane = this.visualLane(n.lane)
        const laneG = this.lanesGfx[visLane]
        g.roundRect(laneG.x+6, y-8, laneG.width-12, 12, 6).fill(0x4fffaf)
      }
      this.stage.addChild(g)
      // Auto cleanup next frame
      queueMicrotask(() => g.destroy())
    }

    // Hit line
    const line = new Graphics().rect(0, hitY, W, 2).fill(0x6666aa)
    this.stage.addChild(line); queueMicrotask(()=>line.destroy())

    // Effects update
    if (this.settings.visual.effects) {
      // Hit particles
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i]
        e.life -= dt
        const t = Math.max(0, e.life / e.max)
        e.g.alpha = t
        e.g.scale.set(1 + (1 - t) * 0.6)
        if (e.life <= 0) {
          e.g.removeFromParent(); e.g.destroy(); this.effects.splice(i, 1)
        }
      }
      // Background pulse overlay
      if (!this.settings.visual.lowPerf && this.pulse.a > 0) {
        this.pulse.a = Math.max(0, this.pulse.a - dt * 2.5)
        const ov = new Graphics().rect(0,0,W,H).fill(this.pulse.color, Math.min(0.25, this.pulse.a))
        this.stage.addChild(ov); queueMicrotask(() => ov.destroy())
      }
    }

    // Scratch disk spin decay
    if (this.scratchDisk) {
      this.scratchSpin *= 0.9
      this.scratchDisk.rotation += this.scratchSpin * dt * 10
    }

    // Float judge texts update
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const e = this.floatTexts[i]
      e.life -= dt
      const t = Math.max(0, e.life / e.max)
      e.t.alpha = t
      e.t.y -= 60 * dt
      if (e.life <= 0) { e.t.removeFromParent(); e.t.destroy(); this.floatTexts.splice(i,1) }
    }

    // Combo text fade
    if (this.comboText) {
      if (this.stat.combo === 0) this.comboText.alpha = Math.max(0, this.comboText.alpha - dt * 3)
      else this.comboText.alpha = Math.min(1, this.comboText.alpha + dt * 2)
    }

    // Heads-up info
    const hud = new Text({ text: `Score ${this.stat.score}  Combo ${this.stat.combo}  P:${this.stat.p} G:${this.stat.g} M:${this.stat.m}  Spd x${this.settings.speed.toFixed(1)}  Off ${this.settings.offsetMs}ms`, style:{ fill:0xffffff, fontSize:14 } })
    hud.x = 24; hud.y = 56; this.stage.addChild(hud); queueMicrotask(()=>hud.destroy())

    // End detection -> go to result
    if (this.started && tMs > this.songDurMs + 500) {
      this.started = false
      // Remaining notes count as misses
      this.stat.m += this.chart.notes.length
      this.chart.notes.length = 0
      const counts = { p: this.stat.p, g: this.stat.g, m: this.stat.m }
      const maxCombo = this.stat.maxCombo
      const score = this.stat.score
      const summary = { songId: this.songId, total: this.totalNotes, score, maxCombo, counts }
      // delay a tick to avoid destroying during update
      setTimeout(() => { this.change(new ResultScene(summary)) }, 0)
    }
  }

  dispose(): void {
    this.input.dispose()
    this.audio.stop()
    window.removeEventListener('keydown', this.escHandler)
    this.stage.removeFromParent()
    this.stage.destroy({ children: true })
  }

  private addPauseButton(){
    const btn = new Graphics().roundRect(0,0,80,36,8).fill(0x44445a)
    const txt = new Text({ text: 'Pause', style: { fill: 0xffffff, fontSize: 16 } })
    const W = this.app.renderer.width
    btn.x = W - 100; btn.y = 24; txt.x = btn.x + 14; txt.y = btn.y + 8
    btn.eventMode = 'static'; btn.cursor = 'pointer'
    btn.on('pointertap', () => this.togglePause())
    this.stage.addChild(btn, txt)
  }

  private togglePause(){
    if (!this.started) return
    this.paused = !this.paused
    if (this.paused) {
      this.audio.pause()
      this.showPauseOverlay()
    } else {
      this.hidePauseOverlay()
      if (this.buffer) this.audio.resume(this.buffer)
    }
  }

  private showPauseOverlay(){
    if (this.pauseLayer) return
    const layer = new Container()
    const bg = new Graphics().rect(0,0,this.app.renderer.width,this.app.renderer.height).fill(0x000000, 0.5)
    const panel = new Graphics().roundRect(0,0,300,200,12).fill(0x22223a)
    panel.x = (this.app.renderer.width-300)/2
    panel.y = (this.app.renderer.height-200)/2
    const title = new Text({ text: '一時停止', style: { fill: 0xffffff, fontSize: 20 } })
    title.x = panel.x + 20; title.y = panel.y + 16

    const makeBtn = (label: string, x: number, y: number, cb: () => void) => {
      const b = new Graphics().roundRect(x, y, 120, 40, 10).fill(0x44445a)
      const t = new Text({ text: label, style: { fill: 0xffffff, fontSize: 16 } })
      t.x = x + 20; t.y = y + 10
      b.eventMode='static'; b.cursor='pointer'; b.on('pointertap', cb)
      layer.addChild(b, t)
    }

    makeBtn('再開', panel.x + 24, panel.y + 60, () => { this.paused=false; this.hidePauseOverlay(); if (this.buffer) this.audio.resume(this.buffer) })
    makeBtn('リトライ', panel.x + 156, panel.y + 60, () => { this.change(new PlayScene(this.songId)) })
    makeBtn('曲選択へ', panel.x + 24, panel.y + 120, () => { this.change(new MenuScene()) })

    layer.addChild(bg, panel, title)
    this.stage.addChild(layer)
    this.pauseLayer = layer
  }

  private hidePauseOverlay(){
    this.pauseLayer?.removeFromParent()
    this.pauseLayer?.destroy({ children: true })
    this.pauseLayer = undefined
  }

  private spawnHitEffect(lane: number, j: number){
    if (!this.settings.visual.effects) return
    const W = this.app.renderer.width
    const H = this.app.renderer.height
    const margin = 40
    const top = 80
    const bottom = H - 80
    const hitY = bottom - 20
    const color = j === JUDGEMENT.PERFECT ? 0x66ffd0 : 0xffe37a
    const g = new Graphics()
    if (lane === -1) {
      const x = this.scratchDisk ? this.scratchX : (W - margin - ((W - margin*2)/LANES)/2)
      g.circle(x, hitY, 16).fill(color)
    } else {
      const vis = this.visualLane(lane)
      const laneG = this.lanesGfx[vis]
      g.roundRect(laneG.x+6, hitY-10, laneG.width-12, 20, 8).fill(color)
    }
    g.alpha = 0.9
    this.stage.addChild(g)
    this.effects.push({ g, life: 0.25, max: 0.25 })
    if (!this.settings.visual.lowPerf) {
      this.pulse.color = color
      this.pulse.a = Math.min(1, this.pulse.a + (j === JUDGEMENT.PERFECT ? 0.5 : 0.3))
    }
  }

  private spawnJudgeText(j: number){
    if (!this.settings.visual.effects) return
    const W = this.app.renderer.width
    const H = this.app.renderer.height
    const bottom = H - 80
    const hitY = bottom - 20
    const text = j===JUDGEMENT.PERFECT ? 'Perfect' : (j===JUDGEMENT.GOOD ? 'Good' : 'Miss')
    const color = j===JUDGEMENT.PERFECT ? 0x66ffd0 : (j===JUDGEMENT.GOOD ? 0xffe37a : 0xff6a6a)
    const t = new Text({ text, style: { fill: color, fontSize: 18, stroke: { color: 0x000000, width: 2 } } })
    t.x = this.app.renderer.width/2 - t.width/2
    t.y = hitY - 40
    this.stage.addChild(t)
    this.floatTexts.push({ t, life: 0.5, max: 0.5 })
  }

  private updateComboText(){
    if (!this.comboText){
      this.comboText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 28, stroke: { color: 0x000000, width: 3 } } })
      this.comboText.x = this.app.renderer.width/2 - 40
      this.comboText.y = 16
      this.comboText.alpha = 0
      this.stage.addChild(this.comboText)
    }
    if (this.stat.combo > 0){
      this.comboText.text = `${this.stat.combo} COMBO`
      if (this.stat.combo > this.lastComboShown){
        this.comboText.scale.set(1.2)
      }
      this.lastComboShown = this.stat.combo
      // ease scale back
      const tweenBack = () => { if (!this.comboText) return; this.comboText.scale.x = this.comboText.scale.y = Math.max(1, this.comboText.scale.x - 0.05) }
      tweenBack()
      this.comboText.alpha = 1
    } else {
      this.lastComboShown = 0
    }
  }
}

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
