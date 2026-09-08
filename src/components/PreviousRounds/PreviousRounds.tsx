import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type UIEvent,
} from 'react'
import entryDirectionDown from '../../assets/entryDirectionDown.svg'
import entryDirectionUp from '../../assets/entryDirectionUp.svg'
import iconClock from '../../assets/iconClock.svg'
import lightPriceTarget from '../../assets/lightPriceTarget.svg'
import { BTC_DISPLAY_TIME_ZONE } from '../../services/marketData'
import './PreviousRounds.css'

const MAX_VISIBLE_BULLETS = 5

export interface PreviousRound {
  id: string
  roundStart: number
  roundEnd: number
  targetPrice: number
  finalPrice: number
  result: 'up' | 'down'
}

interface PreviousRoundsProps {
  animatedRoundStart?: number | null
  onAnimatedRoundSeen?: (roundStart: number) => void
  rounds: PreviousRound[]
}

const priceFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  timeZone: BTC_DISPLAY_TIME_ZONE,
})
const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: BTC_DISPLAY_TIME_ZONE,
})

export function PreviousRounds({
  animatedRoundStart = null,
  onAnimatedRoundSeen,
  rounds,
}: PreviousRoundsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const latestRoundStart = rounds[0]?.roundStart
  const animatedRound = rounds.find(
    ({ roundStart }) => roundStart === animatedRoundStart,
  )
  const hasNewRound = animatedRoundStart !== null && Boolean(animatedRound)

  useEffect(() => {
    if (
      !hasNewRound
      || animatedRoundStart === null
      || !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return

    onAnimatedRoundSeen?.(animatedRoundStart)
  }, [
    animatedRoundStart,
    hasNewRound,
    onAnimatedRoundSeen,
  ])

  useEffect(() => {
    trackRef.current?.scrollTo({ left: 0, behavior: 'auto' })
  }, [latestRoundStart])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget
    const firstCard = track.querySelector<HTMLElement>('.previous-rounds__card')

    if (!firstCard) return

    const cardStep = firstCard.offsetWidth + 8
    const nextIndex = Math.round(track.scrollLeft / cardStep)

    setActiveIndex(Math.max(0, Math.min(rounds.length - 1, nextIndex)))
  }

  const handleAnimatedRoundEnd = (
    event: ReactAnimationEvent<HTMLElement>,
    roundStart: number,
  ) => {
    if (
      event.target !== event.currentTarget
      || event.animationName !== 'previous-rounds-card-enter'
    ) return

    onAnimatedRoundSeen?.(roundStart)
  }

  const firstVisibleBulletIndex =
    rounds.length > MAX_VISIBLE_BULLETS
      ? Math.min(
          Math.max(activeIndex - Math.floor(MAX_VISIBLE_BULLETS / 2), 0),
          rounds.length - MAX_VISIBLE_BULLETS,
        )
      : 0

  const visibleBulletIndexes = Array.from(
    { length: Math.min(rounds.length, MAX_VISIBLE_BULLETS) },
    (_, index) => firstVisibleBulletIndex + index,
  )

  const getBulletModifier = (index: number) => {
    const distance = Math.abs(index - activeIndex)

    if (distance === 0) return 'previous-rounds__bullet--active'
    if (distance === 1) return 'previous-rounds__bullet--near'

    return 'previous-rounds__bullet--far'
  }

  if (rounds.length === 0) return null

  return (
    <section
      className="previous-rounds"
      aria-labelledby="previous-rounds-title"
      data-round-count={rounds.length}
      data-node-id="188:3013"
    >
      <div className="previous-rounds__heading">
        <h2 id="previous-rounds-title" className="previous-rounds__title">
          Últimas 10 rondas
        </h2>
        {hasNewRound && (
          <span
            aria-hidden="true"
            className="previous-rounds__update-badge"
            data-result={animatedRound?.result}
            key={animatedRoundStart}
          >
            Nueva
          </span>
        )}
      </div>

      {hasNewRound && (
        <span
          className="previous-rounds__announcement"
          aria-live="polite"
          key={`announcement-${animatedRoundStart}`}
        >
          Nueva ronda añadida. Resultado:{' '}
          {animatedRound?.result === 'up' ? 'arriba' : 'abajo'}.
        </span>
      )}

      <div className="previous-rounds__carousel">
        <div
          className="previous-rounds__track"
          onScroll={handleScroll}
          ref={trackRef}
        >
          {rounds.map((round, index) => {
            const isUp = round.result === 'up'
            const isAnimatedRound = round.roundStart === animatedRoundStart
            const timeRange = `${timeFormatter.format(round.roundStart)} - ${timeFormatter.format(round.roundEnd)}`

            return (
              <article
                className={`previous-rounds__card${isAnimatedRound ? ' previous-rounds__card--entering' : ''}`}
                data-animated-round={isAnimatedRound}
                data-latest-round={index === 0}
                data-final-price={round.finalPrice}
                data-result={round.result}
                data-round-end={round.roundEnd}
                data-round-id={round.id}
                data-round-start={round.roundStart}
                data-target-price={round.targetPrice}
                key={round.roundStart}
                onAnimationEnd={isAnimatedRound
                  ? (event) => handleAnimatedRoundEnd(event, round.roundStart)
                  : undefined}
              >
                <div className="previous-rounds__meta">
                  <span className="previous-rounds__time">
                    <img src={iconClock} alt="" aria-hidden="true" />
                    {timeRange}
                  </span>
                  <span className="previous-rounds__date">
                    {dateFormatter.format(round.roundStart)}
                  </span>
                </div>

                <div className="previous-rounds__prices">
                  <div className="previous-rounds__price previous-rounds__price--target">
                    <span>Precio objetivo</span>
                    <strong>{priceFormatter.format(round.targetPrice)}</strong>
                  </div>
                  <div className="previous-rounds__price previous-rounds__price--final">
                    <span>Precio final</span>
                    <strong
                      className={
                        isUp
                          ? 'previous-rounds__final-value--up'
                          : 'previous-rounds__final-value--down'
                      }
                    >
                      {priceFormatter.format(round.finalPrice)}
                    </strong>
                  </div>
                  <span
                    className={`previous-rounds__result previous-rounds__result--${round.result}`}
                    aria-label={isUp ? 'Resultado: arriba' : 'Resultado: abajo'}
                  >
                    <img
                      src={isUp ? entryDirectionUp : entryDirectionDown}
                      alt=""
                      aria-hidden="true"
                    />
                  </span>
                </div>

                <span className="previous-rounds__light" aria-hidden="true">
                  <img src={lightPriceTarget} alt="" />
                </span>
              </article>
            )
          })}
        </div>

        {rounds.length > 1 && (
          <div className="previous-rounds__bullets" aria-hidden="true">
            {visibleBulletIndexes.map((roundIndex) => (
              <span
                className={`previous-rounds__bullet ${getBulletModifier(roundIndex)}`}
                key={`${rounds[roundIndex].roundStart}-bullet`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
