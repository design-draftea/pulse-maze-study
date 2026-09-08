import assert from 'node:assert/strict'
import test from 'node:test'
import { isTask1ViewportExperiment, installTask1ViewportExperiment } from '../src/services/mazeTask1Viewport.ts'

test('viewport experiment requires explicit onboarding opt-in', () => {
  assert.equal(isTask1ViewportExperiment('?task=onboarding&viewportFix=1&lwt=true'), true)
  for (const search of ['', '?viewportFix=1', '?task=onboarding', '?task=sell&viewportFix=1', '?task=tracking&viewportFix=1', '?task=buy&viewportFix=1']) {
    assert.equal(isTask1ViewportExperiment(search), false, search)
  }
})

test('late scroll is corrected, but user gestures and the deadline release the guard', () => {
  const original = new Map(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const timeouts: { run: () => void; delay: number }[] = []
  let poll = () => {}
  const widgetDocument = new EventTarget()
  const win = Object.assign(new EventTarget(), {
    location: { search: '?task=onboarding&viewportFix=1', hash: '' },
    scrollY: 0, scrollX: 0,
    visualViewport: new EventTarget(),
    scrollTo() { this.scrollY = 0; this.scrollX = 0 },
    setTimeout(run: () => void, delay: number) { timeouts.push({ run, delay }); return 0 },
    setInterval(run: () => void) { poll = run; return 0 },
    clearInterval() { poll = () => {} },
  })
  Object.assign(globalThis, { window: win, document: { getElementById: () => ({ contentDocument: widgetDocument }) }, requestAnimationFrame: (run: () => void) => { run(); return 0 }, cancelAnimationFrame: () => {} })
  let dispose = () => {}
  try {
    dispose = installTask1ViewportExperiment()
    // The first revision stopped at 1s. A late focus/scroll must still reset.
    win.scrollY = 160
    poll()
    assert.equal(win.scrollY, 0)
    win.scrollY = 120
    win.dispatchEvent(new Event('scroll'))
    assert.equal(win.scrollY, 0)
    widgetDocument.dispatchEvent(new Event('touchstart'))
    win.scrollY = 200
    poll()
    win.dispatchEvent(new Event('scroll'))
    assert.equal(win.scrollY, 200, 'widget interaction releases the page')
    dispose()

    dispose = installTask1ViewportExperiment()
    win.location.hash = '#entradas'
    win.scrollY = 90
    poll()
    assert.equal(win.scrollY, 90, 'never overrides a navigation destination')
    win.location.hash = ''
    timeouts.filter(timer => timer.delay === 8000).forEach(timer => timer.run())
    win.scrollY = 300
    win.dispatchEvent(new Event('scroll'))
    poll()
    assert.equal(win.scrollY, 300, 'startup guard expires even without interaction')
  } finally {
    dispose()
    original.forEach((descriptor, key) => descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key))
  }
})
