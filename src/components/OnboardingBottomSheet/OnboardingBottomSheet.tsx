import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type UIEvent as ReactUIEvent,
} from 'react'
import { createPortal } from 'react-dom'
import closeIcon from '../../assets/iconClose.svg'
import backIcon from '../../assets/iconVoltar.svg'
import { OnboardingChart } from './OnboardingChart'
import { OnboardingRoundClock } from './OnboardingRoundClock'
import { OnboardingSellEarly } from './OnboardingSellEarly'
import { OnboardingSharePrice } from './OnboardingSharePrice'
import { ONBOARDING_STEP_TOTAL, onboardingSteps } from './onboardingSteps'
import './OnboardingBottomSheet.css'

const SHEET_MOTION_MS = 300
const SHEET_TITLE = 'Cómo funciona Draftea Pulse'
const CLOSE_LABEL = 'Cerrar'
const BACK_LABEL = 'Volver'
const illustrationByStepId: Partial<Record<string, () => ReactNode>> = {
  choice: OnboardingChart,
  round: OnboardingRoundClock,
  price: OnboardingSharePrice,
  sell: OnboardingSellEarly,
}
const OVERLAY_BLUR_STYLE = {
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
} satisfies CSSProperties
const FOCUS_RESTORE_ATTEMPTS = 6

/**
 * `onClose` derruba o `inert` do conteúdo principal num commit do React que não
 * tem ordem garantida em relação ao próximo quadro. Enquanto o `inert` ainda
 * estiver no DOM, `focus()` é ignorado em silêncio e o foco fica no `body`.
 * Por isso a devolução insiste por alguns quadros, até pousar de fato.
 */
const restoreFocus = (target: HTMLElement | null) => {
  if (!target) return

  let remaining = FOCUS_RESTORE_ATTEMPTS

  const attempt = () => {
    target.focus({ preventScroll: true })
    remaining -= 1

    if (document.activeElement !== target && remaining > 0) {
      window.requestAnimationFrame(attempt)
    }
  }

  window.requestAnimationFrame(attempt)
}

interface OnboardingBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Disparado apenas pelo CTA final. Fechar no X, no arrasto ou pelo gesto de
   * voltar chama `onClose` sem passar por aqui: abrir o guia não é o mesmo que
   * percorrê-lo até o fim, e a pesquisa mede a segunda coisa.
   */
  onComplete?: () => void
}

export function OnboardingBottomSheet({
  isOpen,
  onClose,
  onComplete,
}: OnboardingBottomSheetProps) {
  // Na Tarefa 1, o sheet já vem aberto: montá-lo nesta primeira pintura evita
  // mostrar a Home vazia antes da introdução.
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const isClosingRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const sheetRef = useRef<HTMLElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)

  /**
   * A trilha é um carrossel de rolagem nativa com encaixe, o mesmo mecanismo do
   * `PreviousRounds`. Quem arrasta, encaixa e dá inércia é o navegador — e por
   * isso o gesto funciona igual no toque e no trackpad, sem custo de código, e
   * a rolagem vertical do sheet continua com ele.
   *
   * `behavior` fica de fora de propósito: sem ele a rolagem programada obedece
   * ao `scroll-behavior` do CSS, que a preferência de movimento reduzido
   * desliga junto com o resto.
   */
  const scrollToStep = useCallback((next: number) => {
    const track = trackRef.current
    const first = track?.children[0]
    const slide = track?.children[next]

    if (!track || !(first instanceof HTMLElement) || !(slide instanceof HTMLElement)) {
      return
    }

    // A origem é o primeiro slide, e não a trilha: o recuo lateral dela entra
    // nos dois `offsetLeft` e se cancela, então a conta não depende dele.
    track.scrollTo({ left: slide.offsetLeft - first.offsetLeft })
  }, [])

  const handleTrackScroll = useCallback((event: ReactUIEvent<HTMLDivElement>) => {
    const track = event.currentTarget
    const [first, second] = track.children

    if (!(first instanceof HTMLElement)) return

    // O passo é medido no layout, e não repetido a partir do `gap` do CSS: são
    // duas fontes para o mesmo número, e a que vale é a que está na tela.
    const stride = second instanceof HTMLElement
      ? second.offsetLeft - first.offsetLeft
      : first.offsetWidth

    if (stride <= 0) return

    const next = Math.round(track.scrollLeft / stride)

    setStepIndex(Math.max(0, Math.min(onboardingSteps.length - 1, next)))
  }, [])

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const finishClose = useCallback(() => {
    const returnFocusTarget = returnFocusRef.current

    clearCloseTimer()
    setShouldRender(false)
    setIsClosing(false)
    isClosingRef.current = false
    onClose()
    restoreFocus(returnFocusTarget)
  }, [clearCloseTimer, onClose])

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return

    isClosingRef.current = true
    setIsClosing(true)
    closeTimerRef.current = window.setTimeout(finishClose, SHEET_MOTION_MS)
  }, [finishClose])

  useEffect(() => {
    if (!isOpen) return undefined

    clearCloseTimer()
    isClosingRef.current = false
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    let focusFrame: number | null = null
    const openTimer = window.setTimeout(() => {
      setShouldRender(true)
      setIsClosing(false)
      // O onboarding tem quatro passos e a entrada é um botão de ajuda, então
      // reabrir sempre recomeça no primeiro card em vez de retomar no meio.
      setStepIndex(0)
      focusFrame = window.requestAnimationFrame(() => {
        // A trilha guarda a própria posição de rolagem, então voltar ao
        // primeiro passo é levá-la de volta ao começo.
        if (trackRef.current) trackRef.current.scrollLeft = 0
        sheetRef.current?.focus({ preventScroll: true })
      })
    }, 0)

    return () => {
      window.clearTimeout(openTimer)
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame)
    }
  }, [clearCloseTimer, isOpen])

  useEffect(() => {
    if (isOpen || !shouldRender) return undefined
    const closeFrame = window.requestAnimationFrame(() => requestClose())
    return () => window.cancelAnimationFrame(closeFrame)
  }, [isOpen, requestClose, shouldRender])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  useEffect(() => {
    if (!shouldRender) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [requestClose, shouldRender])

  const step = onboardingSteps[stepIndex]
  const isLastAuthoredStep = stepIndex === onboardingSteps.length - 1
  const isLastPlannedStep = stepIndex === ONBOARDING_STEP_TOTAL - 1

  const handleBack = useCallback(() => {
    if (stepIndex > 0) scrollToStep(stepIndex - 1)
  }, [scrollToStep, stepIndex])

  const handleAdvance = useCallback(() => {
    if (isLastAuthoredStep) {
      onComplete?.()
      requestClose()
      return
    }

    scrollToStep(stepIndex + 1)
  }, [isLastAuthoredStep, onComplete, requestClose, scrollToStep, stepIndex])

  if (!shouldRender || !step) return null

  return createPortal(
    <div className="onboarding-sheet__container">
      <button
        className={`onboarding-sheet__overlay${
          isClosing ? ' onboarding-sheet__overlay--closing' : ''
        }`}
        style={OVERLAY_BLUR_STYLE}
        type="button"
        aria-label={CLOSE_LABEL}
        onClick={requestClose}
      />

      <aside
        ref={sheetRef}
        className={`onboarding-sheet${isClosing ? ' onboarding-sheet--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={SHEET_TITLE}
        tabIndex={-1}
        data-node-id="564:6369"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="onboarding-sheet__glow" aria-hidden="true" data-node-id="564:6370" />

        <header className="onboarding-sheet__header" data-node-id="564:6371">
          <span className="onboarding-sheet__header-spacer" aria-hidden="true" />
          <h2 className="onboarding-sheet__title" data-node-id="564:6376">
            {SHEET_TITLE}
          </h2>
          <button
            className="onboarding-sheet__close"
            type="button"
            aria-label={CLOSE_LABEL}
            onClick={requestClose}
            data-node-id="564:6378"
          >
            <img src={closeIcon} alt="" aria-hidden="true" />
          </button>
        </header>

        <div className="onboarding-sheet__content" data-node-id="564:6610">
          <div
            ref={trackRef}
            className="onboarding-sheet__track"
            onScroll={handleTrackScroll}
          >
            {onboardingSteps.map((slide, index) => {
              const Illustration = illustrationByStepId[slide.id]
              // A ilustração do vizinho já vem montada, senão o card entraria
              // vazio no meio do arrasto. Quem a segura no primeiro quadro até
              // a chegada é o `animation-play-state` do CSS, preso a
              // `data-active`.
              const isNear = Math.abs(index - stepIndex) <= 1

              return (
                <div
                  key={slide.id}
                  className="onboarding-sheet__slide"
                  data-active={index === stepIndex}
                >
                  {Illustration && isNear ? <Illustration /> : null}

                  <h3 className="onboarding-sheet__step-title" data-node-id="564:6611">
                    {slide.title}
                  </h3>
                  <p className="onboarding-sheet__step-body" data-node-id="564:6612">
                    {slide.body}
                  </p>
                </div>
              )
            })}
          </div>

          <div
            className="onboarding-sheet__bullets"
            role="group"
            aria-label={`Paso ${stepIndex + 1} de ${ONBOARDING_STEP_TOTAL}`}
            data-node-id="564:6633"
          >
            {Array.from({ length: ONBOARDING_STEP_TOTAL }, (_, index) => (
              <span
                key={index}
                className={`onboarding-sheet__bullet${
                  index === stepIndex ? ' onboarding-sheet__bullet--active' : ''
                }`}
                aria-hidden="true"
              />
            ))}
          </div>

          <div className="onboarding-sheet__footer" data-node-id="564:7000">
            {stepIndex > 0 && (
              <button
                className="onboarding-sheet__back"
                type="button"
                aria-label={BACK_LABEL}
                onClick={handleBack}
                data-node-id="564:6970"
              >
                <img src={backIcon} alt="" aria-hidden="true" />
              </button>
            )}
            <button
              className="onboarding-sheet__advance"
              type="button"
              onClick={handleAdvance}
              data-node-id="564:7008"
            >
              {isLastPlannedStep ? 'Entendido, empezar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
