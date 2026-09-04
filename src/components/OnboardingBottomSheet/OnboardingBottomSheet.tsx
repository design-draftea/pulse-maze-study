import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
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
const STEP_MOTION_MS = 300
const SHEET_TITLE = 'Cómo funciona Draftea Pulse'
const CLOSE_LABEL = 'Cerrar'
const BACK_LABEL = 'Volver'
const illustrationByStepId: Record<string, () => ReactNode> = {
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
}

export function OnboardingBottomSheet({
  isOpen,
  onClose,
}: OnboardingBottomSheetProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  // O passo que está saindo e a direção da troca. Só existem durante os 300ms
  // da transição: fora dela apenas o passo atual é montado, para não deixar
  // quatro ilustrações animando ao mesmo tempo.
  const [leavingStep, setLeavingStep] = useState<number | null>(null)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const stepTimerRef = useRef<number | null>(null)
  const isClosingRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const sheetRef = useRef<HTMLElement | null>(null)

  // Os efeitos colaterais ficam fora do updater do `setStepIndex` de propósito:
  // o React pode invocar um updater mais de uma vez, e agendar temporizador
  // dentro dele dispararia a limpeza da transição antes da hora.
  const goToStep = useCallback((next: number, way: 'forward' | 'back') => {
    if (next === stepIndex) return

    setLeavingStep(stepIndex)
    setDirection(way)
    setStepIndex(next)

    if (stepTimerRef.current !== null) window.clearTimeout(stepTimerRef.current)
    stepTimerRef.current = window.setTimeout(
      () => setLeavingStep(null),
      STEP_MOTION_MS,
    )
  }, [stepIndex])

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
      setLeavingStep(null)
      focusFrame = window.requestAnimationFrame(() => {
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

  useEffect(() => () => {
    clearCloseTimer()
    if (stepTimerRef.current !== null) window.clearTimeout(stepTimerRef.current)
  }, [clearCloseTimer])

  useEffect(() => {
    if (!shouldRender) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [requestClose, shouldRender])

  const step = onboardingSteps[stepIndex]
  const Illustration = step ? illustrationByStepId[step.id] : undefined
  const leaving = leavingStep === null ? undefined : onboardingSteps[leavingStep]
  const LeavingIllustration = leaving ? illustrationByStepId[leaving.id] : undefined
  const isMoving = leavingStep !== null
  const isLastAuthoredStep = stepIndex === onboardingSteps.length - 1
  const isLastPlannedStep = stepIndex === ONBOARDING_STEP_TOTAL - 1

  const handleBack = useCallback(() => {
    if (stepIndex > 0) goToStep(stepIndex - 1, 'back')
  }, [goToStep, stepIndex])

  const handleAdvance = useCallback(() => {
    if (isLastAuthoredStep) {
      requestClose()
      return
    }

    goToStep(stepIndex + 1, 'forward')
  }, [goToStep, isLastAuthoredStep, requestClose, stepIndex])

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
          <div className="onboarding-sheet__stage">
            {leaving && (
              <div
                className={`onboarding-sheet__step onboarding-sheet__step--leaving-${direction}`}
                aria-hidden="true"
              >
                {LeavingIllustration ? <LeavingIllustration /> : null}
                <h3 className="onboarding-sheet__step-title">{leaving.title}</h3>
                <p className="onboarding-sheet__step-body">{leaving.body}</p>
              </div>
            )}

            <div
              className={`onboarding-sheet__step${
                isMoving ? ` onboarding-sheet__step--entering-${direction}` : ''
              }`}
            >
              {Illustration ? <Illustration /> : null}

              <h3 className="onboarding-sheet__step-title" data-node-id="564:6611">
                {step.title}
              </h3>
              <p className="onboarding-sheet__step-body" data-node-id="564:6612">
                {step.body}
              </p>
            </div>
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
