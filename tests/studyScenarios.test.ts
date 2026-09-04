import assert from 'node:assert/strict'
import test from 'node:test'
import { installFakeWindow, uninstallFakeWindow } from './studyTestEnv.ts'

const BASE = 'https://pulse-maze.draftea.com/'
const OPENED_AT = Date.UTC(2026, 8, 4, 12, 0, 0)

const load = async () => {
  const scenarios = await import(
    `../src/study/studyScenarios.ts?case=${Math.random()}`
  )
  const round = await import(
    `../src/study/studyMarketRound.ts?case=${Math.random()}`
  )
  const outcome = await import(
    `../src/study/studyOutcomeMarket.ts?case=${Math.random()}`
  )
  const previous = await import(
    `../src/study/studyPreviousRounds.ts?case=${Math.random()}`
  )
  const series = await import(
    `../src/study/studyPriceSeries.ts?case=${Math.random()}`
  )

  return { scenarios, round, outcome, previous, series }
}

const open = async (search: string, now = OPENED_AT) => {
  installFakeWindow(`${BASE}${search}`)
  const modules = await load()
  const resolution = modules.scenarios.prepareStudyScenario(now)

  return { ...modules, resolution }
}

test.afterEach(() => uninstallFakeWindow())

test('cada tarefa carrega o seed correto', async () => {
  const onboarding = await open('?task=onboarding&mazeStep=start')
  assert.equal(onboarding.resolution.status, 'ready')
  assert.equal(onboarding.resolution.scenario.task, 'onboarding')
  assert.equal(onboarding.resolution.scenario.onboarding.completed, false)
  assert.equal(onboarding.resolution.scenario.wallet.balanceCents, 204_000)
  uninstallFakeWindow()

  const buy = await open('?task=buy&mazeStep=start')
  assert.equal(buy.resolution.scenario.onboarding.completed, true)
  assert.equal(buy.resolution.scenario.wallet.balanceCents, 204_000)
  uninstallFakeWindow()

  const sell = await open('?task=sell&mazeStep=start')
  const sellScenario = sell.resolution.scenario
  const roundStart = sell.scenarios.getStudyRoundStart(sellScenario.openedAt)
  assert.equal(sellScenario.onboarding.completed, true)
  assert.equal(sellScenario.wallet.balanceCents, 203_000)
  assert.equal(
    sellScenario.wallet.positionsByRound[String(roundStart)].up,
    10 / 0.67,
  )
  uninstallFakeWindow()

  const help = await open('?task=help&mazeStep=start')
  assert.equal(help.resolution.scenario.onboarding.completed, true)
  assert.equal(help.resolution.scenario.market.targetPrice, 80_000)
})

test('todas as tarefas abrem na Home', async () => {
  for (const task of ['onboarding', 'buy', 'sell', 'help']) {
    const opened = await open(`?task=${task}&mazeStep=start`)
    assert.equal(opened.resolution.scenario.startSection, 'home')
    uninstallFakeWindow()
  }
})

test('uma tarefa não reutiliza o estado de outra', async () => {
  const fake = installFakeWindow(`${BASE}?task=sell&mazeStep=start`)
  const first = await load()
  const sell = first.scenarios.prepareStudyScenario(OPENED_AT)
  assert.equal(sell.status === 'ready' && sell.scenario.wallet.balanceCents, 203_000)

  // Mesmo aparelho, mesma sessão de storage, tarefa seguinte.
  fake.location.href = `${BASE}?task=buy&mazeStep=start`
  const second = await load()
  const buy = second.scenarios.prepareStudyScenario(OPENED_AT)

  assert.equal(buy.status, 'ready')
  assert.equal(buy.status === 'ready' && buy.scenario.wallet.balanceCents, 204_000)
  assert.deepEqual(
    buy.status === 'ready' ? buy.scenario.wallet.positionsByRound : null,
    {},
  )
})

test('reabrir a URL inicial restaura o cenário', async () => {
  const fake = installFakeWindow(`${BASE}?task=buy&mazeStep=start`)
  const first = await load()
  const opened = first.scenarios.prepareStudyScenario(OPENED_AT)
  assert.equal(opened.status, 'ready')

  // Simula uma compra já feita antes da reabertura.
  const stored = JSON.parse(
    fake.localStorage.getItem('pulse.maze.v1.wallet') ?? '{}',
  )
  stored.balanceCents = 100
  fake.localStorage.setItem('pulse.maze.v1.wallet', JSON.stringify(stored))

  fake.location.href = `${BASE}?task=buy&mazeStep=start`
  const second = await load()
  const reopened = second.scenarios.prepareStudyScenario(OPENED_AT)

  assert.equal(
    reopened.status === 'ready' && reopened.scenario.wallet.balanceCents,
    204_000,
  )
})

test('um reload no meio da missão preserva o que já aconteceu', async () => {
  const fake = installFakeWindow(`${BASE}?task=buy&mazeStep=start`)
  const first = await load()
  first.scenarios.prepareStudyScenario(OPENED_AT)

  const stored = JSON.parse(
    fake.localStorage.getItem('pulse.maze.v1.wallet') ?? '{}',
  )
  stored.balanceCents = 203_000
  fake.localStorage.setItem('pulse.maze.v1.wallet', JSON.stringify(stored))

  fake.location.href = `${BASE}?task=buy&mazeStep=purchase-complete`
  const second = await load()
  const restored = second.scenarios.prepareStudyScenario(OPENED_AT)

  assert.equal(
    restored.status === 'ready' && restored.scenario.wallet.balanceCents,
    203_000,
  )
})

test('tarefa ausente ou inválida não abre a Home', async () => {
  const missing = await open('')
  assert.equal(missing.resolution.status, 'invalid')
  uninstallFakeWindow()

  const unknown = await open('?task=deposit&mazeStep=start')
  assert.equal(unknown.resolution.status, 'invalid')
  uninstallFakeWindow()

  const empty = await open('?task=&mazeStep=start')
  assert.equal(empty.resolution.status, 'invalid')
})

test('o relógio começa em 10 minutos, avança e para em 5', async () => {
  const opened = await open('?task=buy&mazeStep=start')
  const { scenario } = opened.resolution
  const { buildStudyMarketRound } = opened.round

  const atOpen = buildStudyMarketRound(scenario, OPENED_AT)
  assert.equal(atOpen.remainingSeconds, 600)
  assert.equal(atOpen.minutes, '10')
  assert.equal(atOpen.seconds, '00')

  const afterOneMinute = buildStudyMarketRound(scenario, OPENED_AT + 60_000)
  assert.equal(afterOneMinute.remainingSeconds, 540)

  const afterFive = buildStudyMarketRound(scenario, OPENED_AT + 5 * 60_000)
  assert.equal(afterFive.remainingSeconds, 300)

  // O contador não encerra a rodada nem depois de meia hora de missão.
  const afterThirty = buildStudyMarketRound(scenario, OPENED_AT + 30 * 60_000)
  assert.equal(afterThirty.remainingSeconds, 300)
  assert.equal(afterThirty.roundStart, atOpen.roundStart)
})

test('o gráfico é determinístico e termina no preço atual', async () => {
  const opened = await open('?task=buy&mazeStep=start')
  const { scenario } = opened.resolution
  const { buildStudyMarketRound } = opened.round

  const first = buildStudyMarketRound(scenario, OPENED_AT)
  const second = buildStudyMarketRound(scenario, OPENED_AT)

  assert.deepEqual(first.points, second.points)
  assert.equal(first.points.at(-1)?.value, 80_012.40)
  assert.equal(first.currentPrice, 80_012.40)
  assert.equal(first.targetPrice, 80_000)

  // A ponta do gráfico e o card `Precio actual` leem o mesmo número em todo
  // instante: são a mesma posição da série, não dois cálculos paralelos.
  for (const offset of [0, 45_000, 200_000, 600_000]) {
    const round = buildStudyMarketRound(scenario, OPENED_AT + offset)
    assert.equal(round.currentPrice, round.points.at(-1)?.value)
  }

  // Um ponto já desenhado nunca muda de valor quando a série cresce.
  const later = buildStudyMarketRound(scenario, OPENED_AT + 120_000)
  assert.deepEqual(later.points.slice(0, first.points.length), first.points)

  // A forma da abertura não depende do instante real em que a pessoa entrou.
  const other = await (async () => {
    uninstallFakeWindow()
    const later = await open('?task=buy&mazeStep=start', OPENED_AT + 7 * 60_000)
    return later.round.buildStudyMarketRound(
      later.resolution.scenario,
      OPENED_AT + 7 * 60_000,
    )
  })()

  assert.deepEqual(
    first.points.map(({ value }) => value),
    other.points.map(({ value }) => value),
  )
})

test('as dez rodadas anteriores são estáveis e equilibradas', async () => {
  const opened = await open('?task=help&mazeStep=start')
  const { buildStudyPreviousRounds } = opened.previous
  const roundStart = opened.scenarios.getStudyRoundStart(
    opened.resolution.scenario.openedAt,
  )
  const rounds = buildStudyPreviousRounds(roundStart)

  assert.equal(rounds.length, 10)
  assert.equal(rounds.filter(({ result }) => result === 'up').length, 5)
  assert.equal(rounds.filter(({ result }) => result === 'down').length, 5)
  assert.equal(rounds[0].targetPrice, 79_980)
  assert.equal(rounds[0].finalPrice, 79_992)
  assert.equal(rounds[0].result, 'up')
  assert.deepEqual(rounds, buildStudyPreviousRounds(roundStart))
  assert.equal(rounds[0].roundStart, roundStart - 15 * 60 * 1000)
})

test('UP e DOWN abrem em 67% e 33% para todas as tarefas', async () => {
  for (const task of ['onboarding', 'buy', 'sell', 'help']) {
    const opened = await open(`?task=${task}&mazeStep=start`)
    const round = opened.round.buildStudyMarketRound(
      opened.resolution.scenario,
      OPENED_AT,
    )
    const market = opened.outcome.buildStudyOutcomeMarket({
      currentPrice: round.currentPrice,
      roundSlug: round.roundSlug,
      quotedAt: OPENED_AT,
    })

    assert.equal(market.displayPrices.up, 0.67)
    assert.equal(market.displayPrices.down, 0.33)
    assert.equal(market.status, 'live')
    assert.equal(market.source, 'study')
    uninstallFakeWindow()
  }
})

test('depois da abertura o mercado caminha, e igual para todo mundo', async () => {
  const opened = await open('?task=buy&mazeStep=start')
  const { scenario } = opened.resolution
  const precoEm = (offset: number) => opened.outcome.buildStudyOutcomeMarket({
    currentPrice: opened.round
      .buildStudyMarketRound(scenario, OPENED_AT + offset).currentPrice,
    roundSlug: 'study',
    quotedAt: OPENED_AT + offset,
  }).displayPrices.up

  const trajetoria = [0, 30_000, 90_000, 210_000, 540_000].map(precoEm)

  assert.equal(trajetoria[0], 0.67)
  assert.ok(
    new Set(trajetoria).size > 1,
    'UP ficou parado ao longo da missão',
  )
  // Duas leituras do mesmo instante entregam o mesmo preço: o movimento é uma
  // função do tempo decorrido, não um sorteio.
  assert.deepEqual([0, 30_000, 90_000, 210_000, 540_000].map(precoEm), trajetoria)
})
