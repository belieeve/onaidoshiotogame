import { Container, Graphics, Text } from 'pixi.js'
import type { Scene } from '../engine/Scene'
import { loadSettings, saveSettings } from '../utils/storage'
import { MenuScene } from './MenuScene'

export class SettingsScene implements Scene {
  private stage = new Container()
  app!: any
  change!: (s: Scene) => void
  private state = loadSettings()

  init(): void {
    const { app } = this
    app.stage.addChild(this.stage)

    const title = new Text({ text: '設定', style: { fill: 0xffffff, fontSize: 28 } })
    title.x = 24; title.y = 24
    this.stage.addChild(title)

    let y = 80
    this.addSpeedControl(24, y); y += 70
    this.addOffsetControl(24, y); y += 70
    this.addLeftyToggle(24, y); y += 60
    this.addEffectsToggle(24, y); y += 60
    this.addLowPerfToggle(24, y); y += 60

    const saveBtn = new Graphics().roundRect(24, y + 10, 160, 44, 10).fill(0x2b7a2b)
    const saveTxt = new Text({ text: '保存', style: { fill: 0xffffff, fontSize: 16 } })
    saveTxt.x = 24 + 16; saveTxt.y = y + 10 + 12
    saveBtn.eventMode = 'static'; saveBtn.cursor = 'pointer'
    saveBtn.on('pointertap', () => { saveSettings(this.state); this.change(new MenuScene()) })
    this.stage.addChild(saveBtn, saveTxt)

    const cancelBtn = new Graphics().roundRect(200, y + 10, 160, 44, 10).fill(0x44445a)
    const cancelTxt = new Text({ text: '戻る', style: { fill: 0xffffff, fontSize: 16 } })
    cancelTxt.x = 200 + 16; cancelTxt.y = y + 10 + 12
    cancelBtn.eventMode = 'static'; cancelBtn.cursor = 'pointer'
    cancelBtn.on('pointertap', () => this.change(new MenuScene()))
    this.stage.addChild(cancelBtn, cancelTxt)
  }

  private addSpeedControl(x: number, y: number){
    const label = new Text({ text: `ノーツ速度 x${this.state.speed.toFixed(1)}`, style: { fill: 0xffffff, fontSize: 18 } })
    label.x = x; label.y = y
    this.stage.addChild(label)
    const minus = new Graphics().roundRect(x, y+28, 44, 32, 8).fill(0x44445a)
    const plus = new Graphics().roundRect(x+52, y+28, 44, 32, 8).fill(0x44445a)
    const t1 = new Text({ text: '-', style: { fill: 0xffffff, fontSize: 20 } })
    const t2 = new Text({ text: '+', style: { fill: 0xffffff, fontSize: 20 } })
    t1.x=x+16; t1.y=y+28+6; t2.x=x+52+16; t2.y=y+28+6
    minus.eventMode='static'; plus.eventMode='static'; minus.cursor='pointer'; plus.cursor='pointer'
    const update = () => { label.text = `ノーツ速度 x${this.state.speed.toFixed(1)}` }
    minus.on('pointertap', () => { this.state.speed = clamp(round1(this.state.speed - 0.1), 0.8, 2.0); update() })
    plus.on('pointertap', () => { this.state.speed = clamp(round1(this.state.speed + 0.1), 0.8, 2.0); update() })
    this.stage.addChild(minus, plus, t1, t2)
  }

  private addOffsetControl(x: number, y: number){
    const label = new Text({ text: `判定オフセット ${this.state.offsetMs} ms`, style: { fill: 0xffffff, fontSize: 18 } })
    label.x = x; label.y = y
    this.stage.addChild(label)
    const m10 = new Graphics().roundRect(x, y+28, 60, 32, 8).fill(0x44445a)
    const p10 = new Graphics().roundRect(x+68, y+28, 60, 32, 8).fill(0x44445a)
    const t1 = new Text({ text: '-10', style: { fill: 0xffffff, fontSize: 16 } })
    const t2 = new Text({ text: '+10', style: { fill: 0xffffff, fontSize: 16 } })
    t1.x=x+16; t1.y=y+28+8; t2.x=x+68+16; t2.y=y+28+8
    m10.eventMode='static'; p10.eventMode='static'; m10.cursor='pointer'; p10.cursor='pointer'
    const update = () => { label.text = `判定オフセット ${this.state.offsetMs} ms` }
    m10.on('pointertap', () => { this.state.offsetMs = clamp(this.state.offsetMs - 10, -100, 100); update() })
    p10.on('pointertap', () => { this.state.offsetMs = clamp(this.state.offsetMs + 10, -100, 100); update() })
    this.stage.addChild(m10, p10, t1, t2)
  }

  private addLeftyToggle(x: number, y: number){
    const label = new Text({ text: `左利きモード: ${this.state.lefty ? 'ON' : 'OFF'}`, style: { fill: 0xffffff, fontSize: 18 } })
    label.x = x; label.y = y
    this.stage.addChild(label)
    const btn = new Graphics().roundRect(x, y+28, 120, 32, 8).fill(0x44445a)
    const t = new Text({ text: '切替', style: { fill: 0xffffff, fontSize: 16 } })
    t.x=x+40; t.y=y+28+8
    btn.eventMode='static'; btn.cursor='pointer'
    btn.on('pointertap', () => { this.state.lefty = !this.state.lefty; label.text = `左利きモード: ${this.state.lefty ? 'ON' : 'OFF'}` })
    this.stage.addChild(btn, t)
  }

  private addEffectsToggle(x: number, y: number){
    const label = new Text({ text: `演出効果: ${this.state.visual.effects ? 'ON' : 'OFF'}`, style: { fill: 0xffffff, fontSize: 18 } })
    label.x = x; label.y = y
    this.stage.addChild(label)
    const btn = new Graphics().roundRect(x, y+28, 120, 32, 8).fill(0x44445a)
    const t = new Text({ text: '切替', style: { fill: 0xffffff, fontSize: 16 } })
    t.x=x+40; t.y=y+28+8
    btn.eventMode='static'; btn.cursor='pointer'
    btn.on('pointertap', () => { this.state.visual.effects = !this.state.visual.effects; label.text = `演出効果: ${this.state.visual.effects ? 'ON' : 'OFF'}` })
    this.stage.addChild(btn, t)
  }

  private addLowPerfToggle(x: number, y: number){
    const label = new Text({ text: `低負荷モード: ${this.state.visual.lowPerf ? 'ON' : 'OFF'}`, style: { fill: 0xffffff, fontSize: 18 } })
    label.x = x; label.y = y
    this.stage.addChild(label)
    const btn = new Graphics().roundRect(x, y+28, 140, 32, 8).fill(0x44445a)
    const t = new Text({ text: '切替', style: { fill: 0xffffff, fontSize: 16 } })
    t.x=x+50; t.y=y+28+8
    btn.eventMode='static'; btn.cursor='pointer'
    btn.on('pointertap', () => { this.state.visual.lowPerf = !this.state.visual.lowPerf; label.text = `低負荷モード: ${this.state.visual.lowPerf ? 'ON' : 'OFF'}` })
    this.stage.addChild(btn, t)
  }

  update(): void {}

  dispose(): void {
    this.stage.removeFromParent(); this.stage.destroy({ children: true })
  }
}

function clamp(v: number, min: number, max: number){ return Math.max(min, Math.min(max, v)) }
function round1(v: number){ return Math.round(v*10)/10 }
