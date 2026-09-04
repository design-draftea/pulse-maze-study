import type { OutcomeSide } from './outcomeMarket'

export const PROTOTYPE_WALLET_STORAGE_KEY = 'pulse.prototype-wallet.v4'
export const LEGACY_PROTOTYPE_WALLET_STORAGE_KEYS = [
  'pulse.prototype-wallet.v1',
  'pulse.prototype-wallet.v2',
  'pulse.prototype-wallet.v3',
] as const
// A v4 acrescenta participações e saldo resultante a cada movimento. Estados
// da v3 não têm esses campos e não permitem derivá-los com segurança: duas
// compras na mesma rodada e lado colapsam numa única entrada liquidada, então
// o rateio ficaria arbitrário. Como o histórico é simulado, a virada de versão
// recarrega o seed completo em vez de migrar pela metade.
export const PROTOTYPE_WALLET_VERSION = 4
export const INITIAL_DEPOSIT_CENTS = 200_000
export const SEEDED_AVAILABLE_BALANCE_CENTS = 204_000

const MAX_CREDIT_EVENT_IDS = 100
const MAX_MOVEMENTS = 100
const MAX_SETTLED_ENTRIES = 100
const PARTICIPATION_EPSILON = 1e-8
const INITIAL_DEPOSIT_MOVEMENT_ID = 'initial-deposit'
const ROUND_DURATION_MS = 15 * 60 * 1000
const SEEDED_PURCHASE_DELAY_MS = 2 * 60 * 1000

interface SeededEntryDefinition {
  daysAgo: number
  hour: number
  minute: number
  side: OutcomeSide
  outcome: 'won' | 'lost'
  amountCents: number
  participations: number
  payoutCents: number
  targetPrice: number
  finalPrice: number
}

const SEEDED_ENTRY_DEFINITIONS = [
  {
    daysAgo: 3,
    hour: 10,
    minute: 0,
    side: 'up',
    outcome: 'won',
    amountCents: 10_000,
    participations: 160,
    payoutCents: 16_000,
    targetPrice: 80_014.42,
    finalPrice: 80_031.15,
  },
  {
    daysAgo: 2,
    hour: 15,
    minute: 15,
    side: 'down',
    outcome: 'lost',
    amountCents: 6_000,
    participations: 75,
    payoutCents: 0,
    targetPrice: 80_214.63,
    finalPrice: 80_236.19,
  },
  {
    daysAgo: 1,
    hour: 9,
    minute: 30,
    side: 'down',
    outcome: 'won',
    amountCents: 12_000,
    participations: 200,
    payoutCents: 20_000,
    targetPrice: 80_327.58,
    finalPrice: 80_294.11,
  },
  {
    daysAgo: 1,
    hour: 16,
    minute: 45,
    side: 'up',
    outcome: 'lost',
    amountCents: 4_000,
    participations: 100,
    payoutCents: 0,
    targetPrice: 80_266.34,
    finalPrice: 80_252.91,
  },
] as const satisfies readonly SeededEntryDefinition[]

export type WalletMovementType =
  | 'deposit'
  | 'withdrawal'
  | 'purchase'
  | 'sale'
  | 'win'
  | 'cancellation'

export interface PrototypeWalletMovement {
  id: string
  type: WalletMovementType
  amountCents: number
  occurredAt: number
  roundStart?: number
  side?: OutcomeSide
  // Participações movimentadas, quando a operação envolve posição. Permite
  // exibir o que foi comprado ou vendido, e não apenas quanto custou.
  participations?: number
  // Saldo logo após o movimento, para o histórico ser reconciliável linha a
  // linha. Opcional porque estados persistidos antes deste campo não o têm.
  balanceAfterCents?: number
}

export interface PrototypeWalletPosition {
  up: number
  down: number
}

export interface PrototypeWalletCostBasis {
  up: number
  down: number
}

export interface PrototypeWalletSettledEntry {
  id: string
  roundStart: number
  roundEnd: number
  side: OutcomeSide
  outcome: 'won' | 'lost' | 'canceled' | 'sold'
  amountCents: number
  participations: number
  payoutCents: number
  targetPrice: number | null
  finalPrice: number | null
}

export interface PrototypeWalletState {
  version: typeof PROTOTYPE_WALLET_VERSION
  balanceCents: number
  positionsByRound: Record<string, PrototypeWalletPosition>
  costBasisCentsByRound: Record<string, PrototypeWalletCostBasis>
  totalPurchasesCents: number
  totalReceivedCents: number
  creditedEventIds: string[]
  movements: PrototypeWalletMovement[]
  settledEntries: PrototypeWalletSettledEntry[]
  revision: number
  updatedAt: number
}

export interface PrototypeWalletProfileMetrics {
  availableBalanceCents: number
  portfolioTotalCents: number
  totalPurchasesCents: number
  openEntriesCents: number
  totalReceivedCents: number
  netResultCents: number
}

export interface WalletMutationResult {
  state: PrototypeWalletState
  applied: boolean
  balanceDeltaCents: number
}

export interface WalletSettlementResult extends WalletMutationResult {
  payoutCents: number
}

export interface WalletRoundResultDetails {
  roundEnd?: number
  targetPrice?: number | null
  finalPrice?: number | null
}

interface WalletPurchase {
  roundStart: number
  side: OutcomeSide
  amountCents: number
  participations: number
}

interface WalletSale {
  roundStart: number
  side: OutcomeSide
  amountReceivedCents: number
  participations: number
  targetPrice?: number | null
}

const emptyPosition = (): PrototypeWalletPosition => ({ up: 0, down: 0 })
const emptyCostBasis = (): PrototypeWalletCostBasis => ({ up: 0, down: 0 })

const isNonNegativeFinite = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
)

const isNonNegativeInteger = (value: unknown): value is number => (
  Number.isInteger(value) && isNonNegativeFinite(value)
)

const isValidRoundStart = (value: number) => (
  Number.isInteger(value) && value > 0
)

const isWalletMovementType = (value: unknown): value is WalletMovementType => (
  value === 'deposit'
  || value === 'withdrawal'
  || value === 'purchase'
  || value === 'sale'
  || value === 'win'
  || value === 'cancellation'
)

const hasValidMovementAmount = (
  type: WalletMovementType,
  amountCents: number,
) => (
  type === 'purchase' || type === 'withdrawal'
    ? amountCents < 0
    : amountCents > 0
)

const createInitialDepositMovement = (
  occurredAt: number,
): PrototypeWalletMovement => ({
  id: INITIAL_DEPOSIT_MOVEMENT_ID,
  type: 'deposit',
  amountCents: INITIAL_DEPOSIT_CENTS,
  occurredAt,
  balanceAfterCents: INITIAL_DEPOSIT_CENTS,
})

const getRelativeLocalTimestamp = (
  createdAt: number,
  daysAgo: number,
  hour: number,
  minute: number,
) => {
  const date = new Date(createdAt)

  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

const createSeededWalletHistory = (createdAt: number) => {
  const settledEntries: PrototypeWalletSettledEntry[] = SEEDED_ENTRY_DEFINITIONS
    .map((definition) => {
      const roundStart = getRelativeLocalTimestamp(
        createdAt,
        definition.daysAgo,
        definition.hour,
        definition.minute,
      )

      return {
        id: `seed-entry:${roundStart}:${definition.side}`,
        roundStart,
        roundEnd: roundStart + ROUND_DURATION_MS,
        side: definition.side,
        outcome: definition.outcome,
        amountCents: definition.amountCents,
        participations: definition.participations,
        payoutCents: definition.payoutCents,
        targetPrice: definition.targetPrice,
        finalPrice: definition.finalPrice,
      }
    })
  const depositOccurredAt = getRelativeLocalTimestamp(createdAt, 4, 9, 0)
  const movements = [
    createInitialDepositMovement(depositOccurredAt),
    ...settledEntries.flatMap((entry): PrototypeWalletMovement[] => [
      {
        id: `seed-purchase:${entry.roundStart}:${entry.side}`,
        type: 'purchase',
        amountCents: -entry.amountCents,
        occurredAt: entry.roundStart + SEEDED_PURCHASE_DELAY_MS,
        roundStart: entry.roundStart,
        side: entry.side,
        participations: entry.participations,
      },
      ...(entry.outcome === 'won'
        ? [{
            id: `seed-win:${entry.roundStart}:${entry.side}`,
            type: 'win' as const,
            amountCents: entry.payoutCents,
            occurredAt: entry.roundEnd,
            roundStart: entry.roundStart,
            side: entry.side,
            participations: entry.participations,
          }]
        : []),
    ]),
  ]
    .sort((left, right) => left.occurredAt - right.occurredAt)
    // O saldo de cada linha é acumulado depois da ordenação, para o histórico
    // da persona fechar na mesma sequência em que é exibido.
    .reduce<{ balanceCents: number; movements: PrototypeWalletMovement[] }>(
      (accumulated, movement) => {
        const balanceCents = accumulated.balanceCents + movement.amountCents

        accumulated.movements.push({ ...movement, balanceAfterCents: balanceCents })
        return { balanceCents, movements: accumulated.movements }
      },
      { balanceCents: 0, movements: [] },
    ).movements
  const totalPurchasesCents = settledEntries.reduce(
    (total, entry) => total + entry.amountCents,
    0,
  )
  const totalReceivedCents = settledEntries.reduce(
    (total, entry) => total + entry.payoutCents,
    0,
  )

  return {
    balanceCents: INITIAL_DEPOSIT_CENTS
      - totalPurchasesCents
      + totalReceivedCents,
    movements,
    settledEntries,
    totalPurchasesCents,
    totalReceivedCents,
  }
}

const normalizeMovement = (
  value: unknown,
): PrototypeWalletMovement | null => {
  if (typeof value !== 'object' || value === null) return null

  const movement = value as Partial<PrototypeWalletMovement>

  if (
    typeof movement.id !== 'string'
    || movement.id.length === 0
    || !isWalletMovementType(movement.type)
    || typeof movement.amountCents !== 'number'
    || !Number.isInteger(movement.amountCents)
    || !hasValidMovementAmount(movement.type, movement.amountCents)
    || !isNonNegativeFinite(movement.occurredAt)
    || (
      movement.roundStart !== undefined
      && !isValidRoundStart(movement.roundStart)
    )
    || (
      movement.side !== undefined
      && movement.side !== 'up'
      && movement.side !== 'down'
    )
    || (
      movement.participations !== undefined
      && !(isNonNegativeFinite(movement.participations)
        && movement.participations > 0)
    )
    || (
      movement.balanceAfterCents !== undefined
      && !isNonNegativeInteger(movement.balanceAfterCents)
    )
  ) {
    return null
  }

  return {
    id: movement.id,
    type: movement.type,
    amountCents: movement.amountCents,
    occurredAt: movement.occurredAt,
    ...(movement.roundStart === undefined
      ? {}
      : { roundStart: movement.roundStart }),
    ...(movement.side === undefined ? {} : { side: movement.side }),
    ...(movement.participations === undefined
      ? {}
      : { participations: movement.participations }),
    ...(movement.balanceAfterCents === undefined
      ? {}
      : { balanceAfterCents: movement.balanceAfterCents }),
  }
}

const normalizeMovements = (
  values: unknown,
  fallbackInitialDepositOccurredAt: number,
) => {
  const parsedMovements = Array.isArray(values)
    ? values
      .map(normalizeMovement)
      .filter((movement): movement is PrototypeWalletMovement => movement !== null)
    : []
  const initialDeposit = parsedMovements.find(
    ({ id }) => id === INITIAL_DEPOSIT_MOVEMENT_ID,
  )
  const normalized = parsedMovements.filter(
    ({ id }) => id !== INITIAL_DEPOSIT_MOVEMENT_ID,
  )
  const unique = normalized.filter((movement, index, movements) => (
    movements.findLastIndex(({ id }) => id === movement.id) === index
  ))

  return [
    createInitialDepositMovement(
      initialDeposit?.occurredAt ?? fallbackInitialDepositOccurredAt,
    ),
    ...unique.slice(-(MAX_MOVEMENTS - 1)),
  ]
}

const appendMovement = (
  state: PrototypeWalletState,
  movement: PrototypeWalletMovement,
) => normalizeMovements(
  [...state.movements, movement],
  state.movements[0]?.occurredAt ?? state.updatedAt,
)

const nextCreditEventIds = (eventIds: string[], eventId: string) => (
  [...eventIds.filter((value) => value !== eventId), eventId]
    .slice(-MAX_CREDIT_EVENT_IDS)
)

const updateWallet = (
  state: PrototypeWalletState,
  update: Partial<Pick<
    PrototypeWalletState,
    | 'balanceCents'
    | 'positionsByRound'
    | 'costBasisCentsByRound'
    | 'totalPurchasesCents'
    | 'totalReceivedCents'
    | 'creditedEventIds'
    | 'movements'
    | 'settledEntries'
  >>,
): PrototypeWalletState => ({
  ...state,
  ...update,
  revision: state.revision + 1,
  updatedAt: Date.now(),
})

export const createInitialWalletState = (): PrototypeWalletState => {
  const createdAt = Date.now()
  const seededHistory = createSeededWalletHistory(createdAt)

  return {
    version: PROTOTYPE_WALLET_VERSION,
    balanceCents: seededHistory.balanceCents,
    positionsByRound: {},
    costBasisCentsByRound: {},
    totalPurchasesCents: seededHistory.totalPurchasesCents,
    totalReceivedCents: seededHistory.totalReceivedCents,
    creditedEventIds: [],
    movements: seededHistory.movements,
    settledEntries: seededHistory.settledEntries,
    revision: 0,
    updatedAt: createdAt,
  }
}

export const deserializeWalletState = (
  serialized: string | null,
): PrototypeWalletState => {
  if (!serialized) return createInitialWalletState()

  try {
    const parsed = JSON.parse(serialized) as Partial<PrototypeWalletState>

    if (
      parsed.version !== PROTOTYPE_WALLET_VERSION
      || !Number.isInteger(parsed.balanceCents)
      || !isNonNegativeFinite(parsed.balanceCents)
      || typeof parsed.positionsByRound !== 'object'
      || parsed.positionsByRound === null
      || typeof parsed.costBasisCentsByRound !== 'object'
      || parsed.costBasisCentsByRound === null
      || !isNonNegativeInteger(parsed.totalPurchasesCents)
      || !isNonNegativeInteger(parsed.totalReceivedCents)
      || !Array.isArray(parsed.creditedEventIds)
      || !Number.isInteger(parsed.revision)
      || !isNonNegativeFinite(parsed.revision)
      || !isNonNegativeFinite(parsed.updatedAt)
    ) {
      return createInitialWalletState()
    }

    const positionsByRound = Object.entries(parsed.positionsByRound)
      .reduce<Record<string, PrototypeWalletPosition>>((positions, [key, value]) => {
        const roundStart = Number(key)
        const position = value as Partial<PrototypeWalletPosition>

        if (
          !isValidRoundStart(roundStart)
          || !isNonNegativeFinite(position.up)
          || !isNonNegativeFinite(position.down)
          || (position.up <= PARTICIPATION_EPSILON
            && position.down <= PARTICIPATION_EPSILON)
        ) {
          return positions
        }

        positions[key] = {
          up: position.up,
          down: position.down,
        }
        return positions
      }, {})
    const creditedEventIds = [...new Set(
      parsed.creditedEventIds.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
    )].slice(-MAX_CREDIT_EVENT_IDS)
    const costBasisCentsByRound = Object.entries(positionsByRound)
      .reduce<Record<string, PrototypeWalletCostBasis>>((costBasis, [key]) => {
        const value = parsed.costBasisCentsByRound?.[key] as Partial<PrototypeWalletCostBasis> | undefined

        if (
          !value
          || !isNonNegativeInteger(value.up)
          || !isNonNegativeInteger(value.down)
        ) {
          return costBasis
        }

        costBasis[key] = {
          up: value.up,
          down: value.down,
        }
        return costBasis
      }, {})

    if (Object.keys(costBasisCentsByRound).length !== Object.keys(positionsByRound).length) {
      return createInitialWalletState()
    }
    const movements = normalizeMovements(parsed.movements, parsed.updatedAt)
    const settledEntries: PrototypeWalletSettledEntry[] = Array.isArray(
      parsed.settledEntries,
    ) ? parsed.settledEntries.flatMap((rawEntry) => {
        const entry = rawEntry as Partial<PrototypeWalletSettledEntry>
        const hasValidPrices = (
          (entry.targetPrice === null
            || (typeof entry.targetPrice === 'number'
              && Number.isFinite(entry.targetPrice)
              && entry.targetPrice > 0))
          && (entry.finalPrice === null
            || (typeof entry.finalPrice === 'number'
              && Number.isFinite(entry.finalPrice)
              && entry.finalPrice > 0))
        )

        if (
          typeof entry.id !== 'string'
          || entry.id.length === 0
          || !isValidRoundStart(entry.roundStart ?? 0)
          || !Number.isInteger(entry.roundEnd)
          || (entry.roundEnd ?? 0) <= (entry.roundStart ?? 0)
          || (entry.side !== 'up' && entry.side !== 'down')
          || (
            entry.outcome !== 'won'
            && entry.outcome !== 'lost'
            && entry.outcome !== 'canceled'
            && entry.outcome !== 'sold'
          )
          || !isNonNegativeInteger(entry.amountCents)
          || !isNonNegativeFinite(entry.participations)
          || (entry.participations ?? 0) <= PARTICIPATION_EPSILON
          || !isNonNegativeInteger(entry.payoutCents)
          || !hasValidPrices
        ) return []

        return [{
          id: entry.id,
          roundStart: entry.roundStart,
          roundEnd: entry.roundEnd,
          side: entry.side,
          outcome: entry.outcome,
          amountCents: entry.amountCents,
          participations: entry.participations,
          payoutCents: entry.payoutCents,
          targetPrice: entry.targetPrice,
          finalPrice: entry.finalPrice,
        } as PrototypeWalletSettledEntry]
      }).filter((entry, index, entries) => (
        entries.findIndex(({ id }) => id === entry.id) === index
      )).slice(-MAX_SETTLED_ENTRIES)
      : []

    return {
      version: PROTOTYPE_WALLET_VERSION,
      balanceCents: parsed.balanceCents,
      positionsByRound,
      costBasisCentsByRound,
      totalPurchasesCents: parsed.totalPurchasesCents,
      totalReceivedCents: parsed.totalReceivedCents,
      creditedEventIds,
      movements,
      settledEntries,
      revision: parsed.revision,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return createInitialWalletState()
  }
}

export const getWalletPosition = (
  state: PrototypeWalletState,
  roundStart: number,
): PrototypeWalletPosition => (
  state.positionsByRound[String(roundStart)] ?? emptyPosition()
)

export const getWalletCostBasis = (
  state: PrototypeWalletState,
  roundStart: number,
): PrototypeWalletCostBasis => (
  state.costBasisCentsByRound[String(roundStart)] ?? emptyCostBasis()
)

export const getWalletProfileMetrics = (
  state: PrototypeWalletState,
  currentRoundStart: number,
  currentRoundMarketValueCents: number | null,
): PrototypeWalletProfileMetrics => {
  const currentRoundKey = String(currentRoundStart)
  const currentRoundCostBasis = state.costBasisCentsByRound[currentRoundKey]
  const currentRoundFallbackCents = currentRoundCostBasis
    ? currentRoundCostBasis.up + currentRoundCostBasis.down
    : 0
  const currentRoundValueCents = isNonNegativeInteger(currentRoundMarketValueCents)
    ? currentRoundMarketValueCents
    : currentRoundFallbackCents
  const pendingEntriesCents = Object.entries(state.costBasisCentsByRound)
    .reduce((total, [roundKey, costBasis]) => (
      roundKey === currentRoundKey
        ? total
        : total + costBasis.up + costBasis.down
    ), 0)
  const openEntriesCents = currentRoundValueCents + pendingEntriesCents
  const portfolioTotalCents = state.balanceCents + openEntriesCents

  return {
    availableBalanceCents: state.balanceCents,
    portfolioTotalCents,
    totalPurchasesCents: state.totalPurchasesCents,
    openEntriesCents,
    totalReceivedCents: state.totalReceivedCents,
    netResultCents: portfolioTotalCents - INITIAL_DEPOSIT_CENTS,
  }
}

export const getPendingWalletRoundStarts = (
  state: PrototypeWalletState,
  currentRoundStart: number,
) => Object.keys(state.positionsByRound)
  .map(Number)
  .filter((roundStart) => (
    isValidRoundStart(roundStart) && roundStart < currentRoundStart
  ))
  .sort((first, second) => first - second)

export const applyWalletPurchase = (
  state: PrototypeWalletState,
  purchase: WalletPurchase,
): WalletMutationResult => {
  const {
    roundStart,
    side,
    amountCents,
    participations,
  } = purchase

  if (
    !isValidRoundStart(roundStart)
    || !Number.isInteger(amountCents)
    || amountCents <= 0
    || amountCents > state.balanceCents
    || !Number.isFinite(participations)
    || participations <= 0
  ) {
    return { state, applied: false, balanceDeltaCents: 0 }
  }

  const key = String(roundStart)
  const position = getWalletPosition(state, roundStart)
  const costBasis = getWalletCostBasis(state, roundStart)
  const positionsByRound = {
    ...state.positionsByRound,
    [key]: {
      ...position,
      [side]: position[side] + participations,
    },
  }
  const costBasisCentsByRound = {
    ...state.costBasisCentsByRound,
    [key]: {
      ...costBasis,
      [side]: costBasis[side] + amountCents,
    },
  }
  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents - amountCents,
    positionsByRound,
    costBasisCentsByRound,
    totalPurchasesCents: state.totalPurchasesCents + amountCents,
    movements: appendMovement(state, {
      id: `purchase:${roundStart}:${side}:${state.revision + 1}`,
      type: 'purchase',
      amountCents: -amountCents,
      occurredAt: Date.now(),
      roundStart,
      side,
      participations,
      balanceAfterCents: state.balanceCents - amountCents,
    }),
  })

  return {
    state: nextState,
    applied: true,
    balanceDeltaCents: -amountCents,
  }
}

export const applyWalletSale = (
  state: PrototypeWalletState,
  sale: WalletSale,
): WalletMutationResult => {
  const {
    roundStart,
    side,
    amountReceivedCents,
    participations,
    targetPrice = null,
  } = sale
  const key = String(roundStart)
  const position = getWalletPosition(state, roundStart)
  const costBasis = getWalletCostBasis(state, roundStart)

  if (
    !isValidRoundStart(roundStart)
    || !Number.isInteger(amountReceivedCents)
    || amountReceivedCents < 0
    || !Number.isFinite(participations)
    || participations <= 0
    || participations > position[side] + PARTICIPATION_EPSILON
  ) {
    return { state, applied: false, balanceDeltaCents: 0 }
  }

  const remainingPosition = {
    ...position,
    [side]: Math.max(0, position[side] - participations),
  }
  const positionsByRound = { ...state.positionsByRound }
  const costBasisCentsByRound = { ...state.costBasisCentsByRound }
  const soldRatio = Math.min(1, participations / position[side])
  const soldCostBasisCents = Math.round(costBasis[side] * soldRatio)
  const remainingCostBasis = {
    ...costBasis,
    [side]: Math.max(0, costBasis[side] - soldCostBasisCents),
  }

  if (
    remainingPosition.up <= PARTICIPATION_EPSILON
    && remainingPosition.down <= PARTICIPATION_EPSILON
  ) {
    delete positionsByRound[key]
    delete costBasisCentsByRound[key]
  } else {
    positionsByRound[key] = remainingPosition
    costBasisCentsByRound[key] = remainingCostBasis
  }

  // Toda venda entra no histórico, inclusive a parcial: o dinheiro já foi
  // realizado. Vendas sucessivas da mesma rodada e lado acumulam numa única
  // entrada, senão a última sobrescreveria as anteriores e o card mostraria só
  // o último pedaço. O preço de venta exibido vira a média ponderada.
  const soldEntryId = `${roundStart}:${side}:sold`
  const previousSold = state.settledEntries.find(({ id }) => id === soldEntryId)
  const resolvedTargetPrice = isNonNegativeFinite(targetPrice) && targetPrice > 0
    ? targetPrice
    : previousSold?.targetPrice ?? null
  const soldEntry: PrototypeWalletSettledEntry = {
    id: soldEntryId,
    roundStart,
    roundEnd: roundStart + ROUND_DURATION_MS,
    side,
    outcome: 'sold',
    amountCents: (previousSold?.amountCents ?? 0) + soldCostBasisCents,
    participations: (previousSold?.participations ?? 0) + participations,
    payoutCents: (previousSold?.payoutCents ?? 0) + amountReceivedCents,
    targetPrice: resolvedTargetPrice,
    // A pessoa saiu antes do encerramento, então não existe preço final.
    finalPrice: null,
  }

  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents + amountReceivedCents,
    positionsByRound,
    costBasisCentsByRound,
    totalReceivedCents: state.totalReceivedCents + amountReceivedCents,
    settledEntries: [
      ...state.settledEntries.filter(({ id }) => id !== soldEntry.id),
      soldEntry,
    ].slice(-MAX_SETTLED_ENTRIES),
    movements: appendMovement(state, {
      id: `sale:${roundStart}:${side}:${state.revision + 1}`,
      type: 'sale',
      amountCents: amountReceivedCents,
      occurredAt: Date.now(),
      roundStart,
      side,
      participations,
      balanceAfterCents: state.balanceCents + amountReceivedCents,
    }),
  })

  return {
    state: nextState,
    applied: true,
    balanceDeltaCents: amountReceivedCents,
  }
}

export const settleWalletRound = (
  state: PrototypeWalletState,
  roundStart: number,
  winner: OutcomeSide,
  details: WalletRoundResultDetails = {},
): WalletSettlementResult => {
  const key = String(roundStart)
  const eventId = `round:${roundStart}`
  const position = state.positionsByRound[key]

  if (!position) {
    return {
      state,
      applied: false,
      balanceDeltaCents: 0,
      payoutCents: 0,
    }
  }

  const positionsByRound = { ...state.positionsByRound }
  const costBasis = getWalletCostBasis(state, roundStart)
  const costBasisCentsByRound = { ...state.costBasisCentsByRound }
  delete positionsByRound[key]
  delete costBasisCentsByRound[key]

  if (state.creditedEventIds.includes(eventId)) {
    const nextState = updateWallet(state, {
      balanceCents: state.balanceCents,
      positionsByRound,
      costBasisCentsByRound,
      movements: state.movements,
    })

    return {
      state: nextState,
      applied: false,
      balanceDeltaCents: 0,
      payoutCents: 0,
    }
  }

  const payoutCents = Math.max(0, Math.round(position[winner] * 100))
  const roundEnd = Number.isInteger(details.roundEnd)
    && (details.roundEnd ?? 0) > roundStart
    ? details.roundEnd as number
    : roundStart + ROUND_DURATION_MS
  const targetPrice = typeof details.targetPrice === 'number'
    && Number.isFinite(details.targetPrice)
    && details.targetPrice > 0
    ? details.targetPrice
    : null
  const finalPrice = typeof details.finalPrice === 'number'
    && Number.isFinite(details.finalPrice)
    && details.finalPrice > 0
    ? details.finalPrice
    : null
  const settledEntries = (['down', 'up'] as const).flatMap((side) => {
    if (position[side] <= PARTICIPATION_EPSILON) return []

    return [{
      id: `${roundStart}:${side}`,
      roundStart,
      roundEnd,
      side,
      outcome: side === winner ? 'won' as const : 'lost' as const,
      amountCents: costBasis[side],
      participations: position[side],
      payoutCents: side === winner
        ? Math.max(0, Math.round(position[side] * 100))
        : 0,
      targetPrice,
      finalPrice,
    }]
  })
  const nextSettledEntries = [
    ...(state.settledEntries ?? []).filter((entry) => (
      settledEntries.every(({ id }) => id !== entry.id)
    )),
    ...settledEntries,
  ].slice(-MAX_SETTLED_ENTRIES)
  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents + payoutCents,
    positionsByRound,
    costBasisCentsByRound,
    totalReceivedCents: state.totalReceivedCents + payoutCents,
    creditedEventIds: nextCreditEventIds(
      state.creditedEventIds,
      eventId,
    ),
    movements: payoutCents > 0
      ? appendMovement(state, {
        id: `win:${roundStart}`,
        type: 'win',
        amountCents: payoutCents,
        occurredAt: Date.now(),
        roundStart,
        side: winner,
        participations: position[winner],
        balanceAfterCents: state.balanceCents + payoutCents,
      })
      : state.movements,
    settledEntries: nextSettledEntries,
  })

  return {
    state: nextState,
    applied: true,
    balanceDeltaCents: payoutCents,
    payoutCents,
  }
}

export const creditWalletEvent = (
  state: PrototypeWalletState,
  eventId: string,
  amountCents: number,
): WalletMutationResult => {
  if (
    !eventId
    || state.creditedEventIds.includes(eventId)
    || !Number.isInteger(amountCents)
    || amountCents <= 0
  ) {
    return { state, applied: false, balanceDeltaCents: 0 }
  }

  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents + amountCents,
    totalReceivedCents: state.totalReceivedCents + amountCents,
    creditedEventIds: nextCreditEventIds(
      state.creditedEventIds,
      eventId,
    ),
    movements: appendMovement(state, {
      id: `win:${eventId}`,
      type: 'win',
      amountCents,
      occurredAt: Date.now(),
      balanceAfterCents: state.balanceCents + amountCents,
    }),
  })

  return {
    state: nextState,
    applied: true,
    balanceDeltaCents: amountCents,
  }
}
