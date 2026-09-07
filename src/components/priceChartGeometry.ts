export const BASE_PRICE_CHART_WIDTH = 375
export const PRICE_CHART_HEIGHT = 256

const PLOT_RIGHT_INSET = BASE_PRICE_CHART_WIDTH - 280
const SERIES_RIGHT_INSET = BASE_PRICE_CHART_WIDTH - 236
const PRICE_LABEL_RIGHT_INSET = BASE_PRICE_CHART_WIDTH - 288

export type PriceChartGeometry = {
  width: number
  plotRight: number
  seriesRight: number
  currentLabelX: number
  priceLabelX: number
}
const clampUnit = (value: number) => Math.min(1, Math.max(0, value))

export const getTimeTickOpacity = (
  x: number,
  leftBoundary: number,
  rightBoundary: number,
  fadeDistance: number,
) => {
  if (fadeDistance <= 0) return 1

  const fadeInFromRight = clampUnit((rightBoundary - x) / fadeDistance)
  const fadeOutToLeft = clampUnit((x - leftBoundary) / fadeDistance)

  return Math.min(fadeInFromRight, fadeOutToLeft)
}

export const getPriceChartGeometry = (
  containerWidth: number,
): PriceChartGeometry => {
  const width =
    Number.isFinite(containerWidth) && containerWidth > 0
      ? containerWidth
      : BASE_PRICE_CHART_WIDTH
  const plotRight = width - PLOT_RIGHT_INSET
  const seriesRight = width - SERIES_RIGHT_INSET

  return {
    width,
    plotRight,
    seriesRight,
    currentLabelX: plotRight,
    priceLabelX: width - PRICE_LABEL_RIGHT_INSET,
  }
}
