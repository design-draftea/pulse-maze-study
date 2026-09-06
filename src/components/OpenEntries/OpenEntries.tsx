import { useEffect, useRef, useState } from 'react'
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
import { OpenEntryCard, SettledEntryCard } from './EntryCards'
import './OpenEntries.css'

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
    id: 'preview-sold-entry',
    roundStart: new Date(2026, 8, 1, 9, 30).getTime(),
    roundEnd: new Date(2026, 8, 1, 9, 45).getTime(),
    side: 'up',
    outcome: 'sold',
    amountCents: 20_000,
    participations: 298.51,
    payoutCents: 20_000,
    finalPrice: null,
  },
  {
    ...WON_ENTRY_PREVIEW,
    id: 'preview-canceled-entry',
    roundStart: new Date(2026, 8, 1, 9, 15).getTime(),
    roundEnd: new Date(2026, 8, 1, 9, 30).getTime(),
    outcome: 'canceled',
    payoutCents: 0,
    finalPrice: 80_195.64,
  },
]
const ENTRY_SIDE_ORDER: Record<OutcomeSide, number> = { down: 0, up: 1 }
const OPEN_ENTRIES_PREVIEW: OpenEntrySummary[] = [
  {
    side: 'down',
    participations: 588.24,
    amountCents: 20_000,
    averagePriceCents: 34,
    potentialPayoutCents: 58_824,
  },
  {
    side: 'up',
    participations: 588.24,
    amountCents: 20_000,
    averagePriceCents: 34,
    potentialPayoutCents: 58_824,
  },
]

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
  const liveEntries = ENTRIES_PREVIEW_MODE === 'open'
    ? OPEN_ENTRIES_PREVIEW
    : getOpenEntrySummaries(position, costBasis)
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
          <OpenEntryCard
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
