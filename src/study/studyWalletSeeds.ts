import {
  applyWalletPurchase,
  createInitialWalletState,
  type PrototypeWalletState,
} from '../services/prototypeWallet.ts'
import { STUDY_VALUES } from './studyConfig.ts'
import type { StudyTask } from './studyTypes.ts'

/** US$10,00 ÷ US$0,67 — precisão interna completa, sem arredondar. */
export const STUDY_BUY_PARTICIPATIONS =
  STUDY_VALUES.buyAmount / STUDY_VALUES.upBuyPrice

export const STUDY_BUY_AMOUNT_CENTS = Math.round(STUDY_VALUES.buyAmount * 100)

/**
 * Carteira de partida de cada tarefa.
 *
 * `onboarding`, `buy` e `help` abrem com o seed padrão do protótipo: saldo de
 * US$2.040,00 e nenhuma entrada aberta na rodada corrente. `sell` aplica a
 * compra pelo mesmo caminho de código que uma compra real percorre, então a
 * posição, o custo médio, o movimento e o saldo resultante são exatamente os
 * que a interface produziria se a pessoa tivesse comprado ela mesma.
 */
export const createStudyWalletState = (
  task: StudyTask,
  roundStart: number,
): PrototypeWalletState => {
  const initialState = createInitialWalletState()

  if (task !== 'sell') return initialState

  const result = applyWalletPurchase(initialState, {
    roundStart,
    side: 'up',
    amountCents: STUDY_BUY_AMOUNT_CENTS,
    participations: STUDY_BUY_PARTICIPATIONS,
  })

  if (!result.applied) {
    throw new Error('O seed de venda não conseguiu abrir a posição inicial.')
  }

  return result.state
}
