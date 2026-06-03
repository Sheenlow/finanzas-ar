# Finanzas AR

Aplicacion de gestion financiera personal diseñada para el contexto argentino. Permite llevar el control de cuentas en multiples monedas, registrar gastos e ingresos, gestionar suscripciones, establecer metas de ahorro y compartir gastos del hogar con division automatica proporcional a los ingresos.

## Stack

| Capa           | Tecnologia                                   |
|----------------|----------------------------------------------|
| Framework      | Next.js 16 (App Router)                      |
| Frontend       | React 19, Tailwind CSS v4, Framer Motion     |
| Charts         | Recharts                                     |
| Icons          | Lucide React                                 |
| Auth / DB / RLS| Supabase (PostgreSQL)                        |
| Hosting        | Vercel                                       |
| Package Manager| pnpm                                         |
| Lenguaje       | TypeScript (strict)                          |
| Tests          | Vitest + Testing Library                     |

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

### Dashboard principal
- **Patrimonio neto consolidado**: suma todos los saldos en ARS y USD con toggle de conversion
- **Tendencia de ingresos vs gastos**: grafico de lineas de los ultimos 6 meses
- **Grafico de torta por categoria**: distribucion de gastos del mes seleccionado
- **Resumen del hogar**: balance de deudas entre miembros si pertenece a un hogar
- **Metas de ahorro**: barras de progreso con animacion y confetti al completar
- **Reporte de gastos fijos**: grafico de barras y tabla de promedios mensuales
- Selector de mes para filtrar transacciones historicas

### Cotizacion USD blue
- Consume [dolarapi.com](https://dolarapi.com) para obtener la cotizacion del dolar blue en tiempo real
- Cache de 1 hora con revalidacion automatica (ISR)
- Fallback hardcodeado si la API falla

### Suscripciones automaticas (Cron)
- Al marcar una transaccion como `subscription` o `service`, el sistema la replica automaticamente cada mes
- Vercel Cron Job ejecuta `GET /api/cron/generate-subscriptions` el dia 1 de cada mes a las 00:00
- Evita duplicados verificando si ya existe una copia para el mes actual

### Metas de ahorro
- Objetivos en ARS o USD con monto target y fecha opcional
- Barra de progreso visual
- Efecto de confetti al alcanzar la meta (canvas-confetti)

### Hogar (gastos compartidos)
- Creacion de hogares con invitacion por email (link con token unico)
- Roles: `admin` (puede gestionar miembros, eliminar hogar) y `member`
- **Split automatico proporcional a ingresos**: cada miembro declara su ingreso mensual en ARS y los gastos se dividen segun el porcentaje que representa su ingreso sobre el total
- Soporte para split manual (porcentaje fijo) si no se declaran ingresos
- Registro de balances entre pares de miembros (`household_balances`)
- Historial de saldados (`household_settlements`) con confirmacion
- Los saldados actualizan automaticamente los balances y marcan los share records como `settled`
- Vista de historial de transacciones del hogar con detalle de quien pago
- Renombrar hogar, transferir admin, abandonar hogar, eliminar hogar (con confirmacion por texto "ELIMINAR")
- Exportacion de transacciones del hogar a CSV

### Autenticacion
- Login con email/password y Google OAuth
- Registro con reCAPTCHA v3 (bypasseable en desarrollo con `dev-token`)
- Medidor de fortaleza de contraseña (zxcvbn, requiere score >= 3)
- Callback de auth para confirmacion de email
- Timeout de sesion por inactividad (30 minutos, warning 1 minuto antes)

### UX
- Tema claro/oscuro con persistencia en localStorage y respeto a `prefers-color-scheme`
- Sidebar responsive con version mobile (drawer)
- Animaciones con Framer Motion en cards, modales y transiciones
- Session timeout con modal de advertencia
- Estados de carga (skeletons) y error en todas las paginas

## Estructura del proyecto

```
pagina-responsive/
├── src/
│   ├── app/                          # App Router
│   │   ├── (dashboard)/              # Rutas protegidas (sidebar + session timeout)
│   │   │   ├── layout.tsx            # Layout con Sidebar + MobileSidebar + SessionTimeout
│   │   │   ├── page.tsx              # Dashboard principal (server component)
│   │   │   ├── loading.tsx           # Skeleton de carga
│   │   │   ├── error.tsx             # Error boundary
│   │   │   ├── accounts/page.tsx     # Gestion de cuentas
│   │   │   ├── transactions/page.tsx # Gestion de transacciones
│   │   │   ├── goals/page.tsx        # Metas de ahorro
│   │   │   └── hogar/page.tsx        # Gestion del hogar
│   │   ├── api/                      # API Routes
│   │   │   ├── auth/register/route.ts
│   │   │   ├── cron/generate-subscriptions/route.ts
│   │   │   └── households/           # CRUD de hogares (admin-only via service_role)
│   │   ├── auth/callback/route.ts    # OAuth callback
│   │   ├── join/page.tsx             # Aceptar invitacion al hogar
│   │   ├── login/page.tsx            # Login
│   │   ├── signup/page.tsx           # Registro
│   │   ├── layout.tsx                # Root layout (metadata, fuentes, theme)
│   │   ├── globals.css               # Tailwind v4 + CSS custom properties
│   │   ├── loading.tsx, error.tsx, not-found.tsx
│   │   └── favicon.ico
│   ├── components/
│   │   ├── dashboard/                # Widgets: ConsolidatedBalance, TrendsChart,
│   │   │                             #   CategoryPieChart, FixedExpensesReport,
│   │   │                             #   DashboardGoals, DashboardHouseholdSummary
│   │   ├── forms/                    # TransactionForm, AccountForm, GoalForm
│   │   ├── household/                # HouseholdManager, HouseholdBalanceWidget,
│   │   │                             #   SettlementModal
│   │   ├── layout/                   # Sidebar, MobileSidebar
│   │   ├── ui/                       # CustomSelect
│   │   ├── AccountItem.tsx           # Tarjeta de cuenta con acciones
│   │   ├── AnimatedCard.tsx          # Card con animacion de entrada
│   │   ├── DashboardLayout.tsx       # Wrapper con skeleton
│   │   ├── GoalItem.tsx              # Tarjeta de meta de ahorro
│   │   ├── GoalsContainer.tsx        # Grid de metas con confetti
│   │   ├── MonthSelector.tsx         # Selector de mes/año
│   │   ├── SessionTimeout.tsx        # Timeout de inactividad
│   │   ├── ThemeProvider.tsx         # Contexto de tema claro/oscuro
│   │   ├── TransactionItem.tsx       # Fila de transaccion con acciones
│   │   └── UserMenu.tsx              # Menu de usuario en sidebar
│   ├── hooks/
│   │   ├── useAccounts.ts            # Hook para cuentas
│   │   └── useHousehold.ts           # Hook para datos del hogar
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser client (singleton lazy)
│   │   │   └── server.ts             # Server client (cookies-based para SSR)
│   │   └── utils.ts                  # Utilidad cn() (clsx + tailwind-merge)
│   ├── services/                     # Capa de logica de negocio
│   │   ├── accountsService.ts        # CRUD de cuentas
│   │   ├── authService.ts            # Login, registro, Google OAuth, logout
│   │   ├── exchangeRateService.ts    # Cotizacion USD/ARS (dolarapi.com)
│   │   ├── householdService.ts       # Operaciones de hogar via API routes
│   │   ├── householdSplitService.ts  # Split, balances, saldados, calculo automatico
│   │   ├── reportService.ts          # Reporte de gastos fijos anuales
│   │   ├── savingsGoalsService.ts    # CRUD de metas de ahorro
│   │   ├── subscriptionService.ts    # Generacion de suscripciones mensuales
│   │   └── transactionsService.ts    # CRUD de transacciones + cuotas
│   └── types/
│       └── database.types.ts         # Tipos completos de todas las tablas (generados por Supabase CLI)
├── supabase/
│   └── migrations/
│       ├── 00001_initial_schema.sql          # Tablas base: profiles, accounts, categories,
│       │                                     #   transactions, savings_goals + RLS + seeds
│       ├── 00002_add_installments_to_transactions.sql  # Cuotas y metodo de pago
│       ├── 00003_households_safe.sql         # Hogares, miembros, invitaciones + RLS
│       ├── 00004_household_expense_split.sql # Incomes, share_records, balances,
│       │                                     #   settlements + RLS + triggers
│       └── 00005_categories_update.sql       # Reemplazo de categorias seed
├── tests/
│   └── householdSplit.test.ts        # Tests unitarios del split automatico
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json                     # TypeScript strict mode
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── vitest.config.ts
├── vercel.json                       # Cron job config
└── .env.local                        # Variables de entorno (no commitear)
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

### Tablas del hogar

| Tabla                    | Descripcion                                                          |
|--------------------------|----------------------------------------------------------------------|
| `households`             | Hogares (nombre, fecha de creacion)                                  |
| `household_members`      | Miembros con rol (`admin`/`member`) y split_percentage               |
| `household_incomes`      | Ingreso mensual declarado por cada miembro (ARS)                     |
| `household_share_records`| Registro de como se dividio cada gasto del hogar                     |
| `household_balances`     | Saldos abiertos entre pares de miembros                              |
| `household_settlements`  | Historial de pagos de saldados entre miembros                        |
| `invitations`            | Invitaciones pendientes para unirse al hogar (por email + token)     |

### Relaciones clave
- `transactions.household_id` → indica que un gasto es compartido
- `transactions.parent_transaction_id` → vincula cuotas hijas con la cuota padre
- `transactions.is_installment` + `installment_number`/`installments_total` → tracking de cuotas

### Seguridad (RLS)
- Todas las tablas tienen Row Level Security habilitado
- Los usuarios solo ven/editan sus propios datos o los de hogares a los que pertenecen
- Las API routes de hogar usan `service_role` para operaciones privilegiadas (crear, invitar, eliminar)

## Variables de entorno

Crear `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=tu-site-key
RECAPTCHA_SECRET_KEY=tu-secret-key
CRON_SECRET=un-secreto-para-el-cron
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
Comida, Regalos, Salud / Medicos, Vivienda, Transporte, Gastos personales, Mascotas, Servicios, Viajes, Deuda, Otros.

## API Routes

| Endpoint                                  | Metodo | Descripcion                              | Auth         |
|-------------------------------------------|--------|------------------------------------------|--------------|
| `/api/auth/register`                      | POST   | Registro con email + reCAPTCHA           | Publico      |
| `/api/cron/generate-subscriptions`        | GET    | Generar suscripciones del mes (cron)     | CRON_SECRET  |
| `/api/households/create`                  | POST   | Crear hogar                              | Usuario      |
| `/api/households/rename`                  | POST   | Renombrar hogar                          | Admin        |
| `/api/households/delete`                  | POST   | Eliminar hogar                           | Admin        |
| `/api/households/invite`                  | POST   | Invitar por email                        | Admin        |
| `/api/households/accept`                  | POST   | Aceptar invitacion                       | Usuario      |
| `/api/households/leave`                   | POST   | Abandonar hogar                          | Miembro      |
| `/api/households/remove-member`           | POST   | Remover miembro                          | Admin        |
| `/api/households/transfer-admin`          | POST   | Transferir admin                         | Admin        |
| `/api/households/split`                   | POST   | Dividir gasto entre miembros             | Miembro      |
| `/api/households/balances`                | GET    | Obtener balances actuales                | Miembro      |
| `/api/households/settle`                  | POST   | Registrar saldado                        | Miembro      |
| `/api/households/incomes`                 | POST   | Declarar/actualizar ingreso mensual      | Miembro      |
| `/api/households/export`                  | GET    | Exportar transacciones a CSV             | Miembro      |

## Licencia

MIT
