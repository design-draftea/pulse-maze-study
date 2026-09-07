import { useEffect, useMemo, useRef, useState } from 'react'
import { BTC_DISPLAY_TIME_ZONE } from '../../services/marketData'
import {
  PriceChart,
  type PriceChartDomain,
  type PriceChartEntry,
  type PriceDirection,
  type PricePoint,
  type PriceChartRange,
} from '../PriceChart'
import {
  calculatePriceChartDomain,
  clampPriceChartAnchor,
  getPriceChartRangeConfig,
  getPriceChartWindowPoints,
  interpolatePriceChartDomain,
  LIVE_WINDOW_DURATION_MS,
  LIVE_MINIMUM_GRID_STEP,
  stabilizePriceChartDomain,
  type StablePriceChartDomainState,
} from '../priceChartModel'

interface MarketPriceChartProps {
  now: number
  points: PricePoint[]
  historyPoints: PricePoint[]
  targetPrice: number | null
  currentPrice: number | null
  priceDirection: PriceDirection | null
  directionAnimationSequence: number
  entries: PriceChartEntry[]
  roundStart: number
  roundEnd: number
  currentSource: string | null
  currentStatus: string
  currentUpdatedAt: number | null
}

const DOMAIN_ANIMATION_DURATION_MS = 280

const domainsAreEqual = (
  first: PriceChartDomain,
  second: PriceChartDomain,
) => first.bottom === second.bottom
  && first.top === second.top
  && first.step === second.step

// As dependências são os três números do domínio, e não o objeto. As fontes do
// domínio são recriadas a cada tique de 250ms do relógio, então depender da
// identidade cancelava e reiniciava esta animação de 280ms antes de ela
// convergir: `renderDomain` nunca alcançava `domain` e os rótulos da grade
// deixavam de descrever as alturas em que estavam desenhados.
const useAnimatedPriceChartDomain = (
  { bottom, top, step }: PriceChartDomain,
) => {
  const currentDomainRef = useRef<PriceChartDomain>({ bottom, top, step })
  const [renderDomain, setRenderDomain] = useState<PriceChartDomain>(
    { bottom, top, step },
  )

  useEffect(() => {
    const targetDomain = { bottom, top, step }
    const fromDomain = currentDomainRef.current

    if (domainsAreEqual(fromDomain, targetDomain)) return undefined

    const commit = (nextDomain: PriceChartDomain) => {
      currentDomainRef.current = nextDomain
      setRenderDomain(nextDomain)
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedMotionFrame = window.requestAnimationFrame(
        () => commit(targetDomain),
      )
      return () => window.cancelAnimationFrame(reducedMotionFrame)
    }

    let frameId = 0
    const startedAt = window.performance.now()
    const animate = (frameTime: number) => {
      const progress = Math.min(
        1,
        (frameTime - startedAt) / DOMAIN_ANIMATION_DURATION_MS,
      )
      const easedProgress = 1 - (1 - progress) ** 3

      commit(interpolatePriceChartDomain(fromDomain, targetDomain, easedProgress))
      if (progress < 1) frameId = window.requestAnimationFrame(animate)
    }

    // Com a página oculta o navegador não entrega quadros, então a transição
    // fica parada onde estava e a faixa desenhada deixa de ser a faixa
    // calculada. Na volta o certo é saltar para o valor verdadeiro, não
    // retomar uma interpolação que descreve um estado que já passou.
    const snapToTarget = () => {
      if (document.visibilityState !== 'visible') return

      window.cancelAnimationFrame(frameId)
      commit(targetDomain)
    }

    frameId = window.requestAnimationFrame(animate)
    document.addEventListener('visibilitychange', snapToTarget)

    return () => {
      document.removeEventListener('visibilitychange', snapToTarget)
      window.cancelAnimationFrame(frameId)
    }
  }, [bottom, step, top])

  return renderDomain
}

export function MarketPriceChart({
  now,
  points,
  historyPoints,
  targetPrice,
  currentPrice,
  priceDirection,
  directionAnimationSequence,
  entries,
  roundStart,
  roundEnd,
  currentSource,
  currentStatus,
  currentUpdatedAt,
}: MarketPriceChartProps) {
  const [range, setRange] = useState<PriceChartRange>('live')
  const [panAnchor, setViewAnchorTimestamp] = useState<number | null>(null)
  const [windowSpanMs, setWindowSpanMs] = useState(LIVE_WINDOW_DURATION_MS)
  // A série contínua já mescla candles e observações de várias rodadas.
  // Enquanto ela carrega, conservar os pontos reais disponíveis da rodada.
  const displayedPoints = historyPoints.length > 0 ? historyPoints : points
  const chartTime = Math.max(now, displayedPoints.at(-1)?.timestamp ?? now)
  const viewAnchorTimestamp = panAnchor === null ? null : clampPriceChartAnchor(
    panAnchor, displayedPoints, windowSpanMs, chartTime,
  )
  const liveWindowPoints = useMemo(
    () => getPriceChartWindowPoints(
      displayedPoints,
      chartTime - LIVE_WINDOW_DURATION_MS,
      chartTime,
    ),
    [chartTime, displayedPoints],
  )

  const candidateDomain = useMemo(
    () => calculatePriceChartDomain(liveWindowPoints, targetPrice, {
      includeAllPoints: true,
      livePrice: currentPrice,
      minimumGridStep: LIVE_MINIMUM_GRID_STEP,
    }),
    [currentPrice, liveWindowPoints, targetPrice],
  )
  const pannedDomain = useMemo(() => {
    if (range !== 'live' || viewAnchorTimestamp === null) return null

    const windowPoints = getPriceChartWindowPoints(
      displayedPoints,
      viewAnchorTimestamp - windowSpanMs,
      viewAnchorTimestamp,
    )

    return windowPoints.length === 0
      ? null
      : calculatePriceChartDomain(windowPoints, null, {
          includeAllPoints: true,
          minimumGridStep: LIVE_MINIMUM_GRID_STEP,
        })
  }, [displayedPoints, range, viewAnchorTimestamp, windowSpanMs])
  const fixedRangeDomain = useMemo(() => {
    const durationMs = getPriceChartRangeConfig(range, 1).durationMs
    if (durationMs === null) return null

    // O quadro da rodada é parado: vai de `roundStart` a `roundEnd` e sempre
    // inclui o objetivo, que nessa escala cabe e é o referencial do jogo.
    const isRoundRange = range === 'ronda'
    const rangeEnd = isRoundRange
      ? roundEnd
      : Math.max(now, historyPoints.at(-1)?.timestamp ?? 0)
    const windowPoints = getPriceChartWindowPoints(
      historyPoints,
      rangeEnd - durationMs,
      isRoundRange ? Math.min(now, rangeEnd) : rangeEnd,
    )

    return calculatePriceChartDomain(windowPoints, targetPrice, {
      includeAllPoints: true,
      includeTarget: isRoundRange,
      livePrice: currentPrice,
    })
  }, [currentPrice, historyPoints, now, range, roundEnd, targetPrice])
  const [stableDomainState, setStableDomainState] = useState<
    StablePriceChartDomainState
  >(() => stabilizePriceChartDomain(
    null,
    candidateDomain,
    liveWindowPoints,
    chartTime,
    { includeAllPoints: true, livePrice: currentPrice },
  ))
  const [initialRoundStart] = useState(roundStart)
  const nextDomainState = stabilizePriceChartDomain(
    stableDomainState,
    candidateDomain,
    liveWindowPoints,
    chartTime,
    { includeAllPoints: true, livePrice: currentPrice },
  )
  // A comparação é por valor. `candidateDomain` é um objeto novo sempre que o
  // preço animado muda, então comparar identidades faria a estabilização
  // recolocar o mesmo domínio em estado a cada quadro.
  const hasSameDomain = domainsAreEqual(
    nextDomainState.domain,
    stableDomainState.domain,
  )
  const resolvedDomainState = hasSameDomain
    ? { ...nextDomainState, domain: stableDomainState.domain }
    : nextDomainState

  if (
    !hasSameDomain
    || resolvedDomainState.contractionCandidateKey
      !== stableDomainState.contractionCandidateKey
    || resolvedDomainState.shiftCandidateKey !== stableDomainState.shiftCandidateKey
  ) {
    setStableDomainState(resolvedDomainState)
  }

  const liveDomain = resolvedDomainState.domain
  const domain = fixedRangeDomain ?? pannedDomain ?? liveDomain
  const renderDomain = useAnimatedPriceChartDomain(domain)

  return (
    <PriceChart
      points={displayedPoints}
      domain={domain}
      renderDomain={renderDomain}
      currentPrice={currentPrice}
      targetPrice={targetPrice}
      priceDirection={priceDirection}
      directionAnimationSequence={directionAnimationSequence}
      entries={entries}
      locale="es-MX"
      timeZone={BTC_DISPLAY_TIME_ZONE}
      seriesKey={initialRoundStart}
      viewAnchorTimestamp={viewAnchorTimestamp}
      onViewAnchorChange={setViewAnchorTimestamp}
      onWindowSpanChange={setWindowSpanMs}
      resetReason="initial-load"
      roundEnd={roundEnd}
      source={currentSource}
      status={currentStatus}
      updatedAt={currentUpdatedAt}
      range={range}
      onRangeChange={setRange}
    />
  )
}
