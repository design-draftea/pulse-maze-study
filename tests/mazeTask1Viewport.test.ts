import assert from 'node:assert/strict'
import test from 'node:test'
import { isTask1ViewportExperiment } from '../src/services/mazeTask1Viewport.ts'

test('viewport experiment requires explicit onboarding opt-in', () => {
  assert.equal(isTask1ViewportExperiment('?task=onboarding&viewportFix=1&lwt=true'), true)
  for (const search of ['', '?viewportFix=1', '?task=onboarding', '?task=sell&viewportFix=1', '?task=tracking&viewportFix=1', '?task=buy&viewportFix=1']) {
    assert.equal(isTask1ViewportExperiment(search), false, search)
  }
})
