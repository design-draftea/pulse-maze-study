/**
 * Marcos da pesquisa no Maze, escritos na URL.
 *
 * O Maze não observa o que acontece dentro da aplicação: ele compara a URL da
 * página com a URL de sucesso configurada no bloco. Então cada etapa que a
 * pesquisa precisa medir vira uma mudança de `?mazeStep=`, disparada pelo evento
 * real da interface — nunca por um botão criado só para avançar o teste.
 */
export type MazeStep =
  | 'onboarding-open'
  | 'onboarding-complete'
  | 'buy-betslip-open'
  | 'purchase-complete'
  | 'entries-open'
  | 'sell-betslip-open'
  | 'sale-complete'
  | 'past-entries-open'

export const MAZE_STEP_PARAM = 'mazeStep'

/**
 * Reescreve a URL preservando o hash da navegação interna e trocando apenas o
 * `mazeStep`. Nada dinâmico entra aqui — sem identificador de participante, sem
 * horário, sem valor de carteira —, então duas pessoas no mesmo ponto da mesma
 * tarefa produzem exatamente a mesma URL, que é o que permite ao Maze agrupar os
 * caminhos.
 */
export const buildMazeStepUrl = (href: string, step: MazeStep) => {
  const url = new URL(href)

  url.searchParams.set(MAZE_STEP_PARAM, step)
  return url.toString()
}

export const getMazeStep = (href: string) => (
  new URL(href).searchParams.get(MAZE_STEP_PARAM)
)

/**
 * Usa `replaceState`, e não `pushState`, porque a aplicação já navega por hash e
 * por `pushState`: empilhar uma entrada por marco faria o botão voltar exigir
 * vários toques no meio da missão. O mesmo marco chamado duas vezes não reescreve
 * nada.
 */
export const markMazeStep = (step: MazeStep) => {
  if (typeof window === 'undefined') return
  if (getMazeStep(window.location.href) === step) return

  window.history.replaceState(
    window.history.state,
    '',
    buildMazeStepUrl(window.location.href, step),
  )
}
