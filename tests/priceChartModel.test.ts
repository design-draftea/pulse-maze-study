import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendRollingPricePoint,
  appendRoundPricePoint,
  calculatePriceChartDomain,
  clampPriceChartAnchor,
  countPricePointGaps,
  connectPriceChartEndpoint,
  DOMAIN_CONTRACTION_DELAY_MS,
  DOMAIN_SHIFT_CONFIRMATION_MS,
  getContinuousVisiblePricePoints,
  getPriceChartRangeConfig,
  getPriceChartTimeTicks,
  getPriceChartWindowPoints,
  interpolatePriceAt,
  interpolatePriceChartDomain,
  LIVE_WINDOW_DURATION_MS,
  LIVE_MINIMUM_GRID_STEP,
  mergePricePointSeries,
  projectPriceToY,
  resolvePriceChartTarget,
  stabilizePriceChartDomain,
  type PriceChartDomain,
} from '../src/components/priceChartModel.ts'
import { getPriceChartGeometry } from '../src/components/priceChartGeometry.ts'

test('histórico tardio não injeta picos nas lacunas da curva restaurada', () => {
  const observed = [
    { timestamp: 60000, value: 100 },
    { timestamp: 62000, value: 100.2 },
  ]
  const historical = [
    { timestamp: 0, value: 99 },
    { timestamp: 61000, value: 110 },
    { timestamp: 63000, value: 115 },
  ]
  assert.deepEqual(mergePricePointSeries(historical, observed, 0), [historical[0], ...observed])
  assert.deepEqual(mergePricePointSeries(historical, [], 0), historical)
  assert.deepEqual(mergePricePointSeries(historical, [{ timestamp: -1, value: 100 }], 0), historical)
})

test('LIVE revela oscilações pequenas com piso de 25 centavos sem mudar o padrão dos ranges fixos', () => {
  const points = [
    { timestamp: 0, value: 79670.55 },
    { timestamp: 30000, value: 79671.28 },
  ]
  const options = { applyTrendShift: false, includeAllPoints: true }
  const live = calculatePriceChartDomain(points, 79664.53, {
    ...options, minimumGridStep: LIVE_MINIMUM_GRID_STEP,
  })
  assert.equal(live.step, 0.25)
  assert.equal(live.top - live.bottom, 1.5)
  assert.ok(live.bottom <= points[0].value && live.top >= points[1].value)
  assert.equal(calculatePriceChartDomain(points, null, options).step, 2.5)
  const flat = calculatePriceChartDomain([points[0]], null, {
    ...options, minimumGridStep: LIVE_MINIMUM_GRID_STEP,
  })
  assert.equal(flat.step, 0.25)
  assert.equal(flat.top - flat.bottom, 1.5)
})

test('LIVE amplia para movimentos fortes e espera cinco segundos antes de voltar ao piso menor', () => {
  const calm = [{ timestamp: 0, value: 100 }, { timestamp: 1000, value: 100.1 }]
  const volatile = [...calm, { timestamp: 2000, value: 120 }]
  const options = { includeAllPoints: true, applyTrendShift: false, minimumGridStep: LIVE_MINIMUM_GRID_STEP }
  const small = calculatePriceChartDomain(calm, null, options)
  const large = calculatePriceChartDomain(volatile, null, options)
  let state = stabilizePriceChartDomain(null, small, calm, 0, options)
  state = stabilizePriceChartDomain(state, large, volatile, 1000, options)
  assert.ok(state.domain.step > 0.25)
  state = stabilizePriceChartDomain(state, small, calm, 2000, options)
  assert.equal(state.domain.step, large.step)
  state = stabilizePriceChartDomain(state, small, calm, 6999, options)
  assert.equal(state.domain.step, large.step)
  state = stabilizePriceChartDomain(state, small, calm, 7000, options)
  assert.equal(state.domain.step, 0.25)
})

test('janela de 30s conserva os preços anteriores na virada da rodada', () => {
  const boundary = Date.UTC(2026, 8, 4, 19, 45)
  const history = Array.from({ length: 61 }, (_, i) => ({
    timestamp: boundary - 52_000 + i * 1000, value: 100 + i / 10,
  }))
  const now = boundary + 8_000
  const window = getPriceChartWindowPoints(history, now - LIVE_WINDOW_DURATION_MS, now)
  assert.equal(window[0].timestamp, boundary - 22_000)
  assert.equal(window.at(-1)?.timestamp, now)
  assert.equal(window.length, 31)
  assert.ok(window.some(p => p.timestamp < boundary))
  const anchor = boundary - 15_000
  assert.equal(clampPriceChartAnchor(anchor, history, LIVE_WINDOW_DURATION_MS, now), anchor)
})

test('retenção ajusta o arraste antigo e histórico parcial não inventa uma série', () => {
  const now = 4_000_000
  const history = [{timestamp: now - 3_600_000, value: 100}, {timestamp: now, value: 101}]
  assert.equal(clampPriceChartAnchor(0, history, LIVE_WINDOW_DURATION_MS, now), now - 3_570_000)
  assert.deepEqual(getPriceChartWindowPoints([], now - 30_000, now), [])
  const partial = [{timestamp: now - 8_000, value: 100}, {timestamp: now, value: 101}]
  const visible = getContinuousVisiblePricePoints(partial, now, 240, 0, 8)
  assert.equal(visible.points[0].timestamp, now - 8_000)
  assert.equal(visible.points[0].x, 176)
})

test('linha e marcador compartilham a ponta durante alta, queda e mudança de domínio', () => {
  const history = [{ timestamp: 0, value: 100, x: 0, y: 100 }]
  let previousY = -1
  for (const [value, top] of [[101, 110], [104, 110], [99, 110], [103, 110], [103, 120]]) {
    const endpoint = {
      timestamp: 30_000, value, x: 236,
      y: projectPriceToY(value, { bottom: 90, top }, 16, 220),
    }
    const line = connectPriceChartEndpoint(history, endpoint)
    assert.equal(line.at(-1), endpoint)
    assert.notEqual(line.at(-1)?.y, previousY)
    assert.equal(line[0], history[0])
    previousY = endpoint.y
  }
  assert.deepEqual(history, [{ timestamp: 0, value: 100, x: 0, y: 100 }])
})

test('ponta histórica exclui guardas além da borda e substitui a ponta antiga', () => {
  const source = [{ timestamp: 0, value: 100 }, { timestamp: 60_000, value: 160 }]
  const visible = getContinuousVisiblePricePoints(source, 45_000, 236, 0, 236 / 30)
  const endpoint = { timestamp: 45_000, value: interpolatePriceAt(source, 45_000)!, x: 236 }
  const line = connectPriceChartEndpoint([
    ...visible.points,
    { timestamp: 45_100, value: 145.1, x: 236.8 },
  ], endpoint)
  assert.equal(line.at(-1), endpoint)
  assert.equal(endpoint.value, 145)
  assert.ok(line.slice(0, -1).every((point) => point.x < 236))
  assert.equal(line.filter((point) => point.x === 236).length, 1)
  assert.deepEqual(connectPriceChartEndpoint([], endpoint), [endpoint])
})

test('organiza pontos por rodada, deduplica por segundo e respeita o limite', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  let points = [{ timestamp: roundStart, value: 100 }]

  points = appendRoundPricePoint(
    points,
    { timestamp: roundStart + 1_800, value: 102 },
    roundStart,
    3,
  )
  points = appendRoundPricePoint(
    points,
    { timestamp: roundStart + 1_200, value: 101 },
    roundStart,
    3,
  )
  points = appendRoundPricePoint(
    points,
    { timestamp: roundStart + 2_000, value: 103 },
    roundStart,
    3,
  )
  points = appendRoundPricePoint(
    points,
    { timestamp: roundStart + 3_000, value: 104 },
    roundStart,
    3,
  )

  assert.deepEqual(points, [
    { timestamp: roundStart + 1_800, value: 102 },
    { timestamp: roundStart + 2_000, value: 103 },
    { timestamp: roundStart + 3_000, value: 104 },
  ])
})

test('preserva o ponto inicial exato da rodada no primeiro segundo', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = appendRoundPricePoint(
    [{ timestamp: roundStart, value: 100 }],
    { timestamp: roundStart + 500, value: 101 },
    roundStart,
    120,
  )

  assert.deepEqual(points, [{ timestamp: roundStart, value: 100 }])
})

test('remove pontos de outra rodada ao receber o primeiro preço novo', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = appendRoundPricePoint(
    [{ timestamp: roundStart - 1_000, value: 99 }],
    { timestamp: roundStart, value: 100 },
    roundStart,
    120,
  )

  assert.deepEqual(points, [{ timestamp: roundStart, value: 100 }])
})

test('mantém uma série móvel, deduplicada por segundo, por até uma hora', () => {
  const now = Date.UTC(2026, 8, 1, 11, 0, 0)
  const earliest = now - 60 * 60_000
  const points = appendRollingPricePoint(
    [
      { timestamp: earliest - 1_000, value: 90 },
      { timestamp: now - 500, value: 100 },
    ],
    { timestamp: now - 100, value: 101 },
    earliest,
    3_601,
  )

  assert.deepEqual(points, [{ timestamp: now - 100, value: 101 }])
})

test('mescla candles e observações priorizando o ponto observado no mesmo segundo', () => {
  const start = Date.UTC(2026, 8, 1, 10, 0, 0)
  const points = mergePricePointSeries(
    [
      { timestamp: start - 1_000, value: 99 },
      { timestamp: start, value: 100 },
      { timestamp: start + 60_000, value: 101 },
    ],
    [
      { timestamp: start + 60_500, value: 105 },
      { timestamp: start + 61_000, value: 106 },
    ],
    start,
  )

  assert.deepEqual(points, [
    { timestamp: start, value: 100 },
    { timestamp: start + 60_500, value: 105 },
    { timestamp: start + 61_000, value: 106 },
  ])
})

test('configura escala e marcações para cada range do gráfico', () => {
  const seriesRight = 240

  assert.deepEqual(getPriceChartRangeConfig('live', seriesRight), {
    durationMs: null,
    pixelsPerSecond: 8,
    timeTickIntervalMs: 10_000,
  })
  assert.deepEqual(getPriceChartRangeConfig('5m', seriesRight), {
    durationMs: 5 * 60_000,
    pixelsPerSecond: 0.8,
    timeTickIntervalMs: 2 * 60_000,
  })
  assert.equal(getPriceChartRangeConfig('15m', seriesRight).durationMs, 15 * 60_000)
  assert.equal(getPriceChartRangeConfig('15m', seriesRight).timeTickIntervalMs, 5 * 60_000)
  assert.equal(getPriceChartRangeConfig('1h', seriesRight).pixelsPerSecond, 1 / 15)
  assert.equal(getPriceChartRangeConfig('1h', seriesRight).timeTickIntervalMs, 20 * 60_000)
})

test('mantém a janela LIVE em 30 segundos em todas as larguras mobile', () => {
  for (const width of [320, 375, 430, 499]) {
    const { seriesRight } = getPriceChartGeometry(width)
    const { pixelsPerSecond } = getPriceChartRangeConfig('live', seriesRight)
    const windowSpanMs = (seriesRight / pixelsPerSecond) * 1000

    assert.equal(Math.round(windowSpanMs), LIVE_WINDOW_DURATION_MS)
  }
})

test('projeta início, meio e presente da janela LIVE nas posições corretas', () => {
  const displayTime = 30_000
  const seriesRight = 240
  const { pixelsPerSecond } = getPriceChartRangeConfig('live', seriesRight)
  const visible = getContinuousVisiblePricePoints(
    [
      { timestamp: 0, value: 100 },
      { timestamp: 15_000, value: 105 },
      { timestamp: displayTime, value: 110 },
    ],
    displayTime,
    seriesRight,
    0,
    pixelsPerSecond,
  )

  assert.deepEqual(visible.points.map(({ x }) => x), [0, 120, 240])
})

test('mantém exatamente três horários em posições fixas e distribuídas', () => {
  const anchorTime = Date.UTC(2026, 8, 4, 10, 54, 48)

  assert.deepEqual(
    getPriceChartTimeTicks(anchorTime, 2 * 60_000, 16, 236, 24),
    [
      { timestamp: Date.UTC(2026, 8, 4, 10, 50, 0), x: 40 },
      { timestamp: Date.UTC(2026, 8, 4, 10, 52, 0), x: 126 },
      { timestamp: Date.UTC(2026, 8, 4, 10, 54, 0), x: 212 },
    ],
  )

  assert.deepEqual(
    getPriceChartTimeTicks(anchorTime, 20 * 60_000, 16, 236, 24),
    [
      { timestamp: Date.UTC(2026, 8, 4, 10, 0, 0), x: 40 },
      { timestamp: Date.UTC(2026, 8, 4, 10, 20, 0), x: 126 },
      { timestamp: Date.UTC(2026, 8, 4, 10, 40, 0), x: 212 },
    ],
  )
})

test('redistribui os três horários sem cortar os rótulos em telas estreitas', () => {
  const ticks = getPriceChartTimeTicks(20_000, 5_000, 16, 181, 24)

  assert.equal(ticks.length, 3)
  assert.deepEqual(ticks.map(({ x }) => x), [40, 98.5, 157])
})

test('o domínio de um range considera todos os pontos visíveis', () => {
  const points = [
    { timestamp: 0, value: 50 },
    ...Array.from({ length: 20 }, (_, index) => ({
      timestamp: (index + 1) * 1_000,
      value: 100 + index / 10,
    })),
  ]
  const liveDomain = calculatePriceChartDomain(points, null)
  const rangeDomain = calculatePriceChartDomain(points, null, {
    applyTrendShift: false,
    includeAllPoints: true,
  })

  assert.ok(liveDomain.bottom > 50)
  assert.ok(rangeDomain.bottom <= 50)
})

test('o domínio LIVE inclui oscilações de toda a janela de 30 segundos', () => {
  const points = Array.from({ length: 31 }, (_, index) => ({
    timestamp: index * 1_000,
    value: index === 1 ? 50 : 100 + index / 100,
  }))
  const windowPoints = getPriceChartWindowPoints(
    points,
    0,
    LIVE_WINDOW_DURATION_MS,
  )
  const domain = calculatePriceChartDomain(windowPoints, null, {
    includeAllPoints: true,
  })

  assert.ok(domain.bottom <= 50)
  assert.ok(domain.top >= 100.3)
})

test('a estabilização LIVE reage a extremos no início da janela visível', () => {
  const currentDomain: PriceChartDomain = { bottom: 95, top: 110, step: 2.5 }
  const points = Array.from({ length: 31 }, (_, index) => ({
    timestamp: index * 1_000,
    value: index === 0 ? 50 : 100,
  }))
  const candidate = calculatePriceChartDomain(points, null, {
    includeAllPoints: true,
  })
  const stabilized = stabilizePriceChartDomain(
    {
      domain: currentDomain,
      contractionCandidateKey: null,
      contractionStartedAt: null,
      shiftCandidateKey: null,
      shiftStartedAt: null,
    },
    candidate,
    points,
    LIVE_WINDOW_DURATION_MS,
    { includeAllPoints: true },
  )

  assert.equal(stabilized.domain, candidate)
})

test('interpola a passagem pela borda esquerda usando os pontos reais vizinhos', () => {
  const displayTime = 10_000
  const visible = getContinuousVisiblePricePoints(
    [
      { timestamp: 4_000, value: 100 },
      { timestamp: 8_000, value: 104 },
      { timestamp: 10_000, value: 105 },
    ],
    displayTime,
    100,
    0,
    24,
  )

  assert.equal(visible.continuityApplied, true)
  assert.equal(visible.points[0].x, 0)
  assert.ok(visible.points[0].value > 100)
  assert.ok(visible.points[0].value < 104)
  assert.equal(visible.points.at(-1)?.x, 100)
})

test('mantém a série original quando todos os pontos já estão visíveis', () => {
  const visible = getContinuousVisiblePricePoints(
    [
      { timestamp: 9_000, value: 100 },
      { timestamp: 10_000, value: 101 },
    ],
    10_000,
    100,
    0,
    24,
  )

  assert.equal(visible.continuityApplied, false)
  assert.equal(visible.points.length, 2)
})

test('amplia o domínio imediatamente e atrasa a contração por cinco segundos', () => {
  const wideDomain: PriceChartDomain = { bottom: 90, top: 150, step: 10 }
  const narrowDomain: PriceChartDomain = { bottom: 100, top: 115, step: 2.5 }
  const expandedDomain: PriceChartDomain = { bottom: 80, top: 200, step: 20 }
  const points = [
    { timestamp: 1_000, value: 104 },
    { timestamp: 2_000, value: 106 },
  ]
  const initial = {
    domain: wideDomain,
    contractionCandidateKey: null,
    contractionStartedAt: null,
    shiftCandidateKey: null,
    shiftStartedAt: null,
  }
  const pending = stabilizePriceChartDomain(initial, narrowDomain, points, 10_000)
  const stillPending = stabilizePriceChartDomain(
    pending,
    narrowDomain,
    points,
    10_000 + DOMAIN_CONTRACTION_DELAY_MS - 1,
  )
  const contracted = stabilizePriceChartDomain(
    stillPending,
    narrowDomain,
    points,
    10_000 + DOMAIN_CONTRACTION_DELAY_MS,
  )
  const expanded = stabilizePriceChartDomain(
    contracted,
    expandedDomain,
    [{ timestamp: 3_000, value: 180 }],
    20_000,
  )

  assert.equal(pending.domain, wideDomain)
  assert.equal(stillPending.domain, wideDomain)
  assert.equal(contracted.domain, narrowDomain)
  assert.equal(expanded.domain, expandedDomain)
})

test('confirma a tendência antes de deslocar o domínio no mesmo passo', () => {
  const currentDomain: PriceChartDomain = { bottom: 100, top: 115, step: 2.5 }
  const shiftedDomain: PriceChartDomain = { bottom: 105, top: 120, step: 2.5 }
  const points = [
    { timestamp: 1_000, value: 109 },
    { timestamp: 2_000, value: 112 },
  ]
  const initial = {
    domain: currentDomain,
    contractionCandidateKey: null,
    contractionStartedAt: null,
    shiftCandidateKey: null,
    shiftStartedAt: null,
  }
  const pending = stabilizePriceChartDomain(initial, shiftedDomain, points, 10_000)
  const shifted = stabilizePriceChartDomain(
    pending,
    shiftedDomain,
    points,
    10_000 + DOMAIN_SHIFT_CONFIRMATION_MS,
  )

  assert.equal(pending.domain, currentDomain)
  assert.equal(shifted.domain, shiftedDomain)
})

test('interpola o domínio em valores intermediários durante a transição', () => {
  const from: PriceChartDomain = { bottom: 100, top: 115, step: 2.5 }
  const to: PriceChartDomain = { bottom: 110, top: 140, step: 5 }
  const halfway = interpolatePriceChartDomain(from, to, 0.5)

  assert.deepEqual(halfway, {
    bottom: 105,
    top: 127.5,
    step: 3.75,
    trendShiftIntervals: undefined,
  })
  assert.deepEqual(interpolatePriceChartDomain(from, to, 1), to)
})

test('conta apenas lacunas maiores que o limite de atualização', () => {
  assert.equal(countPricePointGaps([
    { timestamp: 0, value: 100 },
    { timestamp: 1_000, value: 101 },
    { timestamp: 4_000, value: 102 },
  ]), 1)
})

test('interpola o preço entre dois pontos e fixa os extremos da série', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = [
    { timestamp: roundStart, value: 100 },
    { timestamp: roundStart + 60_000, value: 130 },
  ]

  assert.equal(interpolatePriceAt(points, roundStart + 30_000), 115)
  assert.equal(interpolatePriceAt(points, roundStart - 5_000), 100)
  assert.equal(interpolatePriceAt(points, roundStart + 90_000), 130)
  assert.equal(interpolatePriceAt([], roundStart), null)
})

test('a janela arrastada inclui as bordas interpoladas de um trecho sem pontos', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = [
    { timestamp: roundStart, value: 100 },
    { timestamp: roundStart + 60_000, value: 160 },
    { timestamp: roundStart + 120_000, value: 100 },
  ]
  const window = getPriceChartWindowPoints(
    points,
    roundStart + 20_000,
    roundStart + 30_000,
  )

  assert.deepEqual(window, [
    { timestamp: roundStart + 20_000, value: 120 },
    { timestamp: roundStart + 30_000, value: 130 },
  ])

  const crossing = getPriceChartWindowPoints(
    points,
    roundStart + 30_000,
    roundStart + 90_000,
  )

  assert.deepEqual(crossing.map(({ value }) => value), [130, 160, 130])
})

test('o arrasto para no ponto mais antigo e não avança além do último', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = [
    { timestamp: roundStart, value: 100 },
    { timestamp: roundStart + 120_000, value: 110 },
  ]
  const latest = roundStart + 120_000
  const windowSpan = 10_000

  assert.equal(
    clampPriceChartAnchor(roundStart - 60_000, points, windowSpan, latest),
    roundStart + windowSpan,
  )
  assert.equal(
    clampPriceChartAnchor(latest + 60_000, points, windowSpan, latest),
    latest,
  )
  assert.equal(
    clampPriceChartAnchor(roundStart + 40_000, points, windowSpan, latest),
    roundStart + 40_000,
  )
  assert.equal(
    clampPriceChartAnchor(roundStart, [], windowSpan, latest),
    latest,
  )
})

test('o domínio da janela arrastada não desloca pela tendência', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const climbing = Array.from({ length: 8 }, (_, index) => ({
    timestamp: roundStart + index * 1_000,
    value: 100 + index * 2,
  }))
  const live = calculatePriceChartDomain(climbing, null)
  const panned = calculatePriceChartDomain(climbing, null, {
    applyTrendShift: false,
  })

  assert.equal(live.trendShiftIntervals, 2)
  assert.equal(panned.trendShiftIntervals, 0)
  assert.equal(live.step, panned.step)
  assert.equal(live.bottom - panned.bottom, panned.step * 2)
})

test('mantém a linha desenhada quando a janela cai entre dois pontos distantes', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = [
    { timestamp: roundStart, value: 100 },
    { timestamp: roundStart + 60_000, value: 160 },
  ]
  const seriesRight = 236
  const pixelsPerSecond = 24
  const visible = getContinuousVisiblePricePoints(
    points,
    roundStart + 10_000,
    seriesRight,
    0,
    pixelsPerSecond,
  )

  assert.equal(visible.points.length, 2)
  assert.equal(visible.points[0].x, 0)
  assert.equal(visible.points[1].x, seriesRight)
  assert.ok(Math.abs(visible.points[0].value - 100.17) < 0.02)
  assert.ok(Math.abs(visible.points[1].value - 110) < 0.02)
  assert.equal(visible.continuityApplied, true)
})

test('a série ao vivo termina no ponto atual e não cria guarda à direita', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = Array.from({ length: 6 }, (_, index) => ({
    timestamp: roundStart + index * 1_000,
    value: 100 + index,
  }))
  const visible = getContinuousVisiblePricePoints(
    points,
    roundStart + 5_000,
    236,
    0,
    24,
  )

  assert.equal(visible.points.length, points.length)
  assert.equal(visible.points[5].x, 236)
  assert.equal(visible.continuityApplied, false)
})

// A faixa da grade do PriceChart: sete linhas de 16 a 220, passo de 34.
const PLOT_TOP = 16
const PLOT_BOTTOM = 220
const TARGET_DOMAIN = { bottom: 80_190, top: 80_220 }

test('preço objetivo dentro do domínio não trava e segue a projeção da faixa', () => {
  const placement = resolvePriceChartTarget(
    80_205,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.equal(placement?.clamp, 'none')
  assert.equal(
    placement?.y,
    projectPriceToY(80_205, TARGET_DOMAIN, PLOT_TOP, PLOT_BOTTOM),
  )
  // Meio exato do domínio cai no meio exato da faixa.
  assert.equal(placement?.y, 118)
})

test('preço objetivo acima do domínio trava no topo e abaixo trava na base', () => {
  const above = resolvePriceChartTarget(
    80_400,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )
  const below = resolvePriceChartTarget(
    80_000,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.deepEqual(above, { y: 16, clamp: 'above' })
  assert.deepEqual(below, { y: 220, clamp: 'below' })
})

test('as bordas do domínio ainda contam como dentro da faixa', () => {
  const atTop = resolvePriceChartTarget(
    TARGET_DOMAIN.top,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )
  const atBottom = resolvePriceChartTarget(
    TARGET_DOMAIN.bottom,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.deepEqual(atTop, { y: 16, clamp: 'none' })
  assert.deepEqual(atBottom, { y: 220, clamp: 'none' })
})

test('o travamento vem do domínio estabilizado e a posição do interpolado', () => {
  // O domínio estabilizado exclui o objetivo, então ele continua travado
  // mesmo que o domínio interpolado já o tenha alcançado no meio da animação.
  const placement = resolvePriceChartTarget(
    80_230,
    TARGET_DOMAIN,
    { bottom: 80_200, top: 80_240 },
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.deepEqual(placement, { y: 16, clamp: 'above' })
})

test('objetivo dentro do domínio estabilizado nunca escapa da faixa', () => {
  // Durante a interpolação o domínio de render pode ser mais estreito que o
  // estabilizado; a posição é contida na faixa em vez de vazar para fora dela.
  const placement = resolvePriceChartTarget(
    80_219,
    TARGET_DOMAIN,
    { bottom: 80_205, top: 80_215 },
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.equal(placement?.clamp, 'none')
  assert.equal(placement?.y, PLOT_TOP)
})

test('sem preço objetivo ou com domínio degenerado não há linha', () => {
  assert.equal(
    resolvePriceChartTarget(
      null,
      TARGET_DOMAIN,
      TARGET_DOMAIN,
      PLOT_TOP,
      PLOT_BOTTOM,
    ),
    null,
  )
  assert.equal(
    resolvePriceChartTarget(
      Number.NaN,
      TARGET_DOMAIN,
      TARGET_DOMAIN,
      PLOT_TOP,
      PLOT_BOTTOM,
    ),
    null,
  )
  assert.equal(
    resolvePriceChartTarget(
      80_205,
      { bottom: 80_205, top: 80_205 },
      { bottom: 80_205, top: 80_205 },
      PLOT_TOP,
      PLOT_BOTTOM,
    ),
    null,
  )
})

test('travado e no topo do domínio caem no mesmo y, e só o clamp os separa', () => {
  const atTop = resolvePriceChartTarget(
    TARGET_DOMAIN.top,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )
  const above = resolvePriceChartTarget(
    TARGET_DOMAIN.top + 1,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.equal(atTop?.y, above?.y)
  assert.notEqual(atTop?.clamp, above?.clamp)
})
