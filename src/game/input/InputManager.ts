export type KeyMap = {
  lanes: string[] // 6 keys
  scratch: string // e.g., Enter
}

export type InputState = {
  lanes: boolean[]
  scratch: boolean
}

export class InputManager {
  private map: KeyMap
  state: InputState = { lanes: [false, false, false, false, false, false], scratch: false }
  private listeners: Array<(type: 'down'|'up', lane: number|'scratch') => void> = []

  constructor(map: KeyMap) {
    this.map = map
    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyUp = this.onKeyUp.bind(this)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }

  private onKeyDown(e: KeyboardEvent) {
    const key = e.key.toLowerCase()
    const laneIdx = this.map.lanes.findIndex(k => k.toLowerCase() === key)
    if (laneIdx >= 0) {
      if (!this.state.lanes[laneIdx]) this.emit('down', laneIdx)
      this.state.lanes[laneIdx] = true
    }
    if (this.map.scratch.toLowerCase() === key) {
      if (!this.state.scratch) this.emit('down', 'scratch')
      this.state.scratch = true
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    const key = e.key.toLowerCase()
    const laneIdx = this.map.lanes.findIndex(k => k.toLowerCase() === key)
    if (laneIdx >= 0) {
      if (this.state.lanes[laneIdx]) this.emit('up', laneIdx)
      this.state.lanes[laneIdx] = false
    }
    if (this.map.scratch.toLowerCase() === key) {
      if (this.state.scratch) this.emit('up', 'scratch')
      this.state.scratch = false
    }
  }

  on(listener: (type: 'down'|'up', lane: number|'scratch') => void) {
    this.listeners.push(listener)
  }

  private emit(type: 'down'|'up', lane: number|'scratch') {
    for (const fn of this.listeners) fn(type, lane)
  }
}

export const DEFAULT_KEYMAP: KeyMap = {
  lanes: ['a','s','d','j','k','l'],
  scratch: 'Enter'
}

