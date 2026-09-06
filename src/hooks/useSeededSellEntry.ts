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

interface SeededSellEntryInput {
  hasOpenPosition: boolean
  quoteBuy: (side: OutcomeSide, amount: number) => ExecutionQuote | null
  roundStart: number
  purchase: (purchase: PrototypeWalletPurchase) => { applied: boolean }
}

/**
 * Garante uma entrada aberta quando a tarefa de venda abre.
 *
 * Só age quando não existe posição na rodada corrente: a entrada que a pessoa
 * fez sozinha é sempre preferida à semeada. Espera o mercado publicar uma
 * cotação completa antes de comprar, então a entrada nasce pelo mesmo caminho de
 * código e ao mesmo preço de uma compra real — não é um registro fabricado.
 *
 * Semeia uma vez por carregamento. Se a rodada virar no meio da tarefa, a
 * posição liquida e não é recriada: uma entrada aparecendo sozinha depois de a
 * pessoa já ter vendido seria mais confuso do que a tarefa terminar ali.
 */
export function useSeededSellEntry({
  hasOpenPosition,
  quoteBuy,
  roundStart,
  purchase,
}: SeededSellEntryInput) {
  const hasSeededRef = useRef(false)

  useEffect(() => {
    if (hasSeededRef.current) return
    if (!isSellTaskUrl(window.location.href)) return

    if (hasOpenPosition) {
      hasSeededRef.current = true
      return
    }

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

    if (result.applied) hasSeededRef.current = true
  }, [hasOpenPosition, purchase, quoteBuy, roundStart])
}
