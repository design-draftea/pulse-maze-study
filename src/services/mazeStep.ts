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
 * Parâmetros do estudo, na ordem em que devem aparecer.
 *
 * O Maze compara URLs como texto, e o `URLSearchParams.set` acrescenta no fim.
 * Isso produzia endereços diferentes para o mesmo estado: durante o teste o Maze
 * abre a página com o `lwt` dele e o nosso passo entrava depois; ao abrir o link
 * de sucesso direto, a ordem se invertia. O caminho gravado deixava de bater com
 * o percorrido, e a tarefa não fechava.
 *
 * Reconstruindo a query com os nossos parâmetros na frente, o mesmo ponto da
 * mesma tarefa produz sempre o mesmo texto, independentemente de o Maze ter
 * chegado antes ou depois.
 */
const STUDY_PARAM_ORDER = ['task', MAZE_STEP_PARAM] as const

/**
 * Reescreve a URL preservando o hash da navegação interna e trocando apenas o
 * `mazeStep`. Nada dinâmico entra aqui — sem identificador de participante, sem
 * horário, sem valor de carteira —, então duas pessoas no mesmo ponto da mesma
 * tarefa produzem exatamente a mesma URL, que é o que permite ao Maze agrupar os
 * caminhos.
 */
export const buildMazeStepUrl = (href: string, step: MazeStep) => {
  const url = new URL(href)
  const previous = new URLSearchParams(url.search)

  previous.set(MAZE_STEP_PARAM, step)

  const next = new URLSearchParams()

  STUDY_PARAM_ORDER.forEach((param) => {
    const value = previous.get(param)
    if (value !== null) next.set(param, value)
  })

  // O que o Maze acrescentou vem depois, na ordem em que chegou.
  previous.forEach((value, key) => {
    if (!(STUDY_PARAM_ORDER as readonly string[]).includes(key)) {
      next.set(key, value)
    }
  })

  url.search = next.toString()
  return url.toString()
}

export const getMazeStep = (href: string) => (
  new URL(href).searchParams.get(MAZE_STEP_PARAM)
)

/**
 * Passos que encerram uma tarefa: são as URLs de sucesso configuradas no Maze.
 */
export const MAZE_COMPLETION_STEPS: ReadonlySet<MazeStep> = new Set([
  'onboarding-complete',
  'purchase-complete',
  'sale-complete',
  'past-entries-open',
])

/**
 * Espera antes de recarregar, para o aviso de sucesso e a saída do bottom sheet
 * terminarem de aparecer. Recarregar no mesmo quadro apagaria da tela — e da
 * gravação — a confirmação que a pessoa acabou de conquistar.
 */
export const MAZE_COMPLETION_RELOAD_DELAY_MS = 1_200

const AUTO_END_KEY = 'pulse.maze-auto-end.v1'
const TESTER_FRAME_ID = 'maze-tester-widget'
const END_LABELS = new Set(['encerrar tarefa', 'end task', 'finalizar tarea', 'terminar tarea'])

/** Integração não oficial: usa o controle real do widget, sem forjar resultados. */
export const findMazeEndButton = (doc: Document): HTMLButtonElement | undefined => {
  try {
    // O editor de paths usa outro iframe: nunca deve ser encerrado aqui.
    const frame = doc.getElementById(TESTER_FRAME_ID) as HTMLIFrameElement | null
    const buttons = frame?.contentDocument?.querySelectorAll('button')
    return buttons ? Array.from(buttons).find((button) => (
      !button.disabled && END_LABELS.has((button.textContent ?? '').trim().toLowerCase())
    )) : undefined
  } catch {
    // Uma mudança de origem/implementação no Maze mantém o encerramento manual.
    return undefined
  }
}

/** Consome somente uma conclusão real armada antes da recarga nesta aba. */
export const resumeMazeAutoEnd = () => {
  let pending: { href: string; createdAt: number }
  try {
    const raw = window.sessionStorage.getItem(AUTO_END_KEY)
    window.sessionStorage.removeItem(AUTO_END_KEY)
    if (!raw) return
    pending = JSON.parse(raw)
  } catch { return }
  const href = window.location.href
  const step = getMazeStep(href)
  if (!pending || pending.href !== href || !Number.isFinite(pending.createdAt)
    || Date.now() - pending.createdAt < 0 || Date.now() - pending.createdAt > 30_000
    || !step || !MAZE_COMPLETION_STEPS.has(step as MazeStep)) return

  const deadline = Date.now() + 15_000
  let candidate: HTMLButtonElement | undefined
  let readySince = 0
  const poll = () => {
    if (window.location.href !== href || Date.now() > deadline) return
    const button = findMazeEndButton(document)
    if (button !== candidate) {
      candidate = button
      readySince = Date.now()
    }
    // Dá tempo ao snippet após a recarga. Não é confirmação de upload do Maze;
    // a classificação do path ainda exige validação no estudo publicado.
    if (button && Date.now() - readySince >= 2_000) {
      button.click()
      return
    }
    window.setTimeout(poll, 250)
  }
  poll()
}

/**
 * Marca o passo na URL.
 *
 * Os passos intermediários usam `replaceState`: são invisíveis, não recarregam
 * nada e não empilham histórico — a aplicação já navega por hash e por
 * `pushState`, e uma entrada por marco faria o botão voltar exigir vários toques
 * no meio da missão.
 *
 * O passo de sucesso precisa de mais que isso. O snippet do Maze não intercepta
 * `pushState` nem `replaceState` — os dois estão nativos na página — e a
 * documentação deles diz que, numa aplicação de página única, uma URL alterada
 * sem recarregamento não é detectada. Sem um carregamento de verdade, o
 * marco final pode deixar de ser registrado. A recarga não encerra a missão:
 * no Website Test isso depende do botão End task.
 *
 * Então o último passo reescreve a URL e recarrega. O custo é a tela piscar uma
 * vez, no instante em que a tarefa já terminou; a carteira e o onboarding vivem
 * em `localStorage` e sobrevivem à recarga.
 */
export const markMazeStep = (step: MazeStep) => {
  if (typeof window === 'undefined') return
  if (getMazeStep(window.location.href) === step) return

  window.history.replaceState(
    window.history.state,
    '',
    buildMazeStepUrl(window.location.href, step),
  )

  if (!MAZE_COMPLETION_STEPS.has(step)) return

  try {
    window.sessionStorage.removeItem(AUTO_END_KEY)
    if (new URL(window.location.href).searchParams.has('lwt')
      && document.getElementById(TESTER_FRAME_ID)) {
      window.sessionStorage.setItem(AUTO_END_KEY, JSON.stringify({
        href: window.location.href,
        createdAt: Date.now(),
      }))
    }
  } catch { /* Armazenamento bloqueado: o botão manual continua disponível. */ }

  // Experimento restrito ao onboarding. Mantém a mesma espera e o botão real
  // do Maze; a única diferença é não recarregar antes de encerrar a tarefa.
  if (step === 'onboarding-complete'
    && new URL(window.location.href).searchParams.get('mazeNoReload') === 'onboarding') {
    window.setTimeout(resumeMazeAutoEnd, MAZE_COMPLETION_RELOAD_DELAY_MS)
    return
  }

  window.setTimeout(
    () => window.location.reload(),
    MAZE_COMPLETION_RELOAD_DELAY_MS,
  )
}
