import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { OutcomeSide } from '../services/outcomeMarket'
import {
  applyWalletPurchase,
  applyWalletSale,
  creditWalletEvent,
  createInitialWalletState,
  deserializeWalletState,
  getPendingWalletRoundStarts,
  getWalletCostBasis,
  getWalletPosition,
  LEGACY_PROTOTYPE_WALLET_STORAGE_KEYS,
  PROTOTYPE_WALLET_STORAGE_KEY,
  settleWalletRound,
  type PrototypeWalletState,
  type WalletRoundResultDetails,
  type WalletMutationResult,
  type WalletSettlementResult,
} from '../services/prototypeWallet'

export interface PrototypeWalletPurchase {
  roundStart: number
  side: OutcomeSide
  amount: number
  participations: number
}

export interface PrototypeWalletSale {
  roundStart: number
  side: OutcomeSide
  amountReceived: number
  participations: number
  targetPrice?: number | null
}

const dollarsToCents = (value: number) => Math.round(value * 100)

const persistWalletState = (state: PrototypeWalletState) => {
  try {
    window.localStorage.setItem(
      PROTOTYPE_WALLET_STORAGE_KEY,
      JSON.stringify(state),
    )
  } catch {
    // Persistence is best-effort; the wallet remains functional in memory.
  }
}

const removeStoredWalletStates = () => {
  window.localStorage.removeItem(PROTOTYPE_WALLET_STORAGE_KEY)
  LEGACY_PROTOTYPE_WALLET_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key)
  })
}

const loadWalletState = () => {
  const url = new URL(window.location.href)

  if (url.searchParams.get('resetWallet') === '1') {
    const initialState = createInitialWalletState()

    try {
      removeStoredWalletStates()
      persistWalletState(initialState)
    } catch {
      // The in-memory wallet still resets when storage is unavailable.
    }

    url.searchParams.delete('resetWallet')
    window.history.replaceState(window.history.state, '', url)
    return initialState
  }

  try {
    LEGACY_PROTOTYPE_WALLET_STORAGE_KEYS.forEach((key) => {
      window.localStorage.removeItem(key)
    })
    const state = deserializeWalletState(
      window.localStorage.getItem(PROTOTYPE_WALLET_STORAGE_KEY),
    )

    persistWalletState(state)
    return state
  } catch {
    return createInitialWalletState()
  }
}

export function usePrototypeWallet(currentRoundStart: number) {
  const [state, setState] = useState(loadWalletState)
  const stateRef = useRef(state)

  const commit = useCallback(<Result extends WalletMutationResult>(
    mutation: (current: PrototypeWalletState) => Result,
  ) => {
    const result = mutation(stateRef.current)

    if (result.state !== stateRef.current) {
      stateRef.current = result.state
      setState(result.state)
      persistWalletState(result.state)
    }

    return result
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PROTOTYPE_WALLET_STORAGE_KEY) return

      const nextState = deserializeWalletState(event.newValue)
      stateRef.current = nextState
      setState(nextState)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const purchase = useCallback((input: PrototypeWalletPurchase) => (
    commit((current) => applyWalletPurchase(current, {
      ...input,
      amountCents: dollarsToCents(input.amount),
    }))
  ), [commit])

  const sell = useCallback((input: PrototypeWalletSale) => (
    commit((current) => applyWalletSale(current, {
      ...input,
      amountReceivedCents: dollarsToCents(input.amountReceived),
    }))
  ), [commit])

  const settleRound = useCallback((
    roundStart: number,
    winner: OutcomeSide,
    details?: WalletRoundResultDetails,
  ): WalletSettlementResult => (
    commit((current) => settleWalletRound(current, roundStart, winner, details))
  ), [commit])

  const creditOnce = useCallback((eventId: string, amount: number) => (
    commit((current) => creditWalletEvent(
      current,
      eventId,
      dollarsToCents(amount),
    ))
  ), [commit])

  const currentPosition = useMemo(
    () => getWalletPosition(state, currentRoundStart),
    [currentRoundStart, state],
  )
  const currentCostBasis = useMemo(
    () => getWalletCostBasis(state, currentRoundStart),
    [currentRoundStart, state],
  )
  const pendingRoundStarts = useMemo(
    () => getPendingWalletRoundStarts(state, currentRoundStart),
    [currentRoundStart, state],
  )

  return {
    balanceCents: state.balanceCents,
    creditedEventIds: state.creditedEventIds,
    movements: state.movements,
    currentCostBasis,
    currentPosition,
    pendingRoundStarts,
    settledEntries: state.settledEntries ?? [],
    walletState: state,
    purchase,
    sell,
    settleRound,
    creditOnce,
  }
}
