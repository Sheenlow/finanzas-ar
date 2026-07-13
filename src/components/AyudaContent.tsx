'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDebounce } from '@/hooks/useDebounce'
import {
  Rocket, Wallet, ArrowRightLeft, LayoutDashboard, Home, Target,
  Bot, HelpCircle, ChevronDown, Search
} from 'lucide-react'

interface Section {
  id: string
  title: string
  icon: React.ElementType
  items: { question: string; answer: string }[]
}

function AccordionItem({ section }: { section: Section }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors select-none text-left"
      >
        <section.icon className="w-5 h-5 text-primary shrink-0" />
        <span className="text-base font-semibold flex-1">{section.title}</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {section.items.length}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.04, 0.62, 0.23, 0.98] }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
          >
            <div className="px-5 pb-4 space-y-4">
              {section.items.map((item, i) => (
                <div key={i} className="border-t border-border/50 pt-4 first:border-0 first:pt-0">
                  <p className="text-sm font-medium text-foreground mb-1.5">{item.question}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const sections: Section[] = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    icon: Rocket,
    items: [
      {
        question: 'Como creo mi cuenta?',
        answer: 'Anda a la pagina de Registro desde el boton "Registrarse" en la pantalla de inicio de sesion. Completa tu nombre, apellido, email y una contraseña segura (minimo nivel "Fuerte"). Acepta los terminos y condiciones. Recibiras un email de verificacion en tu casilla.',
      },
      {
        question: 'No recibi el email de verificacion',
        answer: 'Revisa la carpeta de spam o correo no deseado. Si no aparece, espera unos minutos. El remitente es Supabase (el servicio de autenticacion). Si seguis sin recibirlo, intenta registrarte de nuevo.',
      },
      {
        question: 'Como creo mi primera cuenta (billetera)?',
        answer: 'Anda a la seccion "Cuentas" desde el menu lateral. Completa el formulario con el nombre de la cuenta (ej: "Galicia", "Efectivo", "Binance"), el balance inicial, la moneda y el tipo (Banco, Efectivo o Crypto). Hace clic en "Crear Cuenta".',
      },
      {
        question: 'Que monedas puedo usar?',
        answer: 'ARS (pesos argentinos), USD (dolares), USDT, USDC, BTC y ETH. Cada cuenta puede estar en una moneda distinta. En el Dashboard vas a ver tu patrimonio consolidado en ARS o USD usando la cotizacion del dolar blue en tiempo real.',
      },
    ],
  },
  {
    id: 'cuentas',
    title: 'Cuentas',
    icon: Wallet,
    items: [
      {
        question: 'Que tipos de cuenta existen?',
        answer: 'Cuatro tipos: Banco (cuentas bancarias, billeteras virtuales como Mercado Pago), Efectivo (dinero en mano, "colchon"), Crypto (exchanges, wallets) y Tarjeta de Credito (con gestion de cierres y ciclos de facturacion). Elegi el tipo que corresponda al crear la cuenta.',
      },
      {
        question: 'Como funciona la Tarjeta de Credito?',
        answer: 'Al crear una cuenta tipo "Tarjeta de Credito" podes configurar la regla de cierre: "Ultimo jueves" (autoestima el cierre segun la regla bancaria argentina, donde el cierre es el ultimo jueves de cada mes salvo que el mes termine lunes o martes, en cuyo caso pasa al primer jueves del mes siguiente) o "Dia fijo". Tambien podes cargar ciclos de facturacion reales cuando el banco te notifica la fecha exacta. El sistema prioriza: ciclo real > estimacion automatica > dia fijo.',
      },
      {
        question: 'Puedo editar o eliminar una cuenta?',
        answer: 'Si. En la seccion "Cuentas", cada cuenta tiene botones para editar (lapiz) y eliminar (tacho). Al editar podes cambiar el nombre, balance, moneda o tipo. Al eliminar, la cuenta y su historial de transacciones se borran permanentemente.',
      },
      {
        question: 'El balance se actualiza solo?',
        answer: 'Si. Cada vez que registras un gasto o ingreso en una cuenta, el balance se actualiza automaticamente. Si borras una transaccion, el balance se revierte.',
      },
    ],
  },
  {
    id: 'transacciones',
    title: 'Transacciones',
    icon: ArrowRightLeft,
    items: [
      {
        question: 'Como registro un gasto?',
        answer: 'Anda a "Consumos" desde el menu. Completa: descripcion (ej: "Supermercado"), monto, fecha, tipo (gasto o ingreso), categoria, cuenta, moneda y metodo de pago (efectivo, tarjeta o transferencia). Hace clic en "Crear".',
      },
      {
        question: 'Como funcionan las cuotas?',
        answer: 'Al elegir metodo de pago "Tarjeta", vas a ver la opcion "En cuotas". Activala y elegi la cantidad (3, 6, 9, 12, 18, 24 o personalizada). El sistema divide el monto total en cuotas iguales y genera automaticamente las transacciones futuras con fecha incrementada mes a mes.',
      },
      {
        question: 'Que es un gasto recurrente?',
        answer: 'Es un gasto que se repite periodicamente (suscripciones, servicios). Al activar "Fijar como gasto recurrente", elegis la frecuencia (mensual, trimestral, semestral o anual). El sistema genera automaticamente la transaccion cada periodo.',
      },
      {
        question: 'Diferencia entre suscripcion y servicio?',
        answer: 'Ambos son gastos recurrentes. "Suscripcion" es para servicios pagos como Netflix, Spotify, etc. "Servicio" es para gastos fijos como luz, gas, internet. A nivel funcional se comportan igual, pero se muestran con distintos badges visuales.',
      },
      {
        question: 'Que metodos de pago hay?',
        answer: 'Efectivo (cash), Tarjeta (debito o credito) y Transferencia. Si elegis Tarjeta de Credito, el sistema asigna automaticamente el gasto al mes de facturacion correcto (cuando llega el resumen), no al mes calendario en que hiciste la compra.',
      },
      {
        question: 'Como sabe el sistema a que mes pertenece una compra con tarjeta?',
        answer: 'Cada compra con tarjeta de credito recibe un "mes de facturacion" automatico. Si tu tarjeta cierra el 18 y compras el 20 de mayo, el gasto aparece en el dashboard de junio (cuando llega el resumen y lo pagas). La estimacion usa la regla configurada en la cuenta (ultimo jueves o dia fijo). Si el banco te avisa un cierre distinto al estimado, podes registrarlo manualmente en la seccion Cuentas y el sistema corrige el mes automaticamente.',
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      {
        question: 'Que muestra el balance consolidado?',
        answer: 'La suma de todos los saldos de tus cuentas, unificados en una sola moneda (ARS o USD). Podes cambiar la moneda de visualizacion con el boton de toggle. Las criptomonedas se convierten a USD usando la cotizacion en tiempo real de CoinGecko.',
      },
      {
        question: 'Como funciona el selector de mes?',
        answer: 'Arriba a la derecha en el Dashboard hay un selector de mes y año. Al cambiar de mes, las transacciones, graficos y reportes se filtran para mostrar solo ese periodo. Util para revisar meses anteriores.',
      },
      {
        question: 'Que graficos hay?',
        answer: 'Tres graficos principales: Tendencias (barras de ingresos vs gastos de los ultimos 6 meses), Grafico de torta (distribucion de gastos por categoria en el mes actual), y Reporte de gastos fijos (grafico de barras anual + tabla detallada).',
      },
      {
        question: 'Para que sirve el reporte de gastos fijos?',
        answer: 'Muestra todos los gastos que son suscripciones, servicios o cuotas. Incluye un grafico de barras con el promedio mensual y una tabla con filtros (por descripcion, monto, tipo y cuenta) para analizar tus gastos fijos.',
      },
    ],
  },
  {
    id: 'hogar',
    title: 'Hogar',
    icon: Home,
    items: [
      {
        question: 'Que es un hogar?',
        answer: 'Un espacio compartido entre miembros de una casa (familia, pareja, roommates) para registrar y dividir gastos comunes. Cada miembro ve las transacciones del hogar y puede saber cuanto debe o le deben.',
      },
      {
        question: 'Como creo un hogar e invito miembros?',
        answer: 'Anda a "Hogar" en el menu. Hace clic en "Crear Hogar", asigna un nombre. Luego usa el boton "Invitar" e ingresa el email de la persona. Esa persona recibira un enlace unico para unirse. Al hacer clic, debe iniciar sesion con el mismo email.',
      },
      {
        question: 'Como funciona el split automatico?',
        answer: 'Cada miembro declara su ingreso mensual en ARS desde la seccion Hogar. El sistema calcula automaticamente el porcentaje que le corresponde a cada uno: (mi ingreso / ingreso total) × 100. Al registrar un gasto compartido, cada miembro ve cuanto le corresponde pagar.',
      },
      {
        question: 'Diferencia entre mostrar y compartir un gasto',
        answer: '"Mostrar en el hogar" hace que el gasto sea visible para todos los miembros en la tabla del hogar, pero NO se divide. "Compartir con el hogar" ademas de mostrarlo, lo divide entre los miembros segun el split automatico y actualiza los balances de deudas.',
      },
      {
        question: 'Como liquido una deuda con otro miembro?',
        answer: 'En la seccion Hogar, abajo de la tabla de gastos, vas a ver el widget de balances ("Te deben" o "Debes"). Hace clic en "Ya me pago" y completa el monto a liquidar. El sistema actualiza los balances y registra la liquidacion en el historial.',
      },
      {
        question: 'Que es transferir admin?',
        answer: 'El admin es quien creo el hogar. Puede transferir ese rol a otro miembro desde los botones de gestion de miembros. El nuevo admin podra invitar, expulsar y administrar el hogar. Solo puede haber un admin a la vez.',
      },
      {
        question: 'Como exporto los gastos del hogar?',
        answer: 'En la seccion Hogar hay un boton "Exportar CSV" que descarga un archivo con todas las transacciones del hogar (fecha, descripcion, quien pago, monto, moneda, tipo). Util para llevar a Excel o Google Sheets.',
      },
    ],
  },
  {
    id: 'metas',
    title: 'Metas de ahorro',
    icon: Target,
    items: [
      {
        question: 'Como creo una meta de ahorro?',
        answer: 'Anda a "Metas" en el menu. Completa el nombre de la meta (ej: "Viaje a Bariloche"), monto objetivo, monto ya ahorrado, moneda (ARS o USD) y opcionalmente una fecha limite. Hace clic en "Crear Meta".',
      },
      {
        question: 'Como deposito en una meta?',
        answer: 'En la tarjeta de la meta, hace clic en el boton de deposito (+), ingresa el monto y confirma. El progreso se actualiza automaticamente y queda registrado quien hizo el deposito.',
      },
      {
        question: 'Que son las metas compartidas?',
        answer: 'Al crear una meta, si perteneces a un hogar, podes marcarla como "Compartida con el hogar". Todos los miembros del hogar pueden verla y depositar en ella. Ideal para objetivos grupales como un fondo comun.',
      },
      {
        question: 'Que pasa cuando alcanzo una meta?',
        answer: 'Al llegar al 100% del monto objetivo, la barra de progreso se pone verde y se lanza un efecto de confetti en pantalla. La meta queda registrada como completada.',
      },
    ],
  },
  {
    id: 'bot',
    title: 'Bot de Telegram',
    icon: Bot,
    items: [
      {
        question: 'Como vinculo el bot de Telegram?',
        answer: 'En el Dashboard, busca la seccion "Vincula tu bot de Telegram" (color indigo). Copia el codigo que aparece (formato UUID). Envia el comando /vincular seguido del codigo al bot (ej: /vincular a1b2c3d4-e5f6-7890-abcd-ef1234567890). Podes encontrar al bot en https://t.me/FinanzasArBot o buscandolo como @FinanzasArBot en Telegram.',
      },
      {
        question: 'Donde encuentro el bot?',
        answer: 'Podes acceder directamente desde https://t.me/FinanzasArBot o buscarlo manualmente en Telegram como @FinanzasArBot.',
      },
      {
        question: 'Que puedo hacer con el bot?',
        answer: 'Registrar gastos por texto, consultar saldos y estadisticas, y personalizar como la IA interpreta tus mensajes.',
      },
      {
        question: 'Como registro un gasto por texto?',
        answer: 'Escribi en el chat del bot describiendo el gasto. Ejemplos: "Supermercado 8000 efectivo", "Netflix 12 USD debito", "Nafta 5000 credito 3 cuotas", "Zapatillas 25000 credito". El bot te va a guiar paso a paso para confirmar cada detalle.',
      },
      {
        question: 'Que comandos tiene el bot?',
        answer: '/stats — Resumen de gastos del mes actual. /list — Ultimos 10 gastos registrados. /balance — Saldo actual de todas tus cuentas. /ayuda — Guia completa de uso (lo que estas viendo ahora, resumido). /config — Personalizar el prompt de IA. /desvincular — Desvincular tu cuenta de Telegram. Al pagar con tarjeta de credito, el bot calcula automaticamente el mes de facturacion correcto usando la regla de cierre de tu cuenta.',
      },
      {
        question: 'Como aprende el bot?',
        answer: 'Cuando el bot te pregunta "Confirma el gasto" y vos tocas "Editar" para cambiar la categoria o la cuenta, el bot aprende de esa correccion. La proxima vez que uses una palabra similar, la va a asignar automaticamente. Las reglas aprendidas tambien se usan al consultar a la IA.',
      },
      {
        question: 'Como personalizo la IA?',
        answer: 'Usa el comando /config seguido de tus instrucciones. Ejemplo: /config Mis cuentas son Galicia, MP y Efectivo. Siempre asumi que pago con debito. Esto se agrega al prompt que se envia a la IA cada vez que interpreta un gasto.',
      },
    ],
  },
  {
    id: 'faq',
    title: 'Preguntas frecuentes',
    icon: HelpCircle,
    items: [
      {
        question: 'Mis datos estan seguros?',
        answer: 'Si. Usamos Supabase con Row Level Security (RLS): cada usuario solo puede ver y modificar sus propios datos. Las contraseñas se almacenan encriptadas. Las conexiones usan HTTPS. Las API keys sensibles nunca se exponen al frontend.',
      },
      {
        question: 'Que pasa si borro una cuenta?',
        answer: 'Al borrar una cuenta, todas las transacciones asociadas a esa cuenta se eliminan en cascada. Los balances de otras cuentas no se ven afectados. Esta accion no se puede deshacer.',
      },
      {
        question: 'Que pasa si borro una transaccion?',
        answer: 'El monto de la transaccion se revierte en el balance de la cuenta asociada. Si la transaccion tenia cuotas, solo se borra la cuota individual, no las demas.',
      },
      {
        question: 'Puedo estar en mas de un hogar a la vez?',
        answer: 'Actualmente no. Cada usuario puede pertenecer a un solo hogar. Si queres cambiar de hogar, primero tenes que abandonar el actual (o que te expulsen).',
      },
      {
        question: 'Como cambio mi contraseña?',
        answer: 'La gestion de contraseña se hace a traves de Supabase. En la pantalla de login hay un enlace de "Olvide mi contraseña" que envia un email de recuperacion.',
      },
      {
        question: 'La sesion se cierra sola?',
        answer: 'Si, por seguridad. Despues de 30 minutos de inactividad, aparece un modal de advertencia. Si no respondes en 1 minuto, la sesion se cierra y volves a la pantalla de login.',
      },
      {
        question: 'Se puede usar sin conexion a internet?',
        answer: 'No. Finanzas AR es una aplicacion web que requiere conexion para acceder a la base de datos y a las APIs externas (cotizaciones).',
      },
    ],
  },
]

export function AyudaContent() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)

  const filteredSections = debouncedSearch.trim()
    ? sections
        .map(section => ({
          ...section,
          items: section.items.filter(
            item =>
              item.question.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
              item.answer.toLowerCase().includes(debouncedSearch.toLowerCase())
          ),
        }))
        .filter(section => section.items.length > 0)
    : sections

  const leftSections = filteredSections.filter((_, i) => i % 2 === 0)
  const rightSections = filteredSections.filter((_, i) => i % 2 === 1)

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Centro de ayuda</h1>
        <p className="text-muted-foreground text-sm">
          Encontra respuestas a las preguntas mas frecuentes sobre como usar Finanzas AR.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar en la ayuda..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          aria-label="Buscar en la ayuda"
        />
      </div>

      {filteredSections.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No se encontraron resultados para &ldquo;{debouncedSearch}&rdquo;.
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 flex flex-col gap-4">
          {leftSections.map(section => (
            <AccordionItem key={section.id} section={section} />
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-4">
          {rightSections.map(section => (
            <AccordionItem key={section.id} section={section} />
          ))}
        </div>
      </div>

      <div className="bg-muted/30 border border-border rounded-2xl p-5 text-center">
        <p className="text-sm text-muted-foreground">
          No encontraste lo que buscabas?{' '}
          <span className="text-foreground font-medium">
            Proba el bot de Telegram con el comando /ayuda para una version resumida de esta guia.
          </span>
        </p>
      </div>
    </div>
  )
}
