export type LoadedSong = {
  id: string
  title: string
  buffer: AudioBuffer
  bpm: number
  offsetMs?: number
}

export class AudioEngine {
  ctx: AudioContext
  private gain: GainNode
  private currentSource: AudioBufferSourceNode | null = null
  private startAtCtxTime = 0
  private pauseAt = 0

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.gain = this.ctx.createGain()
    this.gain.connect(this.ctx.destination)
  }

  async load(url: string): Promise<AudioBuffer> {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch failed')
      const arr = await res.arrayBuffer()
      return await this.ctx.decodeAudioData(arr.slice(0))
    } catch {
      // Fallback: generate a short tone so the game can run without assets
      return this.generateTone(440, 1.0)
    }
  }

  private generateTone(freq: number, seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate
    const length = Math.floor(seconds * sr)
    const buf = this.ctx.createBuffer(1, length, sr)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < length; i++) {
      const t = i / sr
      // light click at beats for testing
      ch[i] = 0.2 * Math.sin(2 * Math.PI * freq * t) * Math.exp(-3 * t)
    }
    return buf
  }

  play(buffer: AudioBuffer, when = 0, offset = 0) {
    this.stop()
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(this.gain)
    src.start(this.ctx.currentTime + when, offset)
    this.currentSource = src
    this.startAtCtxTime = this.ctx.currentTime - offset
    this.pauseAt = 0
  }

  pause() {
    if (!this.currentSource) return
    const t = this.time()
    this.stop()
    this.pauseAt = t
  }

  resume(buffer: AudioBuffer) {
    this.play(buffer, 0, this.pauseAt)
  }

  stop() {
    try { this.currentSource?.stop() } catch {}
    this.currentSource?.disconnect()
    this.currentSource = null
  }

  time(): number { // seconds since start
    return Math.max(0, this.ctx.currentTime - this.startAtCtxTime)
  }

  setVolume(v: number) {
    this.gain.gain.value = Math.max(0, Math.min(1, v))
  }
}
