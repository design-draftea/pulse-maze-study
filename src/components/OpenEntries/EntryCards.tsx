import badgeGanhador from '../../assets/badgeGanhador.svg'
import entryCardLight from '../../assets/entryCardLight.svg'
import entryDirectionDown from '../../assets/entryDirectionDown.svg'
import entryDirectionUp from '../../assets/entryDirectionUp.svg'
import type { OutcomeSide } from '../../services/outcomeMarket'
import type { OpenEntrySummary } from '../../services/openEntries'
import type { PrototypeWalletSettledEntry } from '../../services/prototypeWallet'
import { LiveIndicator } from '../LiveIndicator/LiveIndicator'

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const participationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const formatPrice = (value: number | null) => (
  value === null ? '—' : moneyFormatter.format(value)
)

const formatDelta = (value: number | null) => {
  if (value === null || value === 0) return null

  return `${value > 0 ? '+' : '−'}${moneyFormatter.format(Math.abs(value))}`
}

function DirectionIcon({ side }: { side: OutcomeSide }) {
  return (
    <span className={`entry-card-v2__direction entry-card-v2__direction--${side}`}>
      <img
        src={side === 'up' ? entryDirectionUp : entryDirectionDown}
        alt=""
        aria-hidden="true"
      />
    </span>
  )
}

function CardLight() {
  return (
    <span className="entry-card-v2__light" aria-hidden="true">
      <img src={entryCardLight} alt="" />
    </span>
  )
}

interface OpenEntryCardProps {
  entry: OpenEntrySummary
  startTime: string
  endTime: string
  minutes: string
  seconds: string
  targetPrice: number | null
  currentPrice: number | null
  isLeaving?: boolean
  onLeaveEnd?: () => void
  onViewMarket: () => void
  onSell: (side: OutcomeSide) => void
}

export function OpenEntryCard({
  entry,
  startTime,
  endTime,
  minutes,
  seconds,
  targetPrice,
  currentPrice,
  isLeaving = false,
  onLeaveEnd,
  onViewMarket,
  onSell,
}: OpenEntryCardProps) {
  const priceDelta = targetPrice === null || currentPrice === null
    ? null
    : currentPrice - targetPrice
  const delta = formatDelta(priceDelta)

  return (
    <article
      className={`entry-card-v2 entry-card-v2--open${isLeaving ? ' entry-card-v2--leaving' : ''}`}
      data-entry-side={entry.side}
      data-node-id={entry.side === 'down' ? '856:7372' : '856:7418'}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget
          || event.animationName !== 'entry-card-v2-leave') return

        onLeaveEnd?.()
      }}
    >
      <CardLight />

      <header className="entry-card-v2__header entry-card-v2__header--open">
        <DirectionIcon side={entry.side} />
        <div className="entry-card-v2__identity">
          <strong>
            Compra en{' '}
            <span className={`entry-card-v2__side entry-card-v2__side--${entry.side}`}>
              {entry.side.toUpperCase()}
            </span>
          </strong>
          <span>{startTime} – {endTime}</span>
        </div>
        <div className="entry-card-v2__countdown">
          <span className="entry-card-v2__countdown-label">
            <LiveIndicator />
            Termina en
          </span>
          <strong>{minutes}:{seconds}</strong>
        </div>
      </header>

      <div className="entry-card-v2__position">
        <div className="entry-card-v2__amounts">
          <div className="entry-card-v2__headline">
            <span>Si aciertas, recibes</span>
            <strong>{moneyFormatter.format(entry.potentialPayoutCents / 100)}</strong>
          </div>
          <div className="entry-card-v2__invested">
            <span>Tu monto</span>
            <strong>{moneyFormatter.format(entry.amountCents / 100)}</strong>
          </div>
        </div>
        <span className="entry-card-v2__participations">
          {participationFormatter.format(entry.participations)} participaciones
          {' · '}Precio promedio {Math.round(entry.averagePriceCents)}¢
        </span>
      </div>

      <div className="entry-card-v2__price-wrap">
        <div className="entry-card-v2__prices">
          <div>
            <span>Precio objetivo</span>
            <strong>{formatPrice(targetPrice)}</strong>
          </div>
          <div>
            <span className="entry-card-v2__price-label">
              Precio actual
              {delta && (
                <em className={`entry-card-v2__delta entry-card-v2__delta--${(priceDelta ?? 0) > 0 ? 'up' : 'down'}`}>
                  {delta}
                </em>
              )}
            </span>
            <strong>{formatPrice(currentPrice)}</strong>
          </div>
        </div>
      </div>

      <footer className="entry-card-v2__actions">
        <button
          className="entry-card-v2__button entry-card-v2__button--secondary"
          type="button"
          onClick={onViewMarket}
        >
          Ver mercado
        </button>
        <button
          className="entry-card-v2__button entry-card-v2__button--primary"
          type="button"
          onClick={() => onSell(entry.side)}
        >
          Vender
        </button>
      </footer>
    </article>
  )
}

function ResultBadge({ outcome }: { outcome: PrototypeWalletSettledEntry['outcome'] }) {
  if (outcome === 'won') {
    return (
      <span className="entry-card-v2__winner" aria-label="¡GANADOR!">
        <img src={badgeGanhador} alt="" aria-hidden="true" />
        <strong>¡GANADOR!</strong>
      </span>
    )
  }

  const label = outcome === 'lost'
    ? 'NO GANADOR'
    : outcome === 'sold' ? 'VENDIDA' : 'CANCELADO'

  return <span className="entry-card-v2__status">{label}</span>
}

export function SettledEntryCard({ entry }: { entry: PrototypeWalletSettledEntry }) {
  const isSold = entry.outcome === 'sold'
  const isCanceled = entry.outcome === 'canceled'
  const averagePriceCents = entry.participations > 0
    ? entry.amountCents / entry.participations
    : 0
  const salePriceCents = isSold && entry.participations > 0
    ? entry.payoutCents / entry.participations
    : 0
  const receivedCents = isCanceled ? entry.amountCents : entry.payoutCents
  const priceDelta = entry.targetPrice === null || entry.finalPrice === null
    ? null
    : entry.finalPrice - entry.targetPrice
  const delta = formatDelta(priceDelta)

  return (
    <article
      className={`entry-card-v2 entry-card-v2--settled entry-card-v2--${entry.outcome}`}
      data-entry-side={entry.side}
      data-node-id={entry.outcome === 'won'
        ? '856:7860'
        : entry.outcome === 'lost'
          ? '856:7653'
          : entry.outcome === 'sold' ? '856:7688' : '856:7720'}
    >
      <CardLight />

      <header className="entry-card-v2__header entry-card-v2__header--settled">
        <DirectionIcon side={entry.side} />
        <div className="entry-card-v2__identity">
          <strong>
            Compra en{' '}
            <span className={`entry-card-v2__side entry-card-v2__side--${entry.side}`}>
              {entry.side.toUpperCase()}
            </span>
          </strong>
          <span>
            {dateFormatter.format(entry.roundStart)} · {timeFormatter.format(entry.roundStart)}–{timeFormatter.format(entry.roundEnd)}
          </span>
        </div>
        <ResultBadge outcome={entry.outcome} />
      </header>

      <div className="entry-card-v2__position">
        <div className="entry-card-v2__amounts">
          <div className="entry-card-v2__headline">
            <span>
              {isSold
                ? 'Recibiste por la venta'
                : isCanceled ? 'Recibe de vuelta' : 'Recibiste'}
            </span>
            <strong>{moneyFormatter.format(receivedCents / 100)}</strong>
          </div>
          <div className="entry-card-v2__invested">
            <span>Tu monto</span>
            <strong>{moneyFormatter.format(entry.amountCents / 100)}</strong>
          </div>
        </div>
        <span className="entry-card-v2__participations">
          {participationFormatter.format(entry.participations)} participaciones
          {isSold ? ' vendidas' : isCanceled ? '' : ` · Precio promedio ${Math.round(averagePriceCents)}¢`}
        </span>
      </div>

      <div className="entry-card-v2__prices">
        <div>
          <span>Precio objetivo</span>
          <strong>{formatPrice(entry.targetPrice)}</strong>
        </div>
        <div>
          {isSold ? (
            <>
              <span>Precio de venta</span>
              <strong>{Math.round(salePriceCents)}¢</strong>
            </>
          ) : (
            <>
              <span className="entry-card-v2__price-label">
                Precio final
                {delta && (
                  <em className={`entry-card-v2__delta entry-card-v2__delta--${(priceDelta ?? 0) > 0 ? 'up' : 'down'}`}>
                    {delta}
                  </em>
                )}
              </span>
              <strong>{formatPrice(entry.finalPrice)}</strong>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
