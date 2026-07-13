# Finanzas AR

Aplicacion de gestion financiera personal disenada para el contexto argentino. Permite llevar el control de cuentas en multiples monedas (ARS, USD, crypto, tarjetas de credito), registrar gastos e ingresos con cuotas y suscripciones, establecer metas de ahorro, compartir gastos del hogar con division automatica proporcional a los ingresos, y registrar todo por texto desde un bot de Telegram con IA.

## Stack

| Capa               | Tecnologia                                           |
|--------------------|------------------------------------------------------|
| Framework          | Next.js 16 (App Router + Turbopack)                  |
| Frontend           | React 19, Tailwind CSS v4, Framer Motion             |
| Charts             | Recharts                                             |
| Icons              | Lucide React                                         |
| Auth / DB / RLS    | Supabase (PostgreSQL)                                |
| AI / Bot           | OpenAI GPT-4o-mini, Telegram Bot API                 |
| Rate Limiting      | Upstash Redis                                        |
| Logging            | Pino                                                 |
| Validation         | Zod                                                  |
| Hosting            | Vercel                                               |
| CI/CD              | GitHub Actions                                       |
| Package Manager    | pnpm                                                 |
| Lenguaje           | TypeScript (strict)                                  |
| Tests              | Vitest + Testing Library + jsdom                     |

## Caracteristicas

### Cuentas multi-moneda
- Soporte para **ARS**, **USD**, **USDT**, **USDC**, **BTC** y **ETH**
- Tipos de cuenta: efectivo (`cash`), banco (`bank`), crypto (`crypto`), tarjeta de credito (`credit_card`)
- Tarjetas de credito con configuracion de cierre: dia fijo (1-31) o ultimo jueves del mes (`closing_rule`)
- Ciclos de facturacion personalizados por tarjeta (`billing_cycles`): fecha de cierre + fecha de vencimiento
- Cada cuenta tiene balance, moneda, nombre y color personalizable en UI

### Transacciones
- Tipos: ingreso (`income`), gasto (`expense`), transferencia (`transfer`), suscripcion (`subscription`), servicio (`service`)
- Cuotas con tarjeta de credito (3, 6, 9, 12, 18, 24 o personalizadas)
- Metodos de pago: efectivo, tarjeta, transferencia
- Las transacciones en cuotas generan registros hijos automaticamente con fechas incrementadas por mes
- Al borrar una transaccion, se revierte el impacto en el balance de la cuenta
- Gastos fijos recurrentes con frecuencia mensual, trimestral, semestral o anual
- Las transacciones con tarjeta de credito calculan automaticamente el mes de facturacion (`billing_month`)

### Dashboard principal
- **Patrimonio neto consolidado**: suma todos los saldos en ARS y USD con toggle de conversion (cotizacion blue en tiempo real)
- **Tendencia de ingresos vs gastos**: grafico de barras de los ultimos 6 meses
- **Grafico de torta por categoria**: distribucion de gastos del mes seleccionado con desglose porcentual
- **Resumen del hogar**: tabla de gastos compartidos con detalle de quien pago y si fue dividido, widget de balances entre miembros
- **Metas de ahorro**: barras de progreso con efecto confetti al completar (canvas-confetti)
- **Reporte de gastos fijos anual**: grafico de barras por mes mas tabla con filtros (descripcion, monto, tipo, cuenta)
- **Reporte de gastos fijos mensual**: tabla detallada del mes con total ARS + USD consolidado y toggle de moneda
- Selector de mes para filtrar transacciones historicas
- Componentes principales extraidos a `lib/dashboardData.ts` y `lib/dashboardCalculations.ts`

### Bot de Telegram con IA
- Vinculacion via codigo unico de un solo uso desde el dashboard (`/vincular`)
- Desvinculacion con regeneracion de token (`/desvincular`)
- **Registro de gastos por texto**: parser NLP que extrae descripcion, monto, moneda, cuenta, metodo de pago y categoria
- Si el parser no resuelve el gasto, consulta a GPT-4o-mini con contexto de cuentas, categorias y reglas aprendidas
- **Flujo interactivo** con inline keyboards para confirmar cada detalle: cuotas, cuenta, categoria, recurrencia, visibilidad en hogar, compartir gasto
- **Aprendizaje automatico**: cuando el usuario corrige categoria o cuenta, el bot guarda reglas de keyword para futuros gastos
- Prompt de IA personalizable por usuario (`/config`)
- Comandos: `/stats` (resumen del mes), `/list` (ultimos gastos), `/balance` (saldos de cuentas), `/help`
- Sanitizacion HTML de todas las respuestas del bot (`escapeHtml`)

### Cotizaciones en tiempo real
- **Dolar blue**: consume [dolarapi.com](https://dolarapi.com) con cache de 1 hora y fallback hardcodeado (1400)
- **Crypto**: consume [CoinGecko](https://coingecko.com) para BTC/USD y ETH/USD con cache de 1 hora y fallback (87000 / 3400)

### Suscripciones automaticas (Cron Jobs)
- Vercel Cron Job ejecuta `GET /api/cron/generate-subscriptions` el dia 1 de cada mes
- Genera transacciones hijas para cada suscripcion o servicio recurrente
- Soporta frecuencias: `monthly`, `quarterly`, `biannual`, `annual` ancladas al mes original de la transaccion padre
- Evita duplicados verificando si ya existe una copia para el periodo actual
- Tambien disponible bajo demanda via `POST /api/transactions/generate-one`
- Cron Job semanal `GET /api/cron/keepalive` para mantener la base de datos activa + limpiar `bot_pending` con >24h de antiguedad

### Metas de ahorro
- Objetivos personales en ARS o USD con monto target y fecha opcional
- Metas compartidas con el hogar (visibles para todos los miembros)
- Depositos auditados en tabla `goal_deposits` con trazabilidad de quien aporto
- Barra de progreso visual con animacion
- Efecto de confetti al alcanzar la meta (canvas-confetti, se dispara via `useEffect` cuando `isCompleted` transiciona a `true`)

### Hogar (gastos compartidos)
- Creacion de hogares con invitacion por email (link con token unico)
- Roles: `admin` (gestiona miembros, renombra, elimina hogar) y `member`
- **Split automatico proporcional a ingresos**: cada miembro declara su ingreso mensual en ARS y los gastos se dividen segun el porcentaje que representa su ingreso sobre el total
- Soporte para split manual (porcentaje fijo) si no se declaran ingresos
- Registro de balances entre pares de miembros (`household_balances`)
- Historial de liquidaciones (`household_settlements`) con registro de transaccion de ingreso opcional
- Las liquidaciones actualizan balances y marcan `share_records` como `settled`
- Tabla de transacciones del hogar con columna "Compartido" (si/no)
- Transferir admin a otro miembro
- Abandonar hogar (si el admin es el unico miembro, elimina el hogar)
- Eliminar hogar con confirmacion por texto "ELIMINAR"
- Exportacion de transacciones del hogar a CSV

### Autenticacion y seguridad
- Login con email/password y Google OAuth
- Registro con reCAPTCHA v3 (bypasseable en desarrollo con `dev-token`)
- Medidor de fortaleza de contraseña (zxcvbn, requiere score >= 3 — nivel "Fuerte")
- Callback de auth para confirmacion de email
- Middleware global (`proxy.ts`) que protege todas las rutas excepto `/login`, `/signup`, `/join`, `/api`, `/auth/callback`
- Timeout de sesion por inactividad (30 minutos, warning modal 1 minuto antes)
- Row Level Security (RLS) en todas las tablas de Supabase
- API routes administrativas usan `service_role` key para operaciones cross-user
- Token de vinculacion Telegram de un solo uso (previene account hijacking)
- **Rate limiting con Upstash Redis**: 4 limiters pre-configurados protegiendo 17 endpoints (register, telegram, general, strict)
- Content Security Policy endurecida (sin `unsafe-eval`)
- Sanitizacion de errores en todas las API routes (sin leak de informacion sensible)
- HTML sanitizado en todas las respuestas del bot de Telegram

### Audit Trail
- Tabla `audit_logs` que registra toda operacion financiera critica
- Logs automaticos en: create/update/delete de transacciones, cuentas, y metas de ahorro
- Campos: `user_id`, `action`, `entity_type`, `entity_id`, `details` (JSONB), `ip_address`, `created_at`
- RLS: solo el usuario puede leer sus propios logs de auditoria

### UX
- Tema claro/oscuro con script externo anti-flicker (`public/theme.js`), persistencia en localStorage y respeto a `prefers-color-scheme`
- Sidebar responsive: fija en desktop, drawer animado en mobile
- Animaciones con Framer Motion en cards, modales y transiciones
- CSS `@media (prefers-reduced-motion: no-preference)` para respetar preferencias de accesibilidad
- Estados de carga (skeletons) y error boundaries en todas las paginas
- Paginacion con controles de avance/retroceso y selector de page size
- **Accesibilidad (a11y)**: aria-labels en botones solo-icono, roles ARIA en modales (`role="dialog"`, `aria-modal`), focus trap, labels en inputs

### PWA
- `manifest.json` con nombre, colores y display `standalone`
- Iconos SVG (192x192 y 512x512)
- Meta tags `apple-mobile-web-app-capable` y `theme-color`
- Listo para instalarse en dispositivos moviles

---

## Estructura del proyecto

```
pagina-responsive/
├── .github/
│   └── workflows/
│       └── ci.yml                          # CI/CD: lint, typecheck, test
├── src/
│   ├── app/                                # App Router
│   │   ├── (dashboard)/                    # Rutas protegidas (sidebar + session timeout)
│   │   │   ├── layout.tsx                  # Layout con Sidebar + MobileSidebar + SessionTimeout
│   │   │   ├── page.tsx                    # Dashboard principal (server component, ~53 lineas)
│   │   │   ├── loading.tsx                 # Skeleton de carga
│   │   │   ├── error.tsx                   # Error boundary
│   │   │   ├── accounts/page.tsx           # Gestion de cuentas
│   │   │   ├── transactions/page.tsx       # Gestion de transacciones + recurrentes
│   │   │   ├── goals/page.tsx              # Metas de ahorro personales + hogar
│   │   │   ├── hogar/page.tsx              # Gestion completa del hogar (force-dynamic)
│   │   │   └── ayuda/page.tsx              # Centro de ayuda / FAQ
│   │   ├── api/                            # API Routes (21 endpoints)
│   │   │   ├── auth/register/route.ts      # Registro con reCAPTCHA + zxcvbn
│   │   │   ├── bot/telegram/route.ts       # Webhook del bot (mensajes, callbacks)
│   │   │   ├── cron/
│   │   │   │   ├── generate-subscriptions/route.ts  # Cron: suscripciones mensuales
│   │   │   │   └── keepalive/route.ts               # Cron: ping semanal + TTL bot_pending
│   │   │   ├── goals/deposit/route.ts      # Deposito en meta de ahorro
│   │   │   ├── households/                 # 13 endpoints CRUD de hogares
│   │   │   │   ├── accept/route.ts         # Aceptar invitacion
│   │   │   │   ├── balances/route.ts       # Obtener balances
│   │   │   │   ├── create/route.ts         # Crear hogar
│   │   │   │   ├── delete/route.ts         # Eliminar hogar
│   │   │   │   ├── export/route.ts         # Exportar CSV
│   │   │   │   ├── incomes/route.ts        # Declarar/consultar ingresos
│   │   │   │   ├── invite/route.ts         # Invitar por email
│   │   │   │   ├── leave/route.ts          # Abandonar hogar
│   │   │   │   ├── remove-member/route.ts  # Expulsar miembro
│   │   │   │   ├── rename/route.ts         # Renombrar hogar
│   │   │   │   ├── settle/route.ts         # Liquidar deuda
│   │   │   │   ├── split/route.ts          # Dividir gasto
│   │   │   │   └── transfer-admin/route.ts # Transferir admin
│   │   │   ├── transactions/generate-one/route.ts  # Generar instancia de suscripcion
│   │   │   └── webhooks/welcome-email/route.ts     # Envio de email de bienvenida
│   │   ├── auth/callback/route.ts          # OAuth callback
│   │   ├── join/page.tsx                   # Aceptar invitacion al hogar
│   │   ├── login/page.tsx                  # Login email/password + Google
│   │   ├── signup/page.tsx                 # Registro con reCAPTCHA + medidor fuerza
│   │   ├── layout.tsx                      # Root layout (metadata, fuentes Geist, theme, PWA)
│   │   ├── globals.css                     # Tailwind v4 + variables CSS + dark mode
│   │   ├── loading.tsx, error.tsx, not-found.tsx
│   │   └── favicon.ico
│   ├── components/
│   │   ├── dashboard/                      # Widgets + dashboard client
│   │   │   ├── DashboardClient.tsx         # Cliente orquestador del dashboard
│   │   │   ├── ConsolidatedBalance.tsx     # Balance ARS+USD con toggle
│   │   │   ├── TrendsChart.tsx             # Barras ingresos vs gastos 6 meses
│   │   │   ├── CategoryPieChart.tsx        # Torta de gastos por categoria
│   │   │   ├── FixedExpensesReport.tsx     # Reporte anual + grafico barras
│   │   │   ├── MonthlyFixedExpensesReport.tsx  # Reporte mensual con filtros
│   │   │   ├── MonthlyTransactions.tsx     # Tabla de transacciones del mes
│   │   │   ├── DashboardGoals.tsx          # Metas en miniatura
│   │   │   └── DashboardHouseholdSummary.tsx   # Resumen hogar + balances
│   │   ├── forms/
│   │   │   ├── TransactionForm.tsx         # Crear/editar transaccion (~182 lineas)
│   │   │   ├── AccountForm.tsx             # Crear/editar cuenta
│   │   │   ├── GoalForm.tsx                # Crear/editar meta de ahorro
│   │   │   └── transaction/               # Subcomponentes de TransactionForm
│   │   │       ├── TypeToggle.tsx          # Toggle ingreso/gasto/transferencia
│   │   │       ├── AmountInput.tsx          # Input de monto con formato
│   │   │       ├── AccountSelect.tsx        # Selector de cuenta origen/destino
│   │   │       ├── InstallmentsSection.tsx  # Selector de cuotas
│   │   │       ├── RecurringSection.tsx     # Selector de frecuencia recurrente
│   │   │       ├── HouseholdSection.tsx     # Toggle de visibilidad/compartir hogar
│   │   │       └── BillingMonthPreview.tsx  # Preview del mes de facturacion
│   │   ├── household/                      # Componentes del hogar
│   │   │   ├── HouseholdManager.tsx        # CRUD completo del hogar (~235 lineas)
│   │   │   ├── HouseholdBalanceWidget.tsx  # Widget de balances
│   │   │   ├── HouseholdMonthlyReport.tsx  # Reporte mensual del hogar
│   │   │   ├── SettlementModal.tsx         # Modal de liquidacion
│   │   │   ├── CreateHouseholdForm.tsx     # Formulario para crear hogar
│   │   │   ├── MemberList.tsx              # Lista de miembros con roles
│   │   │   ├── IncomeEditor.tsx            # Editor de ingresos mensuales
│   │   │   ├── SplitEditor.tsx             # Editor de porcentaje de split
│   │   │   ├── TransactionList.tsx         # Tabla de transacciones del hogar
│   │   │   ├── SettlementHistory.tsx       # Historial de liquidaciones
│   │   │   ├── GoalPreview.tsx             # Preview de metas del hogar
│   │   │   ├── LeaveModal.tsx              # Modal de abandonar hogar
│   │   │   └── DeleteModal.tsx             # Modal de eliminar hogar
│   │   ├── layout/                         # Componentes de navegacion
│   │   │   ├── Sidebar.tsx                 # Sidebar desktop fija
│   │   │   └── MobileSidebar.tsx           # Drawer mobile animado
│   │   ├── ui/
│   │   │   └── CustomSelect.tsx            # Select estilizado reutilizable
│   │   ├── AccountItem.tsx                 # Tarjeta de cuenta con editar/eliminar
│   │   ├── AnimatedCard.tsx                # Card con animacion CSS de entrada
│   │   ├── AyudaContent.tsx                # Contenido del centro de ayuda FAQ
│   │   ├── DashboardLayout.tsx             # Wrapper con animacion de entrada
│   │   ├── GoalItem.tsx                    # Tarjeta de meta con deposito/eliminar
│   │   ├── GoalsContainer.tsx              # Grid de metas personales + hogar
│   │   ├── MonthSelector.tsx               # Selector de mes/año para filtrar
│   │   ├── RecurringExpenses.tsx           # Lista de gastos fijos con badge de tipo
│   │   ├── SessionTimeout.tsx              # Timeout de inactividad con warning
│   │   ├── ThemeProvider.tsx               # Contexto de tema claro/oscuro
│   │   ├── TransactionItem.tsx             # Fila de transaccion con editar/eliminar
│   │   ├── UserMenu.tsx                    # Menu de usuario en sidebar
│   │   └── UserProvider.tsx                # Contexto de usuario autenticado
│   ├── hooks/                              # Custom hooks (11)
│   │   ├── useAccounts.ts                  # Estado de cuentas
│   │   ├── useHousehold.ts                 # Estado del hogar
│   │   ├── useTransactionForm.ts           # Estado del formulario de transaccion
│   │   ├── useCategories.ts                # Carga de categorias
│   │   ├── useCreditCardInfo.ts            # Datos de tarjeta + billing month
│   │   ├── useSplitPreview.ts              # Calculo de split del hogar
│   │   ├── useHouseholdMembers.ts          # CRUD de miembros del hogar
│   │   ├── useHouseholdIncomes.ts          # Ingresos del hogar
│   │   ├── useInviteLink.ts                # Token de invitacion
│   │   ├── useSettlements.ts               # Historial de liquidaciones
│   │   └── useDebounce.ts                  # Debounce generico para inputs
│   ├── lib/                                # Utilidades
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Browser client (@supabase/ssr)
│   │   │   ├── server.ts                   # Server client (cookies-based para SSR)
│   │   │   └── admin.ts                    # Admin client centralizado (service_role)
│   │   ├── dashboardData.ts                # Data fetching del dashboard (Promise.all)
│   │   ├── dashboardCalculations.ts        # Funciones puras de calculos del dashboard
│   │   ├── utils.ts                        # cn(), escapeHtml(), getBillingMonth(), etc.
│   │   ├── env.ts                          # Validacion de variables de entorno (Zod)
│   │   ├── security.ts                     # getClientIp(), requireOrigin()
│   │   ├── rateLimit.ts                    # Upstash Redis limiters (register, telegram, general, strict)
│   │   └── logger.ts                       # Logger estructurado con Pino
│   ├── services/                           # Servicios de logica de negocio
│   │   ├── accountsService.ts              # CRUD de cuentas + tarjetas de credito + ciclos
│   │   ├── auditService.ts                 # Registro de auditoria (audit_logs)
│   │   ├── authService.client.ts           # Login, Google OAuth, logout (browser)
│   │   ├── cryptoPriceService.ts           # Cotizacion BTC/ETH (CoinGecko)
│   │   ├── exchangeRateService.ts          # Cotizacion USD/ARS (dolarapi.com)
│   │   ├── householdService.ts             # Operaciones de hogar
│   │   ├── householdSplitService.ts        # Split automatico, balances, liquidaciones
│   │   ├── reportService.ts                # Reporte de gastos fijos anuales
│   │   ├── savingsGoalsService.ts          # CRUD de metas de ahorro + depositos
│   │   ├── subscriptionService.ts          # Generacion de suscripciones mensuales
│   │   ├── telegramClient.ts               # Wrapper HTTP para Telegram Bot API
│   │   ├── transactionsService.ts          # CRUD de transacciones + cuotas
│   │   └── bot/                            # Motor del bot de Telegram (modular)
│   │       ├── index.ts                    # BotProcessor — clase principal
│   │       ├── commands.ts                 # Comandos: /stats, /list, /balance, /config, etc.
│   │       ├── parser.ts                   # Parser NLP (extractKeywords, normalizeAmount, etc.)
│   │       ├── ai.ts                       # Integracion con OpenAI GPT-4o-mini
│   │       ├── stateMachine.ts             # Maquina de estados del flujo interactivo
│   │       ├── keywords.ts                 # Aprendizaje de reglas keyword → categoria/cuenta
│   │       ├── messages.ts                 # Templates de mensajes constantes
│   │       └── types.ts                    # Tipos: Account, Category, ParsedTransaction, etc.
│   ├── types/
│   │   ├── database.types.ts               # Tipos completos generados por Supabase CLI
│   │   └── supabase.ts                     # TypedSupabaseClient alias
│   └── proxy.ts                            # Middleware global de autenticacion
├── supabase/
│   └── migrations/                         # 14 migraciones SQL
│       ├── 00001_initial_schema.sql        # Tablas base + RLS + triggers + seeds (14 categorias)
│       ├── 00002_add_installments_to_transactions.sql  # Cuotas + metodo de pago
│       ├── 00003_households_safe.sql        # Hogares, miembros, invitaciones + RLS
│       ├── 00004_household_expense_split.sql # Incomes, share_records, balances, settlements
│       ├── 00005_categories_update.sql      # Reemplazo de categorias seed (21 categorias)
│       ├── 00006_household_goals.sql        # Metas compartidas + goal_deposits
│       ├── 00007_transaction_types.sql      # Agrega 'subscription' y 'service' al CHECK
│       ├── 00008_bot_tables.sql             # bot_rules + bot_config
│       ├── 00009_bot_pending.sql            # Estado de conversacion interactiva
│       ├── 00010_multi_user_bot.sql         # link_token + bot_users (multi-usuario)
│       ├── 00011_credit_cards.sql           # Tabla credit_cards (closing_day, due_day, etc.)
│       ├── 00012_billing_cycles.sql         # Tabla billing_cycles + closing_rule
│       ├── 00013_audit_log.sql              # Tabla audit_logs (registro de operaciones)
│       └── 00014_additional_indexes.sql     # Indices para queries frecuentes
├── tests/                                  # 20 archivos, 147 tests
│   ├── api/                                # Tests de integracion API
│   │   ├── auth/register.test.ts
│   │   ├── goals/deposit.test.ts
│   │   └── households/households.test.ts
│   ├── components/                         # Tests de componentes React
│   │   ├── AnimatedCard.test.tsx
│   │   ├── GoalItem.test.tsx
│   │   ├── SessionTimeout.test.tsx
│   │   ├── ThemeProvider.test.tsx
│   │   └── TransactionItem.test.tsx
│   ├── lib/
│   │   └── security.test.ts
│   ├── services/                           # Tests unitarios de servicios
│   │   ├── accountsService.test.ts
│   │   ├── cryptoPriceService.test.ts
│   │   ├── exchangeRateService.test.ts
│   │   ├── householdService.test.ts
│   │   ├── savingsGoalsService.test.ts
│   │   ├── subscriptionService.test.ts
│   │   └── transactionsService.test.ts
│   ├── botParser.test.ts
│   ├── householdSplit.test.ts
│   ├── reportService.test.ts
│   └── utils.test.ts
├── public/
│   ├── theme.js                            # Script anti-flicker para tema oscuro
│   ├── manifest.json                       # PWA manifest
│   ├── icon-192.svg, icon-512.svg          # Iconos PWA
│   └── *.svg                               # Iconos estaticos
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json                           # TypeScript strict, path alias @/
├── next.config.ts                          # CSP + security headers + Turbopack config
├── eslint.config.mjs                       # ESLint 9 + next/core-web-vitals + next/typescript
├── postcss.config.mjs                      # Tailwind CSS v4
├── vitest.config.ts                        # Vitest + jsdom + coverage v8 + path alias
├── vercel.json                             # Cron jobs: generate-subscriptions + keepalive
└── .env.local                              # Variables de entorno (no commitear)
```

---

## Esquema de base de datos

### Tablas principales

| Tabla                   | Descripcion                                                            |
|-------------------------|------------------------------------------------------------------------|
| `profiles`              | Extension de `auth.users` con nombre y moneda preferida                |
| `accounts`              | Cuentas del usuario (efectivo, banco, crypto, tarjeta) con balance y moneda |
| `categories`            | Categorias de transacciones (globales `user_id IS NULL` o custom)      |
| `transactions`          | Libro mayor: ingresos, gastos, transferencias, suscripciones, cuotas   |
| `savings_goals`         | Metas de ahorro con monto target y progreso actual                     |
| `goal_deposits`         | Auditoria de depositos en metas (quien, cuanto, cuando)                |
| `credit_cards`          | Tarjetas de credito (closing_day, due_day, credit_limit, closing_rule) |
| `billing_cycles`        | Ciclos de facturacion por tarjeta (close_date, due_date)               |
| `audit_logs`            | Registro de operaciones financieras (user, action, entity, details)    |

### Tablas del hogar

| Tabla                    | Descripcion                                                          |
|--------------------------|----------------------------------------------------------------------|
| `households`             | Hogares (nombre, fecha de creacion)                                  |
| `household_members`      | Miembros con rol (`admin`/`member`) y split_percentage               |
| `household_incomes`      | Ingreso mensual declarado por cada miembro (ARS)                     |
| `household_share_records`| Registro de como se dividio cada gasto del hogar                     |
| `household_balances`     | Saldos abiertos entre pares de miembros                              |
| `household_settlements`  | Historial de pagos de liquidaciones entre miembros                   |
| `invitations`            | Invitaciones pendientes para unirse al hogar (por email + token)     |

### Tablas del bot

| Tabla           | Descripcion                                                      |
|-----------------|------------------------------------------------------------------|
| `bot_config`    | Configuracion por usuario: custom AI prompt + link_token         |
| `bot_rules`     | Reglas aprendidas: keyword → categoria/cuenta/tipo               |
| `bot_pending`   | Estado de conversacion interactiva (JSONB: state + parsed data)  |
| `bot_users`     | Vinculacion Telegram user ID ↔ Supabase user ID                  |

### Relaciones clave
- `transactions.household_id` → indica que un gasto pertenece a un hogar
- `transactions.parent_transaction_id` → vincula cuotas/suscripciones hijas con el registro padre
- `transactions.is_installment` + `installment_number`/`installments_total` → tracking de cuotas
- `transactions.billing_month` → mes de facturacion para gastos con tarjeta de credito
- `transactions.subscription_frequency` → periodicidad de gastos recurrentes (`monthly`, `quarterly`, `biannual`, `annual`)
- `savings_goals.household_id` → metas compartidas visibles para todos los miembros del hogar
- `credit_cards.account_id` (UNIQUE) → configuracion de tarjeta vinculada a una cuenta
- `billing_cycles.credit_card_id` → ciclos de facturacion de cada tarjeta
- `audit_logs.user_id` → trazabilidad de quien realizo cada operacion financiera

### Seguridad (RLS)
- Todas las tablas tienen Row Level Security habilitado
- Los usuarios solo ven/editan sus propios datos o los de hogares a los que pertenecen
- Las API routes de operaciones cross-user usan `service_role` key (via `createAdminClient()`)
- `bot_users` usa RLS abierta (`USING (true)`) porque solo se accede con service_role

---

## Variables de entorno

Crear `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=tu-site-key
RECAPTCHA_SECRET_KEY=tu-secret-key

# Telegram Bot
TELEGRAM_BOT_TOKEN=tu-bot-token
TELEGRAM_WEBHOOK_SECRET=un-secreto-para-el-webhook

# OpenAI (para el bot)
OPENAI_API_KEY=tu-api-key

# Cron
CRON_SECRET=un-secreto-para-el-cron

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=tu-redis-token

# SMTP (emails de bienvenida, opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
SMTP_FROM="Finanzas AR <tu-email@gmail.com>"

# Sitio
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Instalacion

```bash
pnpm install
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Comandos disponibles

| Comando              | Descripcion                                  |
|----------------------|----------------------------------------------|
| `pnpm dev`           | Servidor de desarrollo                       |
| `pnpm build`         | Build de produccion                          |
| `pnpm start`         | Iniciar build de produccion                  |
| `pnpm lint`          | Ejecutar ESLint                              |
| `pnpm test`          | Ejecutar tests con Vitest                    |
| `pnpm test:watch`    | Ejecutar tests en modo watch                 |
| `pnpm test:coverage` | Ejecutar tests con reporte de cobertura      |

---

## Base de datos

Las migraciones se encuentran en `supabase/migrations/`. Ejecutarlas en orden:

```bash
# Con Supabase CLI local
supabase db push

# O copiar el contenido de cada archivo .sql en el SQL Editor de Supabase
```

### Categorias seed incluidas (21)

**Ingresos**: Sueldo, Freelance, Inversiones, Reembolso, Regalo recibido, Otros ingresos.

**Gastos**: Comida, Regalos, Salud / Medicos, Vivienda, Transporte, Gastos personales, Mascotas, Servicios, Viajes, Deuda, Otros.

**Transferencia**: Entre cuentas.

---

## API Routes

### Autenticacion y registro

| Endpoint                     | Metodo | Descripcion                          | Auth        |
|------------------------------|--------|--------------------------------------|-------------|
| `/api/auth/register`         | POST   | Registro con email + reCAPTCHA       | Publico     |
| `/auth/callback`             | GET    | OAuth callback (Google)              | Publico     |

### Bot de Telegram

| Endpoint                     | Metodo | Descripcion                          | Auth              |
|------------------------------|--------|--------------------------------------|-------------------|
| `/api/bot/telegram`          | POST   | Webhook: mensajes y callbacks       | WEBHOOK_SECRET    |

### Cron Jobs

| Endpoint                                  | Metodo | Descripcion                          | Auth         |
|-------------------------------------------|--------|--------------------------------------|--------------|
| `/api/cron/generate-subscriptions`        | GET    | Generar suscripciones del mes        | CRON_SECRET  |
| `/api/cron/keepalive`                     | GET    | Ping semanal + limpiar bot_pending   | CRON_SECRET  |

### Webhooks

| Endpoint                            | Metodo | Descripcion                          | Auth         |
|-------------------------------------|--------|--------------------------------------|--------------|
| `/api/webhooks/welcome-email`       | GET    | Estado del webhook (health check)    | Publico      |
| `/api/webhooks/welcome-email`       | POST   | Enviar email de bienvenida           | Webhook      |

### Metas de ahorro

| Endpoint                     | Metodo | Descripcion                          | Auth        |
|------------------------------|--------|--------------------------------------|-------------|
| `/api/goals/deposit`         | POST   | Depositar en una meta (personal o compartida) | Usuario |

### Transacciones

| Endpoint                            | Metodo | Descripcion                          | Auth        |
|-------------------------------------|--------|--------------------------------------|-------------|
| `/api/transactions/generate-one`    | POST   | Generar instancia mensual de una suscripcion | Usuario |

### Hogar

| Endpoint                            | Metodo | Descripcion                          | Auth         |
|-------------------------------------|--------|--------------------------------------|--------------|
| `/api/households/create`            | POST   | Crear hogar (auto-asignado admin)    | Usuario      |
| `/api/households/rename`            | PATCH  | Renombrar hogar                      | Admin        |
| `/api/households/delete`            | DELETE | Eliminar hogar                       | Admin        |
| `/api/households/invite`            | POST   | Invitar por email (token unico)      | Admin        |
| `/api/households/accept`            | POST   | Aceptar invitacion via token         | Usuario      |
| `/api/households/leave`             | POST   | Abandonar hogar                      | Miembro      |
| `/api/households/remove-member`     | POST   | Expulsar miembro                     | Admin        |
| `/api/households/transfer-admin`    | POST   | Transferir rol admin a otro miembro  | Admin        |
| `/api/households/incomes`           | GET    | Consultar ingresos declarados        | Miembro      |
| `/api/households/incomes`           | POST   | Declarar/actualizar ingreso mensual  | Miembro      |
| `/api/households/split`             | POST   | Dividir gasto entre miembros         | Miembro      |
| `/api/households/balances`          | GET    | Obtener balances entre pares         | Miembro      |
| `/api/households/settle`            | POST   | Liquidar deuda + opcionalmente registrar ingreso | Miembro |
| `/api/households/export`            | GET    | Exportar transacciones del hogar a CSV | Miembro    |

---

## Flujo del bot de Telegram

1. El usuario envia `/vincular <codigo>` al bot con el codigo del dashboard
2. El bot valida el token (un solo uso), asocia `telegram_user_id` ↔ `supabase_user_id` en `bot_users`
3. Para registrar un gasto, el usuario envia texto:
   - **Parser NLP**: extrae descripcion, monto, moneda (ARS/USD/BTC/ETH), cuenta, metodo de pago
   - Si el parser falla, consulta a **GPT-4o-mini** con el contexto del usuario
4. Flujo interactivo con **inline keyboards**:
   - ¿Es en cuotas? → ¿Cuantas? (3/6/9/12/18/24)
   - ¿Es suscripcion? → ¿Frecuencia? (mensual/trimestral/semestral/anual)
   - Seleccionar cuenta → Seleccionar categoria
   - Si pertenece a un hogar: ¿Mostrar? → ¿Compartir gasto?
   - Confirmar → guarda transaccion + split automatico
5. **Aprendizaje**: si el usuario edita categoria o cuenta post-confirmacion, el bot guarda una regla `keyword → valor` para futuros gastos
6. Comandos disponibles: `/stats`, `/list`, `/balance`, `/config`, `/help`, `/vincular`, `/desvincular`

---

## Rate Limiting

Todos los endpoints de escritura estan protegidos con rate limiting via Upstash Redis:

| Limiter           | Limite      | Endpoints protegidos                                    |
|-------------------|-------------|--------------------------------------------------------|
| `registerLimiter` | 5 req/min   | `/api/auth/register`                                   |
| `telegramLimiter` | 60 req/min  | `/api/bot/telegram`                                    |
| `generalLimiter`  | 20 req/min  | `/api/households/*`, `/api/goals/deposit`, `/api/transactions/generate-one` |
| `strictLimiter`   | 5 req/min   | Disponible para endpoints criticos adicionales          |

En caso de exceder el limite, el endpoint responde `429 Too Many Requests`.

---

## Licencia

MIT
