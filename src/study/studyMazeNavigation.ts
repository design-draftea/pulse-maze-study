import type { MazeStep, StudyTask } from './studyTypes.ts'

export const STUDY_TASK_PARAM = 'task'
export const STUDY_MAZE_STEP_PARAM = 'mazeStep'
export const STUDY_RESET_PARAM = 'resetStudy'
export const STUDY_DEBUG_PARAM = 'debugStudy'

/**
 * Parâmetros preservados na reescrita da URL, na ordem em que devem aparecer.
 * A ordem é fixa de propósito: o Maze compara URLs como texto, então
 * `?task=buy&mazeStep=start` e `?mazeStep=start&task=buy` seriam dois links
 * diferentes para o mesmo estado.
 */
const PRESERVED_PARAMS = [
  STUDY_TASK_PARAM,
  STUDY_MAZE_STEP_PARAM,
  STUDY_DEBUG_PARAM,
] as const

/** Marco de sucesso de cada tarefa, na configuração do Maze. */
export const STUDY_SUCCESS_STEPS: Record<StudyTask, MazeStep> = {
  onboarding: 'onboarding-complete',
  buy: 'purchase-complete',
  sell: 'sale-complete',
  help: 'answer-shown',
}

export interface BuildStudyUrlInput {
  href: string
  task: StudyTask
  step: MazeStep
}

/**
 * Reescreve a URL preservando o hash da navegação interna e trocando apenas o
 * `mazeStep`. Nada dinâmico entra aqui: sem identificador de participante, sem
 * timestamp, sem valor de carteira. Dois participantes no mesmo ponto da mesma
 * tarefa produzem exatamente a mesma URL, que é o que permite ao Maze agrupar
 * os caminhos.
 */
export const buildStudyUrl = ({ href, task, step }: BuildStudyUrlInput) => {
  const url = new URL(href)
  const previous = new URLSearchParams(url.search)
  const next = new URLSearchParams()

  previous.set(STUDY_TASK_PARAM, task)
  previous.set(STUDY_MAZE_STEP_PARAM, step)
  previous.delete(STUDY_RESET_PARAM)

  PRESERVED_PARAMS.forEach((param) => {
    const value = previous.get(param)
    if (value !== null) next.set(param, value)
  })

  url.search = next.toString()
  return url.toString()
}

export const getCurrentMazeStep = (href: string): string | null => (
  new URL(href).searchParams.get(STUDY_MAZE_STEP_PARAM)
)

let lastMarkedStep: MazeStep | null = null

/**
 * Marca um marco da pesquisa na URL. Usa `replaceState` porque a aplicação já
 * navega por hash e por `pushState`: empilhar uma entrada por marco faria o
 * botão voltar exigir vários toques no meio da missão. O mesmo marco chamado
 * duas vezes não reescreve nada.
 */
export const markMazeStep = (task: StudyTask, step: MazeStep) => {
  if (typeof window === 'undefined') return

  const currentStep = getCurrentMazeStep(window.location.href)
  if (currentStep === step && lastMarkedStep === step) return

  const nextHref = buildStudyUrl({ href: window.location.href, task, step })
  if (nextHref === window.location.href) {
    lastMarkedStep = step
    return
  }

  lastMarkedStep = step
  window.history.replaceState(window.history.state, '', nextHref)
}

/** Usado pelo reset de QA e pelos testes, que não compartilham módulo entre casos. */
export const resetMarkedStepMemory = () => {
  lastMarkedStep = null
}
