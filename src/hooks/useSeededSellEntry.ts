import { useEffect, useRef } from 'react'
import type { ExecutionQuote, OutcomeSide } from '../services/outcomeMarket'
import type { PrototypeWalletPurchase } from './usePrototypeWallet'

/**
 * Parâmetro que marca a URL da tarefa de venda no Maze.
 *
 * A tarefa pede para vender uma entrada, então a pessoa precisa chegar com uma
 * entrada aberta. Quem vem da tarefa de compra já tem a sua — o mesmo navegador,
 * a mesma carteira — e é essa que queremos que ela venda. Mas quem falhou,
 * pulou, ou abriu o link direto chegaria sem nada, e a tarefa não ficaria
 * difícil: ficaria impossível, e a sessão entraria na análise como se a pessoa
 * não tivesse encontrado o caminho.
 */
export const MAZE_TASK_PARAM = 'task'
export const MAZE_SELL_TASK = 'sell'

/** Mesmo monto da tarefa de compra, para as duas contarem a mesma história. */
export const SEEDED_SELL_AMOUNT = 10

export const isSellTaskUrl = (href: string) => (
  new URL(href).searchParams.get(MAZE_TASK_PARAM) === MAZE_SELL_TASK
)

export interface SeedSellEntryDecision {
  isSellTask: boolean
  hasCompletedSale: boolean
  hasOpenPosition: boolean
  /** Rodada em que já se semeou, ou `null` se ainda não se semeou nenhuma. */
  seededRound: number | null
  roundStart: number
}

/**
 * A decisão isolada do React, porque é ela que carrega as regras difíceis:
 * repor a entrada quando a rodada vira, mas nunca depois da venda, e nunca duas
 * vezes na mesma rodada. Testar isso pela interface exigiria esperar a virada de
 * uma rodada real.
 */
export const shouldSeedSellEntry = ({
  isSellTask,
  hasCompletedSale,
  hasOpenPosition,
  seededRound,
  roundStart,
}: SeedSellEntryDecision) => (
  isSellTask
  && !hasCompletedSale
  && !hasOpenPosition
  && seededRound !== roundStart
)

interface SeededSellEntryInput {
  hasOpenPosition: boolean
  /** Trava a semeadura depois que a pessoa vende: a tarefa acabou. */
  hasCompletedSale: boolean
  quoteBuy: (side: OutcomeSide, amount: number) => ExecutionQuote | null
  roundStart: number
  purchase: (purchase: PrototypeWalletPurchase) => { applied: boolean }
}

/**
 * Garante que exista uma entrada aberta enquanto a tarefa de venda estiver em
 * curso.
 *
 * Só age quando não existe posição na rodada corrente, então a entrada que a
 * pessoa fez sozinha na tarefa anterior é sempre preferida à semeada. Espera o
 * mercado publicar uma cotação completa antes de comprar, e usa `purchase`: a
 * entrada nasce pelo mesmo caminho de código e ao mesmo preço de uma compra
 * real, não é um registro fabricado na carteira.
 *
 * A garantia vale por rodada, e não por carregamento. A rodada real vira a cada
 * 15 minutos: se virasse no meio da tarefa, a posição liquidaria e a pessoa
 * ficaria sem nada para vender — a tarefa deixaria de ser difícil e passaria a
 * ser impossível, sem que ela entendesse por quê. Semeando de novo na rodada
 * seguinte, a entrada continua aberta; o monto permanece o mesmo e o preço médio
 * e o ganho potencial passam a ser os da rodada corrente, que é o único par de
 * valores coerente com o objetivo que está na tela.
 *
 * `hasCompletedSale` é o que impede isso de virar um laço: sem ele, vender
 * zeraria a posição e uma entrada nova nasceria em seguida, desfazendo diante
 * dos olhos da pessoa o que ela acabou de fazer.
 */
export function useSeededSellEntry({
  hasOpenPosition,
  hasCompletedSale,
  quoteBuy,
  roundStart,
  purchase,
}: SeededSellEntryInput) {
  // Guarda a rodada já semeada, e não um booleano: é o que permite semear de
  // novo quando a rodada vira, sem semear duas vezes na mesma.
  const seededRoundRef = useRef<number | null>(null)

  useEffect(() => {
    const shouldSeed = shouldSeedSellEntry({
      isSellTask: isSellTaskUrl(window.location.href),
      hasCompletedSale,
      hasOpenPosition,
      seededRound: seededRoundRef.current,
      roundStart,
    })

    if (!shouldSeed) return

    const quote = quoteBuy('up', SEEDED_SELL_AMOUNT)
    // Sem cotação completa o mercado ainda está conectando. O efeito roda de
    // novo quando ela chegar.
    if (!quote?.complete) return

    const result = purchase({
      roundStart,
      side: 'up',
      amount: SEEDED_SELL_AMOUNT,
      participations: quote.participations,
    })

    if (result.applied) seededRoundRef.current = roundStart
  }, [hasCompletedSale, hasOpenPosition, purchase, quoteBuy, roundStart])
}
