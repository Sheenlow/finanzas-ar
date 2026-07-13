# PLAN DE MEJORAS — FINANZAS AR

Revisión completa del proyecto. A continuación, el plan detallado organizado por fases, prioridades y tareas concretas.

---

## FASE 1 — CORRECCIÓN DE BUGS CRÍTICOS

**Impacto:** Alto &nbsp;|&nbsp; **Esfuerzo:** Bajo

---

### Tarea 1.1 — Arreglar total de cuotas inflado en `TransactionItem`

**Archivo:** `src/components/TransactionItem.tsx:59-60`

**Problema:** La línea actual multiplica `amount * installments_total`, pero `amount` ya es el valor por cuota individual. Una compra de $12.000 en 3 cuotas ($4.000 c/u) muestra $12.000 en esa cuota, dando la impresión de que el gasto es 3x mayor.

**Solución:**
```tsx
// Antes (línea ~59-60):
transaction.is_installment ? transaction.amount * transaction.installments_total : transaction.amount

// Después:
transaction.amount
```

Ya que `amount` ya contiene el valor por cuota. El total del gasto se puede ver en el detalle si es necesario.

**Riesgo:** Ninguno. Solo cambia display.
**Tiempo estimado:** 5 min.

---

### Tarea 1.2 — Arreglar balance del Bot de Telegram para ingresos

**Archivo:** `src/services/botProcessor.ts:524-529`

**Problema:** El bot siempre resta del saldo (`account.balance - installmentAmount`) sin verificar si la transacción es un ingreso. Si un usuario registra un ingreso vía Telegram, el saldo disminuye en vez de aumentar.

**Solución:**
```ts
// Antes (línea ~527):
await this.supabase.from('accounts').update({ balance: account.balance - installmentAmount }).eq('id', parsed.accountId)

// Después:
const newBalance = parsed.type === 'income'
  ? account.balance + installmentAmount
  : account.balance - installmentAmount
await this.supabase.from('accounts').update({ balance: newBalance }).eq('id', parsed.accountId)
```

**Riesgo:** Ninguno. Misma lógica que `transactionsService.ts:93-97`.
**Tiempo estimado:** 5 min.

---

### Tarea 1.3 — Arreglar detección de suscripciones duplicadas

**Archivos afectados:**
- `src/app/api/cron/generate-subscriptions/route.ts:37-41`
- `src/services/subscriptionService.ts:22-27`

**Problema:** Ambas funciones verifican duplicados comparando `transaction_date` con una fecha parcial, pero la inserción real usa `new Date().toISOString()` con hora completa. El `eq()` de Supabase en un campo `timestamp` no matchea con `'2026-07-01'` si el valor guardado es `'2026-07-01T12:34:56.789Z'`.

**Solución:**
```ts
const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01T00:00:00Z`
const endOfMonth = currentMonth === 12
  ? `${currentYear + 1}-01-01T00:00:00Z`
  : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01T00:00:00Z`

const { data: existing } = await supabase
  .from('transactions')
  .select('id')
  .eq('parent_transaction_id', sub.id)
  .gte('transaction_date', startOfMonth)
  .lt('transaction_date', endOfMonth)
  .maybeSingle()
```

Aplicar el mismo cambio en `subscriptionService.ts:22-27`.

**Riesgo:** Ninguno.
**Tiempo estimado:** 10 min.

---

### Tarea 1.4 — Agregar `billing_month` a suscripciones generadas

**Archivos afectados:**
- `src/services/subscriptionService.ts:32-46`
- `src/app/api/cron/generate-subscriptions/route.ts:45-58`

**Problema:** Las transacciones hijas de suscripciones recurrentes se crean sin `billing_month`. Si el método de pago original es `card`, los reportes por mes de facturación quedan rotos para esas transacciones.

**Solución:** Extraer la función `resolveBillingMonth` de `transactionsService.ts` a `utils.ts` para poder reutilizarla desde el servicio de suscripciones y el cron. Calcular `billing_month` antes del `insert` usando los datos de la tarjeta de crédito asociada al `account_id` del item padre.

**Riesgo:** Bajo. La función de cálculo ya está probada en el flujo web.
**Tiempo estimado:** 20 min.

---

## FASE 2 — MEJORAS DE SEGURIDAD

**Impacto:** Medio/Alto &nbsp;|&nbsp; **Esfuerzo:** Medio

---

### Tarea 2.1 — Mover `createClient()` de `authService.ts` fuera del ámbito de módulo

**Archivo:** `src/services/authService.ts:3`

**Problema:** `const supabase = createClient()` se ejecuta al importar el módulo. Si algún Server Component importa este archivo, `createBrowserClient()` falla porque no hay `window`. Además, las env vars `NEXT_PUBLIC_*` se comportan distinto en server vs client.

**Solución:** Usar lazy initialization:
```ts
let _client: ReturnType<typeof createClient> | null = null
function getClient() {
  if (!_client) _client = createClient()
  return _client
}
```
Reemplazar todas las referencias a `supabase` por `getClient()` dentro de cada método.

**Riesgo:** Bajo.
**Tiempo estimado:** 10 min.

---

### Tarea 2.2 — Agregar rate limiting a rutas de API críticas

**Archivos afectados:**
- `src/app/api/goals/deposit/route.ts`
- `src/app/api/households/split/route.ts`
- `src/app/api/households/create/route.ts`
- `src/app/api/households/delete/route.ts`

**Problema:** Solo las rutas de registro y Telegram tienen rate limiting. Las rutas de escritura no tienen protección contra abuso.

**Solución:** Agregar el mismo patrón ya usado en `auth/register/route.ts`:
```ts
import { checkRateLimit, getClientIp } from '@/lib/security'

const ip = getClientIp(req)
const rate = checkRateLimit('goal-deposit:' + ip, 10, 60_000)
if (!rate.allowed) {
  return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
}
```

**Riesgo:** Ninguno. El patrón ya está probado.
**Tiempo estimado:** 15 min.

---

### Tarea 2.3 — Endurecer `proxy.ts` para proteger rutas `/api`

**Archivo:** `src/proxy.ts:4-5`

**Problema:** `'/api'` es ruta pública en el middleware. Esto delega toda la seguridad a cada endpoint individual. Si un nuevo endpoint se olvida de agregar auth check, queda expuesto.

**Solución:** Excluir `/api` de las rutas públicas y agregar las rutas específicas que SÍ necesitan ser públicas:
```ts
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/join',
  '/auth/callback',
  '/api/auth/register',
  '/api/bot/telegram',
  '/api/cron/',
  '/api/webhooks/',
]
```

Luego en el middleware, verificar auth para todas las demás rutas `/api`:
```ts
const isApiRoute = request.nextUrl.pathname.startsWith('/api')
if (isApiRoute && !isPublicPath) {
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
}
```

**Riesgo:** Medio. Requiere probar que todas las rutas públicas sigan funcionando.
**Tiempo estimado:** 20 min.

---

## FASE 3 — MEJORAS DE CÓDIGO

**Impacto:** Medio &nbsp;|&nbsp; **Esfuerzo:** Medio

---

### Tarea 3.1 — Eliminar `any` de todos los servicios y tipar correctamente

**Archivos afectados:**
- `src/services/accountsService.ts` — `supabase: any` → `SupabaseClient<Database>`
- `src/services/transactionsService.ts` — `supabase: any` → `SupabaseClient<Database>`
- `src/services/householdService.ts` — `supabase: any` → `SupabaseClient<Database>`
- `src/services/householdSplitService.ts` — `supabase: any` → `SupabaseClient<Database>`
- `src/services/savingsGoalsService.ts` — `supabase: any` → `SupabaseClient<Database>`
- `src/services/subscriptionService.ts` — `supabase: any` → `SupabaseClient<Database>`

**Problema:** Todos los servicios reciben `supabase: any`, anulando completamente el sistema de tipos. Errores de query solo se detectan en runtime.

**Solución:**
```ts
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Antes:
async getAll(supabase: any, userId: string) { ... }

// Después:
async getAll(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Database['public']['Tables']['accounts']['Row'][]> { ... }
```

Esto da autocompletado en las queries y errores en tiempo de compilación si una columna no existe.

**Riesgo:** Bajo. Puede revelar errores de tipo ocultos que requieran ajustes.
**Tiempo estimado:** 45 min.

---

### Tarea 3.2 — Eliminar `safeRedirect` y usar `redirect()` nativo

**Archivos:** `src/lib/redirect.ts` + todos los Server Components que lo usan

**Problema:** La función construye manualmente una URL absoluta usando `headers()` para luego llamar a `redirect()`. Es innecesario.

**Pasos:**
1. Reemplazar todas las llamadas `safeRedirect('/login')` por `redirect('/login')` de `next/navigation`
2. Eliminar el archivo `src/lib/redirect.ts`
3. Verificar que `return redirect(...)` funcione correctamente

**Riesgo:** Bajo. `redirect()` es la API oficial de Next.js 16.
**Tiempo estimado:** 15 min.

---

### Tarea 3.3 — Reemplazar `window.location` por `useRouter` en `HouseholdManager`

**Archivo:** `src/components/household/HouseholdManager.tsx:224-228`

**Problema:** `window.location.href` y `window.location.reload()` causan recarga completa de la página, perdiendo estado del cliente.

**Solución:**
```ts
// Antes:
window.location.href = '/hogar'
window.location.reload()

// Después:
router.push('/hogar')
// Para refresh de datos, volver a cargar el estado desde el effect
```

**Riesgo:** Bajo.
**Tiempo estimado:** 10 min.

---

### Tarea 3.4 — Renombrar `proxy.ts` a `middleware.ts`

**Archivo:** `src/proxy.ts`

**Problema:** La convención de Next.js es `middleware.ts` en la raíz o `src/middleware.ts`. El nombre `proxy.ts` no sigue estándares y es confuso.

**Solución:** Renombrar a `src/middleware.ts`.

**Riesgo:** Ninguno si Next.js detecta el archivo por nombre.
**Tiempo estimado:** 5 min.

---

### Tarea 3.5 — Crear `src/lib/env.ts` con validación de variables de entorno

**Archivo nuevo:** `src/lib/env.ts`

**Problema:** El código usa `process.env.NEXT_PUBLIC_SUPABASE_URL!` con non-null assertion en todos lados. Si falta una variable, el error es un Runtime Error genérico.

**Solución:**
```ts
// src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  RECAPTCHA_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().min(1),
  BOT_USER_ID: z.string().uuid(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
})

export const env = envSchema.parse(process.env)
```

Esto tira un error claro en build/dev si falta alguna variable requerida.

**Dependencia nueva:** `zod` (agregar al proyecto si no está).

**Riesgo:** Ninguno. Solo agrega validación.
**Tiempo estimado:** 15 min.

---

## FASE 4 — OPTIMIZACIONES DE PERFORMANCE

**Impacto:** Alto en UX &nbsp;|&nbsp; **Esfuerzo:** Medio

---

### Tarea 4.1 — Paralelizar queries del Dashboard

**Archivo:** `src/app/(dashboard)/page.tsx`

**Problema:** Las queries se ejecutan en serie: accounts, transactions, goals, categorías, exchange rate, crypto prices — una tras otra.

**Solución:** Agrupar queries independientes con `Promise.all`:
```ts
const [
  accounts,
  transactions,
  goals,
  { data: categories },
  { data: membership },
  exchangeRate,
  cryptoPrices,
] = await Promise.all([
  accountsService.getAll(supabase, user.id),
  transactionsService.getAll(supabase, user.id),
  savingsGoalsService.getAll(supabase, user.id),
  supabase.from('categories').select('id, name, color').order('name'),
  supabase.from('household_members')
    .select('*, households(id, name)')
    .eq('user_id', user.id)
    .maybeSingle(),
  exchangeRateService.getRate(),
  cryptoPriceService.getPrices(),
])
```

Esto reduce el tiempo de carga de ~N*200ms a ~200ms.

**Riesgo:** Ninguno. Las queries son independientes.
**Tiempo estimado:** 20 min.

---

### Tarea 4.2 — Agregar caché a datos de usuario con React Context

**Archivos afectados:** `UserMenu.tsx`, nuevo `UserProvider.tsx`

**Problema:** `UserMenu.tsx` hace 3 queries a Supabase cada vez que se monta, y se monta en cada página. Datos redundantes.

**Solución:** Crear un `UserProvider` que cargue los datos una vez y los comparta vía contexto:
```
src/components/UserProvider.tsx   ← nuevo contexto con user, profile, household
src/components/UserMenu.tsx       ← consumir del contexto, no hacer fetch
```

**Riesgo:** Medio. Requiere probar refresco de datos al cambiar perfil.
**Tiempo estimado:** 30 min.

---

### Tarea 4.3 — Agregar lazy loading a componentes pesados

**Archivos afectados:** `(dashboard)/layout.tsx`, `accounts/page.tsx`, `hogar/page.tsx`, `goals/page.tsx`

**Problema:** Componentes grandes se importan estáticamente, inflando el bundle inicial.

**Solución:** Usar `dynamic` de Next.js:
```tsx
import dynamic from 'next/dynamic'

const HouseholdManager = dynamic(
  () => import('@/components/household/HouseholdManager')
    .then(mod => ({ default: mod.HouseholdManager })),
  { loading: () => <Skeleton className="h-64" /> }
)
```

Aplicar a: `HouseholdManager`, `RecurringExpenses`, `TrendsChart`, `CategoryPieChart`, `FixedExpensesReport`, `MonthlyFixedExpensesReport`.

**Riesgo:** Bajo.
**Tiempo estimado:** 20 min.

---

### Tarea 4.4 — Agregar Suspense boundaries granular en el Dashboard

**Archivo:** `src/app/(dashboard)/page.tsx`

**Problema:** El dashboard entero espera a que todas las queries terminen antes de mostrar nada.

**Solución:** Envolver cada sección en su propio `<Suspense>` con skeleton fallback:
```tsx
<Suspense fallback={<BalanceSkeleton />}>
  <ConsolidatedBalance section />
</Suspense>
<Suspense fallback={<ChartSkeleton />}>
  <TrendsChart section />
</Suspense>
// etc. para CategoryPieChart, MonthlyTransactions, FixedExpenses, etc.
```

Esto permite streaming SSR: cada sección se renderiza apenas sus datos están listos.

**Riesgo:** Medio. Requiere refactorizar datos en componentes separados.
**Tiempo estimado:** 40 min.

---

## FASE 5 — REFACTOR DE ARQUITECTURA

**Impacto:** Alto en mantenibilidad &nbsp;|&nbsp; **Esfuerzo:** Alto

---

### Tarea 5.1 — Dividir `botProcessor.ts` en módulos

**Archivo:** `src/services/botProcessor.ts` (942 líneas)

**Estructura propuesta:**

```
src/services/bot/
├── parser.ts           ← parseText, extractKeywords, detectPaymentMethod,
│                         isCardPayment, normalizeAmount, getArgentinaISOString
├── ai.ts               ← parseWithAI
├── stateMachine.ts     ← FlowState, computeNext, renderState,
│                         confirmationKeyboard, formatConfirmation
├── commands.ts         ← handleCommand, getStatsMessage, getListMessage,
│                         getBalancesMessage
├── transactionOps.ts   ← createTransaction, updateTransactionField,
│                         deleteTransaction, getTransaction,
│                         saveKeywordRule, resolveBillingMonth
├── types.ts            ← ParsedTransaction, Account, Category,
│                         KeywordRule, FlowState, etc.
└── processor.ts        ← clase BotProcessor (orquestador) + handleCallback
```

**Riesgo:** Medio. Muchas piezas móviles. Conviene hacerlo con tests.
**Tiempo estimado:** 1.5 - 2 horas.

---

### Tarea 5.2 — Dividir `HouseholdManager.tsx` en subcomponentes

**Archivo:** `src/components/household/HouseholdManager.tsx` (879 líneas)

**Estructura propuesta:**

```
src/components/household/
├── HouseholdManager.tsx           ← orquestador (~200 líneas)
├── CreateHouseholdForm.tsx        ← formulario de creación sin hogar
├── HouseholdHeader.tsx            ← encabezado con nombre editable
├── IncomeSection.tsx              ← sección de ingresos mensuales por miembro
├── MembersSection.tsx             ← miembros, splits, edición de porcentajes
├── InviteSection.tsx              ← sección de invitación por email
├── TransactionTable.tsx           ← tabla de últimos gastos del hogar
├── SettlementHistory.tsx          ← historial de liquidaciones
├── HouseholdGoalsPreview.tsx      ← preview de metas compartidas
├── DangerZone.tsx                 ← botón de eliminar hogar
├── LeaveHouseholdModal.tsx        ← modal de salirse del hogar
└── DeleteHouseholdModal.tsx       ← modal de eliminación con confirmación
```

**Riesgo:** Medio. Implica mover estados y props entre componentes.
**Tiempo estimado:** 1.5 - 2 horas.

---

## FASE 6 — MEJORAS DE UX Y FUNCIONALIDAD

**Impacto:** Medio &nbsp;|&nbsp; **Esfuerzo:** Medio/Alto

---

### Tarea 6.1 — Agregar PWA (manifest + metadata)

**Archivos nuevos:**
- `public/manifest.json`
- `public/icon-192.png`
- `public/icon-512.png`

**Solución:** Agregar en `src/app/layout.tsx`:
```tsx
export const metadata: Metadata = {
  // ... existente ...
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Finanzas AR',
  },
}
```

Y crear `public/manifest.json`:
```json
{
  "name": "Finanzas AR",
  "short_name": "FinanzasAR",
  "description": "Gestión financiera personal para Argentina",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1e1e24",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Riesgo:** Ninguno.
**Tiempo estimado:** 15 min.

---

### Tarea 6.2 — Agregar skeleton states a formularios y listas

**Archivo nuevo:** `src/components/ui/Skeleton.tsx`

**Problema:** Los estados de carga actuales son mínimos (solo texto "Cargando..." o spinners).

**Solución:** Crear componente `Skeleton` con variantes usando Tailwind `animate-pulse`:
```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} />
}

export function CardSkeleton() { /* skeleton de tarjeta */ }
export function RowSkeleton() { /* skeleton de fila de tabla */ }
export function ChartSkeleton() { /* skeleton de gráfico */ }
```

Reemplazar los `loading.tsx` y fallbacks actuales con skeletons.

**Riesgo:** Ninguno.
**Tiempo estimado:** 30 min.

---

### Tarea 6.3 — Agregar tests unitarios y de integración

**Archivos nuevos:**

| Archivo | Qué testea |
|---------|-----------|
| `tests/transactionsService.test.ts` | CRUD, billing_month, cuotas |
| `tests/botProcessor.test.ts` | Parseo de texto argentino, flujo de estados, comandos |
| `tests/reportService.test.ts` | Cálculo de gastos fijos, agrupación mensual |
| `tests/accountsService.test.ts` | CRUD cuentas, tarjetas, ciclos de facturación |

**Ampliar existente:**
- `tests/householdSplit.test.ts` — Agregar tests para `splitHouseholdExpense`, balances y liquidaciones

**Riesgo:** Ninguno.
**Tiempo estimado:** 2 - 3 horas.

---

### Tarea 6.4 — Extraer URLs hardcodeadas a variables de entorno

**Archivos afectados:**

| Archivo | URL hardcodeada | Variable nueva |
|---------|----------------|----------------|
| `src/services/exchangeRateService.ts` | `https://dolarapi.com/v1/dolares/blue` | `DOLAR_API_URL` |
| `src/services/cryptoPriceService.ts` | `https://api.coingecko.com/api/v3/simple/price` | `COINGECKO_API_URL` |
| `src/app/api/webhooks/welcome-email/route.ts` | `https://finanzas-ar-app.vercel.app` | `NEXT_PUBLIC_SITE_URL` (ya existe) |

**Riesgo:** Ninguno.
**Tiempo estimado:** 15 min.

---

## FASE 7 — LIMPIEZA Y MANTENIMIENTO

**Impacto:** Bajo &nbsp;|&nbsp; **Esfuerzo:** Mínimo

---

### Tarea 7.1 — Eliminar header `X-XSS-Protection` obsoleto

**Archivo:** `next.config.ts:22`

Eliminar la línea:
```ts
{ key: 'X-XSS-Protection', value: '1; mode=block' },
```

Este header está deprecado y es ignorado por navegadores modernos.

**Tiempo estimado:** 1 min.

---

### Tarea 7.2 — Simplificar selectores CSS redundantes

**Archivo:** `src/app/globals.css`

**1. Selectores scrollbar (líneas 106-138):**
```css
/* Antes */
* { scrollbar-width: thin; ... }

/* Después */
html {
  scrollbar-width: thin;
  scrollbar-color: hsl(40 20% 85%) transparent;
}
```

El selector `*` fuerza al navegador a recalcular estilos de scrollbar en cada nodo del DOM. Aplicar solo a `html` es suficiente.

**2. Bloque `@theme` (líneas 45-67):**
Si Tailwind v4 lo permite, definir los colores directamente con valores HSL en `@theme` y eliminar las variables del `:root`. Si es muy riesgoso, dejar como está.

**Riesgo:** Bajo (scrollbar), Medio (theme).
**Tiempo estimado:** 10 min.

---

### Tarea 7.3 — Verificar y limpiar artefactos de build

- Confirmar que `node_modules/.package-lock.json` no esté siendo trackeado por git
- Agregar `.vercel` al `.gitignore` (si no está ya)
- Verificar que `tsconfig.tsbuildinfo` esté ignorado (está en `.gitignore`)

**Tiempo estimado:** 5 min.

---

## RESUMEN DE FASES Y TIEMPOS

| Fase | Tareas | Tiempo total |
|------|--------|-------------|
| **Fase 1** — Bugs críticos | 4 | ~40 min |
| **Fase 2** — Seguridad | 3 | ~45 min |
| **Fase 3** — Calidad de código | 5 | ~1h 25min |
| **Fase 4** — Performance | 4 | ~1h 50min |
| **Fase 5** — Refactor arquitectura | 2 | ~3h - 4h |
| **Fase 6** — UX y features | 4 | ~3h - 4h |
| **Fase 7** — Limpieza | 3 | ~16 min |
| **TOTAL** | **25 tareas** | **~11 - 13 horas** |

---

## ORDEN DE EJECUCIÓN RECOMENDADO

### Semana 1 — Correcciones y seguridad (~3h)
Fase 1 (bugs) → Fase 2 (seguridad) → Fase 3 (código)

### Semana 2 — Performance y limpieza (~2h)
Fase 4 (performance) → Fase 7 (limpieza)

### Semana 3 — Deuda técnica grande (~4h)
Fase 5 (refactor arquitectura)

### Semana 4 — Calidad final (~4h)
Fase 6 (PWA, tests, skeletons, env vars)

---

## RESUMEN DE PROBLEMAS ENCONTRADOS POR CATEGORÍA

### Bugs (6 encontrados)
1. Total de cuotas inflado en TransactionItem
2. Bot siempre resta del saldo, incluso para ingresos
3. Detección de suscripciones duplicadas rota
4. `billing_month` nulo en suscripciones generadas
5. `addMonths()` frágil en fin de mes
6. Filtro de reportService con condición inalcanzable

### Seguridad (6 encontrados)
1. Cliente Supabase en ámbito de módulo en authService
2. Rutas `/api` sin protección en middleware
3. Rate limiting solo en memoria (no escala en serverless)
4. Sin validación de tipos en body de API routes
5. Rate limiting ausente en rutas de escritura (deposit, split)
6. Service role key en .env.local (expuesto localmente)

### Performance (7 encontrados)
1. Queries secuenciales en Dashboard
2. Fetch redundante en UserMenu cada página
3. Componentes monolíticos con exceso de estados
4. Algoritmo ineficiente de gastos fijos
5. Selectores CSS universales costosos
6. Sin lazy loading de componentes pesados
7. Sin Suspense granular en Dashboard

### Código / Arquitectura (9 encontrados)
1. `any` masivo en todos los servicios
2. `safeRedirect` innecesario
3. `window.location` en vez de router
4. Archivo middleware mal nombrado (`proxy.ts`)
5. Sin validación de variables de entorno
6. `botProcessor.ts` monolítico (942 líneas)
7. `HouseholdManager.tsx` monolítico (879 líneas)
8. URLs hardcodeadas
9. Header `X-XSS-Protection` deprecado

### Funcionalidad faltante (4 encontrados)
1. Sin PWA
2. Sin skeleton states
3. Tests casi inexistentes (solo 1 archivo)
4. Sin analytics

---

*Plan generado el 12 de julio de 2026.*
