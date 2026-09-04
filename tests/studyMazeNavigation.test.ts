import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStudyUrl,
  getCurrentMazeStep,
  markMazeStep,
  resetMarkedStepMemory,
  STUDY_SUCCESS_STEPS,
} from '../src/study/studyMazeNavigation.ts'
import { installFakeWindow, uninstallFakeWindow } from './studyTestEnv.ts'

const BASE = 'https://pulse-maze.draftea.com/'

test.beforeEach(() => resetMarkedStepMemory())
test.afterEach(() => uninstallFakeWindow())

test('markMazeStep preserva a tarefa', () => {
  const fake = installFakeWindow(`${BASE}?task=buy&mazeStep=start`)

  markMazeStep('buy', 'buy-betslip-open')

  assert.equal(
    fake.location.href,
    `${BASE}?task=buy&mazeStep=buy-betslip-open`,
  )
})

test('o hash da navegação interna permanece intacto', () => {
  const fake = installFakeWindow(`${BASE}?task=sell&mazeStep=entries-open#entradas`)

  markMazeStep('sell', 'sell-betslip-open')

  assert.equal(
    fake.location.href,
    `${BASE}?task=sell&mazeStep=sell-betslip-open#entradas`,
  )
})

test('o mesmo step não reescreve a URL nem empilha histórico', () => {
  const fake = installFakeWindow(`${BASE}?task=help&mazeStep=assistant-open`)

  markMazeStep('help', 'assistant-open')
  markMazeStep('help', 'assistant-open')

  assert.deepEqual(fake.history.replaceCalls, [])
  assert.deepEqual(fake.history.pushCalls, [])
})

test('a navegação permanece na mesma aba, sem empilhar entradas', () => {
  const fake = installFakeWindow(`${BASE}?task=buy&mazeStep=start`)

  markMazeStep('buy', 'buy-betslip-open')
  markMazeStep('buy', 'purchase-complete')

  assert.equal(fake.history.pushCalls.length, 0)
  assert.equal(fake.history.replaceCalls.length, 2)
})

test('a ordem dos parâmetros é estável entre participantes', () => {
  const fromStep = buildStudyUrl({
    href: `${BASE}?mazeStep=start&task=buy`,
    task: 'buy',
    step: 'purchase-complete',
  })
  const fromTask = buildStudyUrl({
    href: `${BASE}?task=buy&mazeStep=start`,
    task: 'buy',
    step: 'purchase-complete',
  })

  assert.equal(fromStep, fromTask)
  assert.equal(fromStep, `${BASE}?task=buy&mazeStep=purchase-complete`)
})

test('nenhum identificador dinâmico entra na URL', () => {
  const fake = installFakeWindow(
    `${BASE}?task=sell&mazeStep=start&participantId=42&t=1234567890#entradas`,
  )

  markMazeStep('sell', 'sale-complete')

  assert.equal(
    fake.location.href,
    `${BASE}?task=sell&mazeStep=sale-complete#entradas`,
  )
})

test('o parâmetro de reset de QA sai da URL na primeira reescrita', () => {
  const url = buildStudyUrl({
    href: `${BASE}?task=buy&mazeStep=start&resetStudy=1`,
    task: 'buy',
    step: 'buy-betslip-open',
  })

  assert.equal(url, `${BASE}?task=buy&mazeStep=buy-betslip-open`)
})

test('o diagnóstico de QA sobrevive à reescrita', () => {
  const url = buildStudyUrl({
    href: `${BASE}?task=buy&mazeStep=start&debugStudy=1`,
    task: 'buy',
    step: 'purchase-complete',
  })

  assert.equal(
    url,
    `${BASE}?task=buy&mazeStep=purchase-complete&debugStudy=1`,
  )
})

test('os marcos finais usam os nomes previstos na configuração do Maze', () => {
  assert.deepEqual(STUDY_SUCCESS_STEPS, {
    onboarding: 'onboarding-complete',
    buy: 'purchase-complete',
    sell: 'sale-complete',
    help: 'answer-shown',
  })
})

test('as quatro URLs iniciais abrem no marco start', () => {
  for (const task of ['onboarding', 'buy', 'sell', 'help'] as const) {
    const href = `${BASE}?task=${task}&mazeStep=start`
    assert.equal(getCurrentMazeStep(href), 'start')
  }
})
