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

const useAnimatedPriceChartDomain = (
  targetDomain: PriceChartDomain,
) => {
  const currentDomainRef = useRef(targetDomain)
  const [renderDomain, setRenderDomain] = useState(targetDomain)

  useEffect(() => {
    const fromDomain = currentDomainRef.current
    if (domainsAreEqual(fromDomain, targetDomain)) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedMotionFrame = window.requestAnimationFrame(() => {
        currentDomainRef.current = targetDomain
        setRenderDomain(targetDomain)
      })
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
      const nextDomain = interpolatePriceChartDomain(
        fromDomain,
        targetDomain,
        easedProgress,
      )

      currentDomainRef.current = nextDomain
      setRenderDomain(nextDomain)
      if (progress < 1) frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frameId)
  }, [targetDomain])

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
      minimumGridStep: LIVE_MINIMUM_GRID_STEP,
    }),
    [liveWindowPoints, targetPrice],
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
          applyTrendShift: false,
          includeAllPoints: true,
          minimumGridStep: LIVE_MINIMUM_GRID_STEP,
        })
  }, [displayedPoints, range, viewAnchorTimestamp, windowSpanMs])
  const fixedRangeDomain = useMemo(() => {
    const durationMs = getPriceChartRangeConfig(range, 1).durationMs
    if (durationMs === null) return null

    const rangeEnd = Math.max(
      now,
      historyPoints.at(-1)?.timestamp ?? 0,
    )
    const windowPoints = getPriceChartWindowPoints(
      historyPoints,
      rangeEnd - durationMs,
      rangeEnd,
    )

    return calculatePriceChartDomain(windowPoints, targetPrice, {
      applyTrendShift: false,
      includeAllPoints: true,
    })
  }, [historyPoints, now, range, targetPrice])
  const [stableDomainState, setStableDomainState] = useState<{
    inputKey: string
    state: StablePriceChartDomainState
  }>(() => ({
    inputKey: '',
    state: stabilizePriceChartDomain(
      null,
      candidateDomain,
      liveWindowPoints,
      chartTime,
      { includeAllPoints: true },
    ),
  }))
  const [initialRoundStart] = useState(roundStart)
  const domainTimestamp = chartTime
  const domainInputKey = [
    candidateDomain.bottom,
    candidateDomain.top,
    candidateDomain.step,
    domainTimestamp,
  ].join(':')
  let resolvedDomainState = stableDomainState

  if (stableDomainState.inputKey !== domainInputKey) {
    resolvedDomainState = {
      inputKey: domainInputKey,
      state: stabilizePriceChartDomain(
        stableDomainState.state,
        candidateDomain,
        liveWindowPoints,
        domainTimestamp,
        { includeAllPoints: true },
      ),
    }
    setStableDomainState(resolvedDomainState)
  }

  const liveDomain = resolvedDomainState.state.domain
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
      source={currentSource}
      status={currentStatus}
      updatedAt={currentUpdatedAt}
      range={range}
      onRangeChange={setRange}
    />
  )
}
