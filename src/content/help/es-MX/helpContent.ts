export interface HelpFaqItem {
  answer: string
  examples: string[]
  id: string
  keywords: string[]
  question: string
}

export interface HelpGlossaryItem {
  description: string
  examples: string[]
  id: string
  keywords: string[]
  title: string
}

export type HelpProductActionId = 'movements' | 'previous-rounds'

export interface HelpProductItem {
  action?: HelpProductActionId
  aliases: string[]
  description: string
  examples: string[]
  id: string
  keywords: string[]
  title: string
}

export interface HelpTopicItem {
  aliases: string[]
  description: string
  examples: string[]
  id: string
  keywords: string[]
  title: string
}

export interface HelpSmallTalkItem {
  answer: string
  id: string
  utterances: string[]
  withMenu: boolean
}

export const helpFaqItems: HelpFaqItem[] = [
  {
    id: 'what-is-pulse',
    question: '¿Qué es Draftea Pulse?',
    answer:
      'Draftea Pulse es una experiencia en la que puedes predecir si el precio de Bitcoin terminará arriba o abajo de un valor de referencia. Cada predicción ocurre dentro de una ronda de 15 minutos. En esta versión, el saldo y las operaciones son simulados.',
    keywords: ['Draftea Pulse', 'qué es Pulse', 'cómo es Pulse', 'predicción de Bitcoin'],
    examples: [
      '¿De qué se trata Pulse?',
      '¿Cómo funciona Draftea Pulse?',
      '¿Qué puedo hacer en Pulse?',
    ],
  },
  {
    id: 'how-round-works',
    question: '¿Cómo funciona una ronda de 15 minutos?',
    answer:
      'Cada ronda comienza con un precio objetivo de Bitcoin. Durante los 15 minutos, puedes elegir si el precio terminará arriba o abajo de ese valor. Cuando el tiempo se acaba, el precio final se compara con el precio objetivo para definir el resultado.',
    keywords: ['ronda de 15 minutos', 'funcionamiento de la ronda', 'tiempo de la ronda'],
    examples: [
      '¿Qué pasa durante una ronda?',
      '¿Cuánto dura una ronda?',
      '¿Qué sucede cuando termina el tiempo?',
    ],
  },
  {
    id: 'can-play-after-start',
    question: '¿Puedo participar después de que la ronda ya comenzó?',
    answer:
      'Sí. Puedes entrar mientras la ronda siga abierta y las opciones de compra estén disponibles. Antes de confirmar, revisa cuánto tiempo queda, ya que el precio de las participaciones puede cambiar durante la ronda.',
    keywords: ['participar después', 'ronda comenzada', 'entrar tarde', 'comprar durante la ronda'],
    examples: [
      '¿Puedo entrar con la ronda empezada?',
      '¿Todavía puedo comprar?',
      '¿Puedo participar si el reloj ya comenzó?',
    ],
  },
  {
    id: 'what-is-up-down',
    question: '¿Qué significa elegir UP o DOWN?',
    answer:
      'Elige UP si crees que el precio final de Bitcoin será igual o mayor que el precio objetivo. Elige DOWN si crees que terminará por debajo. Tu selección queda asociada a esa ronda específica.',
    keywords: ['UP o DOWN', 'elegir UP', 'elegir DOWN', 'arriba o abajo'],
    examples: [
      '¿Qué quiere decir UP y DOWN?',
      '¿Cuándo gana UP?',
      '¿Cuándo gana DOWN?',
    ],
  },
  {
    id: 'what-is-target-price',
    question: '¿Qué es el precio objetivo?',
    answer:
      'Es el precio de Bitcoin registrado al inicio de la ronda y sirve como referencia para definir el resultado. Este valor permanece fijo durante los 15 minutos, aunque el precio actual siga subiendo o bajando.',
    keywords: ['precio objetivo', 'valor de referencia', 'precio inicial'],
    examples: [
      '¿Para qué sirve el precio objetivo?',
      '¿El precio objetivo cambia?',
      '¿Cuál es el valor de referencia?',
    ],
  },
  {
    id: 'where-price-comes-from',
    question: '¿De dónde viene el precio de Bitcoin que muestra Pulse?',
    answer:
      'Pulse utiliza fuentes externas de datos de mercado para mostrar el precio de Bitcoin. El precio objetivo se registra al inicio de cada ronda, mientras que el precio actual se actualiza durante la experiencia.',
    keywords: ['origen del precio', 'fuente del precio', 'datos de Bitcoin', 'precio de Bitcoin'],
    examples: [
      '¿Qué fuente usa Pulse?',
      '¿De dónde sale el precio?',
      '¿El precio de Bitcoin es real?',
    ],
  },
  {
    id: 'price-difference',
    question: '¿Por qué el precio puede ser diferente al de otras plataformas?',
    answer:
      'Cada plataforma puede consultar una fuente distinta o actualizar el precio en momentos diferentes. Por eso pueden existir pequeñas variaciones entre los valores mostrados. Para definir el resultado, Pulse utiliza la referencia establecida para la ronda.',
    keywords: ['precio diferente', 'otra plataforma', 'diferencia de precio', 'variación del precio'],
    examples: [
      '¿Por qué aquí aparece otro precio?',
      '¿Por qué no coincide con otra app?',
      'El precio es distinto al que veo en otro lugar',
    ],
  },
  {
    id: 'possible-win',
    question: '¿Cuánto puedo recibir si acierto?',
    answer:
      'Cada participación ganadora paga US$1 al finalizar la ronda. El monto total dependerá de cuántas participaciones tengas. Antes de confirmar una compra, puedes consultar el retorno potencial estimado.',
    keywords: ['cuánto recibo', 'si acierto', 'pago por participación', 'retorno potencial'],
    examples: [
      '¿Cuánto gano si acierto?',
      '¿Cuánto paga una participación?',
      '¿Dónde veo mi retorno potencial?',
    ],
  },
  {
    id: 'can-i-lose',
    question: '¿Puedo perder el monto que utilicé?',
    answer:
      'Sí. Si tu selección no acierta, las participaciones de esa ronda no reciben pago y el monto utilizado no regresa a tu saldo. También puedes vender antes del cierre por un monto menor al que utilizaste. En esta versión el saldo es simulado, así que no hay pérdida de dinero real.',
    keywords: ['puedo perder', 'perder dinero', 'pierdo el monto', 'qué pasa si no acierto', 'riesgo'],
    examples: [
      '¿Puedo perder dinero?',
      '¿Qué pasa si pierdo?',
      '¿Pierdo el monto si no acierto?',
    ],
  },
  {
    id: 'can-sell-before-end',
    question: '¿Puedo vender mi participación antes de que termine la ronda?',
    answer:
      'Sí. Puedes vender mientras esta opción esté disponible y exista un precio de venta. El monto que recibirás depende del valor de tus participaciones en ese momento y puede ser mayor o menor que el monto utilizado en la compra.',
    keywords: ['vender antes', 'salir antes', 'cerrar posición', 'venta anticipada'],
    examples: [
      '¿Puedo salir antes?',
      '¿Cómo cierro mi posición?',
      '¿Tengo que esperar los 15 minutos para vender?',
    ],
  },
  {
    id: 'where-to-check-entries',
    question: '¿Dónde puedo consultar mis entradas y resultados?',
    answer:
      'En la sección Entradas puedes acompañar tus participaciones abiertas y consultar las que ya terminaron. Las entradas se organizan entre Abiertas, Ganadas y Pasadas, según su estado.',
    keywords: ['mis entradas', 'ver resultados', 'entradas abiertas', 'historial de entradas'],
    examples: [
      '¿Dónde veo lo que compré?',
      '¿Dónde están mis participaciones?',
      '¿Cómo reviso mis entradas pasadas?',
    ],
  },
  {
    id: 'equal-price-result',
    question: '¿Qué pasa si el precio final es igual al precio objetivo?',
    answer:
      'Cuando ambos precios son iguales, el resultado se considera UP. La ronda se liquida siguiendo esta regla y las participaciones ganadoras se actualizan en tu saldo.',
    keywords: ['precios iguales', 'empate', 'igual al objetivo', 'resultado UP'],
    examples: [
      '¿Qué sucede si hay empate?',
      '¿Quién gana cuando los precios son iguales?',
      'El precio final quedó igual al objetivo',
    ],
  },
  {
    id: 'what-if-round-canceled',
    question: '¿Qué pasa cuando se cancela una ronda?',
    answer:
      'Si una ronda se cancela, las participaciones asociadas también se cancelan. El monto utilizado en la compra se devuelve a tu saldo y la entrada queda registrada como cancelada.',
    keywords: ['ronda cancelada', 'cancelación', 'devolución', 'entrada cancelada'],
    examples: [
      '¿Me devuelven el dinero si cancelan?',
      '¿Qué ocurre con una entrada cancelada?',
      '¿Qué sucede si la ronda no termina?',
    ],
  },
]

export const helpGlossaryItems: HelpGlossaryItem[] = [
  {
    description: 'Es un activo digital cuyo precio cambia constantemente. En Draftea Pulse, este precio se utiliza para crear las rondas y definir sus resultados.',
    id: 'bitcoin',
    title: 'Bitcoin',
    keywords: ['BTC', 'cripto', 'criptomoneda'],
    examples: ['¿Qué es Bitcoin?', '¿Qué significa BTC?'],
  },
  {
    description: 'Es el periodo de 15 minutos en el que puedes elegir UP o DOWN. Cada ronda tiene su propio precio objetivo, tiempo restante y resultado.',
    id: 'round',
    title: 'Ronda',
    keywords: ['ronda de 15 minutos', 'periodo', 'mercado'],
    examples: ['¿Qué es una ronda?', '¿Qué significa ronda?'],
  },
  {
    description: 'Es el precio de Bitcoin registrado al inicio de la ronda. Sirve como referencia para determinar si el resultado será UP o DOWN.',
    id: 'target-price',
    title: 'Precio objetivo',
    keywords: ['valor de referencia', 'precio inicial', 'objetivo'],
    examples: ['¿Qué significa precio objetivo?', '¿Qué es el objetivo?'],
  },
  {
    description: 'Es el precio más reciente de Bitcoin mostrado durante la ronda. Puede cambiar varias veces antes de que termine el tiempo.',
    id: 'current-price',
    title: 'Precio actual',
    keywords: ['precio ahora', 'valor actual', 'precio en vivo'],
    examples: ['¿Qué es el precio actual?', '¿Qué significa precio en vivo?'],
  },
  {
    description: 'Es el precio utilizado al cierre de la ronda. Se compara con el precio objetivo para definir el resultado.',
    id: 'final-price',
    title: 'Precio final',
    keywords: ['precio de cierre', 'valor final', 'cierre de ronda'],
    examples: ['¿Qué es el precio final?', '¿Cuál es el precio de cierre?'],
  },
  {
    description: 'Es la opción que representa una subida. Gana cuando el precio final es igual o mayor que el precio objetivo.',
    id: 'up',
    title: 'UP',
    keywords: ['arriba', 'subida', 'sube'],
    examples: ['¿Qué significa UP?', '¿Qué representa UP?'],
  },
  {
    description: 'Es la opción que representa una bajada. Gana cuando el precio final queda por debajo del precio objetivo.',
    id: 'down',
    title: 'DOWN',
    keywords: ['abajo', 'bajada', 'baja'],
    examples: ['¿Qué significa DOWN?', '¿Qué representa DOWN?'],
  },
  {
    description: 'Es la unidad que recibes al comprar UP o DOWN. Su valor puede cambiar durante la ronda y cada participación ganadora paga US$1.',
    id: 'participation',
    title: 'Participación',
    keywords: ['participaciones', 'unidad', 'compra'],
    examples: ['¿Qué es una participación?', '¿Qué recibo cuando compro?'],
  },
  {
    description: 'Es la probabilidad que el mercado le da a un resultado, expresada en el precio de la participación. Si UP cuesta $0.62, el mercado le está dando 62% a que la ronda termine arriba, porque esa participación paga US$1 si acierta. No es una predicción de Pulse: es el precio que se está pagando en ese momento y cambia durante la ronda.',
    id: 'implied-probability',
    title: 'Probabilidad implícita',
    keywords: ['porcentaje de UP y DOWN', 'qué significa el porcentaje', 'precio como probabilidad', 'qué representa el precio'],
    examples: ['¿Qué es la probabilidad implícita?', '¿Qué significa el porcentaje que aparece en UP?', '¿Por qué el precio se muestra como porcentaje?'],
  },
  {
    description: 'Es el registro de tu participación en una ronda. Incluye información como tu selección, el monto utilizado y el estado del resultado.',
    id: 'entry',
    title: 'Entrada',
    keywords: ['entradas', 'registro', 'predicción'],
    examples: ['¿Qué es una entrada?', '¿Qué información tiene mi entrada?'],
  },
  {
    description: 'Es el total de participaciones que mantienes en UP o DOWN dentro de una ronda. Puede aumentar con nuevas compras o disminuir cuando realizas una venta.',
    id: 'position',
    title: 'Posición',
    keywords: ['posiciones', 'total de participaciones', 'posición abierta'],
    examples: ['¿Qué es una posición?', '¿Qué significa posición abierta?'],
  },
  {
    description: 'Es el monto estimado que recibirías si tu selección gana. Puede cambiar según la cantidad y el precio de las participaciones que compres.',
    id: 'potential-return',
    title: 'Retorno potencial',
    keywords: ['ganancia potencial', 'pago estimado', 'monto estimado'],
    examples: ['¿Qué es el retorno potencial?', '¿Qué significa ganancia potencial?'],
  },
  {
    description: 'Es el proceso que ocurre después del cierre de la ronda. En ese momento se confirma el resultado, se calculan las participaciones ganadoras y se actualiza el saldo.',
    id: 'settlement',
    title: 'Liquidación',
    keywords: ['liquidar', 'cierre', 'actualización del saldo', 'cuándo me pagan', 'cuándo recibo el pago', 'cuándo me depositan lo ganado'],
    examples: ['¿Qué es la liquidación?', '¿Cuándo se actualiza el saldo al terminar?'],
  },
]

export const helpProductItems: HelpProductItem[] = [
  {
    id: 'previous-rounds',
    title: 'Últimas 10 rondas',
    description:
      'Esta sección muestra las 10 rondas completadas más recientes. En cada tarjeta puedes consultar la fecha y el horario, el precio objetivo, el precio final y si el resultado fue UP o DOWN.',
    aliases: [
      'últimas rondas',
      'últimas diez rondas',
      'rondas anteriores',
      'historial de rondas',
      'resultados recientes',
      'resultados anteriores',
      'las 10 anteriores',
    ],
    keywords: ['historial', 'rondas terminadas', 'rondas pasadas', 'últimos resultados'],
    examples: [
      '¿Qué son las últimas 10 rondas?',
      '¿Dónde veo las rondas anteriores?',
      'Muéstrame los resultados recientes',
    ],
    action: 'previous-rounds',
  },
  {
    id: 'price-chart',
    title: 'Gráfico de precio',
    description:
      'El gráfico muestra cómo cambia el precio de Bitcoin durante la ronda. La línea principal representa el precio actual y la referencia del precio objetivo te ayuda a comparar si Bitcoin está arriba o abajo en ese momento.',
    aliases: ['gráfico', 'gráfica', 'gráfico de Bitcoin', 'línea de precio'],
    keywords: ['precio en el gráfico', 'evolución del precio', 'precio durante la ronda'],
    examples: [
      '¿Qué muestra el gráfico?',
      '¿Cómo leo la gráfica?',
      '¿Qué significa la línea del gráfico?',
    ],
  },
  {
    id: 'movements',
    title: 'Movimientos',
    description:
      'En Movimientos puedes consultar las operaciones registradas en tu saldo simulado, como compras, ventas, resultados de rondas y devoluciones.',
    aliases: ['mis movimientos', 'historial de movimientos', 'operaciones de mi saldo'],
    keywords: ['compras y ventas', 'historial de operaciones', 'transacciones'],
    examples: [
      '¿Dónde veo mis movimientos?',
      '¿Dónde está mi historial de operaciones?',
      'Quiero ver mis compras y ventas',
    ],
    action: 'movements',
  },
]

/**
 * Tópicos que existem apenas no assistente.
 *
 * As 12 perguntas frequentes e os 12 termos do glossário foram aprovados e não
 * são alterados aqui. Estes textos cobrem lacunas confirmadas em consultas
 * reais e ficam fora das duas telas aprovadas até que a copy seja revisada.
 * Promover um item para o glossário ou para as perguntas frequentes é mover o
 * objeto de lista, sem outra mudança.
 */
export const helpTopicItems: HelpTopicItem[] = [
  {
    id: 'is-money-real',
    title: 'Saldo simulado',
    description:
      'En esta versión el saldo, las compras y las ventas son simulados: existen para que pruebes la experiencia sin usar dinero real. Los precios de Bitcoin y de las participaciones sí provienen de fuentes de mercado, así que lo que cambia es el dinero, no los datos.',
    aliases: [
      'dinero real',
      'saldo real',
      'es dinero de verdad',
      'es real o simulado',
      'esto es real',
    ],
    keywords: ['dinero simulado', 'prototipo', 'dinero de verdad', 'saldo falso'],
    examples: [
      '¿El dinero de Pulse es real?',
      '¿Estoy usando dinero de verdad?',
      '¿Esto es real o es una simulación?',
    ],
  },
  {
    id: 'amount-limits',
    title: 'Monto mínimo y máximo',
    description:
      'No hay un monto mínimo definido: puedes participar desde $0.01. El máximo depende de tu saldo disponible y de las participaciones disponibles en el mercado en ese momento. Si escribes un monto mayor que tu saldo, el botón de compra muestra Saldo insuficiente.',
    aliases: [
      'monto mínimo',
      'monto máximo',
      'cuánto mínimo',
      'lo mínimo que puedo poner',
      'cuánto puedo poner',
    ],
    keywords: ['mínimo', 'máximo', 'límite de monto', 'cuánto invertir'],
    examples: [
      '¿Cuál es el monto mínimo?',
      '¿Cuánto es lo mínimo que puedo poner?',
      '¿Hay un límite de monto?',
    ],
  },
  {
    id: 'deposits-withdrawals',
    title: 'Depósitos y retiros',
    description:
      'En esta versión, Depositar y Retirar todavía no están disponibles: los botones aparecen en tu perfil, pero no realizan ninguna operación. Empiezas con un saldo simulado ya cargado y ese es el que utilizas durante toda la prueba.',
    aliases: [
      'depositar',
      'retirar',
      'retirar mi dinero',
      'sacar mi dinero',
      'cómo deposito',
    ],
    keywords: ['depósito', 'retiro', 'cobrar', 'sacar saldo'],
    examples: [
      '¿Puedo retirar mi dinero?',
      '¿Cómo deposito saldo?',
      '¿Puedo sacar mis ganancias?',
    ],
  },
  {
    id: 'no-fees',
    title: 'Comisiones',
    description:
      'En esta versión no se aplica ninguna comisión. El monto que utilizas es exactamente el que se descuenta de tu saldo simulado, y lo que recibes por una venta o por una ronda ganada se acredita completo.',
    aliases: ['comisiones', 'comisión', 'cobran algo', 'hay cargos'],
    keywords: ['comisión', 'cargo', 'costo adicional', 'tarifa'],
    examples: [
      '¿Pulse cobra comisiones?',
      '¿Hay algún cargo por comprar?',
      '¿Me descuentan algo cuando gano?',
    ],
  },
  {
    id: 'chance-or-market',
    title: 'Mercado de predicción',
    description:
      'Pulse es un mercado de predicción sobre el precio de Bitcoin: el resultado depende de cómo se mueve el mercado, no de un sorteo. Aun así, nadie puede conocer el resultado por adelantado y puedes no acertar. El precio de UP y DOWN refleja lo que el mercado está pagando por cada resultado en ese momento.',
    aliases: [
      'es azar',
      'juego de azar',
      'es apuesta',
      'es suerte',
      'es un casino',
    ],
    keywords: ['azar', 'suerte', 'apuesta', 'mercado de predicción'],
    examples: [
      '¿Es un juego de azar?',
      '¿Esto es una apuesta?',
      '¿Depende de la suerte?',
    ],
  },
  {
    id: 'how-to-start',
    title: 'Cómo empezar',
    description:
      'Primero mira el precio objetivo y el tiempo que queda en la ronda. Después elige UP si crees que el precio final quedará igual o arriba de ese valor, o DOWN si crees que quedará abajo. Escribe el monto, desliza para confirmar la compra y sigue el resultado en la sección Entradas.',
    aliases: [
      'cómo empiezo',
      'cómo empezar',
      'cómo juego',
      'cómo participo',
      'primeros pasos',
      'cómo se usa',
    ],
    keywords: ['empezar', 'primeros pasos', 'cómo participar', 'cómo comprar'],
    examples: [
      '¿Cómo empiezo?',
      '¿Cómo participo en una ronda?',
      '¿Qué tengo que hacer para comprar?',
    ],
  },
  {
    id: 'why-price-moves',
    title: 'Por qué cambia el precio de las participaciones',
    description:
      'Ese precio refleja lo que el mercado está pagando por cada resultado en ese momento. Cuando Bitcoin se acerca o se aleja del precio objetivo, o cuando queda menos tiempo en la ronda, el precio se ajusta. Por eso el porcentaje de UP y DOWN se mueve durante los 15 minutos.',
    aliases: [
      'por qué cambia el precio',
      'por qué se mueve el porcentaje',
      'por qué sube el precio de UP',
      'por qué baja el precio de DOWN',
    ],
    keywords: [
      'cambio de precio',
      'precio de las participaciones',
      'porcentaje que se mueve',
    ],
    examples: [
      '¿Por qué cambia el precio de UP?',
      '¿Por qué el porcentaje se mueve?',
      '¿Por qué ahora cuesta diferente?',
    ],
  },
  {
    id: 'change-side',
    title: 'Cambiar de lado o tener los dos',
    description:
      'Una entrada no cambia de lado. Si compraste UP y ahora prefieres DOWN, puedes vender tus participaciones de UP mientras haya precio de venta y después comprar DOWN. También puedes tener participaciones en UP y en DOWN al mismo tiempo dentro de la misma ronda, pero solo uno de los dos lados recibe pago al cierre.',
    aliases: [
      'cambiar de lado',
      'cambiar de UP a DOWN',
      'cambiar de DOWN a UP',
      'cambiarme de lado',
      'comprar los dos lados',
      'tener UP y DOWN',
      'comprar UP y DOWN',
    ],
    keywords: ['cambiar entrada', 'los dos lados', 'ambos lados', 'arrepentirme'],
    examples: [
      '¿Puedo cambiar de UP a DOWN?',
      '¿Puedo comprar los dos lados?',
      '¿Puedo tener UP y DOWN en la misma ronda?',
    ],
  },
  {
    id: 'chart-ranges',
    title: 'Rangos del gráfico',
    description:
      'Los botones debajo del gráfico cambian el periodo que se muestra. LIVE sigue el precio de la ronda en curso, mientras que 5M, 15M y 1H amplían la vista a los últimos 5 minutos, 15 minutos y 1 hora. Cambiar el rango solo cambia lo que ves: no afecta tu entrada ni el resultado de la ronda.',
    aliases: [
      'rangos del gráfico',
      'LIVE 5M 15M 1H',
      'qué significa LIVE',
      'qué significa 5M',
      'qué significa 15M',
      'qué significa 1H',
      'botones del gráfico',
    ],
    keywords: ['periodo del gráfico', 'zoom del gráfico', 'vista del gráfico'],
    examples: [
      '¿Qué significa LIVE en el gráfico?',
      '¿Para qué sirven 5M y 15M?',
      '¿Qué cambian los botones debajo del gráfico?',
    ],
  },
  {
    id: 'rounds-per-day',
    title: 'Cuántas rondas hay',
    description:
      'Las rondas duran 15 minutos y se suceden sin pausa, así que hay 96 rondas por día. En cuanto una termina, la siguiente empieza con un precio objetivo nuevo. No necesitas participar en todas: puedes entrar en la que quieras, mientras siga abierta.',
    aliases: [
      'cuántas rondas hay',
      'cuántas rondas al día',
      'cuántas rondas por día',
      'cada cuánto hay una ronda',
      'cuándo empieza la próxima ronda',
      'próxima ronda',
    ],
    keywords: ['frecuencia de las rondas', 'rondas por día', 'siguiente ronda'],
    examples: [
      '¿Cuántas rondas hay al día?',
      '¿Cada cuánto empieza una ronda?',
      '¿Tengo que participar en todas las rondas?',
    ],
  },
]

/**
 * Conversa básica. Sem isso, `hola` e `gracias` caem no fallback de baixa
 * confiança, que é o pior primeiro contato possível com o assistente.
 */
export const helpSmallTalkItems: HelpSmallTalkItem[] = [
  {
    id: 'greeting',
    answer: 'Hola. Soy el asistente de Pulse y respondo con la información de tu ronda y de tu cuenta. ¿Qué quieres saber?',
    utterances: [
      'hola',
      'holi',
      'buenas',
      'buenos dias',
      'buenas tardes',
      'buenas noches',
      'que tal',
      'hey',
      'ola',
    ],
    withMenu: true,
  },
  {
    id: 'thanks',
    answer: 'Con gusto. Si te queda otra duda sobre la ronda, los precios o tus entradas, aquí sigo.',
    utterances: [
      'gracias',
      'muchas gracias',
      'mil gracias',
      'te lo agradezco',
      'genial gracias',
      'ok gracias',
    ],
    withMenu: false,
  },
  {
    id: 'farewell',
    answer: 'Hasta luego. Puedes volver a abrirme desde el Centro de ayuda cuando quieras.',
    utterances: ['adios', 'hasta luego', 'nos vemos', 'bye', 'chao'],
    withMenu: false,
  },
  {
    id: 'capabilities',
    answer: 'Puedo responderte con los datos reales de este momento: la probabilidad implícita de UP y DOWN, cuánto tiempo queda en la ronda, cómo va tu entrada, tu saldo y las últimas rondas. También explico cómo funciona Pulse. Lo que no hago es recomendarte UP o DOWN ni predecir el precio de Bitcoin.',
    utterances: [
      'que puedes hacer',
      'que sabes hacer',
      'en que me puedes ayudar',
      'para que sirves',
      'quien eres',
      'que eres',
      'como funcionas',
    ],
    withMenu: true,
  },
  {
    id: 'confused',
    answer: 'Sin problema, vamos por partes. Dime qué parte no quedó clara y la explico con los datos de tu ronda.',
    utterances: [
      'no entendi',
      'no entiendo',
      'no entendi nada',
      'no me quedo claro',
      'explicame de nuevo',
      'como asi',
      'no se',
    ],
    withMenu: true,
  },
  {
    id: 'open-help',
    answer: 'Claro. Pregúntame directamente lo que necesites; respondo con los datos de tu ronda y de tu cuenta.',
    utterances: ['ayuda', 'ayudame', 'necesito ayuda', 'auxilio'],
    withMenu: true,
  },
]
