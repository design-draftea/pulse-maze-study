import { getOpenEntrySummaries } from './openEntries.ts'
import type { OutcomeSide } from './outcomeMarket'
import {
  getPositionSide,
  hasAnyPosition,
  hasLivePrices,
  type HelpAssistantLiveSnapshot,
} from './helpAssistantSnapshot.ts'
import {
  ACTION_LABELS,
  type HelpAssistantHighlight,
  type HelpAssistantResult,
} from './helpAssistantTypes.ts'

/**
 * Respostas calculadas a partir do estado real do protótipo.
 *
 * Regra central: nenhum número aqui é estimado ou inventado. Ou o dado existe
 * no instantâneo e a resposta o usa, ou a resposta diz que o dado não está
 * disponível. As cotações vêm das mesmas funções que o betslip usa, então o
 * número do chat é o mesmo que a compra apresentaria.
 */

const MAX_SIMULATION_CENTS = 9_999_999

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const signedMoneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})
const participationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const clockFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * Acompanhamentos oferecidos depois de uma resposta com dados ao vivo.
 *
 * Cada `query` precisa resolver em conteúdo de alta confiança: um chip que cai
 * no fallback é pior do que nenhum chip. `tests/helpAssistantLive.test.ts`
 * percorre este mapa e falha se algum deixar de resolver.
 */
export const FOLLOW_UPS = {
  amountLimits: {
    id: 'follow-up:amount-limits',
    label: '¿Cuál es el monto mínimo?',
    query: '¿Cuál es el monto mínimo?',
  },
  canLose: {
    id: 'follow-up:can-i-lose',
    label: '¿Puedo perder el monto?',
    query: '¿Puedo perder el monto que utilicé?',
  },
  canSell: {
    id: 'follow-up:can-sell',
    label: '¿Puedo vender antes?',
    query: '¿Puedo vender mi participación antes de que termine la ronda?',
  },
  howToStart: {
    id: 'follow-up:how-to-start',
    label: '¿Cómo empiezo?',
    query: '¿Cómo empiezo?',
  },
  impliedProbability: {
    id: 'follow-up:implied-probability',
    label: '¿Cómo se calcula ese porcentaje?',
    query: '¿Qué es la probabilidad implícita?',
  },
  liveProbability: {
    id: 'follow-up:live-probability',
    label: '¿Qué probabilidad hay ahora?',
    query: '¿Cuál es la probabilidad de que yo gane?',
  },
  participation: {
    id: 'follow-up:participation',
    label: '¿Qué es una participación?',
    query: '¿Qué es una participación?',
  },
  potentialReturn: {
    id: 'follow-up:potential-return',
    label: '¿Qué es el retorno potencial?',
    query: '¿Qué es el retorno potencial?',
  },
  roundWorks: {
    id: 'follow-up:round-works',
    label: '¿Cómo funciona una ronda?',
    query: '¿Cómo funciona una ronda de 15 minutos?',
  },
  settlement: {
    id: 'follow-up:settlement',
    label: '¿Cuándo me pagan?',
    query: '¿Cuándo me pagan?',
  },
  targetPrice: {
    id: 'follow-up:target-price',
    label: '¿Qué es el precio objetivo?',
    query: '¿Qué es el precio objetivo?',
  },
} as const

const SIDE_LABEL: Record<OutcomeSide, string> = { up: 'UP', down: 'DOWN' }
const SIDE_DIRECTION: Record<OutcomeSide, string> = {
  up: 'arriba',
  down: 'abajo',
}

const formatMoney = (value: number) => moneyFormatter.format(value)
const formatCents = (cents: number) => moneyFormatter.format(cents / 100)
const formatSignedCents = (cents: number) => signedMoneyFormatter.format(cents / 100)
const formatParticipations = (value: number) => participationFormatter.format(value)
const formatSharePrice = (price: number) => moneyFormatter.format(price)
/** Mesmo arredondamento do `MarketChoice`, para o chat e a Home nunca divergirem. */
const formatImpliedPercent = (price: number) => `${Math.round(price * 100)}%`

const formatClock = (timestamp: number) => clockFormatter.format(timestamp)

const formatRemaining = (remainingSeconds: number) => {
  const safeSeconds = Math.max(0, remainingSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const liveSource = (id: string, label: string) => ({
  id,
  label: `Datos en vivo · ${label}`,
  type: 'live' as const,
})

const priceHighlight = (
  snapshot: HelpAssistantLiveSnapshot,
): HelpAssistantHighlight | undefined => {
  if (!hasLivePrices(snapshot)) return undefined

  return {
    items: [
      { label: 'UP', side: 'up', value: formatImpliedPercent(snapshot.market.prices.up) },
      { label: 'DOWN', side: 'down', value: formatImpliedPercent(snapshot.market.prices.down) },
    ],
    timeLabel: formatClock(snapshot.now),
  }
}

/** Frase reutilizada pela guarda de uso responsável e pelas respostas de preço. */
export const describeMarketPrices = (snapshot: HelpAssistantLiveSnapshot) => {
  if (!hasLivePrices(snapshot)) return null

  const { up, down } = snapshot.market.prices
  return `UP a ${formatSharePrice(up)} (${formatImpliedPercent(up)}) y DOWN a ${formatSharePrice(down)} (${formatImpliedPercent(down)})`
}

const pricesUnavailableResult = (
  id: string,
  label: string,
): HelpAssistantResult => ({
  answer: 'Ahora no tengo el precio de UP y DOWN, así que no puedo darte un número de esta ronda. El porcentaje que aparece en UP y DOWN es la probabilidad implícita del mercado: una participación que cuesta $0.62 paga US$1 si acierta.',
  confidence: 'high',
  details: ['Vuelve a preguntarme en unos segundos, cuando el precio esté disponible.'],
  source: liveSource(id, label),
  suggestions: [FOLLOW_UPS.impliedProbability],
})

// ---------------------------------------------------------------------------
// Leitura de monto e de lado
// ---------------------------------------------------------------------------

const WORD_AMOUNTS: Record<string, number> = {
  un: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  quince: 15,
  veinte: 20,
  veinticinco: 25,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  quinientos: 500,
  mil: 1_000,
}

/** Unidades que provam que o número não é dinheiro: `15 minutos`, `10 rondas`. */
const NON_AMOUNT_UNIT = /^\s*(?:%|(?:por\s+ciento|porciento|minutos?|mins?|segundos?|segs?|horas?|dias?|rondas?|participaciones?|participacion|veces|vez)\b)/

const toCents = (whole: string, fraction?: string) => {
  const cents = Number(whole) * 100 + Number((fraction ?? '').padEnd(2, '0'))
  return Number.isFinite(cents) ? Math.round(cents) : null
}

/**
 * Lê o monto no texto cru: `normalizeHelpText` troca `.` por espaço e
 * transformaria `10.50` em dois números.
 */
export const parseMoneyAmountCents = (rawQuery: string): number | null => {
  const text = rawQuery
    .normalize('NFD')
    .replace(/\p{Mark}+/gu, '')
    .toLocaleLowerCase('es-MX')
    // Separador de milhar: `$1,000` e `$1.000` viram `$1000`.
    .replace(/(\d)[.,](\d{3})\b/g, '$1$2')

  const explicit = /\$\s*(\d{1,7})(?:[.,](\d{1,2}))?(?!\d)/.exec(text)
  if (explicit) return toCents(explicit[1], explicit[2])

  for (const match of text.matchAll(/(\d{1,7})(?:[.,](\d{1,2}))?(?!\d)/g)) {
    const following = text.slice(match.index + match[0].length)
    if (NON_AMOUNT_UNIT.test(following)) continue

    const preceding = text.slice(0, match.index)
    if (/(?:ultimas?|ultimos?|proximas?|hace)\s+$/.test(preceding)) continue

    return toCents(match[1], match[2])
  }

  for (const [word, value] of Object.entries(WORD_AMOUNTS)) {
    const wordPattern = new RegExp(`\\b${word}\\b`)
    if (!wordPattern.test(text)) continue

    const following = text.slice(
      text.search(wordPattern) + word.length,
    )
    if (NON_AMOUNT_UNIT.test(following)) continue

    return value * 100
  }

  return null
}

export const detectSide = (query: string): OutcomeSide | null => {
  const wantsUp = /\b(?:up|arriba|sube|suba|subir|alza)\b/.test(query)
  const wantsDown = /\b(?:down|abajo|baja|baje|bajar|caida)\b/.test(query)

  if (wantsUp === wantsDown) return null
  return wantsUp ? 'up' : 'down'
}

// ---------------------------------------------------------------------------
// Reconhecimento de intenção
// ---------------------------------------------------------------------------

const matches = (query: string, patterns: RegExp[]) => (
  patterns.some((pattern) => pattern.test(query))
)

const asksForProbability = (query: string) => matches(query, [
  /\bprobabilidad(?:es)?\b/,
  /\bposibilidad(?:es)?\b/,
  /\bchances?\b/,
  /\bque tan probable\b/,
  /\bque tanto probable\b/,
  /\bodds\b/,
  /\bcuanto probable\b/,
])

const asksForSharePrice = (query: string) => (
  matches(query, [
    /\b(?:precio|cuesta|cuestan|vale|valen|cotiza|cotizacion)\b/,
    /\ba cuanto esta\b/,
  ])
  && matches(query, [
    /\b(?:up|down|arriba|abajo|participacion|participaciones)\b/,
  ])
  && !matches(query, [/\b(?:bitcoin|btc)\b/, /\bobjetivo\b/])
)

const asksForSimulation = (query: string) => matches(query, [
  /\bsi (?:pongo|invierto|compro|meto|apuesto|uso|gasto)\b/,
  /\bcon \d/,
  /\bcon \$/,
  /\b(?:cuanto|que) (?:gano|recibo|ganaria|recibiria|me dan|me darian|obtengo)\b/,
  /\bcuantas participaciones\b/,
])

const asksForMyEntry = (query: string) => (
  matches(query, [
    /\bmi (?:entrada|posicion|participacion|compra)\b/,
    /\bmis (?:entradas|posiciones|participaciones)\b/,
    /\bcomo (?:voy|va lo mio|van mis)\b/,
    /\bcuanto (?:llevo|voy ganando|voy perdiendo)\b/,
    /\bque tengo (?:abierto|comprado)\b/,
  ])
)

// `cuántas rondas hay al día?` não é uma pergunta sobre resultados. Sem uma
// palavra de desfecho, a contagem do histórico não é a resposta certa.
const asksForHistory = (query: string) => (
  matches(query, [/\b(?:rondas?|ultimas|anteriores|pasadas|cuantas|cuantos)\b/])
  && matches(query, [
    /\bterminaron\b/,
    /\bacabaron\b/,
    /\bcerraron\b/,
    /\bganaron\b/,
    /\bresultados?\b/,
    /\b(?:arriba|abajo)\b/,
  ])
)

const asksForSaleValue = (query: string) => matches(query, [
  /\bsi vendo\b/,
  /\bvendo ahora\b/,
  /\bvender ahora\b/,
  /\bal vender\b/,
  /\b(?:cuanto|que) (?:me dan|me darian|recibo|recibiria|gano|obtengo)\b.*\bvend/,
  /\bvend\w+\b.*\b(?:cuanto|que) (?:me dan|recibo|gano)\b/,
  /\bprecio de venta\b/,
  /\bcuanto vale (?:mi|la) (?:posicion|entrada|participacion)\b.*\bvend/,
])

// `gané` e `gane` ficam iguais depois da normalização, então a forma sozinha
// não distingue `¿gané la ronda?` de `la probabilidad de que yo gane`. As
// demais formas do pretérito não têm essa ambiguidade.
const asksForLastResult = (query: string) => (
  matches(query, [
    /\bperdi\b/,
    /\backerte\b/,
    /\bme fue\b/,
    /\bronda (?:anterior|pasada)\b/,
    /\bultima ronda\b/,
    /\b(?:ya )?se liquido\b/,
    /\bmi ultim[oa] (?:resultado|entrada)\b/,
  ])
  || asksForAggregateResult(query)
  || (
    /\bgane\b/.test(query)
    && matches(query, [/\bya\b/, /\bhoy\b/, /\bayer\b/, /\bcuanto\b/, /\bronda\b/])
  )
)

const asksForAggregateResult = (query: string) => matches(query, [
  /\bcuanto llevo\b/,
  /\bllevo (?:ganado|perdido)\b/,
  /\ben total\b/,
  /\bacumulado\b/,
  /\bresultado (?:neto|total)\b/,
  /\b(?:gane|perdi)\b.*\bhoy\b/,
  /\bhoy\b.*\b(?:gane|perdi)\b/,
])

const asksForNextRound = (query: string) => matches(query, [
  /\bproxima ronda\b/,
  /\bsiguiente ronda\b/,
  /\bcuando (?:empieza|inicia|comienza)\b/,
])

const asksForRoundState = (query: string) => matches(query, [
  /\b(?:cuanto|que) tiempo\b/,
  /\bcuanto (?:falta|queda)\b/,
  /\bcuantos? (?:minutos|segundos)\b/,
  /\b(?:falta|faltan|queda|quedan)\b/,
  /\ba que hora (?:cierra|termina|acaba)\b/,
  /\bcuando (?:cierra|termina|acaba) (?:la ronda|esta ronda)\b/,
  /\bcomo va la ronda\b/,
  /\bva (?:ganando|perdiendo)\b/,
  /\bquien va ganando\b/,
  /\barriba o abajo\b/,
])

const asksForBitcoinPrice = (query: string) => (
  matches(query, [/\b(?:bitcoin|btc)\b/])
  && matches(query, [
    /\b(?:precio|cuanto|vale|esta|cotiza|cotizacion)\b/,
  ])
)

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

const CHANGES_DURING_ROUND =
  'Este número cambia durante la ronda y no es una predicción de Pulse: es el precio que el mercado está pagando ahora.'

const buildProbabilityAnswer = (
  snapshot: HelpAssistantLiveSnapshot,
): HelpAssistantResult => {
  if (!hasLivePrices(snapshot)) {
    return pricesUnavailableResult('implied-probability', 'Probabilidad implícita')
  }

  const prices = snapshot.market.prices
  const highlight = priceHighlight(snapshot)
  const source = liveSource('implied-probability', 'Probabilidad implícita')
  const summaries = getOpenEntrySummaries(snapshot.position, snapshot.positionCostCents)
  const side = getPositionSide(snapshot)

  if (side) {
    const summary = summaries.find((entry) => entry.side === side)
    const price = prices[side]
    const percent = formatImpliedPercent(price)

    return {
      answer: `El ${percent} que ves en ${SIDE_LABEL[side]} es la probabilidad implícita del mercado: es lo que cuesta ahora una participación que paga US$1 si la ronda termina ${SIDE_DIRECTION[side]}. Tienes ${formatParticipations(snapshot.position[side])} participaciones en ${SIDE_LABEL[side]}, así que el mercado le está dando ${percent} a tu lado en este momento.`,
      confidence: 'high',
      details: [
        summary
          ? `Compraste a ${formatCents(summary.averagePriceCents)} en promedio, con ${formatCents(summary.amountCents)} en total.`
          : `Una participación de ${SIDE_LABEL[side]} cuesta ${formatSharePrice(price)} en este momento.`,
        summary
          ? `Si ${SIDE_LABEL[side]} gana, recibes ${formatCents(summary.potentialPayoutCents)}.`
          : `Cada participación ganadora paga US$1.`,
        CHANGES_DURING_ROUND,
      ],
      highlight,
      source,
      suggestions: [FOLLOW_UPS.impliedProbability, FOLLOW_UPS.canSell],
    }
  }

  if (hasAnyPosition(snapshot)) {
    return {
      answer: `Tienes participaciones en los dos lados, así que no hay un solo número para ti. El mercado le está dando ${formatImpliedPercent(prices.up)} a que la ronda termine arriba y ${formatImpliedPercent(prices.down)} a que termine abajo.`,
      confidence: 'high',
      details: [
        `UP: ${formatParticipations(snapshot.position.up)} participaciones · DOWN: ${formatParticipations(snapshot.position.down)} participaciones.`,
        'Solo uno de los dos lados recibe pago al cierre de la ronda.',
        CHANGES_DURING_ROUND,
      ],
      highlight,
      source,
      suggestions: [FOLLOW_UPS.impliedProbability, FOLLOW_UPS.canSell],
    }
  }

  return {
    answer: `Ahora el mercado paga ${describeMarketPrices(snapshot)}. Ese precio es la probabilidad implícita: ${formatImpliedPercent(prices.up)} de que la ronda termine arriba y ${formatImpliedPercent(prices.down)} de que termine abajo. Todavía no tienes una entrada en esta ronda, así que aún no hay una probabilidad tuya.`,
    confidence: 'high',
    details: [
      'Una participación cuesta ese precio y paga US$1 si acierta.',
      CHANGES_DURING_ROUND,
    ],
    highlight,
    source,
    suggestions: [FOLLOW_UPS.impliedProbability, FOLLOW_UPS.canLose],
  }
}

const buildSharePriceAnswer = (
  query: string,
  snapshot: HelpAssistantLiveSnapshot,
): HelpAssistantResult => {
  if (!hasLivePrices(snapshot)) {
    return pricesUnavailableResult('share-price', 'Precio de UP y DOWN')
  }

  const prices = snapshot.market.prices
  const side = detectSide(query)
  const source = liveSource('share-price', 'Precio de UP y DOWN')
  const highlight = priceHighlight(snapshot)

  if (side) {
    const price = prices[side]
    return {
      answer: `Una participación de ${SIDE_LABEL[side]} cuesta ${formatSharePrice(price)} en este momento, que equivale a una probabilidad implícita de ${formatImpliedPercent(price)}.`,
      confidence: 'high',
      details: [
        `Si ${SIDE_LABEL[side]} gana, cada participación paga US$1.`,
        `Con ${formatMoney(1)} comprarías cerca de ${formatParticipations(1 / price)} participaciones a ese precio.`,
        CHANGES_DURING_ROUND,
      ],
      highlight,
      source,
      suggestions: [FOLLOW_UPS.impliedProbability, FOLLOW_UPS.participation],
    }
  }

  return {
    answer: `Ahora el mercado paga ${describeMarketPrices(snapshot)}. Ese precio es lo que cuesta una participación que paga US$1 si acierta.`,
    confidence: 'high',
    details: [CHANGES_DURING_ROUND],
    highlight,
    source,
    suggestions: [FOLLOW_UPS.impliedProbability, FOLLOW_UPS.participation],
  }
}

const buildSimulationAnswer = (
  query: string,
  rawQuery: string,
  snapshot: HelpAssistantLiveSnapshot,
): HelpAssistantResult | undefined => {
  const amountCents = parseMoneyAmountCents(rawQuery)
  if (amountCents === null || amountCents <= 0) return undefined

  const source = liveSource('return-simulation', 'Retorno estimado')

  if (amountCents > MAX_SIMULATION_CENTS) {
    return {
      answer: `El monto más alto que acepta el campo de compra es ${formatCents(MAX_SIMULATION_CENTS)}, así que no puedo calcular el retorno de ${formatCents(amountCents)}.`,
      confidence: 'high',
      source,
      suggestions: [FOLLOW_UPS.amountLimits],
    }
  }

  if (!hasLivePrices(snapshot)) {
    return pricesUnavailableResult('return-simulation', 'Retorno estimado')
  }

  const side = detectSide(query)
  const highlight = priceHighlight(snapshot)
  const amount = amountCents / 100
  const balanceNote = amountCents > snapshot.wallet.availableBalanceCents
    ? `Tu saldo disponible es ${formatCents(snapshot.wallet.availableBalanceCents)}, menos que ese monto.`
    : null

  if (!side) {
    return {
      answer: `Con ${formatCents(amountCents)} el resultado depende del lado: UP cuesta ${formatSharePrice(snapshot.market.prices.up)} y DOWN cuesta ${formatSharePrice(snapshot.market.prices.down)}. Dime si es UP o DOWN y te doy el número exacto.`,
      confidence: 'high',
      details: [CHANGES_DURING_ROUND],
      highlight,
      source,
      suggestions: [
        {
          id: 'simulate-up',
          label: `Con ${formatCents(amountCents)} en UP`,
          query: `¿Cuánto gano si pongo ${formatCents(amountCents)} en UP?`,
        },
        {
          id: 'simulate-down',
          label: `Con ${formatCents(amountCents)} en DOWN`,
          query: `¿Cuánto gano si pongo ${formatCents(amountCents)} en DOWN?`,
        },
      ],
    }
  }

  const quote = snapshot.quoteBuy?.(side, amount) ?? null

  if (!quote?.complete) {
    return {
      answer: `Ahora no hay participaciones suficientes de ${SIDE_LABEL[side]} para un monto de ${formatCents(amountCents)}, así que no puedo calcular el retorno sin inventarlo.`,
      confidence: 'high',
      details: ['Prueba con un monto menor o vuelve a preguntarme en unos segundos.'],
      highlight,
      source,
      suggestions: [FOLLOW_UPS.participation],
    }
  }

  const payoutCents = Math.round(quote.participations * 100)
  const profitCents = payoutCents - amountCents

  return {
    answer: `Con ${formatCents(amountCents)} en ${SIDE_LABEL[side]} recibirías ${formatParticipations(quote.participations)} participaciones a un precio promedio de ${formatSharePrice(quote.averagePrice)}.`,
    confidence: 'high',
    details: [
      `Si ${SIDE_LABEL[side]} gana, esas participaciones pagan ${formatCents(payoutCents)}, o sea ${formatSignedCents(profitCents)} sobre el monto utilizado.`,
      `Si ${SIDE_LABEL[side]} no gana, el monto utilizado no regresa a tu saldo.`,
      ...(balanceNote ? [balanceNote] : []),
      'Es el precio de este momento y puede cambiar antes de que compres. El saldo es simulado.',
    ],
    highlight,
    source,
    suggestions: [FOLLOW_UPS.canLose, FOLLOW_UPS.canSell],
  }
}

const buildMyEntryAnswer = (
  snapshot: HelpAssistantLiveSnapshot,
): HelpAssistantResult => {
  const source = liveSource('my-entry', 'Tu entrada')
  const action = { id: 'entries' as const, label: ACTION_LABELS.entries }
  const summaries = getOpenEntrySummaries(snapshot.position, snapshot.positionCostCents)

  if (summaries.length === 0) {
    return {
      action,
      answer: snapshot.pendingRoundsCount > 0
        ? `En esta ronda todavía no tienes una entrada abierta, pero tienes ${snapshot.pendingRoundsCount === 1 ? 'una entrada' : `${snapshot.pendingRoundsCount} entradas`} de rondas anteriores esperando la liquidación.`
        : 'Ahora no tienes una entrada abierta. Cuando compres UP o DOWN en una ronda, aquí te digo cómo va.',
      confidence: 'high',
      details: [`Tu saldo disponible es ${formatCents(snapshot.wallet.availableBalanceCents)}.`],
      source,
      suggestions: [FOLLOW_UPS.howToStart, FOLLOW_UPS.liveProbability],
    }
  }

  const details = summaries.flatMap((summary) => {
    const sideLabel = SIDE_LABEL[summary.side]
    const lines = [
      `${sideLabel}: ${formatParticipations(summary.participations)} participaciones · monto ${formatCents(summary.amountCents)} · precio promedio ${formatCents(summary.averagePriceCents)}.`,
      `Si ${sideLabel} gana, recibes ${formatCents(summary.potentialPayoutCents)}.`,
    ]

    const quote = snapshot.quoteSell?.(summary.side, summary.participations) ?? null
    if (quote?.complete) {
      const saleCents = Math.round(quote.grossValue * 100)
      lines.push(
        `Si vendes ${sideLabel} ahora, recibes ${formatCents(saleCents)} (${formatSignedCents(saleCents - summary.amountCents)} sobre el monto utilizado).`,
      )
    }

    return lines
  })

  const headline = summaries.length === 1
    ? `Tienes ${formatParticipations(summaries[0].participations)} participaciones en ${SIDE_LABEL[summaries[0].side]} en esta ronda.`
    : 'Tienes participaciones en los dos lados de esta ronda.'

  return {
    action,
    answer: headline,
    confidence: 'high',
    details: [
      ...details,
      'El valor de venta depende del precio del momento y puede cambiar hasta el cierre.',
    ],
    highlight: priceHighlight(snapshot),
    source,
    suggestions: [FOLLOW_UPS.canSell, FOLLOW_UPS.potentialReturn],
  }
}

const buildHistoryAnswer = (
  snapshot: HelpAssistantLiveSnapshot,
): HelpAssistantResult => {
  const source = liveSource('previous-rounds-count', 'Últimas rondas')
  const action = {
    id: 'previous-rounds' as const,
    label: ACTION_LABELS['previous-rounds'],
  }

  if (snapshot.previousRounds.length === 0) {
    return {
      action,
      answer: 'Todavía no tengo cargado el historial de rondas, así que no puedo darte la cuenta sin inventarla.',
      confidence: 'high',
      source,
      suggestions: [FOLLOW_UPS.liveProbability],
    }
  }

  const upCount = snapshot.previousRounds.filter(({ result }) => result === 'up').length
  const downCount = snapshot.previousRounds.length - upCount

  return {
    action,
    answer: `De las últimas ${snapshot.previousRounds.length} rondas, ${upCount} terminaron arriba y ${downCount} abajo.`,
    confidence: 'high',
    details: [
      'Cada ronda es independiente: estos resultados no indican lo que va a pasar en la siguiente.',
    ],
    highlight: {
      items: [
        { label: 'Arriba', side: 'up', value: String(upCount) },
        { label: 'Abajo', side: 'down', value: String(downCount) },
      ],
    },
    source,
    suggestions: [FOLLOW_UPS.liveProbability],
  }
}

/** Valor de venda agora, reutilizado pela resposta e pela guarda de conselho. */
export const describeSaleValue = (snapshot: HelpAssistantLiveSnapshot) => {
  const summaries = getOpenEntrySummaries(snapshot.position, snapshot.positionCostCents)
  if (summaries.length === 0) return null

  const lines = summaries.flatMap((summary) => {
    const quote = snapshot.quoteSell?.(summary.side, summary.participations) ?? null
    if (!quote?.complete) return []

    const saleCents = Math.round(quote.grossValue * 100)
    return [{
      participations: summary.participations,
      resultCents: saleCents - summary.amountCents,
      saleCents,
      side: summary.side,
      unitPriceCents: summary.participations > 0
        ? saleCents / summary.participations
        : 0,
      payoutCents: summary.potentialPayoutCents,
    }]
  })

  return lines.length === 0 ? null : lines
}

const buildSaleValueAnswer = (
  snapshot: HelpAssistantLiveSnapshot,
): HelpAssistantResult => {
  const source = liveSource('sale-value', 'Valor de venta')
  const action = { id: 'entries' as const, label: ACTION_LABELS.entries }

  if (!hasAnyPosition(snapshot)) {
    return {
      answer: 'Ahora no tienes participaciones para vender en esta ronda.',
      confidence: 'high',
      details: [`Tu saldo disponible es ${formatCents(snapshot.wallet.availableBalanceCents)}.`],
      source,
      suggestions: [FOLLOW_UPS.howToStart, FOLLOW_UPS.canSell],
    }
  }

  const sales = describeSaleValue(snapshot)

  if (!sales) {
    return {
      action,
      answer: 'Ahora no hay precio de venta disponible para tus participaciones, así que no puedo darte el monto sin inventarlo.',
      confidence: 'high',
      details: ['Vuelve a preguntarme en unos segundos, mientras la ronda siga abierta.'],
      source,
      suggestions: [FOLLOW_UPS.canSell],
    }
  }

  const total = sales.reduce((sum, sale) => sum + sale.saleCents, 0)
  const headline = sales.length === 1
    ? `Si vendes ahora tus ${formatParticipations(sales[0].participations)} participaciones de ${SIDE_LABEL[sales[0].side]}, recibes ${formatCents(sales[0].saleCents)}.`
    : `Si vendes ahora todo lo que tienes en esta ronda, recibes ${formatCents(total)}.`

  return {
    action,
    answer: headline,
    confidence: 'high',
    details: [
      ...sales.map((sale) => (
        `${SIDE_LABEL[sale.side]}: ${formatCents(sale.saleCents)} a ${formatCents(sale.unitPriceCents)} por participación, ${formatSignedCents(sale.resultCents)} sobre el monto utilizado.`
      )),
      ...sales.map((sale) => (
        `Si en vez de vender esperas al cierre y ${SIDE_LABEL[sale.side]} gana, recibes ${formatCents(sale.payoutCents)}. Si no gana, no recibes nada.`
      )),
      'El precio de venta cambia durante la ronda: este monto es el de este momento.',
    ],
    highlight: priceHighlight(snapshot),
    source,
    suggestions: [FOLLOW_UPS.canSell, FOLLOW_UPS.liveProbability],
  }
}

const SETTLED_OUTCOME_LABEL: Record<
  HelpAssistantLiveSnapshot['settledEntries'][number]['outcome'],
  string
> = {
  canceled: 'se canceló',
  lost: 'no acertaste',
  sold: 'vendiste antes del cierre',
  won: 'ganaste',
}

const buildLastResultAnswer = (
  query: string,
  snapshot: HelpAssistantLiveSnapshot,
): HelpAssistantResult => {
  const isAggregate = asksForAggregateResult(query)
  const source = liveSource(
    isAggregate ? 'accumulated-result' : 'last-result',
    isAggregate ? 'Tu resultado acumulado' : 'Tu último resultado',
  )
  const action = { id: 'entries' as const, label: ACTION_LABELS.entries }
  // A ordem da lista não é garantida por quem monta o instantâneo, então a
  // mais recente é escolhida aqui.
  const latest = snapshot.settledEntries.reduce<
    HelpAssistantLiveSnapshot['settledEntries'][number] | undefined
  >((newest, entry) => (
    !newest || entry.roundEnd > newest.roundEnd ? entry : newest
  ), undefined)

  if (!latest) {
    return {
      answer: hasAnyPosition(snapshot)
        ? 'Todavía no tienes una ronda liquidada. Tu entrada de esta ronda sigue abierta y se resuelve al cierre.'
        : 'Todavía no tienes ninguna ronda liquidada, así que no hay un resultado que contarte.',
      confidence: 'high',
      details: [`Tu saldo disponible es ${formatCents(snapshot.wallet.availableBalanceCents)}.`],
      source,
      suggestions: [FOLLOW_UPS.howToStart, FOLLOW_UPS.settlement],
    }
  }

  const resultCents = latest.payoutCents - latest.amountCents
  const details = [
    `Elegiste ${SIDE_LABEL[latest.side]} con ${formatCents(latest.amountCents)} y ${formatParticipations(latest.participations)} participaciones.`,
    latest.outcome === 'won'
      ? `Recibiste ${formatCents(latest.payoutCents)}, o sea ${formatSignedCents(resultCents)} sobre el monto utilizado.`
      : latest.outcome === 'sold'
        ? `Recibiste ${formatCents(latest.payoutCents)} por la venta, o sea ${formatSignedCents(resultCents)} sobre el monto utilizado.`
        : latest.outcome === 'canceled'
          ? `Se te devolvieron ${formatCents(latest.payoutCents)}, el monto que habías utilizado.`
          : `No recibiste pago, así que el resultado fue ${formatSignedCents(resultCents)}.`,
    `Resultado acumulado desde el depósito inicial: ${formatSignedCents(snapshot.wallet.netResultCents)}.`,
  ]

  if (isAggregate) {
    return {
      action,
      // O protótipo não separa por dia, então prometer `hoy` seria inventar
      // um recorte que a carteira não guarda.
      answer: `Desde el depósito inicial, tu resultado acumulado es ${formatSignedCents(snapshot.wallet.netResultCents)}.`,
      confidence: 'high',
      details: [
        `Saldo disponible: ${formatCents(snapshot.wallet.availableBalanceCents)} · con las entradas abiertas, tu total es ${formatCents(snapshot.wallet.portfolioTotalCents)}.`,
        `En la ronda que cerró a las ${formatClock(latest.roundEnd)}, ${SETTLED_OUTCOME_LABEL[latest.outcome]}.`,
        'No puedo separarlo por día: la cuenta del prototipo guarda el acumulado desde que empezaste.',
      ],
      source,
      suggestions: [FOLLOW_UPS.settlement, FOLLOW_UPS.liveProbability],
    }
  }

  return {
    action,
    answer: `En la ronda que cerró a las ${formatClock(latest.roundEnd)}, ${SETTLED_OUTCOME_LABEL[latest.outcome]}.`,
    confidence: 'high',
    details,
    source,
    suggestions: [FOLLOW_UPS.settlement, FOLLOW_UPS.liveProbability],
  }
}

const buildRoundStateAnswer = (
  snapshot: HelpAssistantLiveSnapshot,
  focus: 'next' | 'price' | 'time',
): HelpAssistantResult => {
  const { currentPrice, endTime, isClosing, remainingSeconds, targetPrice } = snapshot.round
  const source = liveSource('round-state', 'Ronda actual')

  const timeLine = isClosing || remainingSeconds <= 0
    ? 'Esta ronda está cerrando en este momento.'
    : `Quedan ${formatRemaining(remainingSeconds)} en esta ronda, que cierra a las ${endTime}.`
  const stillOpenLine = isClosing || remainingSeconds <= 0
    ? null
    : 'Falta tiempo para el cierre y el precio todavía puede cambiar de lado.'

  const comparisonLine = (() => {
    if (currentPrice === null || targetPrice === null) return null

    const difference = currentPrice - targetPrice
    const percentValue = targetPrice === 0
      ? null
      : percentFormatter.format(Math.abs(difference / targetPrice) * 100)
    // `(0%)` não informa nada: abaixo do arredondamento, a diferença em dólares
    // já é a única leitura honesta.
    const percent = percentValue === '0' ? null : percentValue
    const leadingSide: OutcomeSide = difference >= 0 ? 'up' : 'down'

    return `Está ${formatMoney(Math.abs(difference))} ${SIDE_DIRECTION[leadingSide]} del objetivo${percent === null ? '' : ` (${percent}%)`}. Si la ronda cerrara en este momento, ganaría ${SIDE_LABEL[leadingSide]}.`
  })()

  const pricesLine = (() => {
    if (currentPrice !== null && targetPrice !== null) {
      return `Bitcoin está en ${formatMoney(currentPrice)} y el precio objetivo de esta ronda es ${formatMoney(targetPrice)}.`
    }
    if (currentPrice !== null) {
      return `Bitcoin está en ${formatMoney(currentPrice)}. El precio objetivo de esta ronda todavía no está disponible.`
    }
    if (targetPrice !== null) {
      return `El precio objetivo de esta ronda es ${formatMoney(targetPrice)}. El precio actual de Bitcoin no está disponible en este momento.`
    }
    return 'Ahora no tengo el precio actual ni el precio objetivo de la ronda.'
  })()

  if (focus === 'next') {
    return {
      answer: isClosing || remainingSeconds <= 0
        ? `La próxima ronda empieza en cuanto cierre esta, que está cerrando ahora.`
        : `La próxima ronda empieza a las ${endTime}, en cuanto cierre esta.`,
      confidence: 'high',
      details: [
        isClosing || remainingSeconds <= 0
          ? 'Las rondas duran 15 minutos y se suceden sin pausa.'
          : `Quedan ${formatRemaining(remainingSeconds)} en la ronda actual. Las rondas duran 15 minutos y se suceden sin pausa.`,
        'Cada ronda empieza con un precio objetivo nuevo.',
      ],
      source,
      suggestions: [FOLLOW_UPS.roundWorks, FOLLOW_UPS.liveProbability],
    }
  }

  if (focus === 'price') {
    const headline = currentPrice === null
      ? 'Ahora no tengo el precio actual de Bitcoin, así que no puedo darte el número de este momento.'
      : `Bitcoin está en ${formatMoney(currentPrice)} en este momento.`
    const targetLine = targetPrice === null
      ? 'El precio objetivo de esta ronda todavía no está disponible.'
      : `El precio objetivo de esta ronda es ${formatMoney(targetPrice)}.`

    return {
      answer: headline,
      confidence: 'high',
      details: [
        targetLine,
        ...(comparisonLine ? [comparisonLine] : []),
        timeLine,
        ...(stillOpenLine ? [stillOpenLine] : []),
      ],
      source,
      suggestions: [FOLLOW_UPS.targetPrice, FOLLOW_UPS.liveProbability],
    }
  }

  return {
    answer: timeLine,
    confidence: 'high',
    details: [
      pricesLine,
      ...(comparisonLine ? [comparisonLine] : []),
      ...(stillOpenLine ? [stillOpenLine] : []),
    ],
    source,
    suggestions: [FOLLOW_UPS.roundWorks, FOLLOW_UPS.liveProbability],
  }
}

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

export const resolveLiveAnswer = (
  query: string,
  rawQuery: string,
  snapshot: HelpAssistantLiveSnapshot,
): HelpAssistantResult | undefined => {
  if (asksForSimulation(query)) {
    const simulation = buildSimulationAnswer(query, rawQuery, snapshot)
    if (simulation) return simulation
  }

  if (asksForLastResult(query)) return buildLastResultAnswer(query, snapshot)
  if (asksForSaleValue(query)) return buildSaleValueAnswer(snapshot)
  if (asksForProbability(query)) return buildProbabilityAnswer(snapshot)
  if (asksForSharePrice(query)) return buildSharePriceAnswer(query, snapshot)
  if (asksForMyEntry(query)) return buildMyEntryAnswer(snapshot)
  if (asksForHistory(query)) return buildHistoryAnswer(snapshot)
  if (asksForNextRound(query)) return buildRoundStateAnswer(snapshot, 'next')
  if (asksForBitcoinPrice(query)) return buildRoundStateAnswer(snapshot, 'price')
  if (asksForRoundState(query)) return buildRoundStateAnswer(snapshot, 'time')

  return undefined
}
