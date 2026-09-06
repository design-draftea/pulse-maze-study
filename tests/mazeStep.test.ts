import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMazeStepUrl,
  getMazeStep,
  markMazeStep,
} from '../src/services/mazeStep.ts'

const BASE = 'https://design-draftea.github.io/pulse-maze-study/'

interface FakeWindow {
  location: { href: string }
  history: {
    state: unknown
    replaceState: (state: unknown, title: string, url: string) => void
    pushState: (state: unknown, title: string, url: string) => void
    replaceCalls: string[]
    pushCalls: string[]
  }
}

const installWindow = (href: string): FakeWindow => {
  const fake: FakeWindow = {
    location: { href },
    history: {
      state: null,
      replaceCalls: [],
      pushCalls: [],
      replaceState(state, _title, url) {
        this.state = state
        this.replaceCalls.push(url)
        fake.location.href = new URL(url, fake.location.href).toString()
      },
      pushState(state, _title, url) {
        this.state = state
        this.pushCalls.push(url)
        fake.location.href = new URL(url, fake.location.href).toString()
      },
    },
  }

  ;(globalThis as { window?: unknown }).window = fake
  return fake
}

test.afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

test('marca o passo na URL', () => {
  const fake = installWindow(BASE)

  markMazeStep('onboarding-complete')

  assert.equal(fake.location.href, `${BASE}?mazeStep=onboarding-complete`)
})

test('substitui o passo anterior em vez de acumular', () => {
  const fake = installWindow(`${BASE}?mazeStep=onboarding-open`)

  markMazeStep('onboarding-complete')

  assert.equal(fake.location.href, `${BASE}?mazeStep=onboarding-complete`)
})

test('preserva o hash da navegação interna', () => {
  const fake = installWindow(`${BASE}#entradas`)

  markMazeStep('entries-open')

  assert.equal(fake.location.href, `${BASE}?mazeStep=entries-open#entradas`)
})

/**
 * A aplicação já navega por hash e por `pushState`. Uma entrada de histórico por
 * marco faria o botão voltar exigir vários toques no meio da tarefa.
 */
test('não empilha histórico', () => {
  const fake = installWindow(BASE)

  markMazeStep('onboarding-open')
  markMazeStep('onboarding-complete')

  assert.equal(fake.history.pushCalls.length, 0)
  assert.equal(fake.history.replaceCalls.length, 2)
})

test('o mesmo passo chamado duas vezes não reescreve nada', () => {
  const fake = installWindow(`${BASE}?mazeStep=assistant-open`)

  markMazeStep('assistant-open')

  assert.deepEqual(fake.history.replaceCalls, [])
})

test('a URL é a mesma para todo participante no mesmo ponto', () => {
  const primeiro = buildMazeStepUrl(BASE, 'purchase-complete')
  const segundo = buildMazeStepUrl(
    `${BASE}?mazeStep=buy-betslip-open`,
    'purchase-complete',
  )

  assert.equal(primeiro, segundo)
  assert.equal(getMazeStep(primeiro), 'purchase-complete')
})
