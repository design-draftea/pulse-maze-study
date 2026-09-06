import { useEffect, useRef, useState } from 'react'
import arrowDownRed from '../../assets/arrowDownRed.svg'
import badgeGanhador from '../../assets/badgeGanhador.svg'
import entryCardLight from '../../assets/entryCardLight.svg'
import entryPriceUp from '../../assets/entryPriceUp.svg'
import entrySeparator from '../../assets/entrySeparator.svg'
import iconDoubleChevronsDown from '../../assets/iconDoubleChevronsDown.svg'
import iconDoubleChevronsUp from '../../assets/iconDoubleChevronsUp.svg'
import { LiveIndicator } from '../LiveIndicator/LiveIndicator'
import type { OutcomeSide } from '../../services/outcomeMarket'
import {
  getOpenEntrySummaries,
  type OpenEntrySummary,
} from '../../services/openEntries'
import type {
  PrototypeWalletCostBasis,
  PrototypeWalletPosition,
  PrototypeWalletSettledEntry,
} from '../../services/prototypeWallet'
import { getPastEntries, getWonEntries } from '../../services/wonEntries'
import './OpenEntries.css'

const payoutFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const amountFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const deltaFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const participationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const ENTRIES_PREVIEW_MODE = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('previewEntries')
  : null
const WON_ENTRY_PREVIEW: PrototypeWalletSettledEntry = {
  id: 'preview-won-entry',
  roundStart: new Date(2026, 8, 1, 10, 0).getTime(),
  roundEnd: new Date(2026, 8, 1, 10, 15).getTime(),
  side: 'down',
  outcome: 'won',
  amountCents: 20_000,
  participations: 588.24,
  payoutCents: 58_824,
  targetPrice: 80_194.33,
  finalPrice: 80_193.64,
}
const PAST_ENTRIES_PREVIEW: PrototypeWalletSettledEntry[] = [
  WON_ENTRY_PREVIEW,
  {
    ...WON_ENTRY_PREVIEW,
    id: 'preview-lost-entry',
    roundStart: new Date(2026, 8, 1, 9, 45).getTime(),
    roundEnd: new Date(2026, 8, 1, 10, 0).getTime(),
    outcome: 'lost',
    payoutCents: 0,
    finalPrice: 80_195.64,
  },
  {
    ...WON_ENTRY_PREVIEW,
    id: 'preview-canceled-entry',
    roundStart: new Date(2026, 8, 1, 9, 30).getTime(),
    roundEnd: new Date(2026, 8, 1, 9, 45).getTime(),
    outcome: 'canceled',
    payoutCents: 0,
    finalPrice: 80_195.64,
  },
]
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
const ENTRY_SIDE_ORDER: Record<OutcomeSide, number> = { down: 0, up: 1 }

export interface OpenEntryExit {
  side: OutcomeSide
  position: PrototypeWalletPosition
  costBasis: PrototypeWalletCostBasis
  isLeaving: boolean
}

const TAB_FADE_OUT_MS = 110
const TAB_FADE_IN_MS = 180
export type EntriesTab = 'open' | 'won' | 'past'
type TabTransitionPhase = 'idle' | 'out' | 'in'

const formatPrice = (value: number | null) => (
  value === null ? '—' : priceFormatter.format(value)
)

interface EntryCardProps {
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

function EntryCard({
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
}: EntryCardProps) {
  const priceDelta = targetPrice === null || currentPrice === null
    ? null
    : currentPrice - targetPrice
  const hasPriceDirection = priceDelta !== null && priceDelta !== 0
  const isPriceUp = priceDelta !== null && priceDelta > 0

  return (
    <article
      className={`open-entry-card${isLeaving ? ' open-entry-card--leaving' : ''}`}
      data-entry-side={entry.side}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget
          || event.animationName !== 'open-entry-card-leave') return

        onLeaveEnd?.()
      }}
      data-node-id={entry.side === 'down' ? '383:8508' : '383:9204'}
    >
      <img
        className="open-entry-card__light"
        src={entryCardLight}
        alt=""
        aria-hidden="true"
      />

      <header className="open-entry-card__summary">
        <div className="open-entry-card__potential">
          <strong>{payoutFormatter.format(entry.potentialPayoutCents / 100)}</strong>
          <span>Ganancia potencial</span>
        </div>
        <div className="open-entry-card__summary-details">
          <span>Monto: {amountFormatter.format(entry.amountCents / 100)}</span>
          <span>Precio promedio {Math.round(entry.averagePriceCents)}¢</span>
        </div>
      </header>

      <div className="open-entry-card__body">
        <div className="open-entry-card__meta">
          <span className="open-entry-card__live">
            <LiveIndicator />
            LIVE
          </span>
          <img className="open-entry-card__separator" src={entrySeparator} alt="" aria-hidden="true" />
          <span>{startTime} - {endTime}</span>
          <img className="open-entry-card__separator" src={entrySeparator} alt="" aria-hidden="true" />
          <span className="open-entry-card__countdown">
            Termina en: {minutes}:{seconds}
          </span>
        </div>

        <div className="open-entry-card__position">
          <strong>
            COMPRA EN{' '}
            <span className={`open-entry-card__side open-entry-card__side--${entry.side}`}>
              {entry.side.toUpperCase()}
            </span>
          </strong>
          <span>{participationFormatter.format(entry.participations)} participaciones</span>
        </div>

        <div className="open-entry-card__prices">
          <div className="open-entry-card__target-price">
            <span>Precio objetivo</span>
            <strong>{formatPrice(targetPrice)}</strong>
          </div>
          <div className="open-entry-card__current-price">
            <div className="open-entry-card__current-title">
              <span>Precio actual</span>
              {hasPriceDirection && (
                <span className={`open-entry-card__delta open-entry-card__delta--${isPriceUp ? 'up' : 'down'}`}>
                  <img
                    src={isPriceUp ? entryPriceUp : arrowDownRed}
                    alt=""
                    aria-hidden="true"
                  />
                  {deltaFormatter.format(Math.abs(priceDelta ?? 0))}
                </span>
              )}
            </div>
            <strong>{formatPrice(currentPrice)}</strong>
          </div>
        </div>
      </div>

      <footer className="open-entry-card__actions">
        <button
          className="open-entry-card__button open-entry-card__button--secondary"
          type="button"
          onClick={onViewMarket}
        >
          Ver mercado
        </button>
        <button
          className="open-entry-card__button open-entry-card__button--primary"
          type="button"
          onClick={() => onSell(entry.side)}
        >
          Vender
        </button>
      </footer>
    </article>
  )
}

function SettledEntryCard({ entry }: { entry: PrototypeWalletSettledEntry }) {
  // Nas demais entradas o destaque é participações x $1: o que a rodada pagou,
  // ou o que teria pago. Numa venda esse pagamento deixou de existir quando a
  // posição virou dinheiro, então o destaque é o valor efetivamente recebido.
  const headlineValue = entry.outcome === 'sold'
    ? entry.payoutCents / 100
    : entry.participations
  const potentialPayout = payoutFormatter.format(headlineValue).replace('$', '')
  const averagePriceCents = entry.participations > 0
    ? entry.amountCents / entry.participations
    : 0
  const resultSide: OutcomeSide = entry.targetPrice !== null
    && entry.finalPrice !== null
    ? entry.finalPrice > entry.targetPrice ? 'up' : 'down'
    : entry.outcome === 'lost'
      ? entry.side === 'up' ? 'down' : 'up'
      : entry.side
  const isSold = entry.outcome === 'sold'
  // Numa saída antecipada o preço relevante é o da execução da venda, e não o
  // preço médio de compra mostrado nas demais entradas.
  const salePriceCents = isSold && entry.participations > 0
    ? entry.payoutCents / entry.participations
    : 0
  const statusLabel = entry.outcome === 'lost'
    ? 'NO GANADOR'
    : isSold ? 'VENTA' : 'CANCELADO'

  return (
    <article
      className={`won-entry-card won-entry-card--${entry.outcome}`}
      data-entry-side={entry.side}
      data-result-side={resultSide}
      data-node-id={entry.outcome === 'lost'
        ? '383:14424'
        : entry.outcome === 'canceled' ? '383:14503' : '383:9489'}
    >
      <img className="won-entry-card__light" src={entryCardLight} alt="" aria-hidden="true" />

      <header className="won-entry-card__summary">
        <div className="won-entry-card__payout-row">
          <span className="won-entry-card__payout">
            <span>$</span><strong>{potentialPayout}</strong>
          </span>
          {entry.outcome === 'won' ? (
            <span className="won-entry-card__badge" aria-label="¡GANADOR!">
              <img src={badgeGanhador} alt="" aria-hidden="true" />
              <strong>¡GANADOR!</strong>
            </span>
          ) : (
            <span className="won-entry-card__status-badge">{statusLabel}</span>
          )}
        </div>
        <div className="won-entry-card__summary-details">
          <span>
            Monto:{' '}
            <strong>{amountFormatter.format(entry.amountCents / 100)}</strong>
          </span>
          <span>
            {isSold
              ? `Precio de venta ${Math.round(salePriceCents)}¢`
              : `Precio promedio ${Math.round(averagePriceCents)}¢`}
          </span>
        </div>
      </header>

      <div className="won-entry-card__body">
        <div className="won-entry-card__meta">
          <span>{dateFormatter.format(entry.roundStart)}</span>
          <img src={entrySeparator} alt="" aria-hidden="true" />
          <span>
            {timeFormatter.format(entry.roundStart)} - {timeFormatter.format(entry.roundEnd)}
          </span>
        </div>

        <div className="won-entry-card__position">
          <strong>
            {isSold ? 'VENTA EN' : 'COMPRA EN'}{' '}
            <span className={`open-entry-card__side--${entry.side}`}>
              {entry.side.toUpperCase()}
            </span>
          </strong>
          <span>{participationFormatter.format(entry.participations)} participaciones</span>
        </div>

        <div className="won-entry-card__prices">
          <div className="won-entry-card__target-price">
            <span>Precio objetivo</span>
            <strong>{formatPrice(entry.targetPrice)}</strong>
          </div>
          {!isSold && (
            <div className="won-entry-card__final-price">
              <span>Precio final</span>
              <strong>{formatPrice(entry.finalPrice)}</strong>
            </div>
          )}
          {/* Numa saída antecipada a rodada não tem resultado para indicar, e o
              chevron leria como se o lado da entrada tivesse vencido. */}
          {!isSold && (
            <span className={`won-entry-card__result won-entry-card__result--${resultSide}`}>
              <img
                src={resultSide === 'up' ? iconDoubleChevronsUp : iconDoubleChevronsDown}
                alt={resultSide === 'up' ? 'Resultado arriba' : 'Resultado abajo'}
              />
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

interface OpenEntriesProps {
  position: PrototypeWalletPosition
  costBasis: PrototypeWalletCostBasis
  startTime: string
  endTime: string
  minutes: string
  seconds: string
  targetPrice: number | null
  currentPrice: number | null
  settledEntries: PrototypeWalletSettledEntry[]
  exitingEntry?: OpenEntryExit | null
  onExitEnd?: () => void
  onViewMarket: () => void
  onSell: (side: OutcomeSide) => void
  /** Avisa a troca de aba. Só dispara quando a aba muda de fato. */
  onTabSelect?: (tab: EntriesTab) => void
}

export function OpenEntries({
  position,
  costBasis,
  startTime,
  endTime,
  minutes,
  seconds,
  targetPrice,
  currentPrice,
  settledEntries,
  exitingEntry,
  onExitEnd,
  onViewMarket,
  onSell,
  onTabSelect,
}: OpenEntriesProps) {
  const [activeTab, setActiveTab] = useState<EntriesTab>('open')
  const [tabTransitionPhase, setTabTransitionPhase] = useState<TabTransitionPhase>('idle')
  const [areTabsPinned, setAreTabsPinned] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabSwapTimerRef = useRef<number | null>(null)
  const tabSettleTimerRef = useRef<number | null>(null)
  const liveEntries = getOpenEntrySummaries(position, costBasis)
  // O instantâneo anterior à venda mantém o card na lista enquanto a carteira
  // já está atualizada, e sai da lista só ao fim da animação de saída.
  const heldEntry = exitingEntry
    ? getOpenEntrySummaries(exitingEntry.position, exitingEntry.costBasis)
      .find(({ side }) => side === exitingEntry.side) ?? null
    : null
  const entries = heldEntry
    ? [...liveEntries, heldEntry]
      .toSorted((left, right) => ENTRY_SIDE_ORDER[left.side] - ENTRY_SIDE_ORDER[right.side])
    : liveEntries
  const visibleSettledEntries = ENTRIES_PREVIEW_MODE === 'past'
    ? PAST_ENTRIES_PREVIEW
    : ENTRIES_PREVIEW_MODE === 'won' && settledEntries.length === 0
      ? [WON_ENTRY_PREVIEW]
      : settledEntries
  const wonEntries = getWonEntries(
    visibleSettledEntries,
  )
  const pastEntries = getPastEntries(visibleSettledEntries)
  const visibleEntriesCount = activeTab === 'open'
    ? entries.length
    : activeTab === 'won' ? wonEntries.length : pastEntries.length

  useEffect(() => () => {
    if (tabSwapTimerRef.current !== null) {
      window.clearTimeout(tabSwapTimerRef.current)
    }
    if (tabSettleTimerRef.current !== null) {
      window.clearTimeout(tabSettleTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const updateTabsPinnedState = () => {
      setAreTabsPinned(
        (tabsRef.current?.getBoundingClientRect().top ?? 1) <= 0,
      )
    }

    updateTabsPinnedState()
    window.addEventListener('scroll', updateTabsPinnedState, { passive: true })

    return () => window.removeEventListener('scroll', updateTabsPinnedState)
  }, [])

  const selectTab = (nextTab: EntriesTab) => {
    if (nextTab === activeTab || tabTransitionPhase !== 'idle') return

    onTabSelect?.(nextTab)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActiveTab(nextTab)
      return
    }

    setTabTransitionPhase('out')
    tabSwapTimerRef.current = window.setTimeout(() => {
      tabSwapTimerRef.current = null
      setActiveTab(nextTab)
      setTabTransitionPhase('in')
      tabSettleTimerRef.current = window.setTimeout(() => {
        tabSettleTimerRef.current = null
        setTabTransitionPhase('idle')
      }, TAB_FADE_IN_MS)
    }, TAB_FADE_OUT_MS)
  }

  return (
    <main className="open-entries" data-node-id="383:6851">
      <div
        ref={tabsRef}
        className={`open-entries__tabs open-entries__tabs--${activeTab}${areTabsPinned ? ' open-entries__tabs--pinned' : ''}`}
        role="tablist"
        aria-label="Estados de entradas"
      >
        <button
          className={`open-entries__tab open-entries__tab--with-live${activeTab === 'open' ? ' open-entries__tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'open'}
          onClick={() => selectTab('open')}
        >
          <span className="open-entries__live-indicator-slot">
            <LiveIndicator />
          </span>
          ABIERTAS
        </button>
        <button
          className={`open-entries__tab${activeTab === 'won' ? ' open-entries__tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'won'}
          onClick={() => selectTab('won')}
        >
          GANADAS
        </button>
        <button
          className={`open-entries__tab${activeTab === 'past' ? ' open-entries__tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'past'}
          onClick={() => selectTab('past')}
        >
          PASADAS
        </button>
      </div>

      <div className={`open-entries__list open-entries__list--transition-${tabTransitionPhase}${visibleEntriesCount === 0 ? ' open-entries__list--empty' : ''}`}>
        {activeTab === 'open' && entries.length === 0 && (
          <p className="open-entries__empty">Aún no tienes entradas abiertas</p>
        )}
        {activeTab === 'won' && wonEntries.length === 0 && (
          <p className="open-entries__empty">Aún no tienes entradas ganadas</p>
        )}
        {activeTab === 'past' && pastEntries.length === 0 && (
          <p className="open-entries__empty">Aún no tienes entradas pasadas</p>
        )}
        {activeTab === 'open' && entries.map((entry) => (
          <EntryCard
            entry={entry}
            startTime={startTime}
            endTime={endTime}
            minutes={minutes}
            seconds={seconds}
            targetPrice={targetPrice}
            currentPrice={currentPrice}
            isLeaving={exitingEntry?.isLeaving === true
              && exitingEntry.side === entry.side}
            onLeaveEnd={onExitEnd}
            onViewMarket={onViewMarket}
            onSell={onSell}
            key={entry.side}
          />
        ))}
        {activeTab === 'won' && wonEntries.map((entry) => (
          <SettledEntryCard entry={entry} key={entry.id} />
        ))}
        {activeTab === 'past' && pastEntries.map((entry) => (
          <SettledEntryCard entry={entry} key={entry.id} />
        ))}
      </div>
    </main>
  )
}
