import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { PROTOTYPE_WALLET_STORAGE_KEY } from '../src/services/prototypeWallet.ts'
import { STUDY_STORAGE_PREFIX } from '../src/study/studyConfig.ts'
import {
  resetStudyStorage,
  STUDY_STORAGE_KEY_LIST,
  STUDY_STORAGE_KEYS,
} from '../src/study/studyStorage.ts'
import { installFakeWindow, uninstallFakeWindow } from './studyTestEnv.ts'

const BASE = 'https://pulse-maze.draftea.com/'

test.afterEach(() => uninstallFakeWindow())

test('todas as chaves usam o prefixo pulse.maze.v1', () => {
  assert.equal(STUDY_STORAGE_PREFIX, 'pulse.maze.v1')

  STUDY_STORAGE_KEY_LIST.forEach((key) => {
    assert.ok(
      key.startsWith('pulse.maze.v1.'),
      `${key} está fora do namespace do estudo`,
    )
  })

  assert.equal(PROTOTYPE_WALLET_STORAGE_KEY, 'pulse.maze.v1.wallet')
  assert.deepEqual(new Set(STUDY_STORAGE_KEY_LIST).size, STUDY_STORAGE_KEY_LIST.length)
})

test('o reset apaga somente o namespace do estudo', () => {
  const fake = installFakeWindow(`${BASE}?task=buy&mazeStep=start`)

  fake.localStorage.setItem(STUDY_STORAGE_KEYS.wallet, '{"balanceCents":1}')
  fake.localStorage.setItem(STUDY_STORAGE_KEYS.task, 'buy')
  fake.localStorage.setItem('pulse.maze.v1.legacy-do-estudo', 'x')
  // Chaves do Pulse principal, que podem estar no mesmo aparelho.
  fake.localStorage.setItem('pulse.prototype-wallet.v4', '{"balanceCents":999}')
  fake.localStorage.setItem('pulse.onboarding.invite.dismissed', '1')
  fake.localStorage.setItem('outra-app', 'preservar')

  resetStudyStorage()

  assert.equal(fake.localStorage.getItem(STUDY_STORAGE_KEYS.wallet), null)
  assert.equal(fake.localStorage.getItem(STUDY_STORAGE_KEYS.task), null)
  assert.equal(fake.localStorage.getItem('pulse.maze.v1.legacy-do-estudo'), null)
  assert.equal(
    fake.localStorage.getItem('pulse.prototype-wallet.v4'),
    '{"balanceCents":999}',
  )
  assert.equal(
    fake.localStorage.getItem('pulse.onboarding.invite.dismissed'),
    '1',
  )
  assert.equal(fake.localStorage.getItem('outra-app'), 'preservar')
})

test('nenhuma chave do Pulse principal é acessada em tempo de execução', () => {
  const files = globSync('src/**/*.{ts,tsx}')
  const forbidden = [
    'pulse.prototype-wallet',
    'pulse.onboarding.invite',
    'pulse.market-round',
    'pulse.outcome-market',
  ]
  const offenders: string[] = []

  files.forEach((file) => {
    const source = stripComments(readFileSync(file, 'utf8'))
    forbidden.forEach((key) => {
      if (source.includes(key)) offenders.push(`${file}: ${key}`)
    })
  })

  assert.deepEqual(offenders, [])
})

/**
 * Comentários são removidos antes da varredura: este próprio repositório
 * documenta, em prosa, por que `clear()` não pode ser usado, e essa frase não
 * pode fazer o teste que a defende falhar.
 */
const stripComments = (source: string) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

test('localStorage.clear() não é usado em lugar nenhum do runtime', () => {
  const files = globSync('src/**/*.{ts,tsx}')
  const offenders = files.filter((file) => (
    /localStorage\s*\.\s*clear\s*\(/
      .test(stripComments(readFileSync(file, 'utf8')))
  ))

  assert.deepEqual(offenders, [])
})

test('o reset de QA limpa o namespace e sai da URL', async () => {
  const fake = installFakeWindow(
    `${BASE}?task=buy&mazeStep=start&resetStudy=1`,
  )
  fake.localStorage.setItem(STUDY_STORAGE_KEYS.wallet, '{"balanceCents":1}')
  fake.localStorage.setItem('outra-app', 'preservar')

  const { prepareStudyScenario } = await import(
    `../src/study/studyScenarios.ts?case=${Math.random()}`
  )
  const resolution = prepareStudyScenario(Date.UTC(2026, 8, 4, 12, 0, 0))

  assert.equal(resolution.status, 'ready')
  assert.equal(resolution.scenario.wallet.balanceCents, 204_000)
  assert.ok(!fake.location.href.includes('resetStudy'))
  assert.equal(fake.localStorage.getItem('outra-app'), 'preservar')
})

test('a inicialização persiste o cenário sob o namespace do estudo', async () => {
  const fake = installFakeWindow(`${BASE}?task=sell&mazeStep=start`)
  const { prepareStudyScenario } = await import(
    `../src/study/studyScenarios.ts?case=${Math.random()}`
  )

  prepareStudyScenario(Date.UTC(2026, 8, 4, 12, 0, 0))

  const keys = [...fake.localStorage.entries.keys()]
  assert.ok(keys.length > 0)
  keys.forEach((key) => {
    assert.ok(
      key.startsWith('pulse.maze.v1.'),
      `${key} foi escrito fora do namespace do estudo`,
    )
  })
  assert.equal(fake.localStorage.getItem(STUDY_STORAGE_KEYS.task), 'sell')
})
