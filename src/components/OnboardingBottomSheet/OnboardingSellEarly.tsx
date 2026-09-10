import { useCallback, useEffect, useRef, useState } from 'react'
import chartGlow from '../../assets/onboardingChartGlow.svg'
import { OnboardingSeries } from './OnboardingSeries'
import './OnboardingSellEarly.css'

const SHARES = 200
/* O preço de entrada não entra na conta do valor da venda, que é só
   `participações × preço atual`. Fica aqui porque é o que a pílula mostra, e
   ligado ao mesmo lugar para os dois números não divergirem. */
const ENTRY_PRICE = 0.67
/* Vende sozinho quando a varredura chega ao fim do gráfico, que é onde o valor
   da entrada está no máximo. */
const AUTO_SELL_PHASE = 0.48
const HOLD_DRIFT = 0.02

/**
 * Preço do DOWN ancorado na posição vertical da série, que é o preço do BTC na
 * tela. A série deste card **desce**: começa em `y` 20 (preço alto, acima do
 * objetivo) e termina em 100 (preço baixo, abaixo dele), numa caixa de 115 em
 * que o objetivo cai em 70 — daí as três frações.
 *
 * No objetivo o DOWN vale 50¢, porque ali o resultado é uma moeda ao ar. Acima
 * do objetivo ele despenca; abaixo, se aproxima de $1. A posição é DOWN, então
 * é a **queda** do preço que faz a entrada valer mais.
 */
const DOWN_PRICE_ANCHORS: Array<[number, number]> = [
  [0.8696, 0.9],
  [0.6087, 0.5],
  [0.1739, 0.12],
]

const downPriceAt = (heightFraction: number) => {
  const [first] = DOWN_PRICE_ANCHORS
  const last = DOWN_PRICE_ANCHORS[DOWN_PRICE_ANCHORS.length - 1]

  if (heightFraction >= first[0]) return first[1]
  if (heightFraction <= last[0]) return last[1]

  for (let index = 0; index < DOWN_PRICE_ANCHORS.length - 1; index += 1) {
    const [aFraction, aPrice] = DOWN_PRICE_ANCHORS[index]
    const [bFraction, bPrice] = DOWN_PRICE_ANCHORS[index + 1]

    if (heightFraction <= aFraction && heightFraction >= bFraction) {
      const t = (aFraction - heightFraction) / (aFraction - bFraction)
      return aPrice + (bPrice - aPrice) * t
    }
  }

  return last[1]
}

const saleCentsAt = (heightFraction: number, drift: number) => {
  const price = Math.min(0.99, Math.max(0.01, downPriceAt(heightFraction) + drift))
  return Math.round(SHARES * price * 100)
}

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const readCssNumber = (styles: CSSStyleDeclaration, name: string) =>
  Number.parseFloat(styles.getPropertyValue(name))

/**
 * O `cardAnimado` do quarto passo (`564:7089`), com a mesma série do card 1 numa
 * caixa mais baixa — o rodapé com o resultado e o botão ocupa a base.
 *
 * A posição em aberto é DOWN e a série **desce**: o preço começa acima do
 * objetivo e termina abaixo, então a entrada vai valendo mais. O número mostra
 * o **valor da venda** — quanto se recebe vendendo agora —, que sobe de $24 a
 * $180 ao longo da rodada.
 *
 * Mostrar lucro ou prejuízo aqui seria pior por dois motivos. Um: apareceria
 * `Pérdida potencial` na maior parte do ciclo, e o card existe para apresentar
 * a saída como vantagem, não para assustar no primeiro contato. Dois: com a
 * posição ganhando, segurar até o fim pagaria $200 e vender antes paga $180 —
 * então o resultado ensinaria que vender custa dinheiro. O texto do card já diz
 * qual é o benefício: `vendes tu entrada al valor del momento sin esperar`. É
 * não esperar, não otimizar. E valor de venda é o que uma tela de venda real
 * mostra primeiro.
 *
 * O número não é inventado: sai da posição vertical da série, que é o preço na
 * tela, convertido em preço do DOWN e multiplicado pelas participações.
 *
 * O botão vende sozinho quando a varredura chega ao fim do gráfico, onde o
 * valor está no máximo. Continua clicável: quem tocar antes vende no instante
 * do toque, e quem só assistir vê o card se vender. Em ambos os casos a
 * ilustração congela no instante da venda — a série para de ser traçada, o
 * marcador para, o valor trava e uma linha marca onde no tempo aquilo
 * aconteceu. É o texto do card virando gesto.
 *
 * A rodada acontece uma vez e o card fica no quadro da venda. Recomeçar seria
 * pedir que a mesma cena fosse assistida de novo enquanto a pessoa lê o texto
 * ao lado; o quadro parado é o que ela precisa ver. Voltar a este passo, ou
 * reabrir o onboarding, remonta o card e a rodada roda outra vez.
 */
export function OnboardingSellEarly() {
  const cardRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const amountRef = useRef<HTMLSpanElement>(null)
  const saleCentsRef = useRef(0)
  const [isSold, setIsSold] = useState(false)

  const paint = useCallback((saleCents: number, sold: boolean) => {
    const label = labelRef.current
    const amount = amountRef.current

    if (!label || !amount) return

    label.textContent = sold ? 'Vendido por:' : 'Valor de venta:'
    amount.textContent = amountFormatter.format(saleCents / 100)
  }, [])

  const sell = useCallback(() => {
    const card = cardRef.current
    if (!card || isSold) return

    // Guarda onde no tempo a venda aconteceu, para a linha marcar o instante.
    const marker = card.querySelector<HTMLElement>('.onboarding-series__marker')
    if (marker) {
      card.style.setProperty('--onboarding-sell-at', window.getComputedStyle(marker).left)
    }

    paint(saleCentsRef.current, true)
    setIsSold(true)
  }, [isSold, paint])

  useEffect(() => {
    const card = cardRef.current
    if (!card || isSold) return undefined

    const marker = card.querySelector<HTMLElement>('.onboarding-series__marker')
    if (!marker) return undefined

    const styles = window.getComputedStyle(card)
    const cycleMs = readCssNumber(styles, '--onboarding-sell-duration') * 1000
    const seriesTop = readCssNumber(styles, '--onboarding-series-top')
    const seriesHeight = readCssNumber(styles, '--onboarding-series-height')

    if (!Number.isFinite(cycleMs) || cycleMs <= 0 || !Number.isFinite(seriesHeight)) {
      return undefined
    }

    let frameId = 0

    const render = () => {
      // A fase vem do relógio da própria animação CSS, não de
      // `performance.now()`: o Chrome congela animações de página não
      // renderizada, e um relógio próprio dessincronizaria da série.
      const clock = card
        .getAnimations({ subtree: true })
        .find((animation) => 'animationName' in animation
          && (animation as CSSAnimation).animationName === 'onboarding-series-sweep')
      const elapsed = Number(clock?.currentTime ?? 0)
      const phase = clock ? ((elapsed % cycleMs) + cycleMs) % cycleMs / cycleMs : 1

      // O marcador segue a série, então o `top` dele é o preço na tela.
      const markerTop = Number.parseFloat(window.getComputedStyle(marker).top)
      const fraction = (markerTop - seriesTop) / seriesHeight

      // Depois da varredura o preço na tela para, mas a rodada segue viva: uma
      // oscilação pequena mantém o número em movimento.
      const settled = phase > 0.48 || phase < 0.08
      const drift = settled ? Math.sin(phase * 90) * HOLD_DRIFT : 0
      const saleCents = saleCentsAt(fraction, drift)

      saleCentsRef.current = saleCents
      paint(saleCents, false)

      // Vende sozinho perto do fim da varredura. O laço termina aqui: `sell`
      // liga `isSold`, e o efeito não volta a rodar.
      if (phase >= AUTO_SELL_PHASE && phase < 0.88) {
        sell()
        return
      }

      frameId = window.requestAnimationFrame(render)
    }

    frameId = window.requestAnimationFrame(render)
    return () => window.cancelAnimationFrame(frameId)
  }, [isSold, paint, sell])

  return (
    <div
      ref={cardRef}
      className={`onboarding-sell${isSold ? ' onboarding-sell--sold' : ''}`}
      data-node-id="564:7089"
    >
      <div className="onboarding-sell__anima" data-node-id="564:7090">
        <span className="onboarding-sell__position" aria-hidden="true" data-node-id="595:7429">
          {`DOWN - ${Math.round(ENTRY_PRICE * 100)}%`}
        </span>

        <span className="onboarding-sell__shares" aria-hidden="true" data-node-id="597:7434">
          <span className="onboarding-sell__shares-label">Participaciones:</span>
          <span className="onboarding-sell__shares-value">{SHARES}</span>
        </span>

        <OnboardingSeries direction="falling" />

        {/* Marca em que ponto do tempo a venda aconteceu. */}
        <span className="onboarding-sell__moment" aria-hidden="true" />

        <span className="onboarding-sell__target-line" aria-hidden="true" data-node-id="603:7438" />
        <p className="onboarding-sell__target-label" aria-hidden="true" data-node-id="603:7439">
          PRECIO OBJETIVO
        </p>

        <div className="onboarding-sell__footer" data-node-id="595:7414">
          <div className="onboarding-sell__gain" data-node-id="595:7415">
            <span ref={labelRef} className="onboarding-sell__gain-label" aria-hidden="true">
              Valor de venta:
            </span>
            <span className="onboarding-sell__gain-value" data-node-id="595:7417">
              <span className="onboarding-sell__gain-currency">$</span>
              <span ref={amountRef} className="onboarding-sell__gain-amount">
                0.00
              </span>
            </span>
          </div>

          {/* As duas faces vivem juntas no botão para ele poder girar de uma
              para a outra. O nome acessível vem do `aria-label`, senão o leitor
              de tela anunciaria as duas. */}
          <button
            className="onboarding-sell__action"
            type="button"
            onClick={sell}
            disabled={isSold}
            aria-label={isSold ? 'Vendido' : 'Vender'}
            data-node-id="595:7420"
          >
            <span className="onboarding-sell__action-faces" aria-hidden="true">
              <span className="onboarding-sell__action-face onboarding-sell__action-face--sell">
                Vender
              </span>
              <span className="onboarding-sell__action-face onboarding-sell__action-face--sold">
                Vendido
              </span>
            </span>
          </button>
        </div>
      </div>

      <img
        className="onboarding-sell__glow"
        src={chartGlow}
        alt=""
        aria-hidden="true"
        data-node-id="564:7111"
      />
    </div>
  )
}
