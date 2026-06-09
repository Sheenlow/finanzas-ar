# Finanzas AR

Aplicacion de gestion financiera personal diseñada para el contexto argentino. Permite llevar el control de cuentas en multiples monedas (ARS, USD, crypto), registrar gastos e ingresos, gestionar suscripciones y cuotas, establecer metas de ahorro, compartir gastos del hogar con division automatica proporcional a los ingresos, y registrar todo por texto o voz desde un bot de Telegram con IA.

## Stack

| Capa              | Tecnologia                                   |
|-------------------|----------------------------------------------|
| Framework         | Next.js 16 (App Router)                      |
| Frontend          | React 19, Tailwind CSS v4, Framer Motion     |
| Charts            | Recharts                                     |
| Icons             | Lucide React                                 |
| Auth / DB / RLS   | Supabase (PostgreSQL)                        |
| AI / Bot          | OpenAI GPT-4o-mini, Whisper, Telegram Bot API|
| Hosting           | Vercel                                       |
| Package Manager   | pnpm                                         |
| Lenguaje          | TypeScript (strict)                          |
| Tests             | Vitest + Testing Library                     |

## Caracteristicas

### Cuentas multi-moneda
- Soporte para **ARS**, **USD**, **USDT**, **USDC**, **BTC** y **ETH**
- Tipos de cuenta: efectivo (`cash`), banco (`bank`), crypto (`crypto`)
- Cada cuenta tiene balance, moneda, nombre y color personalizable en UI

### Transacciones
- Tipos: ingreso, gasto, transferencia, suscripcion y servicio
- Cuotas con tarjeta de credito (3, 6, 9, 12, 18, 24 o personalizadas)
- Metodos de pago: efectivo, tarjeta, transferencia
- Las transacciones en cuotas generan registros hijos automaticamente con fechas incrementadas por mes
- Al borrar una transaccion, se revierte el impacto en el balance de la cuenta
- Gastos fijos recurrentes con frecuencia mensual, trimestral, semestral o anual

### Dashboard principal
- **Patrimonio neto consolidado**: suma todos los saldos en ARS y USD con toggle de conversion (cotizacion blue en tiempo real)
- **Tendencia de ingresos vs gastos**: grafico de barras de los ultimos 6 meses
- **Grafico de torta por categoria**: distribucion de gastos del mes seleccionado con desglose porcentual
- **Resumen del hogar**: tabla de gastos compartidos con detalle de quien pago y si fue dividido, widget de balances entre miembros
- **Metas de ahorro**: barras de progreso con animacion y efecto confetti al completar (canvas-confetti)
- **Reporte de gastos fijos anual**: grafico de barras por mes mas tabla con filtros (descripcion, monto, tipo, cuenta)
- **Reporte de gastos fijos mensual**: tabla detallada del mes con total ARS + USD consolidado y toggle de moneda
- Selector de mes para filtrar transacciones historicas

### Bot de Telegram con IA
- Vinculacion via codigo unico de un solo uso desde el dashboard (`/vincular`)
- Desvinculacion con regeneracion de token (`/desvincular`)
- **Registro de gastos por texto**: parser NLP que extrae descripcion, monto, moneda, cuenta, metodo de pago y categoria
- **Registro de gastos por voz**: descarga audio de Telegram, transcribe con Whisper de OpenAI, procesa igual que texto
- Si el parser no resuelve el gasto, consulta a GPT-4o-mini con contexto de cuentas, categorias y reglas aprendidas
- **Flujo interactivo** con inline keyboards para confirmar cada detalle: cuotas, cuenta, categoria, recurrencia, visibilidad en hogar, compartir gasto
- **Aprendizaje automatico**: cuando el usuario corrige categoria o cuenta, el bot guarda reglas de keyword para futuros gastos
- Prompt de IA personalizable por usuario (`/config`)
- Comandos: `/stats` (resumen del mes), `/list` (ultimos gastos), `/balance` (saldos de cuentas), `/help`

### Cotizaciones en tiempo real
- **Dolar blue**: consume [dolarapi.com](https://dolarapi.com) con cache de 1 hora y fallback hardcodeado
- **Crypto**: consume [CoinGecko](https://coingecko.com) para BTC/USD y ETH/USD con cache de 1 hora y fallback

### Suscripciones automaticas (Cron Jobs)
- Vercel Cron Job ejecuta `GET /api/cron/generate-subscriptions` el dia 1 de cada mes a las 00:00
- Genera transacciones hijas para cada suscripcion o servicio recurrente
- Evita duplicados verificando si ya existe una copia para el mes actual
- Tambien disponible bajo demanda via `POST /api/transactions/generate-one`
- Cron Job semanal `GET /api/cron/keepalive` para mantener la base de datos activa

### Metas de ahorro
- Objetivos personales en ARS o USD con monto target y fecha opcional
- Metas compartidas con el hogar (visibles para todos los miembros)
- Depositos auditados en tabla `goal_deposits` con trazabilidad de quien aporto
- Barra de progreso visual con animacion
- Efecto de confetti al alcanzar la meta (canvas-confetti)

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

### UX
- Tema claro/oscuro con script inline anti-flicker, persistencia en localStorage y respeto a `prefers-color-scheme`
- Sidebar responsive: fija en desktop, drawer animado en mobile
- Animaciones con Framer Motion en cards, modales y transiciones
- Estados de carga (skeletons) y error boundaries en todas las paginas
- Paginacion con controles de avance/retroceso y selector de page size

## Estructura del proyecto

```
pagina-responsive/
├── src/
│   ├── app/                              # App Router
│   │   ├── (dashboard)/                  # Rutas protegidas (sidebar + session timeout)
│   │   │   ├── layout.tsx                # Layout con Sidebar + MobileSidebar + SessionTimeout
│   │   │   ├── page.tsx                  # Dashboard principal (server component, 303 lineas)
│   │   │   ├── loading.tsx               # Skeleton de carga
│   │   │   ├── error.tsx                 # Error boundary
│   │   │   ├── accounts/page.tsx         # Gestion de cuentas
│   │   │   ├── transactions/page.tsx     # Gestion de transacciones + recurrentes
│   │   │   ├── goals/page.tsx            # Metas de ahorro personales + hogar
│   │   │   └── hogar/page.tsx            # Gestion completa del hogar (force-dynamic)
│   │   ├── api/                          # API Routes (20+ endpoints)
│   │   │   ├── auth/register/route.ts    # Registro con reCAPTCHA + zxcvbn
│   │   │   ├── bot/telegram/route.ts     # Webhook del bot (mensajes, callbacks, voz)
│   │   │   ├── cron/
│   │   │   │   ├── generate-subscriptions/route.ts  # Cron: suscripciones mensuales
│   │   │   │   └── keepalive/route.ts               # Cron: ping semanal
│   │   │   ├── goals/deposit/route.ts    # Deposito en meta de ahorro
│   │   │   ├── households/              # 13 endpoints CRUD de hogares
│   │   │   │   ├── accept/route.ts      # Aceptar invitacion
│   │   │   │   ├── balances/route.ts    # Obtener balances
│   │   │   │   ├── create/route.ts      # Crear hogar
│   │   │   │   ├── delete/route.ts      # Eliminar hogar
│   │   │   │   ├── export/route.ts      # Exportar CSV
│   │   │   │   ├── incomes/route.ts     # Declarar/consultar ingresos
│   │   │   │   ├── invite/route.ts      # Invitar por email
│   │   │   │   ├── leave/route.ts       # Abandonar hogar
│   │   │   │   ├── remove-member/route.ts   # Expulsar miembro
│   │   │   │   ├── rename/route.ts      # Renombrar hogar
│   │   │   │   ├── settle/route.ts      # Liquidar deuda
│   │   │   │   ├── split/route.ts       # Dividir gasto
│   │   │   │   └── transfer-admin/route.ts  # Transferir admin
│   │   │   └── transactions/generate-one/route.ts  # Generar instancia de suscripcion
│   │   ├── auth/callback/route.ts        # OAuth callback
│   │   ├── join/page.tsx                 # Aceptar invitacion al hogar
│   │   ├── login/page.tsx                # Login email/password + Google
│   │   ├── signup/page.tsx               # Registro con reCAPTCHA + medidor fuerza
│   │   ├── layout.tsx                    # Root layout (metadata, fuentes Geist, theme)
│   │   ├── globals.css                   # Tailwind v4 + CSS custom properties + dark mode
│   │   ├── loading.tsx, error.tsx, not-found.tsx
│   │   └── favicon.ico
│   ├── components/
│   │   ├── dashboard/                    # 7 widgets del dashboard
│   │   │   ├── ConsolidatedBalance.tsx   # Balance ARS+USD con toggle
│   │   │   ├── TrendsChart.tsx           # Barras ingresos vs gastos 6 meses
│   │   │   ├── CategoryPieChart.tsx      # Torta de gastos por categoria
│   │   │   ├── FixedExpensesReport.tsx   # Reporte anual + grafico barras
│   │   │   ├── MonthlyFixedExpensesReport.tsx  # Reporte mensual con filtros
│   │   │   ├── MonthlyTransactions.tsx   # Tabla de transacciones del mes
│   │   │   ├── DashboardGoals.tsx        # Metas en miniatura
│   │   │   └── DashboardHouseholdSummary.tsx  # Resumen hogar + balances
│   │   ├── forms/                        # 3 formularios
│   │   │   ├── TransactionForm.tsx       # Crear/editar transaccion (546 lineas)
│   │   │   ├── AccountForm.tsx           # Crear/editar cuenta
│   │   │   └── GoalForm.tsx              # Crear/editar meta de ahorro
│   │   ├── household/                    # 3 componentes del hogar
│   │   │   ├── HouseholdManager.tsx      # CRUD completo del hogar (879 lineas)
│   │   │   ├── HouseholdBalanceWidget.tsx # Widget de balances
│   │   │   └── SettlementModal.tsx       # Modal de liquidacion
│   │   ├── layout/                       # 2 componentes de navegacion
│   │   │   ├── Sidebar.tsx               # Sidebar desktop fija
│   │   │   └── MobileSidebar.tsx         # Drawer mobile animado
│   │   ├── ui/CustomSelect.tsx           # Select estilizado reutilizable
│   │   ├── AccountItem.tsx               # Tarjeta de cuenta con editar/eliminar
│   │   ├── AnimatedCard.tsx              # Card con animacion de entrada
│   │   ├── DashboardLayout.tsx           # Wrapper con skeleton
│   │   ├── GoalItem.tsx                  # Tarjeta de meta con deposito/eliminar
│   │   ├── GoalsContainer.tsx            # Grid de metas con confetti
│   │   ├── MonthSelector.tsx             # Selector de mes/año para filtrar
│   │   ├── RecurringExpenses.tsx         # Lista de gastos fijos con badge de tipo
│   │   ├── SessionTimeout.tsx            # Timeout de inactividad con warning
│   │   ├── ThemeProvider.tsx             # Contexto de tema claro/oscuro
│   │   ├── TransactionItem.tsx           # Fila de transaccion con editar/eliminar
│   │   └── UserMenu.tsx                  # Menu de usuario en sidebar
│   ├── hooks/                            # 2 custom hooks
│   │   ├── useAccounts.ts                # Estado de cuentas
│   │   └── useHousehold.ts               # Estado del hogar
│   ├── lib/                              # Utilidades
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser client (@supabase/ssr)
│   │   │   └── server.ts                 # Server client (cookies-based para SSR)
│   │   ├── redirect.ts                   # safeRedirect() con protocolo dinamico
│   │   └── utils.ts                      # cn() (clsx + tailwind-merge), getTransactionMeta()
│   ├── services/                         # 12 servicios de logica de negocio
│   │   ├── accountsService.ts            # CRUD de cuentas
│   │   ├── authService.ts                # Login, Google OAuth, logout
│   │   ├── botProcessor.ts               # Motor del bot Telegram (~800 lineas)
│   │   ├── cryptoPriceService.ts         # Cotizacion BTC/ETH (CoinGecko)
│   │   ├── exchangeRateService.ts        # Cotizacion USD/ARS (dolarapi.com)
│   │   ├── householdService.ts           # Operaciones de hogar
│   │   ├── householdSplitService.ts      # Split automatico, balances, liquidaciones
│   │   ├── reportService.ts              # Reporte de gastos fijos anuales
│   │   ├── savingsGoalsService.ts        # CRUD de metas de ahorro + depositos
│   │   ├── subscriptionService.ts        # Generacion de suscripciones mensuales
│   │   ├── telegramClient.ts             # Wrapper HTTP para Telegram Bot API
│   │   └── transactionsService.ts        # CRUD de transacciones + cuotas
│   ├── proxy.ts                          # Middleware global de autenticacion
│   └── types/
│       └── database.types.ts             # Tipos completos generados por Supabase CLI
├── supabase/
│   └── migrations/                       # 10 migraciones SQL
│       ├── 00001_initial_schema.sql      # Tablas base + RLS + triggers + seeds (14 categorias)
│       ├── 00002_add_installments_to_transactions.sql  # Cuotas + metodo de pago
│       ├── 00003_households_safe.sql     # Hogares, miembros, invitaciones + RLS
│       ├── 00004_household_expense_split.sql  # Incomes, share_records, balances, settlements
│       ├── 00005_categories_update.sql   # Reemplazo de categorias seed (21 categorias)
│       ├── 00006_household_goals.sql     # Metas compartidas + goal_deposits
│       ├── 00007_transaction_types.sql   # Agrega 'subscription' y 'service' al CHECK
│       ├── 00008_bot_tables.sql          # bot_rules + bot_config
│       ├── 00009_bot_pending.sql         # Estado de conversacion interactiva
│       └── 00010_multi_user_bot.sql      # link_token + bot_users (multi-usuario)
├── tests/
│   └── householdSplit.test.ts            # Tests unitarios del split automatico (3 casos)
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json                         # TypeScript strict, path alias @/
├── next.config.ts                        # allowedDevOrigins + turbopack
├── eslint.config.mjs                     # ESLint 9 + next/core-web-vitals + next/typescript
├── postcss.config.mjs                    # Tailwind CSS v4
├── vitest.config.ts                      # Vitest + jsdom + path alias
├── vercel.json                           # Cron jobs: generate-subscriptions + keepalive
└── .env.local                            # Variables de entorno (no commitear)
```

## Esquema de base de datos

### Tablas principales

| Tabla                   | Descripcion                                                            |
|-------------------------|------------------------------------------------------------------------|
| `profiles`              | Extension de `auth.users` con nombre y moneda preferida                |
| `accounts`              | Cuentas del usuario (efectivo, banco, crypto) con balance y moneda     |
| `categories`            | Categorias de transacciones (globales `user_id IS NULL` o custom)      |
| `transactions`          | Libro mayor: ingresos, gastos, transferencias, suscripciones, cuotas   |
| `savings_goals`         | Metas de ahorro con monto target y progreso actual                     |
| `goal_deposits`         | Auditoria de depositos en metas (quien, cuanto, cuando)                |

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
- `savings_goals.household_id` → metas compartidas visibles para todos los miembros del hogar
- `transactions.subscription_frequency` → periodicidad de gastos recurrentes (`monthly`, `quarterly`, `biannual`, `annual`)

### Seguridad (RLS)
- Todas las tablas tienen Row Level Security habilitado
- Los usuarios solo ven/editan sus propios datos o los de hogares a los que pertenecen
- Las API routes de operaciones cross-user usan `service_role` key (admin client)
- `bot_users` usa RLS abierta (`USING (true)`) porque solo se accede con service_role

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
BOT_USER_ID=uuid-del-usuario-bot

# OpenAI (para el bot)
OPENAI_API_KEY=tu-api-key

# Cron
CRON_SECRET=un-secreto-para-el-cron

# Sitio
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Instalacion

```bash
pnpm install
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Comandos disponibles

| Comando         | Descripcion                     |
|-----------------|---------------------------------|
| `pnpm dev`      | Servidor de desarrollo          |
| `pnpm build`    | Build de produccion             |
| `pnpm start`    | Iniciar build de produccion     |
| `pnpm lint`     | Ejecutar ESLint                 |
| `pnpm test`     | Ejecutar tests con Vitest       |

## Base de datos

Las migraciones se encuentran en `supabase/migrations/`. Ejecutarlas en orden:

```bash
# Con Supabase CLI local
supabase db push

# O copiar el contenido de cada archivo .sql en el SQL Editor de Supabase
```

### Categorias seed incluidas

**Ingresos**: Sueldo, Freelance, Inversiones, Reembolso, Regalo recibido, Otros ingresos.

**Gastos**: Comida, Regalos, Salud / Medicos, Vivienda, Transporte, Gastos personales, Mascotas, Servicios, Viajes, Deuda, Otros.

**Transferencia**: Entre cuentas.

## API Routes

### Autenticacion y registro

| Endpoint                     | Metodo | Descripcion                          | Auth        |
|------------------------------|--------|--------------------------------------|-------------|
| `/api/auth/register`         | POST   | Registro con email + reCAPTCHA       | Publico     |
| `/auth/callback`             | GET    | OAuth callback (Google)              | Publico     |

### Bot de Telegram

| Endpoint                     | Metodo | Descripcion                          | Auth              |
|------------------------------|--------|--------------------------------------|-------------------|
| `/api/bot/telegram`          | POST   | Webhook: mensajes, callbacks, voz    | WEBHOOK_SECRET    |

### Cron Jobs

| Endpoint                                  | Metodo | Descripcion                          | Auth         |
|-------------------------------------------|--------|--------------------------------------|--------------|
| `/api/cron/generate-subscriptions`        | GET    | Generar suscripciones del mes        | CRON_SECRET  |
| `/api/cron/keepalive`                     | GET    | Ping semanal a la base de datos      | CRON_SECRET  |

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

## Flujo del bot de Telegram

1. El usuario envia `/vincular <codigo>` al bot con el codigo del dashboard
2. El bot valida el token (un solo uso), asocia `telegram_user_id` ↔ `supabase_user_id` en `bot_users`
3. Para registrar un gasto, el usuario envia texto o audio:
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

## Licencia

MIT
