import assert from 'node:assert/strict'
import test from 'node:test'
import { markMazeStep, resumeMazeAutoEnd } from '../src/services/mazeStep.ts'

const base = 'https://example.com/?lwt=true'
function setup({ frame = true, blocked = false } = {}) {
  let now = 1000
  let clicks = 0
  let reloads = 0
  const values = new Map<string, string>()
  const timers: Array<() => void> = []
  const button = { disabled: false, textContent: 'Encerrar tarefa', click: () => { clicks++ } }
  const doc = { getElementById: () => frame ? { contentDocument: { querySelectorAll: () => [button] } } : null }
  const win = {
    location: { href: base, reload() { reloads++ } },
    sessionStorage: {
      getItem: (key: string) => { if (blocked) throw Error(); return values.get(key) },
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => { if (blocked) throw Error(); values.delete(key) },
    },
    history: { state: null, replaceState: (_s: unknown, _t: string, href: string) => { win.location.href = href } },
    setTimeout: (run: () => void) => { timers.push(run); return timers.length },
  }
  Object.assign(globalThis, { window: win, document: doc })
  const originalNow = Date.now
  Date.now = () => now
  return { win, values, button, clicks: () => clicks, reloads: () => reloads, advance(ms = 250) { now += ms; timers.splice(0).forEach(run => run()) }, restore() { Date.now = originalNow; Reflect.deleteProperty(globalThis, 'window'); Reflect.deleteProperty(globalThis, 'document') } }
}

test('experimento encerra onboarding uma vez sem recarregar', () => {
  const env = setup()
  try {
    env.win.location.href += '&mazeNoReload=onboarding'
    markMazeStep('onboarding-complete')
    env.advance(1200)
    env.advance(2000)
    env.advance(5000)
    assert.equal(env.reloads(), 0)
    assert.equal(env.clicks(), 1)
    assert.equal(new URL(env.win.location.href).searchParams.get('mazeStep'), 'onboarding-complete')
  } finally { env.restore() }
})

for (const step of ['onboarding-complete', 'purchase-complete', 'sale-complete', 'past-entries-open'] as const) {
  test(`${step}: encerra sem recarga e clica uma só vez após widget estabilizar`, () => {
    const env = setup()
    try {
      markMazeStep(step)
      env.advance(1200)
      env.advance(1000)
      assert.equal(env.clicks(), 0)
      env.advance(1000)
      assert.equal(env.clicks(), 1)
      resumeMazeAutoEnd()
      env.advance(3000)
      assert.equal(env.clicks(), 1)
      assert.equal(env.reloads(), 0)
    } finally { env.restore() }
  })
}
for (const scenario of ['direct', 'builder', 'blocked', 'changed', 'expired', 'disabled', 'unknown-label']) {
  test(`não encerra em ${scenario}`, () => {
    const env = setup({ frame: scenario !== 'builder', blocked: scenario === 'blocked' })
    try {
      if (scenario === 'direct') env.win.location.href += '&mazeStep=purchase-complete'
      else markMazeStep('purchase-complete')
      if (scenario === 'changed') env.win.location.href = base
      if (scenario === 'expired') env.advance(31000)
      if (scenario === 'disabled') env.button.disabled = true
      if (scenario === 'unknown-label') env.button.textContent = 'Save and close window'
      resumeMazeAutoEnd()
      for (let i = 0; i < 70; i++) env.advance()
      assert.equal(env.clicks(), 0)
    } finally { env.restore() }
  })
}
