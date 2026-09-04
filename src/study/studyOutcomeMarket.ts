import { useEffect, useMemo, useState } from 'react'
import {
  quoteOrderBook,
  type ExecutionQuote,
  type OutcomeMarketState,
  type OutcomeOrderBook,
  type OutcomeSide,
} from '../services/outcomeMarket.ts'
import { STUDY_BOOK_DEPTH } from './studyConfig.ts'
import type { StudyScenario } from './studyTypes.ts'

const QUOTE_REFRESH_INTERVAL_MS = 1_000

/**
 * Livro simulado de um lado.
 *
 * Um único nível de cada lado, com profundidade muito acima do monto da tarefa:
 * a compra de US$10 e a venda da posição inteira executam sempre no melhor
 * preço, sem consumir níveis piores. É o que garante que todo participante veja
 * 67¢ na compra e 61¢ na venda, sem variação por tamanho de ordem.
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
  scenario: StudyScenario,
): Record<OutcomeSide, OutcomeOrderBook> => ({
  up: createStudyBook(
    scenario.market.prices.up,
    scenario.market.sellPrices.up,
  ),
  down: createStudyBook(
    scenario.market.prices.down,
    scenario.market.sellPrices.down,
  ),
})

export interface BuildStudyOutcomeMarketInput {
  scenario: StudyScenario
  roundSlug: string
  quotedAt: number
}

/**
 * Os percentuais exibidos vêm do cenário, e não do ponto médio do livro. Com
 * spread de 6¢ entre compra e venda, o ponto médio mostraria 64% em UP, e o
 * estudo precisa que a Home, o betslip e o assistente digam 67%.
 */
export const buildStudyOutcomeMarket = ({
  scenario,
  roundSlug,
  quotedAt,
}: BuildStudyOutcomeMarketInput): OutcomeMarketState => {
  const books = createStudyBooks(scenario)

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
    displayPrices: {
      up: scenario.market.prices.up,
      down: scenario.market.prices.down,
    },
    books,
    updatedAt: quotedAt,
    quoteBuy,
    quoteSell,
  }
}

export function useStudyOutcomeMarket(
  scenario: StudyScenario,
  roundSlug: string,
): OutcomeMarketState {
  // As cotações não mudam de valor, mas `quotedAt` precisa avançar: a proteção
  // de execução do betslip compara o instante da cotação com o da confirmação e
  // recusaria uma cotação parada há minutos.
  const [quotedAt, setQuotedAt] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(
      () => setQuotedAt(Date.now()),
      QUOTE_REFRESH_INTERVAL_MS,
    )

    return () => window.clearInterval(timer)
  }, [])

  return useMemo(
    () => buildStudyOutcomeMarket({ scenario, roundSlug, quotedAt }),
    [quotedAt, roundSlug, scenario],
  )
}
