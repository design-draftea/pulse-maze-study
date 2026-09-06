import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import type { CSSProperties } from 'react'
import {
  layoutPriceChartEntries,
  type PriceChartEntry,
} from './priceChartLayout'
import {
  BASE_PRICE_CHART_WIDTH,
  getPriceChartGeometry,
  getTimeTickOpacity,
  PRICE_CHART_HEIGHT,
} from './priceChartGeometry'
import {
  countPricePointGaps,
  connectPriceChartEndpoint,
  getContinuousVisiblePricePoints,
  getPriceChartRangeConfig,
  getPriceChartTimeTicks,
  interpolatePriceAt,
  projectPriceToY,
  resolvePriceChartTarget,
  type PriceChartDomain,
  type PriceChartRange,
  type PricePoint,
} from './priceChartModel'
import { usePriceChartPan } from '../hooks/usePriceChartPan'
import { LiveIndicator } from './LiveIndicator/LiveIndicator'
import './PriceChart.css'

export type { PriceChartEntry } from './priceChartLayout'
export type {
  PriceChartDomain,
  PriceChartRange,
  PricePoint,
} from './priceChartModel'

export type PriceDirection = 'up' | 'down'

type PriceChartProps = {
  points: PricePoint[]
  domain: PriceChartDomain
  renderDomain?: PriceChartDomain
  currentPrice: number | null
  targetPrice: number | null
  priceDirection: PriceDirection | null
  directionAnimationSequence: number
  entries?: PriceChartEntry[]
  currency?: string
  locale?: string
  timeZone?: string
  className?: string
  seriesKey: number
  viewAnchorTimestamp: number | null
  onViewAnchorChange: (next: number | null) => void
  onWindowSpanChange?: (spanMs: number) => void
  resetReason: 'initial-load' | 'round-change'
  source: string | null
  status: string
  updatedAt: number | null
  range: PriceChartRange
  onRangeChange: (range: PriceChartRange) => void
}

type ChartPoint = PricePoint & {
  x: number
  y: number
}

const PLOT_LEFT = 16
const PLOT_TOP = 16
const PLOT_BOTTOM = 220
// Os 11px acima da faixa e o 1px abaixo dela são a folga que impede o traço de
// 3px da linha e o halo do ponto de serem cortados pelo recorte.
const PLOT_CLIP_TOP = PLOT_TOP - 11
const PLOT_CLIP_HEIGHT = PLOT_BOTTOM + 1 - PLOT_CLIP_TOP
// O tracinho do eixo temporal nasce colado na última linha da grade. É essa
// emenda que faz o eixo ler como eixo, então a linha do objetivo trava na
// própria borda da faixa em vez de empurrar o eixo para baixo. O nó `17:13176`
// do Figma reserva 25px de respiro aí, mas naquele frame o eixo desce junto; no
// gráfico real o respiro sobraria como um vão sempre que nada estivesse travado.
const TIME_AXIS_TICK_TOP = PLOT_BOTTOM
const TIME_AXIS_TICK_BOTTOM = TIME_AXIS_TICK_TOP + 5
const TIME_AXIS_LABEL_BASELINE = TIME_AXIS_TICK_BOTTOM + 21
const CURRENT_LABEL_WIDTH = 85
const GRID_LINE_COUNT = 7
const TIME_TICK_FADE_DISTANCE = 48
const TIME_TICK_LABEL_INSET = 24
const PLOT_FADE_WIDTH = 96
const DIRECTION_CLEAR_SIZE = 30
const DIRECTION_ANIMATION_FALLBACK_MS = 800
const RENDER_FRAME_INTERVAL = 1000 / 30
// Pílula do preço objetivo, do nó `536:13573`. A borda esquerda é fixa: a linha
// acompanha a largura do gráfico, mas a etiqueta permanece ancorada.
const TARGET_LABEL_X = 66
const TARGET_PILL_HEIGHT = 16
const TARGET_PILL_PADDING_LEFT = 8
const TARGET_PILL_PADDING_RIGHT = 8
const TARGET_PILL_PADDING_RIGHT_WITH_CHEVRON = 4
const TARGET_CHEVRON_GAP = 2
const TARGET_CHEVRON_SIZE = 16
const TARGET_LABEL_BASELINE = 3.5
const RANGE_BUTTONS: Array<{
  range: PriceChartRange
  label: string
  ariaLabel: string
}> = [
  { range: 'live', label: 'LIVE', ariaLabel: 'Ver precio en vivo' },
  { range: '5m', label: '5M', ariaLabel: 'Ver últimos 5 minutos' },
  { range: '15m', label: '15M', ariaLabel: 'Ver últimos 15 minutos' },
  { range: '1h', label: '1H', ariaLabel: 'Ver última hora' },
]

const getSmoothPath = (points: ChartPoint[]) => {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const handle = Math.max(0, next.x - current.x) * 0.45
    const controlOneX = current.x + handle
    const controlTwoX = next.x - handle

    path += ` C ${controlOneX.toFixed(2)} ${current.y.toFixed(2)}, ${controlTwoX.toFixed(2)} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`
  }

  return path
}

const useRenderTime = () => {
  const [renderTime, setRenderTime] = useState(() => Date.now())

  useEffect(() => {
    let frameId = 0
    let previousFrame = 0

    const renderFrame = (frameTime: number) => {
      if (frameTime - previousFrame >= RENDER_FRAME_INTERVAL) {
        previousFrame = frameTime
        setRenderTime(Date.now())
      }

      frameId = window.requestAnimationFrame(renderFrame)
    }

    frameId = window.requestAnimationFrame(renderFrame)

    return () => window.cancelAnimationFrame(frameId)
  }, [])

  return renderTime
}

const usePriceChartWidth = () => {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState(BASE_PRICE_CHART_WIDTH)
  const containerRef = useCallback((node: HTMLElement | null) => {
    setContainer(node)
  }, [])

  useLayoutEffect(() => {
    if (!container) return

    const updateWidth = (nextWidth: number) => {
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return

      setWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth,
      )
    }
    const measure = () => updateWidth(container.getBoundingClientRect().width)

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(([entry]) => {
      updateWidth(entry.contentRect.width)
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [container])

  return { containerRef, width }
}

const DirectionChevrons = ({
  onComplete,
}: {
  onComplete?: () => void
}) => (
  <g className="price-chart__direction-glyph" aria-hidden="true">
    <path
      className="price-chart__direction-chevron price-chart__direction-chevron--second"
      d="M7 11L12 6L17 11"
      onAnimationEnd={() => onComplete?.()}
    />
    <path
      className="price-chart__direction-chevron price-chart__direction-chevron--first"
      d="M7 17L12 12L17 17"
    />
  </g>
)

// `tabler-icon-chevrons-up` de 16px, do nó `536:13556`. É uma variante distinta
// da usada pelo indicador de direção: ali o glifo tem 24px, traço de 1.5 e os
// dois chevrons animados; aqui tem 16px, traço de 1, o da frente cheio, o de
// trás a 50% e nenhuma animação.
const TargetChevrons = () => (
  <g className="price-chart__target-chevrons" aria-hidden="true">
    <path
      className="price-chart__target-chevron price-chart__target-chevron--leading"
      d="M4.66667 7.33333L8 4L11.3333 7.33333"
    />
    <path
      className="price-chart__target-chevron price-chart__target-chevron--trailing"
      d="M4.66667 11.3333L8 8L11.3333 11.3333"
    />
  </g>
)

export function PriceChart({
  points,
  domain,
  renderDomain = domain,
  currentPrice,
  targetPrice,
  priceDirection,
  directionAnimationSequence,
  entries = [],
  currency = 'USD',
  locale = 'en-US',
  timeZone,
  className = '',
  seriesKey,
  viewAnchorTimestamp,
  onViewAnchorChange,
  onWindowSpanChange,
  resetReason,
  source,
  status,
  updatedAt,
  range,
  onRangeChange,
}: PriceChartProps) {
  const id = useId().replace(/:/g, '')
  const [completedDirectionSequence, setCompletedDirectionSequence] = useState(0)
  const safePoints = useMemo(
    () =>
      points
        .filter(
          ({ timestamp, value }) =>
            Number.isFinite(timestamp) && Number.isFinite(value),
        )
        .slice()
        .sort((first, second) => first.timestamp - second.timestamp),
    [points],
  )
  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currency, locale],
  )
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone,
      }),
    [locale, timeZone],
  )
  const entryAmountFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [currency, locale],
  )
  const { containerRef, width: containerWidth } = usePriceChartWidth()
  const {
    width: chartWidth,
    plotRight,
    seriesRight,
    currentLabelX,
    priceLabelX,
    directionIconX,
  } = getPriceChartGeometry(containerWidth)
  const latestPoint = safePoints.at(-1)
  const latestPrice = currentPrice ?? latestPoint?.value ?? 0
  const isDirectionVisible = priceDirection !== null
    && directionAnimationSequence > completedDirectionSequence

  useEffect(() => {
    if (directionAnimationSequence === 0) return

    const timer = window.setTimeout(() => {
      setCompletedDirectionSequence((currentSequence) =>
        Math.max(currentSequence, directionAnimationSequence),
      )
    }, DIRECTION_ANIMATION_FALLBACK_MS)

    return () => window.clearTimeout(timer)
  }, [directionAnimationSequence])
  const priceLabelSample = priceFormatter.format(renderDomain.top)
  // O nó fica em estado pelo mesmo motivo da etiqueta do objetivo, logo
  // abaixo: enquanto a série está vazia o componente sai pelo retorno
  // antecipado e este `<text>` não existe. Com `useRef` o efeito rodava uma
  // vez, encontrava `null` e nunca mais voltava, porque nem o comprimento do
  // rótulo nem a largura do gráfico mudam quando a série chega — o contêiner
  // já é medido no estado vazio. `priceLabelWidth` ficava zero,
  // `--price-chart-value-right` não era publicada e a pílula `LIVE` caía no
  // retorno `right: 24px` do CSS em vez do alinhamento medido.
  const [priceLabelNode, setPriceLabelNode] = useState<SVGTextElement | null>(
    null,
  )
  const [priceLabelWidth, setPriceLabelWidth] = useState(0)

  // A medição fica em uma função nomeada, como nas duas medições irmãs do
  // arquivo. Chamar `setPriceLabelWidth` direto no corpo do efeito faz o
  // `react(set-state-in-effect)` do oxlint acusar cascata de renderização,
  // porque o efeito passou a depender de estado próprio.
  useLayoutEffect(() => {
    if (priceLabelNode === null) return

    const measure = () => {
      const measuredWidth = priceLabelNode.getBBox().width
      if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) return

      setPriceLabelWidth((currentWidth) =>
        Math.abs(currentWidth - measuredWidth) < 0.5
          ? currentWidth
          : measuredWidth,
      )
    }

    measure()
  }, [priceLabelNode, priceLabelSample.length, chartWidth])

  const targetLabel = targetPrice === null || !Number.isFinite(targetPrice)
    ? null
    : `${priceFormatter.format(targetPrice)} - objetivo`
  // O nó fica em estado, e não em `useRef`, para a medição reagir à entrada
  // dele no DOM. Enquanto a série está vazia o componente sai pelo retorno
  // antecipado do estado vazio e o `<text>` não existe; com `useRef` o efeito
  // rodaria uma vez, encontraria `null` e nunca mais voltaria, porque o
  // comprimento do rótulo não muda dentro da rodada. A pílula ficava com
  // largura zero e a etiqueta invisível, sobrando só a linha.
  const [targetLabelNode, setTargetLabelNode] = useState<SVGTextElement | null>(
    null,
  )
  const [targetLabelWidth, setTargetLabelWidth] = useState(0)

  // A pílula é desenhada a partir da largura real do texto. Os numerais são
  // tabulares, então remedir quando o número de caracteres muda basta.
  useLayoutEffect(() => {
    const node = targetLabelNode
    if (node === null) return

    const measure = () => {
      const measuredWidth = node.getBBox().width
      if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) return

      setTargetLabelWidth((currentWidth) =>
        Math.abs(currentWidth - measuredWidth) < 0.5
          ? currentWidth
          : measuredWidth,
      )
    }

    measure()

    // A Red Hat Display vem do Google Fonts com `display=swap`, então na
    // primeira pintura o texto ainda está na fonte de retorno. Sem remedir
    // quando ela chega, a pílula ficaria dimensionada para a fonte errada.
    if (typeof document.fonts === 'undefined') return

    let isCancelled = false
    document.fonts.ready.then(() => {
      if (!isCancelled) measure()
    })

    return () => {
      isCancelled = true
    }
  }, [targetLabelNode, targetLabel?.length])

  const renderTime = useRenderTime()
  const displayTime = Math.max(renderTime, latestPoint?.timestamp ?? renderTime)
  const rangeConfig = getPriceChartRangeConfig(range, seriesRight)
  const pixelsPerSecond = rangeConfig.pixelsPerSecond
  const timeTickInterval = rangeConfig.timeTickIntervalMs
  const timeTickSpacing = (timeTickInterval / 1000) * pixelsPerSecond
  const windowSpanMs = rangeConfig.durationMs
    ?? (seriesRight / pixelsPerSecond) * 1000
  const isLiveRange = range === 'live'
  const isPanned = isLiveRange && viewAnchorTimestamp !== null
  const anchorTime = isPanned
    ? viewAnchorTimestamp ?? displayTime
    : displayTime
  const anchorPrice = isPanned
    ? interpolatePriceAt(safePoints, anchorTime) ?? latestPrice
    : latestPrice
  const { cancelPan, isPanning, panHandlers, returnToLive } = usePriceChartPan({
    points: safePoints,
    latestTimestamp: displayTime,
    windowSpanMs,
    pixelsPerSecond,
    viewAnchorTimestamp,
    onViewAnchorChange,
  })

  useEffect(() => {
    if (isLiveRange) onWindowSpanChange?.(windowSpanMs)
  }, [isLiveRange, onWindowSpanChange, windowSpanMs])

  const handleRangeChange = (nextRange: PriceChartRange) => {
    if (nextRange === 'live' && range === 'live' && isPanned) {
      returnToLive()
      return
    }

    cancelPan()
    onViewAnchorChange(null)
    onRangeChange(nextRange)
  }

  const rangeControls = (
    <nav
      className="price-chart__range-controls"
      aria-label="Rango del gráfico"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {RANGE_BUTTONS.map((button) => {
        const isActive = button.range === range
          && (button.range !== 'live' || !isPanned)

        return (
          <button
            aria-label={button.range === 'live' && isPanned
              ? 'Volver al precio en vivo'
              : button.ariaLabel}
            aria-pressed={isActive}
            className={`price-chart__range-button${isActive ? ' price-chart__range-button--active' : ''}`}
            data-chart-range={button.range}
            key={button.range}
            onClick={() => handleRangeChange(button.range)}
            type="button"
          >
            {button.range === 'live' ? (
              <LiveIndicator className="price-chart__range-live-dot" />
            ) : null}
            {button.label}
          </button>
        )
      })}
    </nav>
  )

  const visibleEntries = useMemo(
    () => (isPanned ? [] : layoutPriceChartEntries(entries, displayTime)),
    [displayTime, entries, isPanned],
  )

  if (safePoints.length === 0) {
    return (
      <figure
        ref={containerRef}
        className={`price-chart price-chart--empty ${className}`}
        data-range={range}
      >
        <div className="price-chart__empty-message" role="status">
          Esperando datos del mercado
        </div>
        {rangeControls}
      </figure>
    )
  }

  const { top } = renderDomain
  const { step } = domain
  const priceToY = (value: number) =>
    projectPriceToY(value, renderDomain, PLOT_TOP, PLOT_BOTTOM)
  const targetPlacement = resolvePriceChartTarget(
    targetPrice,
    domain,
    renderDomain,
    PLOT_TOP,
    PLOT_BOTTOM,
  )
  const isTargetClamped = targetPlacement !== null
    && targetPlacement.clamp !== 'none'
  const targetPillWidth = targetLabelWidth === 0
    ? 0
    : TARGET_PILL_PADDING_LEFT
      + targetLabelWidth
      + (isTargetClamped
        ? TARGET_CHEVRON_GAP
          + TARGET_CHEVRON_SIZE
          + TARGET_PILL_PADDING_RIGHT_WITH_CHEVRON
        : TARGET_PILL_PADDING_RIGHT)
  const animatedSafePoints = safePoints.map((point, index) => (
    index === safePoints.length - 1
      ? { ...point, value: latestPrice }
      : point
  ))
  const pointsWithCurrent = latestPoint?.timestamp === displayTime
    ? animatedSafePoints
    : [
        ...animatedSafePoints,
        { timestamp: displayTime, value: latestPrice },
      ]
  const visibleSeries = getContinuousVisiblePricePoints(
    isPanned ? safePoints : pointsWithCurrent,
    anchorTime,
    seriesRight,
    0,
    pixelsPerSecond,
  )
  const chartPoints: ChartPoint[] = visibleSeries.points.map((point) => ({
    ...point,
    y: priceToY(point.value),
  }))
  const currentPoint: ChartPoint = {
    timestamp: anchorTime,
    value: anchorPrice,
    x: seriesRight,
    y: priceToY(anchorPrice),
  }
  // O recorte existe apenas para abrir espaço para os chevrons. Sem direção
  // confirmada ele deixaria um buraco permanente no tracejado, então fecha.
  const isDirectionActive = priceDirection !== null && !isPanned
  const directionClearClassName = `price-chart__direction-clear${
    isDirectionActive ? '' : ' price-chart__direction-clear--closed'
  }`
  const directionCenterX = directionIconX + 12
  const visibleLinePoints = connectPriceChartEndpoint(chartPoints, currentPoint)
  const linePath = getSmoothPath(visibleLinePoints)
  const areaStartX = visibleLinePoints[0]?.x ?? PLOT_LEFT
  const areaPath = `${linePath} L ${currentPoint.x} ${PLOT_BOTTOM} L ${areaStartX} ${PLOT_BOTTOM} Z`
  const ticks = Array.from(
    { length: GRID_LINE_COUNT },
    (_, index) => top - step * index,
  )
  const latestTimeTick =
    Math.floor(anchorTime / timeTickInterval) * timeTickInterval
  const liveTimeTickCount = Math.max(
    4,
    Math.ceil((seriesRight - PLOT_LEFT) / timeTickSpacing) + 1,
  )
  const timeTicks = isLiveRange
    ? Array.from({ length: liveTimeTickCount }, (_, index) => {
        const timestamp = latestTimeTick - index * timeTickInterval

        return {
          timestamp,
          x:
            seriesRight -
            ((anchorTime - timestamp) / 1000) * pixelsPerSecond,
        }
      })
    : getPriceChartTimeTicks(
        anchorTime,
        timeTickInterval,
        PLOT_LEFT,
        seriesRight,
        TIME_TICK_LABEL_INSET,
      )

  return (
    <figure
      ref={containerRef}
      className={`price-chart ${isPanned ? 'price-chart--panned' : ''} ${isPanning ? 'price-chart--panning' : ''} ${className}`}
      aria-label={isPanned
        ? `Gráfico del historial de Bitcoin: ${priceFormatter.format(anchorPrice)}`
        : `Gráfico del precio actual: ${priceFormatter.format(latestPrice)}`}
      data-testid="price-chart"
      data-range={range}
      data-panned={isPanned}
      data-view-anchor={viewAnchorTimestamp ?? ''}
      data-window-span={Math.round(windowSpanMs)}
      style={priceLabelWidth > 0
        ? {
            '--price-chart-value-right': `${Math.max(
              0,
              chartWidth - priceLabelX - priceLabelWidth,
            )}px`,
          } as CSSProperties
        : undefined}
      {...(isLiveRange ? panHandlers : {})}
      data-point-count={safePoints.length}
      data-displayed-price={latestPrice}
      data-target-price={targetPrice ?? ''}
      data-target-clamp={targetPlacement?.clamp ?? ''}
      data-target-y={targetPlacement?.y ?? ''}
      data-domain-bottom={domain.bottom}
      data-domain-top={domain.top}
      data-domain-step={domain.step}
      data-domain-trend-shift={domain.trendShiftIntervals ?? 0}
      data-render-domain-bottom={renderDomain.bottom}
      data-render-domain-top={renderDomain.top}
      data-render-domain-step={renderDomain.step}
      data-series-key={seriesKey}
      data-series-reset-reason={resetReason}
      data-series-start={safePoints[0]?.timestamp ?? ''}
      data-visible-point-count={visibleSeries.points.length}
      data-continuity-applied={visibleSeries.continuityApplied}
      data-gap-count={countPricePointGaps(safePoints)}
      data-current-source={source ?? ''}
      data-current-status={status}
      data-current-updated-at={updatedAt ?? ''}
    >
      <svg
        className="price-chart__canvas"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${chartWidth} ${PRICE_CHART_HEIGHT}`}
        role="img"
        aria-label="Precio en tiempo real"
        aria-describedby={`price-chart-description-${id}`}
      >
        <desc id={`price-chart-description-${id}`}>
          Serie con {safePoints.length} actualizaciones. El precio más reciente es{' '}
          {priceFormatter.format(latestPrice)}.
        </desc>

        <defs>
          <linearGradient id={`price-area-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fbfbfb" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#fbfbfb" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id={`current-price-${id}`}
            x1="0"
            x2="1"
            y1="1"
            y2="0"
          >
            <stop offset="0%" stopColor="#4b20ff" />
            <stop offset="100%" stopColor="#9730ff" />
          </linearGradient>
          <linearGradient
            id={`plot-fade-${id}`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2={PLOT_FADE_WIDTH}
            y1="0"
            y2="0"
          >
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="10%" stopColor="#fff" stopOpacity="0.028" />
            <stop offset="20%" stopColor="#fff" stopOpacity="0.104" />
            <stop offset="30%" stopColor="#fff" stopOpacity="0.216" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.352" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0.648" />
            <stop offset="70%" stopColor="#fff" stopOpacity="0.784" />
            <stop offset="80%" stopColor="#fff" stopOpacity="0.896" />
            <stop offset="90%" stopColor="#fff" stopOpacity="0.972" />
            <stop offset="100%" stopColor="#fff" />
          </linearGradient>
          <mask
            id={`plot-fade-mask-${id}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y={PLOT_CLIP_TOP}
            width={plotRight}
            height={PLOT_CLIP_HEIGHT}
          >
            <rect
              x="0"
              y={PLOT_CLIP_TOP}
              width={plotRight}
              height={PLOT_CLIP_HEIGHT}
              fill={`url(#plot-fade-${id})`}
            />
            <rect
              className={directionClearClassName}
              x={directionCenterX - DIRECTION_CLEAR_SIZE / 2}
              y={currentPoint.y - DIRECTION_CLEAR_SIZE / 2}
              width={DIRECTION_CLEAR_SIZE}
              height={DIRECTION_CLEAR_SIZE}
              fill="#000"
            />
          </mask>
          <mask
            id={`chart-clear-mask-${id}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={chartWidth}
            height={PRICE_CHART_HEIGHT}
          >
            <rect width={chartWidth} height={PRICE_CHART_HEIGHT} fill="#fff" />
            <rect
              className={directionClearClassName}
              x={directionCenterX - DIRECTION_CLEAR_SIZE / 2}
              y={currentPoint.y - DIRECTION_CLEAR_SIZE / 2}
              width={DIRECTION_CLEAR_SIZE}
              height={DIRECTION_CLEAR_SIZE}
              fill="#000"
            />
          </mask>
          <mask
            id={`current-line-clear-mask-${id}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y={-DIRECTION_CLEAR_SIZE / 2}
            width={chartWidth}
            height={DIRECTION_CLEAR_SIZE}
          >
            <rect
              x="0"
              y={-DIRECTION_CLEAR_SIZE / 2}
              width={chartWidth}
              height={DIRECTION_CLEAR_SIZE}
              fill="#fff"
            />
            <rect
              className={directionClearClassName}
              x={directionCenterX - DIRECTION_CLEAR_SIZE / 2}
              y={-DIRECTION_CLEAR_SIZE / 2}
              width={DIRECTION_CLEAR_SIZE}
              height={DIRECTION_CLEAR_SIZE}
              fill="#000"
            />
          </mask>
          <clipPath id={`plot-clip-${id}`}>
            <rect
              x="0"
              y={PLOT_CLIP_TOP}
              width={plotRight}
              height={PLOT_CLIP_HEIGHT}
            />
          </clipPath>
          <filter
            id={`point-glow-${id}`}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          className="price-chart__grid"
          mask={`url(#chart-clear-mask-${id})`}
          aria-hidden="true"
        >
          {ticks.map((tick, index) => {
            const y =
              PLOT_TOP +
              (index * (PLOT_BOTTOM - PLOT_TOP)) / (GRID_LINE_COUNT - 1)

            return (
              <g
                key={`grid-tick-${index}`}
                className="price-chart__grid-tick"
                style={{ transform: `translateY(${y}px)` }}
              >
                <line x1={PLOT_LEFT} x2={plotRight} y1="0" y2="0" />
                <text
                  ref={index === 0 ? setPriceLabelNode : undefined}
                  x={priceLabelX}
                  y="4"
                >
                  {priceFormatter.format(tick)}
                </text>
              </g>
            )
          })}
        </g>

        <g
          clipPath={`url(#plot-clip-${id})`}
          mask={`url(#plot-fade-mask-${id})`}
          aria-hidden="true"
        >
          <path
            className="price-chart__area"
            d={areaPath}
            fill={`url(#price-area-${id})`}
          />
          <path className="price-chart__line" d={linePath} pathLength="1" />
        </g>

        {/* O eixo temporal vem antes da linha do objetivo porque a pílula
            travada embaixo pousa exatamente sobre os tracinhos e precisa
            ocultá-los, como no Figma, onde `preco-objetivo-down` está acima
            de `tempo`. */}
        <g className="price-chart__time-axis" aria-hidden="true">
          {timeTicks.map(({ timestamp, x }, index) => (
            <g
              key={timestamp}
              className="price-chart__time-tick"
              data-time-tick={timestamp}
              data-time-tick-position={index}
              style={isLiveRange
                ? {
                    opacity: getTimeTickOpacity(
                      x,
                      PLOT_LEFT,
                      seriesRight,
                      TIME_TICK_FADE_DISTANCE,
                    ),
                  }
                : undefined}
            >
              <line
                x1={x}
                x2={x}
                y1={TIME_AXIS_TICK_TOP}
                y2={TIME_AXIS_TICK_BOTTOM}
              />
              <text x={x} y={TIME_AXIS_LABEL_BASELINE} textAnchor="middle">
                {timeFormatter.format(timestamp)}
              </text>
            </g>
          ))}
        </g>

        {/* O tracejado do preço atual é desenhado antes da linha do objetivo:
            quando os dois coincidem, é o objetivo que deve ficar por cima. O
            ponto, os chevrons e a pílula do preço atual seguem depois dela, no
            grupo `price-chart__current-level`. */}
        <g
          className="price-chart__current-line-level"
          style={{ transform: `translateY(${currentPoint.y}px)` }}
          aria-hidden="true"
        >
          <line
            className="price-chart__current-line"
            mask={`url(#current-line-clear-mask-${id})`}
            x1={PLOT_LEFT}
            x2={plotRight}
            y1="0"
            y2="0"
          />
        </g>

        {targetPlacement !== null && targetLabel !== null ? (
          <g
            className={`price-chart__target price-chart__target--${targetPlacement.clamp}`}
            style={{ transform: `translateY(${targetPlacement.y}px)` }}
            aria-hidden="true"
          >
            {/* O nó do Figma desenha a linha até `largura - 16`, passando
                por cima dos rótulos de preço. Naquele frame ela nunca cai sobre
                uma linha da grade, então a colisão não aparece; travada na
                borda da faixa, ela riscaria o rótulo mais externo. Aqui ela
                para em `plotRight`, como a grade e a linha do preço atual, que
                já respeitam a coluna dos rótulos. */}
            <line
              className="price-chart__target-line"
              x1={PLOT_LEFT}
              x2={plotRight}
              y1="0"
              y2="0"
            />
            {/* A pílula é opaca, então oclui a linha e a série atrás dela: não
                há vão a abrir na linha nem máscara a manter. */}
            <g
              className="price-chart__target-label"
              transform={`translate(${TARGET_LABEL_X} 0)`}
              opacity={targetPillWidth > 0 ? 1 : 0}
            >
              <rect
                className="price-chart__target-pill"
                x="0"
                y={-TARGET_PILL_HEIGHT / 2}
                width={targetPillWidth}
                height={TARGET_PILL_HEIGHT}
                rx={TARGET_PILL_HEIGHT / 2}
              />
              <text
                ref={setTargetLabelNode}
                x={TARGET_PILL_PADDING_LEFT}
                y={TARGET_LABEL_BASELINE}
              >
                {targetLabel}
              </text>
              {isTargetClamped ? (
                <g
                  transform={`translate(${
                    TARGET_PILL_PADDING_LEFT + targetLabelWidth + TARGET_CHEVRON_GAP
                  } ${-TARGET_CHEVRON_SIZE / 2})`}
                >
                  <g
                    className={`price-chart__target-chevron-box ${
                      targetPlacement.clamp === 'below'
                        ? 'price-chart__target-chevron-box--flipped'
                        : ''
                    }`}
                  >
                    <TargetChevrons />
                  </g>
                </g>
              ) : null}
            </g>
          </g>
        ) : null}

        <g
          className="price-chart__current-level"
          style={{ transform: `translateY(${currentPoint.y}px)` }}
          aria-hidden="true"
        >
          <circle
            className="price-chart__point-halo"
            cx={currentPoint.x}
            cy="0"
            r="10"
          />
          <circle
            className="price-chart__point-ring"
            cx={currentPoint.x}
            cy="0"
            r="6.5"
            filter={`url(#point-glow-${id})`}
          />
          <circle
            className="price-chart__point"
            cx={currentPoint.x}
            cy="0"
            r="3"
          />
          <g
            className="price-chart__direction"
            data-direction-visible={isDirectionVisible && !isPanned}
            data-price-direction={priceDirection ?? 'locked'}
            data-direction-sequence={directionAnimationSequence}
            transform={`translate(${directionIconX} -12)`}
          >
            <g
              className={`price-chart__direction-state price-chart__direction-state--up ${isDirectionVisible && !isPanned && priceDirection === 'up' ? 'price-chart__direction-state--active' : ''}`}
            >
              <DirectionChevrons
                key={`up-${directionAnimationSequence}`}
                onComplete={priceDirection === 'up'
                  ? () => setCompletedDirectionSequence(
                    directionAnimationSequence,
                  )
                  : undefined}
              />
            </g>
            <g
              className={`price-chart__direction-state price-chart__direction-state--down ${isDirectionVisible && !isPanned && priceDirection === 'down' ? 'price-chart__direction-state--active' : ''}`}
            >
              <DirectionChevrons
                key={`down-${directionAnimationSequence}`}
                onComplete={priceDirection === 'down'
                  ? () => setCompletedDirectionSequence(
                    directionAnimationSequence,
                  )
                  : undefined}
              />
            </g>
          </g>
          <g
            className="price-chart__current-label"
            transform={`translate(${currentLabelX} -9)`}
          >
            <path
              d={`M 8 0 H ${CURRENT_LABEL_WIDTH - 9} Q ${CURRENT_LABEL_WIDTH} 0 ${CURRENT_LABEL_WIDTH} 9 Q ${CURRENT_LABEL_WIDTH} 18 ${CURRENT_LABEL_WIDTH - 9} 18 H 8 L 0 9 Z`}
              fill={`url(#current-price-${id})`}
            />
            <text x="10" y="13">
              {priceFormatter.format(anchorPrice)}
            </text>
          </g>
        </g>

        <g className="price-chart__entry-feed" aria-hidden="true">
          {visibleEntries.map(({ entry, opacity, progress, x, y }) => (
            <g
              key={entry.id}
              className={`price-chart__entry price-chart__entry--${entry.direction}`}
              data-entry-amount={entry.amount}
              data-entry-direction={entry.direction}
              data-entry-id={entry.id}
              data-entry-progress={progress.toFixed(3)}
              style={{
                opacity,
                transform: `translate(${x}px, ${y}px)`,
              }}
            >
              <text x="0" y="0">
                +{entryAmountFormatter.format(entry.amount)}
              </text>
            </g>
          ))}
        </g>

      </svg>

      {!isPanned ? (
        <output className="price-chart__live-value" aria-live="polite">
          {priceFormatter.format(latestPrice)}
        </output>
      ) : null}
      {rangeControls}
    </figure>
  )
}
