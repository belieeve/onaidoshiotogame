import { Container, Graphics, Text } from 'pixi.js'
import type { Scene } from '../../engine/Scene'
import { loadSettings, saveSettings } from '../../utils/storage'

export class CalibrationScene implements Scene {
  private stage = new Container()
  app!: any
  change!: (s: Scene) => void
  private ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  private clicks: number[] = [] // scheduled click times (ctx time)
  private taps: number[] = [] // user tap times (ctx time)
  private running = false
  private info!: Text
  private avgMs = 0

  async init() {
    this.app.stage.addChild(this.stage)
    const title = new Text({ text: 'キャリブレーション', style: { fill: 0xffffff, fontSize: 28 } })
    title.x = 24; title.y = 24; this.stage.addChild(title)
    this.info = new Text({ text: '説明: クリック音に合わせて画面をタップ/Enter。8回以上で精度UP。', style: { fill: 0xccccff, fontSize: 16 } })
    this.info.x = 24; this.info.y = 64; this.stage.addChild(this.info)

    const back = new Graphics().roundRect(24, 100, 160, 44, 10).fill(0x44445a)
    const backT = new Text({ text: '戻る', style: { fill: 0xffffff, fontSize: 16 } })
    backT.x = 24 + 16; backT.y = 100 + 12
    back.eventMode='static'; back.cursor='pointer'; back.on('pointertap', () => {
      const { SettingsScene } = require('../SettingsScene')
      this.change(new SettingsScene())
    })
    this.stage.addChild(back, backT)

    const apply = new Graphics().roundRect(200, 100, 200, 44, 10).fill(0x2b7a2b)
    const applyT = new Text({ text: '推定を適用', style: { fill: 0xffffff, fontSize: 16 } })
    applyT.x = 200 + 40; applyT.y = 100 + 12
    apply.eventMode='static'; apply.cursor='pointer'; apply.on('pointertap', () => this.apply())
    this.stage.addChild(apply, applyT)

    // tap listeners
    window.addEventListener('keydown', this.onKey)
    this.stage.eventMode='static'; this.stage.on('pointerdown', this.onTap)

    // start clicks
    this.running = true
    this.scheduleClicks()
  }

  update(): void {
    if (!this.running) return
    const W = this.app.renderer.width
    const H = this.app.renderer.height
    const t = this.ctx.currentTime
    // simple visual metronome
    const phase = (t % 0.6) / 0.6
    const r = 20 + 10 * Math.sin(phase * Math.PI * 2)
    const g = new Graphics().circle(W-60, 60, r).fill(0xff4fd8)
    this.stage.addChild(g); queueMicrotask(()=>g.destroy())
  }

  dispose(): void {
    this.running = false
    window.removeEventListener('keydown', this.onKey)
    this.stage.off('pointerdown', this.onTap)
    this.stage.removeFromParent(); this.stage.destroy({ children: true })
  }

  private scheduleClicks(){
    const click = this.makeClick()
    const start = this.ctx.currentTime + 0.5
    const interval = 0.6 // 100 BPM相当
    for (let i=0;i<32;i++){
      const t = start + i*interval
      const src = this.ctx.createBufferSource()
      src.buffer = click
      src.connect(this.ctx.destination)
      src.start(t)
      this.clicks.push(t)
    }
  }

  private makeClick(): AudioBuffer {
    const sr = this.ctx.sampleRate
    const len = Math.floor(sr * 0.05)
    const b = this.ctx.createBuffer(1, len, sr)
    const d = b.getChannelData(0)
    for (let i=0;i<len;i++){
      const t = i/sr
      // short DC pulse envelope
      d[i] = Math.exp(-50*t)
    }
    return b
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'enter' || e.key.toLowerCase() === ' ') this.captureTap()
  }
  private onTap = () => { this.captureTap() }

  private captureTap(){
    const now = this.ctx.currentTime
    this.taps.push(now)
    // nearest click
    let nearest = this.clicks[0]
    let best = Infinity
    for (const c of this.clicks){
      const diff = Math.abs(c - now)
      if (diff < best){ best = diff; nearest = c }
    }
    const lagSec = now - nearest
    const lagMs = Math.round(lagSec * 1000)
    // simple running average
    const n = this.taps.length
    this.avgMs = Math.round(((this.avgMs * (n-1)) + lagMs) / n)
    this.info.text = `サンプル: ${n}  平均ラグ: ${this.avgMs}ms  推奨オフセット: ${-this.avgMs}ms`
  }

  private apply(){
    const s = loadSettings()
    s.offsetMs = -this.avgMs
    saveSettings(s)
    const { SettingsScene } = require('../SettingsScene')
    this.change(new SettingsScene())
  }
}

