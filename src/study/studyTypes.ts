import type { OutcomeSide } from '../services/outcomeMarket.ts'
import type { PrototypeWalletState } from '../services/prototypeWallet.ts'

/** As quatro missões do estudo não moderado no Maze. */
export type StudyTask = 'onboarding' | 'buy' | 'sell' | 'help'

/**
 * Marcos de URL lidos pelo Maze. Cada bloco de Website Test começa em `start` e
 * termina no marco de sucesso da própria tarefa; os intermediários existem para
 * ler o caminho percorrido, não para validar a missão.
 */
export type MazeStep =
  | 'start'
  | 'onboarding-open'
  | 'onboarding-complete'
  | 'buy-betslip-open'
  | 'purchase-complete'
  | 'entries-open'
  | 'sell-betslip-open'
  | 'sale-complete'
  | 'assistant-open'
  | 'answer-shown'

export type StudySection = 'home' | 'entries' | 'movements'

/** Estado de mercado congelado que a tarefa entrega à interface. */
export interface StudyMarketState {
  targetPrice: number
  currentPrice: number
  prices: Record<OutcomeSide, number>
  /** Melhor preço de venda por lado, usado para montar as ofertas de compra. */
  sellPrices: Record<OutcomeSide, number>
}

export interface StudyOnboardingState {
  /** `false` mantém o convite flutuante pulsando na primeira abertura. */
  completed: boolean
}

export interface StudyScenario {
  id: string
  task: StudyTask
  startSection: StudySection
  market: StudyMarketState
  wallet: PrototypeWalletState
  onboarding: StudyOnboardingState
  /** Instante real em que a tarefa abriu; origem do relógio virtual. */
  openedAt: number
}

/** Uma rodada encerrada do histórico fixo mostrado na Home. */
export interface StudyPreviousRound {
  id: string
  roundStart: number
  roundEnd: number
  targetPrice: number
  finalPrice: number
  result: OutcomeSide
}
