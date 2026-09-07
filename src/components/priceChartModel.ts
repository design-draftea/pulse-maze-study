export type PricePoint = {
  timestamp: number
  value: number
}

export type PriceChartRange = 'live' | 'ronda' | '5m' | '15m' | '1h'

export type PriceChartRangeConfig = {
  durationMs: number | null
  pixelsPerSecond: number
  timeTickIntervalMs: number
}

export type PriceChartTimeTick = {
  timestamp: number
  x: number
}

export type PriceChartDomain = {
  bottom: number
  top: number
  step: number
}

export type ProjectedPricePoint = PricePoint & {
  x: number
}

// A ponta renderizada é única: o caminho termina no mesmo objeto usado pelo
// marcador. O recorte pode conter uma guarda além da borda; ela não deve
// produzir um segmento que ultrapassa a ponta e depois volta.
export const connectPriceChartEndpoint = <T extends ProjectedPricePoint>(
  points: T[],
  endpoint: T,
): T[] => [
  ...points.filter((point) => point.x < endpoint.x),
  endpoint,
]

export type StablePriceChartDomainState = {
  domain: PriceChartDomain
  contractionCandidateKey: string | null
  contractionStartedAt: number | null
  shiftCandidateKey: string | null
  shiftStartedAt: number | null
}

export type VisiblePriceChartPoints = {
  points: ProjectedPricePoint[]
  continuityApplied: boolean
}

export type PriceChartTargetClamp = 'none' | 'above' | 'below'

export type PriceChartTargetPlacement = {
  y: number
  clamp: PriceChartTargetClamp
  // Quanto o preço ainda precisa andar para alcançar o objetivo. É o dado que
  // falta quando o objetivo não cabe na escala e a linha some do quadro.
  distance: number | null
}

const GRID_INTERVALS = 6
const MINIMUM_GRID_STEP = 2.5
export const LIVE_MINIMUM_GRID_STEP = 0.25
const RECENT_DOMAIN_POINT_COUNT = 20
// A faixa nunca encosta nos extremos. Sem esta folga o traço de 3px da linha e o
// halo de 10px do ponto são cortados pelo recorte sempre que o preço toca um
// limite, que é o estado normal de um domínio ajustado ao mínimo e ao máximo.
const DOMAIN_PADDING_FRACTION = 0.12
// Gatilhos da histerese. A faixa só se move quando o dado ameaça sair do quadro
// ou quando o centro dele derivou o bastante para o enquadramento deixar de
// servir. Reescalar a cada oscilação é o que fazia o eixo nunca ficar parado.
const DOMAIN_EDGE_MARGIN_FRACTION = 0.04
const DOMAIN_RECENTER_FRACTION = 0.25
export const LIVE_WINDOW_DURATION_MS = 30_000
const LIVE_TIME_TICK_INTERVAL_MS = 10_000
// A rodada dura o mesmo que a janela de 15M, mas a faixa é outra coisa: ela é
// ancorada em `roundEnd` e não anda com o relógio, então mostra o quadro
// inteiro da rodada, o que já passou e o que falta até o fechamento.
export const ROUND_WINDOW_DURATION_MS = 15 * 60_000
const RANGE_CONFIG = {
  ronda: {
    durationMs: ROUND_WINDOW_DURATION_MS,
    timeTickIntervalMs: 5 * 60_000,
  },
  '5m': { durationMs: 5 * 60_000, timeTickIntervalMs: 2 * 60_000 },
  '15m': { durationMs: 15 * 60_000, timeTickIntervalMs: 5 * 60_000 },
  '1h': { durationMs: 60 * 60_000, timeTickIntervalMs: 20 * 60_000 },
} as const

// Só a rodada tem janela parada. Em todas as outras faixas as marcações nascem
// na direita e caminham para a esquerda, e é isso que o fade acompanha.
export const isRollingPriceChartRange = (range: PriceChartRange) => (
  range !== 'ronda'
)
export const DOMAIN_CONTRACTION_DELAY_MS = 5_000
export const DOMAIN_SHIFT_CONFIRMATION_MS = 750

export const getPriceChartRangeConfig = (
  range: PriceChartRange,
  seriesRight: number,
): PriceChartRangeConfig => {
  if (range === 'live') {
    return {
      durationMs: null,
      pixelsPerSecond: seriesRight / (LIVE_WINDOW_DURATION_MS / 1000),
      timeTickIntervalMs: LIVE_TIME_TICK_INTERVAL_MS,
    }
  }

  const { durationMs, timeTickIntervalMs } = RANGE_CONFIG[range]

  return {
    durationMs,
    pixelsPerSecond: seriesRight / (durationMs / 1000),
    timeTickIntervalMs,
  }
}

// As marcações caem no `x` que a própria projeção da série prevê para o seu
// horário. Antes elas eram distribuídas em três frações uniformes do plot,
// independentemente do tempo: a 375px, no range de 1H, a marcação das 20:40 era
// desenhada em `x=212` quando sua posição verdadeira era `x=185,1` — cerca de
// sete minutos de deslocamento em cada rótulo.
export const getPriceChartTimeTicks = (
  anchorTime: number,
  intervalMs: number,
  leftBoundary: number,
  rightBoundary: number,
  pixelsPerSecond: number,
): PriceChartTimeTick[] => {
  if (
    !Number.isFinite(anchorTime)
    || !Number.isFinite(intervalMs)
    || intervalMs <= 0
    || !Number.isFinite(pixelsPerSecond)
    || pixelsPerSecond <= 0
    || !Number.isFinite(leftBoundary)
    || !Number.isFinite(rightBoundary)
    || rightBoundary < leftBoundary
  ) return []

  const spacing = (intervalMs / 1000) * pixelsPerSecond
  const count = Math.max(
    2,
    Math.ceil((rightBoundary - leftBoundary) / spacing) + 2,
  )
  const latestTimestamp = Math.floor(anchorTime / intervalMs) * intervalMs

  return Array.from({ length: count }, (_, index) => {
    const timestamp = latestTimestamp - index * intervalMs

    return {
      timestamp,
      x: rightBoundary - ((anchorTime - timestamp) / 1000) * pixelsPerSecond,
    }
  }).filter(({ x }) => x >= leftBoundary - spacing && x <= rightBoundary)
}

export const projectPriceToY = (
  value: number,
  { bottom, top }: Pick<PriceChartDomain, 'bottom' | 'top'>,
  plotTop: number,
  plotBottom: number,
) => plotTop + ((top - value) / (top - bottom)) * (plotBottom - plotTop)

// O veredito de travamento vem do domínio já estabilizado e a posição vem do
// domínio interpolado. Decidir os dois pelo interpolado faria a seta e a
// largura da pílula piscarem durante os 280ms de animação sempre que o
// objetivo estivesse parado exatamente na borda da faixa.
//
// Travado, o objetivo pousa na própria borda da faixa, sem respiro. Um objetivo
// exatamente no topo do domínio e um objetivo travado acima caem no mesmo `y`,
// então quem distingue os dois é a opacidade da linha e a presença da seta.
export const resolvePriceChartTarget = (
  targetPrice: number | null,
  domain: Pick<PriceChartDomain, 'bottom' | 'top'>,
  renderDomain: Pick<PriceChartDomain, 'bottom' | 'top'>,
  plotTop: number,
  plotBottom: number,
  currentPrice: number | null = null,
): PriceChartTargetPlacement | null => {
  if (targetPrice === null || !Number.isFinite(targetPrice)) return null
  if (!Number.isFinite(domain.top - domain.bottom)) return null
  if (domain.top <= domain.bottom) return null

  const distance = currentPrice === null || !Number.isFinite(currentPrice)
    ? null
    : targetPrice - currentPrice

  if (targetPrice > domain.top) return { y: plotTop, clamp: 'above', distance }
  if (targetPrice < domain.bottom) return { y: plotBottom, clamp: 'below', distance }

  const y = projectPriceToY(targetPrice, renderDomain, plotTop, plotBottom)

  return {
    y: Math.min(plotBottom, Math.max(plotTop, y)),
    clamp: 'none',
    distance,
  }
}

const getNiceStep = (minimumStep: number) => {
  const exponent = 10 ** Math.floor(Math.log10(minimumStep))
  const normalizedStep = minimumStep / exponent
  const multiplier = normalizedStep <= 1
    ? 1
    : normalizedStep <= 2
      ? 2
      : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10

  return multiplier * exponent
}

const getDomainValues = (
  points: PricePoint[],
  targetPrice: number | null,
  includeAllPoints: boolean,
  livePrice: number | null,
  includeTarget: boolean,
) => {
  const values = (includeAllPoints ? points : points.slice(-RECENT_DOMAIN_POINT_COUNT))
    .map(({ value }) => value)
    .filter((value) => Number.isFinite(value))

  // O marcador, a etiqueta e a última ponta da linha desenham `livePrice`, que
  // vem do feed animado e não da série. Sem ele aqui a faixa é calculada para
  // um dado diferente do que aparece na tela, e o marcador escapa do plot.
  if (livePrice !== null && Number.isFinite(livePrice)) values.push(livePrice)
  if (
    targetPrice !== null
    && Number.isFinite(targetPrice)
    && (includeTarget || values.length === 0)
  ) values.push(targetPrice)

  return values
}

export const appendRoundPricePoint = (
  current: PricePoint[],
  nextPoint: PricePoint,
  roundStart: number,
  maximumPoints: number,
) => {
  if (
    !Number.isFinite(nextPoint.timestamp)
    || !Number.isFinite(nextPoint.value)
    || nextPoint.value <= 0
  ) return current

  const normalizedPoint = {
    ...nextPoint,
    timestamp: Math.max(roundStart, nextPoint.timestamp),
  }
  const normalizedSecond = Math.floor(normalizedPoint.timestamp / 1000)
  const sameSecond = current.find(
    ({ timestamp }) => Math.floor(timestamp / 1000) === normalizedSecond,
  )
  const shouldPreserveRoundSeed = sameSecond?.timestamp === roundStart
  const pointForSecond = shouldPreserveRoundSeed
    ? sameSecond
    : sameSecond && sameSecond.timestamp > normalizedPoint.timestamp
      ? sameSecond
      : normalizedPoint
  const next = [
    ...current.filter(({ timestamp }) => (
      timestamp >= roundStart
      && Math.floor(timestamp / 1000) !== normalizedSecond
    )),
    pointForSecond,
  ].sort((left, right) => left.timestamp - right.timestamp)

  return next.slice(-Math.max(1, maximumPoints))
}

export const appendRollingPricePoint = (
  current: PricePoint[],
  nextPoint: PricePoint,
  earliestTimestamp: number,
  maximumPoints: number,
) => {
  if (
    !Number.isFinite(nextPoint.timestamp)
    || !Number.isFinite(nextPoint.value)
    || nextPoint.value <= 0
  ) return current

  const normalizedSecond = Math.floor(nextPoint.timestamp / 1000)
  const next = [
    ...current.filter(({ timestamp }) => (
      timestamp >= earliestTimestamp
      && Math.floor(timestamp / 1000) !== normalizedSecond
    )),
    nextPoint,
  ].sort((left, right) => left.timestamp - right.timestamp)

  return next.slice(-Math.max(1, maximumPoints))
}

export const mergePricePointSeries = (
  historical: PricePoint[],
  observed: PricePoint[],
  earliestTimestamp: number,
) => {
  const bySecond = new Map<number, PricePoint>()
  const addPoint = (point: PricePoint) => {
    if (
      point.timestamp < earliestTimestamp
      || !Number.isFinite(point.timestamp)
      || !Number.isFinite(point.value)
      || point.value <= 0
    ) return

    bySecond.set(Math.floor(point.timestamp / 1000), point)
  }

  observed.forEach(addPoint)
  // Candles de outra fonte/resolução servem apenas para o período anterior
  // à observação. Não preencher lacunas internas com preços incompatíveis.
  const firstObservedSecond = Math.min(...bySecond.keys())
  historical.forEach((point) => {
    if (Math.floor(point.timestamp / 1000) < firstObservedSecond) addPoint(point)
  })

  return [...bySecond.values()].sort(
    (left, right) => left.timestamp - right.timestamp,
  )
}

export const countPricePointGaps = (
  points: PricePoint[],
  gapThresholdMs = 2_500,
) => points.reduce((count, point, index) => {
  if (index === 0) return count
  return count + (point.timestamp - points[index - 1].timestamp > gapThresholdMs ? 1 : 0)
}, 0)

export const calculatePriceChartDomain = (
  points: PricePoint[],
  targetPrice: number | null,
  {
    includeAllPoints = false,
    includeTarget = false,
    livePrice = null,
    minimumGridStep = MINIMUM_GRID_STEP,
  }: {
    includeAllPoints?: boolean
    includeTarget?: boolean
    livePrice?: number | null
    minimumGridStep?: number
  } = {},
): PriceChartDomain => {
  const values = getDomainValues(
    points,
    targetPrice,
    includeAllPoints,
    livePrice,
    includeTarget,
  )

  if (values.length === 0) return { bottom: 0, top: 6, step: 1 }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  // A folga entra antes da escolha do passo, então ela participa do
  // arredondamento e os sete rótulos continuam caindo em números redondos.
  const padding = Math.max(
    (maximum - minimum) * DOMAIN_PADDING_FRACTION,
    minimumGridStep / 2,
  )
  const paddedMinimum = minimum - padding
  const paddedMaximum = maximum + padding
  // O divisor é `GRID_INTERVALS - 1`, e não `GRID_INTERVALS`. Encaixar a faixa
  // em múltiplos do passo pode consumir até um intervalo inteiro, e com o vão
  // dividido por seis as duas correções abaixo chegavam a brigar: ajustar o topo
  // empurrava a base acima do menor valor, e o preço desenhado ficava de fora.
  // Reservando um intervalo, qualquer das duas correções ainda contém o dado.
  const step = getNiceStep(Math.max(
    minimumGridStep,
    (paddedMaximum - paddedMinimum) / (GRID_INTERVALS - 1),
  ))
  const domainSpan = step * GRID_INTERVALS
  let bottom = Math.floor(
    ((paddedMinimum + paddedMaximum - domainSpan) / 2) / step,
  ) * step
  let top = bottom + domainSpan

  if (paddedMinimum < bottom) {
    bottom = Math.floor(paddedMinimum / step) * step
    top = bottom + domainSpan
  }
  if (paddedMaximum > top) {
    top = Math.ceil(paddedMaximum / step) * step
    bottom = top - domainSpan
  }

  return { bottom, top, step }
}

const getDomainKey = ({ bottom, top, step }: PriceChartDomain) => (
  `${bottom}:${top}:${step}`
)

// Reenquadra sem trocar de escala: mesma amplitude, mesmo passo, apenas
// recentrado no dado. Trocar de escala é decisão à parte, e mais lenta.
const recenterPriceChartDomain = (
  domain: PriceChartDomain,
  center: number,
): PriceChartDomain => {
  const span = domain.top - domain.bottom
  const bottom = Math.round((center - span / 2) / domain.step) * domain.step

  return { bottom, top: bottom + span, step: domain.step }
}

export const stabilizePriceChartDomain = (
  previous: StablePriceChartDomainState | null,
  candidate: PriceChartDomain,
  points: PricePoint[],
  now: number,
  {
    includeAllPoints = false,
    livePrice = null,
  }: {
    includeAllPoints?: boolean
    livePrice?: number | null
  } = {},
): StablePriceChartDomainState => {
  const settled = (domain: PriceChartDomain): StablePriceChartDomainState => ({
    domain,
    contractionCandidateKey: null,
    contractionStartedAt: null,
    shiftCandidateKey: null,
    shiftStartedAt: null,
  })

  if (previous === null) return settled(candidate)

  const current = previous.domain
  const values = getDomainValues(points, null, includeAllPoints, livePrice, false)
  const minimum = values.length > 0 ? Math.min(...values) : candidate.bottom
  const maximum = values.length > 0 ? Math.max(...values) : candidate.top
  const span = current.top - current.bottom
  const margin = span * DOMAIN_EDGE_MARGIN_FRACTION
  // Ameaça de saída do quadro: o dado passou de um limite ou encostou nele.
  // Este é o único gatilho imediato, e ele considera o preço ao vivo.
  const touchesEdge = minimum < current.bottom + margin
    || maximum > current.top - margin

  // O único gatilho imediato é o dado ameaçar sair do quadro. Um candidato com
  // passo maior enquanto tudo ainda cabe não é motivo para reescalar: era assim
  // que o ruído do feed fazia o eixo trocar de escala a cada poucos segundos,
  // subindo na hora e descendo cinco segundos depois, indefinidamente.
  if (touchesEdge) {
    return settled(candidate.step < current.step
      ? recenterPriceChartDomain(current, (minimum + maximum) / 2)
      : candidate)
  }

  if (candidate.step < current.step) {
    const candidateKey = getDomainKey(candidate)
    const contractionStartedAt = previous.contractionCandidateKey === candidateKey
      ? previous.contractionStartedAt ?? now
      : now

    if (now - contractionStartedAt >= DOMAIN_CONTRACTION_DELAY_MS) {
      return settled(candidate)
    }

    return {
      domain: current,
      contractionCandidateKey: candidateKey,
      contractionStartedAt,
      shiftCandidateKey: null,
      shiftStartedAt: null,
    }
  }

  // Mesmo passo: reenquadrar só quando o centro do dado saiu do miolo da faixa.
  // Antes bastava o último preço chegar a dois intervalos de uma borda, o que
  // fazia a faixa perseguir cada oscilação.
  const hasDrifted = Math.abs(
    (minimum + maximum) / 2 - (current.bottom + current.top) / 2,
  ) > span * DOMAIN_RECENTER_FRACTION

  if (hasDrifted && candidate.bottom !== current.bottom) {
    const candidateKey = getDomainKey(candidate)
    const shiftStartedAt = previous.shiftCandidateKey === candidateKey
      ? previous.shiftStartedAt ?? now
      : now

    if (now - shiftStartedAt < DOMAIN_SHIFT_CONFIRMATION_MS) {
      return {
        domain: current,
        contractionCandidateKey: null,
        contractionStartedAt: null,
        shiftCandidateKey: candidateKey,
        shiftStartedAt,
      }
    }

    return settled(candidate)
  }

  return settled(current)
}

export const interpolatePriceChartDomain = (
  from: PriceChartDomain,
  to: PriceChartDomain,
  progress: number,
): PriceChartDomain => {
  const boundedProgress = Math.min(1, Math.max(0, progress))
  if (boundedProgress === 0) return from
  if (boundedProgress === 1) return to
  const interpolate = (start: number, end: number) => (
    start + (end - start) * boundedProgress
  )

  return {
    bottom: interpolate(from.bottom, to.bottom),
    top: interpolate(from.top, to.top),
    step: interpolate(from.step, to.step),
  }
}

export const interpolatePriceAt = (
  points: PricePoint[],
  timestamp: number,
): number | null => {
  if (points.length === 0) return null

  const first = points[0]
  const last = points[points.length - 1]
  if (timestamp <= first.timestamp) return first.value
  if (timestamp >= last.timestamp) return last.value

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const next = points[index]
    if (next.timestamp < timestamp) continue

    const span = next.timestamp - previous.timestamp
    const progress = span <= 0 ? 1 : (timestamp - previous.timestamp) / span

    return previous.value + (next.value - previous.value) * progress
  }

  return last.value
}

export const getPriceChartWindowPoints = (
  points: PricePoint[],
  fromTimestamp: number,
  toTimestamp: number,
): PricePoint[] => {
  if (points.length === 0) return []

  const inside = points.filter(({ timestamp }) => (
    timestamp >= fromTimestamp && timestamp <= toTimestamp
  ))
  const startValue = interpolatePriceAt(points, fromTimestamp)
  const endValue = interpolatePriceAt(points, toTimestamp)
  const window: PricePoint[] = []

  if (startValue !== null && inside[0]?.timestamp !== fromTimestamp) {
    window.push({ timestamp: fromTimestamp, value: startValue })
  }
  window.push(...inside)
  if (
    endValue !== null
    && inside[inside.length - 1]?.timestamp !== toTimestamp
  ) {
    window.push({ timestamp: toTimestamp, value: endValue })
  }

  return window
}

export const clampPriceChartAnchor = (
  anchorTimestamp: number,
  points: PricePoint[],
  windowSpanMs: number,
  latestTimestamp: number,
) => {
  const oldest = points[0]?.timestamp ?? latestTimestamp
  const earliestAnchor = Math.min(latestTimestamp, oldest + windowSpanMs)

  return Math.min(latestTimestamp, Math.max(earliestAnchor, anchorTimestamp))
}

export const getContinuousVisiblePricePoints = (
  points: PricePoint[],
  displayTime: number,
  seriesRight: number,
  leftBoundary: number,
  pixelsPerSecond: number,
): VisiblePriceChartPoints => {
  const project = (point: PricePoint): ProjectedPricePoint => ({
    ...point,
    x: seriesRight - ((displayTime - point.timestamp) / 1000) * pixelsPerSecond,
  })
  const latestTimestamp = displayTime + 1000 / pixelsPerSecond
  const earliestTimestamp =
    displayTime - ((seriesRight - leftBoundary) / pixelsPerSecond) * 1000

  let lastIndex = -1
  for (let index = 0; index < points.length; index += 1) {
    if (points[index].timestamp > latestTimestamp) break
    lastIndex = index
  }

  if (lastIndex < 0) return { points: [], continuityApplied: false }

  let firstInsideIndex = -1
  for (let index = 0; index <= lastIndex; index += 1) {
    if (points[index].timestamp >= earliestTimestamp) {
      firstInsideIndex = index
      break
    }
  }

  const guard = firstInsideIndex === 0 ? null : points[lastIndex]
  const inside = firstInsideIndex < 0
    ? []
    : points.slice(firstInsideIndex, lastIndex + 1).map(project)
  const visible: ProjectedPricePoint[] = [...inside]

  if (firstInsideIndex !== 0 && guard !== null) {
    const previous = project(
      firstInsideIndex < 0 ? guard : points[firstInsideIndex - 1],
    )
    const next = inside[0] ?? null

    if (next !== null) {
      const distance = next.x - previous.x
      const progress = distance <= 0 ? 1 : (leftBoundary - previous.x) / distance

      visible.unshift({
        timestamp: previous.timestamp
          + (next.timestamp - previous.timestamp) * progress,
        value: previous.value + (next.value - previous.value) * progress,
        x: leftBoundary,
      })
    }
  }

  // Guarda da borda direita: enquanto o gráfico está arrastado, o trecho entre
  // o último ponto visível e o próximo ponto real precisa continuar desenhado.
  const nextOutsideIndex = lastIndex + 1
  if (nextOutsideIndex < points.length) {
    const previous = project(points[lastIndex])
    const next = project(points[nextOutsideIndex])
    const distance = next.x - previous.x
    const progress = distance <= 0 ? 1 : (seriesRight - previous.x) / distance
    const rightEdge: ProjectedPricePoint = {
      timestamp: previous.timestamp
        + (next.timestamp - previous.timestamp) * progress,
      value: previous.value + (next.value - previous.value) * progress,
      x: seriesRight,
    }

    if (visible.length === 0) {
      const leftValue = interpolatePriceAt(points, earliestTimestamp)

      if (leftValue !== null) {
        visible.push({
          timestamp: earliestTimestamp,
          value: leftValue,
          x: leftBoundary,
        })
      }
    }

    visible.push(rightEdge)
  }

  return {
    points: visible,
    continuityApplied: firstInsideIndex !== 0 && visible.length > 0,
  }
}
