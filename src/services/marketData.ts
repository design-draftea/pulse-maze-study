import { STUDY_TIME_ZONE } from '../study/studyConfig.ts'

/**
 * Cálculos puros da rodada, sem qualquer acesso à rede.
 *
 * A versão original deste arquivo consultava fontes externas de mercado para o
 * preço objetivo, o preço de fechamento e os candles do gráfico. Nesta cópia de
 * pesquisa todos os dados vêm de `src/study/`, então só sobrou a aritmética das
 * janelas de 15 minutos, que continua servindo ao formato do histórico e dos
 * horários exibidos.
 */
export const BTC_ROUND_DURATION_MS = 15 * 60 * 1000
export const BTC_DISPLAY_TIME_ZONE = STUDY_TIME_ZONE

export type HistoricalBtcRound = {
  id: string
  roundStart: number
  roundEnd: number
  targetPrice: number
  finalPrice: number
  result: 'up' | 'down'
}

export const getBtcRoundStart = (timestamp = Date.now()) => (
  Math.floor(timestamp / BTC_ROUND_DURATION_MS) * BTC_ROUND_DURATION_MS
)

export const getBtcRoundSlug = (roundStart: number) => (
  `btc-updown-15m-${Math.floor(roundStart / 1000)}`
)

export const getPreviousBtcRoundStarts = (
  currentRoundStart: number,
  count: number,
) => Array.from({ length: Math.max(0, count) }, (_, index) => (
  currentRoundStart - (index + 1) * BTC_ROUND_DURATION_MS
))
