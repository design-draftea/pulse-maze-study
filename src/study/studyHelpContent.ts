import type {
  HelpFaqItem,
  HelpSmallTalkItem,
  HelpTopicItem,
} from '../content/help/es-MX/helpContent.ts'

/**
 * Sobreposição de conteúdo do estudo.
 *
 * A cópia de pesquisa não consulta nenhuma fonte de mercado, então as poucas
 * frases aprovadas que afirmam o contrário passariam a ser falsas aqui. A
 * troca é mínima e deliberada: só sai a afirmação sobre a origem do dado. O que
 * o produto ensina sobre preço objetivo, participações, ganho e venda antecipada
 * permanece palavra por palavra, porque é justamente isso que o estudo mede.
 *
 * `price-difference` não aparece nesta lista: é a resposta que a tarefa de ajuda
 * procura e ela continua exatamente como está no Pulse.
 */
export const STUDY_FAQ_ANSWER_OVERRIDES: Record<string, string> = {
  'where-price-comes-from':
    'En esta versión de prueba, el precio de Bitcoin y los porcentajes son simulados: existen para que puedas recorrer la experiencia completa. El precio objetivo se registra al inicio de cada ronda y el precio actual se actualiza durante la experiencia.',
}

/** Tópicos guardam o texto em `description`, e não em `answer`. */
export const STUDY_TOPIC_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'is-money-real':
    'En esta versión de prueba todo es simulado: el saldo, las compras, las ventas, el precio de Bitcoin y el de las participaciones. Nada de lo que hagas aquí usa dinero real ni envía una orden a ningún mercado.',
}

export const STUDY_SMALL_TALK_ANSWER_OVERRIDES: Record<string, string> = {
  capabilities:
    'Puedo responderte con los datos de esta ronda: la probabilidad implícita de UP y DOWN, cuánto tiempo queda, cómo va tu entrada, tu saldo y las últimas rondas. También explico cómo funciona Pulse. Lo que no hago es recomendarte UP o DOWN ni predecir el precio de Bitcoin.',
}

/**
 * Reforço de vocabulário para o FAQ que a tarefa de ajuda procura.
 *
 * A resposta aprovada não muda: só entram formas de perguntar a mesma coisa. A
 * tarefa do Maze descreve a situação citando o preço do Bitcoin e outra
 * plataforma, e sem estas palavras o ranking devolvia uma lista de sugestões em
 * vez da resposta — a pessoa falharia a missão por vocabulário, não por
 * dificuldade de encontrar o assistente.
 */
export const STUDY_FAQ_KEYWORD_ADDITIONS: Record<string, string[]> = {
  'price-difference': [
    'precio de bitcoin diferente',
    'precio distinto en otra plataforma',
    'no coincide con otra app',
    'no es igual al de otro exchange',
    'binance',
    'exchange',
    'otro sitio',
    'otra aplicación',
  ],
}

export const STUDY_FAQ_EXAMPLE_ADDITIONS: Record<string, string[]> = {
  'price-difference': [
    '¿Por qué el precio de Bitcoin es diferente al de otra plataforma?',
    'El precio de Bitcoin aquí es distinto al de otra app',
    '¿Por qué el precio no es igual al de otro exchange?',
  ],
}

export const withStudyFaqVocabulary = (items: HelpFaqItem[]): HelpFaqItem[] =>
  items.map((item) => {
    const keywords = STUDY_FAQ_KEYWORD_ADDITIONS[item.id]
    const examples = STUDY_FAQ_EXAMPLE_ADDITIONS[item.id]

    if (keywords === undefined && examples === undefined) return item

    return {
      ...item,
      keywords: [...item.keywords, ...(keywords ?? [])],
      examples: [...item.examples, ...(examples ?? [])],
    }
  })

const applyOverrides = <Field extends string, Item extends { id: string } & Record<Field, string>>(
  items: Item[],
  field: Field,
  overrides: Record<string, string>,
): Item[] => items.map((item) => (
  overrides[item.id] === undefined
    ? item
    : { ...item, [field]: overrides[item.id] }
))

export const withStudyFaqOverrides = (items: HelpFaqItem[]) =>
  withStudyFaqVocabulary(applyOverrides(items, 'answer', STUDY_FAQ_ANSWER_OVERRIDES))

export const withStudyTopicOverrides = (items: HelpTopicItem[]) =>
  applyOverrides(items, 'description', STUDY_TOPIC_DESCRIPTION_OVERRIDES)

export const withStudySmallTalkOverrides = (items: HelpSmallTalkItem[]) =>
  applyOverrides(items, 'answer', STUDY_SMALL_TALK_ANSWER_OVERRIDES)

/** Frases que não podem sobreviver no conteúdo do estudo. */
export const STUDY_FORBIDDEN_CONTENT_PHRASES = [
  'datos reales',
  'fuentes de mercado',
  'fuentes externas de datos de mercado',
] as const
