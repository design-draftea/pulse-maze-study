import { useEffect, useMemo, useState } from 'react'
import {
  quoteOrderBook,
  type ExecutionQuote,
  type OutcomeMarketState,
  type OutcomeOrderBook,
  type OutcomeSide,
} from '../services/outcomeMarket.ts'
import {
  STUDY_BOOK_DEPTH,
  STUDY_BOOK_SPREAD,
  STUDY_UP_PRICE_RANGE,
  STUDY_UP_SENSITIVITY_PER_DOLLAR,
  STUDY_VALUES,
} from './studyConfig.ts'

const QUOTE_REFRESH_INTERVAL_MS = 1_000

const toCents = (value: number) => Math.round(value * 100) / 100

export interface StudyOutcomePrices {
  asks: Record<OutcomeSide, number>
  bids: Record<OutcomeSide, number>
}

/**
 * Preços de UP e DOWN a partir do preço do Bitcoin.
 *
 * Neste produto o percentual é o preço — o onboarding diz `El % indica el
 * precio`, e 67% e 67¢ são o mesmo número. Então os dois se movem juntos, como
 * num mercado de previsão real: subir em direção ao objetivo encarece o lado
 * que aposta nisso.
 *
 * O arredondamento para centavos inteiros não é cosmético. A interface exibe
 * `Math.round(precio * 100)`, e um preço contínuo faria a tela dizer 67¢
 * enquanto a execução cobrasse 0,6743 — as participações deixariam de fechar
 * com a conta que o próprio onboarding ensina. Quantizando, o que se lê é
 * exatamente o que se paga, e o percentual se move em degraus inteiros, que é
 * como o produto sempre o mostrou.
 */
export const deriveStudyOutcomePrices = (
  currentPrice: number,
): StudyOutcomePrices => {
  const distance = currentPrice - STUDY_VALUES.initialCurrentPrice
  const fairValue = STUDY_VALUES.upBuyPrice
    + distance * STUDY_UP_SENSITIVITY_PER_DOLLAR
  const upAsk = toCents(Math.min(
    STUDY_UP_PRICE_RANGE.max,
    Math.max(STUDY_UP_PRICE_RANGE.min, fairValue),
  ))
  const downAsk = toCents(1 - upAsk)

  return {
    asks: { up: upAsk, down: downAsk },
    bids: {
      up: toCents(upAsk - STUDY_BOOK_SPREAD),
      down: toCents(downAsk - STUDY_BOOK_SPREAD),
    },
  }
}

/**
 * Livro simulado de um lado: um nível de cada, com profundidade muito acima do
 * monto da tarefa. A compra e a venda executam sempre no melhor preço, sem
 * consumir níveis piores, então o preço médio é exatamente o preço exibido.
 */
const createStudyBook = (
  askPrice: number,
  bidPrice: number,
): OutcomeOrderBook => ({
  asks: [{ price: askPrice, size: STUDY_BOOK_DEPTH }],
  bids: [{ price: bidPrice, size: STUDY_BOOK_DEPTH }],
  lastTradePrice: askPrice,
})

export const createStudyBooks = (
  prices: StudyOutcomePrices,
): Record<OutcomeSide, OutcomeOrderBook> => ({
  up: createStudyBook(prices.asks.up, prices.bids.up),
  down: createStudyBook(prices.asks.down, prices.bids.down),
})

export interface BuildStudyOutcomeMarketInput {
  currentPrice: number
  roundSlug: string
  quotedAt: number
}

export const buildStudyOutcomeMarket = ({
  currentPrice,
  roundSlug,
  quotedAt,
}: BuildStudyOutcomeMarketInput): OutcomeMarketState => {
  const prices = deriveStudyOutcomePrices(currentPrice)
  const books = createStudyBooks(prices)

  const quoteBuy = (
    side: OutcomeSide,
    amount: number,
  ): ExecutionQuote | null => (
    quoteOrderBook(books[side], side, 'buy', amount, quotedAt)
  )

  const quoteSell = (
    side: OutcomeSide,
    participations: number,
  ): ExecutionQuote | null => (
    quoteOrderBook(books[side], side, 'sell', participations, quotedAt)
  )

  return {
    status: 'live',
    roundSlug,
    source: 'study',
    lockedForRound: false,
    displayPrices: { up: prices.asks.up, down: prices.asks.down },
    books,
    updatedAt: quotedAt,
    quoteBuy,
    quoteSell,
  }
}

export function useStudyOutcomeMarket(
  currentPrice: number,
  roundSlug: string,
): OutcomeMarketState {
  // As cotações acompanham o preço, mas `quotedAt` precisa avançar mesmo quando
  // o centavo não muda: a proteção de execução do betslip compara o instante da
  // cotação com o da confirmação e recusaria uma cotação parada há minutos.
  const [quotedAt, setQuotedAt] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(
      () => setQuotedAt(Date.now()),
      QUOTE_REFRESH_INTERVAL_MS,
    )

    return () => window.clearInterval(timer)
  }, [])

  return useMemo(
    () => buildStudyOutcomeMarket({ currentPrice, roundSlug, quotedAt }),
    [currentPrice, quotedAt, roundSlug],
  )
}
