import arrowDownRed from '../../assets/arrowDownRed.svg'
import arrowUpGreen from '../../assets/arrowUpGreen.svg'
import logoBTC from '../../assets/logoBTC.png'
import chartGlow from '../../assets/onboardingChartGlow.svg'
import './OnboardingRoundClock.css'

const TARGET_PRICE = '$80,195.64'
const OUTCOME = 'Terminó arriba'

const COUNTDOWN_SECONDS = ['05', '04', '03', '02', '01', '00']

interface RunStep {
  price: string
  delta: string
  isUp: boolean
}

/**
 * A volta que a ilustração percorre, um passo por segundo do relógio. O preço
 * cruza o objetivo três vezes antes de fechar acima dele: sem isso a rodada
 * pareceria decidida de antemão.
 *
 * Todos os valores terminam em `.64`, como o objetivo, então a diferença do
 * chip fecha em dólares inteiros, e o último passo cai exatamente no par do
 * Figma: `$80,202.64` e `$7`.
 */
const RUN_STEPS: RunStep[] = [
  { price: '$80,192.64', delta: '$3', isUp: false },
  { price: '$80,197.64', delta: '$2', isUp: true },
  { price: '$80,194.64', delta: '$1', isUp: false },
  { price: '$80,199.64', delta: '$4', isUp: true },
  { price: '$80,200.64', delta: '$5', isUp: true },
  { price: '$80,202.64', delta: '$7', isUp: true },
]

/**
 * O `cardAnimado` do segundo passo (`564:6976`). Fora da árvore de
 * acessibilidade pelo mesmo motivo do card 1: o título e o corpo abaixo dela
 * carregam o sentido.
 *
 * O estado base do CSS é o quadro **resolvido** — 00:00, barra cheia,
 * `Precio final` e `Terminó arriba`. No card 1 o estado base é o quadro do
 * Figma, mas aqui o do Figma é um instante do meio da contagem, e o quadro
 * resolvido é o que carrega a lição.
 *
 * A volta roda uma vez e para nesse quadro, mantido por `animation-fill-mode`
 * — o que vale também para quem tem `prefers-reduced-motion`, que aqui só
 * perde o movimento e não a sequência.
 */
export function OnboardingRoundClock() {
  return (
    <div className="onboarding-clock" data-node-id="564:6976" aria-hidden="true">
      <div className="onboarding-clock__anima" data-node-id="564:6977">
        <div className="onboarding-clock__round" data-node-id="570:7200">
          <span className="onboarding-clock__coin" data-node-id="570:7205">
            <img src={logoBTC} alt="" />
          </span>

          <div className="onboarding-clock__market" data-node-id="570:7206">
            <p className="onboarding-clock__market-title" data-node-id="570:7207">
              BTC / 15 Min
            </p>
            <p className="onboarding-clock__market-schedule" data-node-id="570:7211">
              19:00 - 19:15
            </p>
          </div>

          <div className="onboarding-clock__timer" data-node-id="570:7215">
            <div className="onboarding-clock__time-unit" data-node-id="570:7216">
              <span className="onboarding-clock__time-value">00</span>
              <span className="onboarding-clock__time-label">MIN.</span>
            </div>
            <span className="onboarding-clock__time-colon" data-node-id="570:7220">
              :
            </span>
            <div className="onboarding-clock__time-unit" data-node-id="570:7221">
              <span
                className="onboarding-clock__odometer onboarding-clock__odometer--seconds"
                data-node-id="570:7222"
              >
                <span className="onboarding-clock__strip">
                  {COUNTDOWN_SECONDS.map((seconds) => (
                    <span key={seconds} className="onboarding-clock__time-value">
                      {seconds}
                    </span>
                  ))}
                </span>
              </span>
              <span className="onboarding-clock__time-label">SEG.</span>
            </div>
          </div>
        </div>

        <div className="onboarding-clock__bar" data-node-id="570:7243">
          <span className="onboarding-clock__bar-track" data-node-id="570:7239" />
          <span className="onboarding-clock__bar-fill" data-node-id="570:7244" />
        </div>

        {/* Herda o visual da pílula do card 1: o card 1 já ensinou esse verde
            com `Terminó arriba`, e repetir o mesmo elemento é o que faz os
            cards lerem como um sistema. */}
        <span className="onboarding-clock__outcome-slot">
          <span className="onboarding-clock__outcome">{OUTCOME}</span>
        </span>

        <div className="onboarding-clock__prices" data-node-id="570:7224">
          <div className="onboarding-clock__price onboarding-clock__price--target" data-node-id="570:7225">
            <p className="onboarding-clock__price-label">Precio objetivo</p>
            <p className="onboarding-clock__price-value">{TARGET_PRICE}</p>
          </div>

          <div className="onboarding-clock__price" data-node-id="570:7229">
            <div className="onboarding-clock__price-head" data-node-id="570:7230">
              <span className="onboarding-clock__price-label-swap">
                <span className="onboarding-clock__price-label onboarding-clock__price-label--now">
                  Precio actual
                </span>
                <span className="onboarding-clock__price-label onboarding-clock__price-label--final">
                  Precio final
                </span>
              </span>

              <span
                className="onboarding-clock__odometer onboarding-clock__odometer--delta"
                data-node-id="570:7232"
              >
                <span className="onboarding-clock__strip">
                  {RUN_STEPS.map((step, index) => (
                    <span
                      key={COUNTDOWN_SECONDS[index]}
                      className={`onboarding-clock__delta${
                        step.isUp ? '' : ' onboarding-clock__delta--down'
                      }`}
                    >
                      <img src={step.isUp ? arrowUpGreen : arrowDownRed} alt="" />
                      {step.delta}
                    </span>
                  ))}
                </span>
              </span>
            </div>

            <span
              className="onboarding-clock__odometer onboarding-clock__odometer--price"
              data-node-id="570:7235"
            >
              <span className="onboarding-clock__strip">
                {RUN_STEPS.map((step, index) => (
                  <span
                    key={COUNTDOWN_SECONDS[index]}
                    className="onboarding-clock__price-value"
                  >
                    {step.price}
                  </span>
                ))}
              </span>
            </span>
          </div>
        </div>
      </div>

      <img
        className="onboarding-clock__glow"
        src={chartGlow}
        alt=""
        data-node-id="564:6998"
      />
    </div>
  )
}
