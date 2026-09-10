import { useEffect, useRef } from 'react'
import chartGlow from '../../assets/onboardingChartGlow.svg'
import './OnboardingSharePrice.css'

const AMOUNT_LABEL = 'Monto a invertir'
const UNIT_LABEL = 'Precio por participación'
const PAYOUT_CENTS = 1493
const GAIN_CENTS = 493

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatCents = (cents: number, withSign = false) =>
  `${withSign ? '+' : ''}${currencyFormatter.format(cents / 100)}`

/** Mesmo `ease-out` quártico do contador de métricas do perfil. */
const easeOut = (progress: number) => 1 - (1 - progress) ** 4

const readCssNumber = (styles: CSSStyleDeclaration, name: string) =>
  Number.parseFloat(styles.getPropertyValue(name))

/**
 * O `cardAnimado` do terceiro passo (`564:7030`). Fora da árvore de
 * acessibilidade pelo mesmo motivo dos anteriores: o título e o corpo abaixo
 * carregam o sentido.
 *
 * O conteúdo é uma conta, então a animação é a **derivação** dela, em ordem de
 * leitura: a compra, o preço, o valor investido, o preço por participação, o
 * retorno — com os números crescendo — e por último a conta que resume tudo. A
 * pílula `67%` recebe uma ênfase no instante em que o `67¢` aparece, que é o
 * que o título do card afirma.
 *
 * O estado base é a conta inteira visível com os valores finais, que é o quadro
 * do Figma.
 *
 * A derivação roda uma vez e para na conta inteira, que é esse mesmo estado
 * base. Com `prefers-reduced-motion` ela continua acontecendo, só sem
 * movimento — ver `--onboarding-motion` no `OnboardingBottomSheet.css`. A
 * contagem também segue: número mudando é texto mudando, não deslocamento.
 */
export function OnboardingSharePrice() {
  const cardRef = useRef<HTMLDivElement>(null)
  const payoutRef = useRef<HTMLSpanElement>(null)
  const gainRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const card = cardRef.current
    const payout = payoutRef.current
    const gain = gainRef.current

    if (!card || !payout || !gain) return undefined

    // A duração e a janela da contagem vivem no CSS, junto das keyframes, para
    // não existirem dois lugares para ajustar o mesmo tempo.
    const styles = window.getComputedStyle(card)
    const cycleMs = readCssNumber(styles, '--onboarding-shares-duration') * 1000
    const from = readCssNumber(styles, '--onboarding-shares-count-from') / 100
    const to = readCssNumber(styles, '--onboarding-shares-count-to') / 100

    if (!Number.isFinite(cycleMs) || cycleMs <= 0) return undefined

    let frameId = 0
    let lastCents = -1

    const render = () => {
      // A fase vem do relógio da própria animação CSS, não de
      // `performance.now()`. O Chrome congela animações de página não
      // renderizada, então um relógio próprio dessincronizaria da ilustração
      // toda vez que a aba fosse para o fundo. Terminada a animação, esse
      // relógio para no ponto de parada, bem depois da janela da contagem, e o
      // número descansa no valor final.
      const clock = card
        .getAnimations({ subtree: true })
        .find((animation) => 'animationName' in animation
          && (animation as CSSAnimation).animationName === 'onboarding-shares-buy')
      // Sem relógio não há fase, e aí o certo é mostrar o valor final: é o
      // estado base do card. Cair em zero deixaria a conta parecendo vazia.
      let progress = 1

      if (clock && to !== from) {
        const elapsed = Number(clock.currentTime ?? 0)
        const phase = ((elapsed % cycleMs) + cycleMs) % cycleMs / cycleMs
        progress = Math.min(1, Math.max(0, (phase - from) / (to - from)))
      }

      const eased = easeOut(progress)
      const payoutCents = Math.round(PAYOUT_CENTS * eased)

      if (payoutCents !== lastCents) {
        lastCents = payoutCents
        payout.textContent = formatCents(payoutCents)
        gain.textContent = formatCents(Math.round(GAIN_CENTS * eased), true)
      }

      frameId = window.requestAnimationFrame(render)
    }

    frameId = window.requestAnimationFrame(render)
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  return (
    <div
      ref={cardRef}
      className="onboarding-shares"
      data-node-id="564:7030"
      aria-hidden="true"
    >
      <div className="onboarding-shares__anima" data-node-id="564:7031">
        <span
          className="onboarding-shares__tag onboarding-shares__tag--buy"
          data-node-id="564:7157"
        >
          COMPRA UP
        </span>
        <span
          className="onboarding-shares__tag onboarding-shares__tag--price"
          data-node-id="564:7160"
        >
          67%
        </span>

        <div className="onboarding-shares__grid" data-node-id="564:7168">
          <div
            className="onboarding-shares__cell onboarding-shares__cell--amount"
            data-node-id="564:7179"
          >
            <span className="onboarding-shares__label">{AMOUNT_LABEL}</span>
            <span className="onboarding-shares__value">$10</span>
          </div>

          <div
            className="onboarding-shares__cell onboarding-shares__cell--unit"
            data-node-id="564:7180"
          >
            <span className="onboarding-shares__label">{UNIT_LABEL}</span>
            <span className="onboarding-shares__value">67¢</span>
          </div>

          <div
            className="onboarding-shares__cell onboarding-shares__cell--payoff"
            data-node-id="564:7185"
          >
            <span className="onboarding-shares__label">Si aciertas, recibes</span>
            <span
              ref={payoutRef}
              className="onboarding-shares__value onboarding-shares__value--gain"
            >
              {formatCents(PAYOUT_CENTS)}
            </span>
          </div>

          <div
            className="onboarding-shares__cell onboarding-shares__cell--payoff"
            data-node-id="564:7190"
          >
            <span className="onboarding-shares__label">Ganancia</span>
            <span
              ref={gainRef}
              className="onboarding-shares__value onboarding-shares__value--gain"
            >
              {formatCents(GAIN_CENTS, true)}
            </span>
          </div>

          <div
            className="onboarding-shares__cell onboarding-shares__cell--formula"
            data-node-id="564:7195"
          >
            <span className="onboarding-shares__label">
              $10 ÷ 67¢ = 14.93 participaciones
            </span>
          </div>
        </div>
      </div>

      <img
        className="onboarding-shares__glow"
        src={chartGlow}
        alt=""
        data-node-id="564:7052"
      />
    </div>
  )
}
