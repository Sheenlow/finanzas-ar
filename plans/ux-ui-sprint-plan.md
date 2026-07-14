# PLAN UX/UI — SPRINTS

**Documento base:** `AUDITORIA_360.md` — Sección "🧑‍💻 PERSPECTIVA DE USUARIO (UX/UI)"

**Principio rector:** Cada sprint entrega una mejora que el usuario siente inmediatamente. Las dependencias entre sprints son mínimas para permitir trabajo en paralelo.

---

## Mapa de Dependencias

```
Sprint 0 (Base UX)
├── Empty states + Alert variants + MonthSelector multi-año
│
├── Sprint 1 (Onboarding) ← depende de Sprint 0
│   └── Wizard post-registro + flag en BD
│
├── Sprint 2 (Transacciones) ← depende de Sprint 0
│   └── Modo rápido + formulario simplificado
│
├── Sprint 3 (Hogar UX) ← independiente
│   ├── Visualización de split por transacción
│   └── Bot: comandos de hogar
│
├── Sprint 4 (Vinculación + Resiliencia) ← independiente
│   ├── Deep link del bot
│   └── Retry en errores
│
└── Sprint 5 (Accesibilidad) ← independiente
    ├── Labels + skip-link
    ├── Focus management
    └── Focus-visible + color contrast
```

---

## Sprint 0 — Base de UX (3 días)

**Objetivo:** Sentar las bases visuales y de feedback que todo el resto de sprints va a usar.

### Tarea 0.1: Empty States con Call-to-Action

| Campo | Detalle |
|-------|---------|
| **Problema** | Dashboard, accounts y transactions vacíos no guían al usuario |
| **Archivos** | `src/components/dashboard/DashboardClient.tsx`, `src/components/dashboard/MonthlyTransactions.tsx:81`, `src/components/dashboard/ConsolidatedBalance.tsx` |
| **Archivos nuevos** | `src/components/ui/EmptyState.tsx` |
| **Qué hacer** | Crear componente `EmptyState` reutilizable con: ícono (Lucide), título, descripción, botón de CTA + callback. Insertarlo en 4 ubicaciones: (a) balance consolidado = 0 → "Creá tu primera cuenta", (b) grid de cuentas vacío → "Agregá una cuenta", (c) tabla de transacciones vacía → "Registrá tu primer gasto", (d) gráfico de torta sin datos → mismo CTA que (c) |
| **Criterio de aceptación** | Un usuario nuevo ve 4 empty states distintos con acciones concretas, no un dashboard mudo |

### Tarea 0.2: Expandir Variantes del Componente Alert

| Campo | Detalle |
|-------|---------|
| **Problema** | `Alert` solo tiene `variant="error"`. No hay feedback para éxito, info o advertencia |
| **Archivos** | `src/components/ui/Alert.tsx` |
| **Qué hacer** | Agregar variantes: `success` (verde, ícono `CheckCircle2`), `warning` (ámbar, ícono `AlertTriangle`), `info` (azul, ícono `Info`). Mantener compatibilidad con `error` existente. Actualizar todos los usos actuales (buscar con grep `Alert variant`) |
| **Criterio de aceptación** | Cualquier pantalla puede mostrar feedback en 4 niveles de severidad. Los usos existentes no se rompen |

### Tarea 0.3: MonthSelector con Navegación Interanual

| Campo | Detalle |
|-------|---------|
| **Problema** | Solo muestra meses del año actual, imposible ver datos históricos |
| **Archivos** | `src/components/MonthSelector.tsx` |
| **Qué hacer** | Agregar flechas `<` `>` para navegar años. El rango va desde la fecha de la primera transacción del usuario hasta el mes actual. Modificar `options` para generarse dinámicamente según el año seleccionado. El estado pasa de `string` a `{ year: number, month: number }` |
| **Criterio de aceptación** | Puedo ver febrero 2025 estando en julio 2026. La URL se actualiza correctamente con `?month=YYYY-MM` |

---

## Sprint 1 — Onboarding (4 días)

**Objetivo:** Que un usuario nuevo sepa exactamente qué hacer en sus primeros 60 segundos.

### Tarea 1.1: Flag de Onboarding en BD

| Campo | Detalle |
|-------|---------|
| **Archivos** | Nueva migración SQL `00015_onboarding_flag.sql`, `src/types/database.types.ts` (regenerar tipos) |
| **Qué hacer** | Agregar columna `onboarding_completed BOOLEAN DEFAULT FALSE` a `public.profiles`. Actualizar tipos de Supabase. El trigger `handle_new_user` ya lo setea en false por defecto |
| **Criterio de aceptación** | `GET /api/user/profile` devuelve `{ onboarding_completed: false }` para usuarios nuevos |

### Tarea 1.2: Componente OnboardingWizard

| Campo | Detalle |
|-------|---------|
| **Archivos nuevos** | `src/components/onboarding/OnboardingWizard.tsx`, `src/components/onboarding/StepCreateAccount.tsx`, `src/components/onboarding/StepFirstTransaction.tsx`, `src/components/onboarding/StepHouseholdInvite.tsx` |
| **Qué hacer** | Wizard de 3 pasos con `motion.div` y `AnimatePresence`. Paso 1: miniformulario de cuenta (tipo predefinido: efectivo ARS por defecto, nombre "Efectivo", sin balance). Paso 2: QuickTransactionInput (del Sprint 2, o mini form de gasto de 3 campos: descripción, monto, categoría). Paso 3: "¿Vivís con alguien?" → botón de crear hogar o saltar. Barra de progreso (paso N/3). Botón "Saltar" en cada paso. Al finalizar, PATCH `profiles.onboarding_completed = true` |
| **Criterio de aceptación** | Usuario completa los 3 pasos en <90 segundos. Puede saltar pasos. Al terminar, ve el dashboard con datos reales (su cuenta y su primer gasto) |

### Tarea 1.3: Integración en Dashboard

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/layout.tsx`, `src/components/UserProvider.tsx` |
| **Qué hacer** | `UserProvider` carga `onboarding_completed` del perfil. Dashboard page: si `onboarding_completed === false`, renderiza `OnboardingWizard` en lugar del contenido normal. Si `true`, comportamiento actual |
| **Criterio de aceptación** | Primer login → wizard. Segundo login → dashboard normal |

---

## Sprint 2 — Transacciones Simplificadas (4 días)

**Objetivo:** Reducir la fricción de crear transacciones de 7 decisiones a 1 input de texto.

### Tarea 2.1: QuickTransactionInput — Componente Web del Parser

| Campo | Detalle |
|-------|---------|
| **Archivos nuevos** | `src/components/forms/QuickTransactionInput.tsx` |
| **Archivos a modificar** | `src/services/bot/parser.ts` (verificar que sea exportable para web) |
| **Qué hacer** | Componente con un solo `<input>` y un botón "Registrar". El usuario escribe lenguaje natural: "cafe 2500 efectivo comida", "nafta 15000 credito 3 cuotas", "sueldo 500000 transferencia". Internamente usa `parseText()` del bot parser para extraer: descripción, monto, moneda, método de pago, cuotas, categoría (por keyword aprendido). **Preview en tiempo real** debajo del input: muestra lo que entendió ("Café · $2.500 · Efectivo · Comida") antes de confirmar. Si falla el parseo, muestra los campos del form tradicional para completar manualmente |
| **Criterio de aceptación** | 80% de transacciones cotidianas se crean desde el input rápido en <10 segundos, sin tocar el form completo |

### Tarea 2.2: Quick Input + Form Completo en Misma Pantalla

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/components/forms/TransactionForm.tsx`, `src/app/(dashboard)/page.tsx` |
| **Qué hacer** | Agregar `QuickTransactionInput` en la parte superior del dashboard (debajo del header, antes de las cuentas) como acceso rápido. El `TransactionForm` completo queda accesible con toggle "Modo avanzado" / "Modo rápido". En la página `/transactions`, el QuickInput está arriba y el form completo debajo con un `<details>` colapsado por defecto |
| **Criterio de aceptación** | El dashboard tiene un input rápido visible sin scroll. El form completo está a un click pero no abruma |

### Tarea 2.3: Aprendizaje de Keywords desde la Web

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/services/bot/keywords.ts`, `src/components/forms/QuickTransactionInput.tsx` |
| **Qué hacer** | Cuando el usuario corrige una categoría o cuenta en el preview del QuickInput (antes de confirmar), se registra la regla de keyword en `bot_rules` con `saveKeywordRule()`. Esto unifica el aprendizaje entre bot y web |
| **Criterio de aceptación** | Si corregí "cafe" → "Restaurantes/Delivery" 1 vez, la próxima vez que escriba "cafe 3000" se asigna automáticamente a esa categoría |

---

## Sprint 3 — Hogar UX (4 días)

**Objetivo:** Que el split del hogar sea transparente y la experiencia web ↔ bot sea consistente.

### Tarea 3.1: Visualización de Split por Transacción

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/components/household/TransactionList.tsx`, `src/components/household/HouseholdManager.tsx` |
| **Archivos nuevos** | `src/components/household/SplitTooltip.tsx` |
| **Qué hacer** | En la lista de transacciones del hogar: (a) badge que indique "Dividido" con el % del usuario actual. (b) hover/tap muestra tooltip con desglose completo: nombre de cada miembro + monto + %. Los datos se obtienen de `household_share_records` para esa transacción. Si la transacción no fue dividida, no mostrar badge |
| **Criterio de aceptación** | Puedo ver exactamente cuánto pagó cada miembro en cada gasto del hogar sin ir a otra pantalla |

### Tarea 3.2: Explicación Visual del Sistema de Split

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/components/household/HouseholdManager.tsx:220-228` |
| **Qué hacer** | Reemplazar el bloque de texto explicativo actual por un diagrama visual de 3 pasos: (1) "Declará tus ingresos mensuales" → icono de dinero, (2) "El sistema calcula tu % automáticamente" → barra de proporciones, (3) "Cada gasto se divide al registrarlo" → iconos de miembros con %. Agregar distinción clara entre modo "Auto-split (por ingresos)" y "Split manual (por % fijo)". Badge visual que indique modo activo |
| **Criterio de aceptación** | Un usuario nuevo entiende el split en <30 segundos sin leer párrafos de texto |

### Tarea 3.3: Bot — Soporte de Hogar

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/services/bot/stateMachine.ts`, `src/services/bot/commands.ts`, `src/services/bot/messages.ts` |
| **Qué hacer** | (a) Nuevo comando `/hogar`: responde con balance actual del hogar (quién debe a quién, formato resumido). (b) Nuevo estado en state machine: si el usuario tiene hogar activo y el gasto es de tipo `expense`, el bot pregunta "¿Compartir con el hogar?" → si dice sí, procede al split con los miembros. (c) Nuevo mensaje `MSG_HOUSEHOLD_BALANCE` en `messages.ts` |
| **Criterio de aceptación** | Desde Telegram puedo ver balances del hogar y registrar gastos compartidos que aparecen en la web |

---

## Sprint 4 — Vinculación + Resiliencia (3 días)

**Objetivo:** Eliminar fricción en la vinculación bot↔web y hacer la app más tolerante a fallos.

### Tarea 4.1: Deep Link para Vinculación del Bot

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/components/dashboard/DashboardClient.tsx:146-201`, `src/app/api/bot/telegram/route.ts`, `src/services/bot/commands.ts` |
| **Qué hacer** | (a) Dashboard: reemplazar el `<code>` con el UUID por un botón "Vincular en Telegram" que abre `https://t.me/FinanzasArBot?start=<link_token>`. (b) Webhook: procesar mensajes con `text` que empiece con `/start <token>` → llamar a la lógica de vinculación automáticamente (mismo código que `/vincular <token>`). (c) Si el token es válido, responder con mensaje de éxito. Si ya fue usado, responder con error descriptivo |
| **Criterio de aceptación** | Vincular la cuenta requiere 1 click (abrir Telegram desde el botón) y 0 tipeo de UUIDs |

### Tarea 4.2: Retry en Estados de Error

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/app/(dashboard)/error.tsx`, `src/app/error.tsx`, `src/components/ui/Alert.tsx` |
| **Archivos nuevos** | `src/hooks/useRetry.ts` |
| **Qué hacer** | Hook `useRetry(fn)` que expone `{ execute, loading, error, retry }`. En error boundaries: botón "Reintentar" que llama a `router.refresh()`. En llamadas API de formularios (TransactionForm, AccountForm, GoalForm): mensaje de error específico + botón de reintento. En loaders de datos (useEffect con fetch): si falla, mostrar skeleton + botón de reintento |
| **Criterio de aceptación** | Ningún error deja al usuario sin opción de recuperación. El botón "Reintentar" está presente en cada estado de error |

---

## Sprint 5 — Accesibilidad (3 días)

**Objetivo:** Cumplir con WCAG 2.1 AA en los puntos críticos.

### Tarea 5.1: Labels Asociados en Formularios

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/components/forms/TransactionForm.tsx`, `src/components/forms/AccountForm.tsx`, `src/components/forms/GoalForm.tsx`, `AmountInput.tsx`, `AccountSelect.tsx`, `TypeToggle.tsx`, `InstallmentsSection.tsx`, `RecurringSection.tsx`, `HouseholdSection.tsx` |
| **Qué hacer** | Cada input/select con solo `placeholder` recibe un `<label htmlFor={id}>` visible o `sr-only`. Modificar componentes atómicos para aceptar prop `label`. En `QuickTransactionInput`, el label es "Registrar gasto o ingreso (ej: cafe 2500 efectivo)" con `sr-only`. Asociar mensajes de error con `aria-describedby` al input que los generó |
| **Criterio de aceptación** | Lighthouse Accessibility score ≥ 95 en páginas con formularios |

### Tarea 5.2: Skip-to-Content Link

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/app/(dashboard)/layout.tsx` o `src/components/layout/Sidebar.tsx` |
| **Qué hacer** | Primer elemento del `<body>` en el dashboard layout: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Saltar al contenido principal</a>`. El `<main>` recibe `id="main-content"`. Styling: visible solo en focus, centrado arriba, fondo primary, texto white |
| **Criterio de aceptación** | Presionando Tab al cargar la página, el primer elemento enfocado es "Saltar al contenido principal" |

### Tarea 5.3: Focus Management en Modales

| Campo | Detalle |
|-------|---------|
| **Archivos nuevos** | `src/hooks/useModalFocus.ts` |
| **Archivos a modificar** | `src/components/household/SettlementModal.tsx`, `src/components/household/LeaveModal.tsx`, `src/components/household/DeleteModal.tsx`, modales en `src/components/GoalItem.tsx` |
| **Qué hacer** | Hook `useModalFocus(isOpen, triggerRef)`: al abrir (`isOpen = true`), guarda `document.activeElement` como trigger, busca el primer elemento enfocable dentro del modal y le aplica `.focus()`. Al cerrar, devuelve foco al trigger. Implementa trampa de foco (Tab/Shift+Tab ciclan dentro del modal). Maneja Escape para cerrar |
| **Criterio de aceptación** | Abrir un modal mueve el foco adentro. Cerrarlo devuelve el foco al botón que lo abrió. Tab no se escapa del modal |

### Tarea 5.4: Focus-Visible y Contraste

| Campo | Detalle |
|-------|---------|
| **Archivos** | `src/app/globals.css`, `src/components/ui/Alert.tsx` (badges de categoría) |
| **Qué hacer** | Agregar en `globals.css`: regla `:focus-visible` global con `outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 4px`. Para badges de categoría: en lugar de `color + '18'`, usar helper `ensureContrast(bgColor)` que verifique ratio ≥ 4.5:1 contra el fondo del tema y ajuste la opacidad. Considerar usar `color-mix(in srgb, var 12%, transparent)` de CSS para Tailwind v4 |
| **Criterio de aceptación** | Navegación completa con Tab muestra anillos de focus visibles. Badges de categoría son legibles en ambos temas |

---

## Cronograma Estimado

| Sprint | Días | Depende de | Entregable principal |
|--------|------|-----------|---------------------|
| **S0** — Base UX | 3 | Nada | EmptyState, Alert variants, MonthSelector |
| **S1** — Onboarding | 4 | S0 | Wizard de 3 pasos |
| **S2** — Transacciones | 4 | S0 | QuickTransactionInput en dashboard |
| **S3** — Hogar UX | 4 | Nada (independiente) | Split tooltip + bot /hogar |
| **S4** — Vinculación + Resiliencia | 3 | Nada (independiente) | Deep link bot + botón retry |
| **S5** — Accesibilidad | 3 | Nada (independiente) | Labels, skip-link, focus modal |
| **Total** | **21 días** | — | — |

Los sprints S3, S4 y S5 son independientes y pueden ejecutarse en paralelo si hay más de un desarrollador.
