# Plan de Ejecucion — Finanzas AR v2

**Total:** 30 tareas | **~67.5h** | **8 sprints** | Dependencias claras entre sprints

---

## SPRINT 1 — Seguridad Inmediata (8h) 🔴

**Objetivo:** Eliminar los 5 riesgos criticos de seguridad. Bloqueante para todo.

### 1.1 Rotar API Keys (1h)

| Key | Accion | Tiempo | Verificacion |
|-----|--------|--------|--------------|
| `OPENAI_API_KEY` | Regenerar en platform.openai.com → `.env.local` → Vercel | 10m | Bot responde |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/revoke` → `.env.local` → Vercel → reconfigurar webhook | 15m | Bot responde |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API → `.env.local` → Vercel | 15m | Dashboard + cron OK |
| `RECAPTCHA_SECRET_KEY` | google.com/recaptcha/admin → ambas keys → `.env.local` + Vercel | 10m | Signup OK |
| `CRON_SECRET` | `crypto.randomBytes(32).toString('hex')` → `.env.local` → Vercel | 5m | Cron OK |
| `TELEGRAM_WEBHOOK_SECRET` | Mismo generador → `.env.local` → Vercel → reconfigurar webhook | 10m | Webhook OK |

### 1.4 Corregir effectiveUserId del Bot (1h)
- `src/app/api/bot/telegram/route.ts:64`: eliminar `BOT_USER_ID` como fallback
- Si no esta vinculado y no es `/vincular`/`/desvincular`, ya se retorna error (lineas 52-61)
- Conclusion: a partir de la linea 64 `supabaseUserId` nunca es null → usar `supabaseUserId!` directamente
- Eliminar `BOT_USER_ID` de `.env.local` y `env.ts:13`

### 1.5 Sanitizar HTML del Bot (1h)
- Agregar `escapeHtml()` en `src/lib/utils.ts`
- Aplicar en TODAS las respuestas de `botProcessor.ts` que incluyan input de usuario (descripcion, nombre, etc.)
- `telegramClient.ts` usa `parse_mode: 'HTML'` en 3 metodos → el texto debe estar sanitizado

### 1.3 Endurecer CSP (2h)
1. Buscar `eval()`, `new Function()` → si no hay, `'unsafe-eval'` no es necesario
2. Mover script de tema a `public/theme.js` con `<Script strategy="beforeInteractive" />`
3. Remover `'unsafe-eval'` y `'unsafe-inline'` de `script-src` en `next.config.ts`
4. Probar: Google Sign-In, reCAPTCHA, tema dark/light sin flicker

### 1.2 Rate Limiting con Upstash Redis (3h)
1. Crear cuenta Upstash → Redis free tier → `UPSTASH_REDIS_REST_URL` + `TOKEN`
2. `pnpm add @upstash/redis @upstash/ratelimit`
3. Crear `src/lib/rateLimit.ts` con 3 limiters: `registerLimiter` (5/min), `telegramLimiter` (60/min), `generalLimiter` (20/min)
4. Eliminar `rateLimitStore` Map, `setInterval`, `checkRateLimit()` de `security.ts`
5. Actualizar `register/route.ts` y `telegram/route.ts`
6. Agregar `generalLimiter.limit(ip)` a los **15 endpoints sin proteccion** (`households/*`, `goals/deposit`, `transactions/generate-one`)

---

## SPRINT 2 — Estabilizacion Tecnica (5h) 🟢

**Pre-requisito:** Sprint 1 ✅

### 4.6 Centralizar Admin Client (1h)
- Crear `src/lib/supabase/admin.ts` con `createAdminClient()`
- Reemplazar en ~18 archivos que repiten `createClient(url, serviceRoleKey)`
- Verificacion: `rg "createClient.*SERVICE_ROLE" src/` no encuentra nada fuera de admin.ts

### 4.5 Eliminar tipos `any` (3h)
- 54 ocurrencias en 7 archivos de servicios
- Crear `TypedSupabaseClient` desde `database.types.ts`
- `supabase: any` → `supabase: TypedSupabaseClient` en todos los metodos
- `any[]` → tipos concretos del schema
- Limpiar `(t: any)`, `(m: any)` en page.tsx y botProcessor
- Verificacion: `pnpm tsc --noEmit` sin errores

### 4.7 Corregir authService (30m)
- `authService.ts:17` usa `window.location.origin` (error en server)
- Separar en `authService.client.ts` (browser) y actualizar imports

### 5.1 Configurar SMTP (30m)
- Crear App Password Gmail → `.env.local` → Vercel
- Probar con: `curl -X POST /api/webhooks/welcome-email`

---

## SPRINT 3 — Testing (16.5h) 🟡

**Pre-requisito:** Sprint 2 ✅ (tipos limpios, admin centralizado)

### 2.4 Coverage (30m)
- Agregar `coverage: { provider: 'v8', thresholds: { lines: 60, branches: 50 } }` en `vitest.config.ts`
- Agregar scripts: `test`, `test:watch`, `test:coverage` en `package.json`

### 2.1 Tests Unitarios (8h)
Archivos a crear/ampliar (~66 tests nuevos):

| Archivo | Tests | Mock target |
|---------|-------|-------------|
| `tests/services/exchangeRateService.test.ts` | 4 | fetch (dolarapi.com) |
| `tests/services/cryptoPriceService.test.ts` | 3 | fetch (CoinGecko) |
| `tests/services/transactionsService.test.ts` | 12 | SupabaseClient |
| `tests/services/accountsService.test.ts` | 8 | SupabaseClient |
| `tests/services/savingsGoalsService.test.ts` | 5 | SupabaseClient |
| `tests/services/subscriptionService.test.ts` | 3 | SupabaseClient |
| `tests/services/householdSplit.test.ts` | +8 (ampliar) | SupabaseClient |
| `tests/services/reportService.test.ts` | +3 (ampliar) | Transacciones |
| `tests/lib/utils.test.ts` | +15 (ampliar) | Puras |
| `tests/lib/security.test.ts` | 7 | Headers |

### 2.2 Tests Integracion API (4h)
- `tests/api/auth/register.test.ts` — 5 tests
- `tests/api/households/households.test.ts` — 6 tests
- `tests/api/goals/deposit.test.ts` — 4 tests

### 2.3 Tests Componentes (3h)
- `tests/components/ThemeProvider.test.tsx` — 3 tests
- `tests/components/SessionTimeout.test.tsx` — 3 tests (fake timers)
- `tests/components/AnimatedCard.test.tsx` — 2 tests
- `tests/components/TransactionItem.test.tsx` — 2 tests
- `tests/components/GoalItem.test.tsx` — 2 tests

---

## SPRINT 4 — Monitoreo y DevOps (6h) 🟡

**Pre-requisito:** Sprint 2 ✅ | Puede ejecutarse en paralelo con Sprint 3 y 5

### 3.3 Logging con Pino (2h)
1. `pnpm add pino pino-pretty`
2. Crear `src/lib/logger.ts` con `logger` y `createContextLogger()`
3. Reemplazar TODOS los `console.error`/`console.warn` (~40+ ocurrencias) por `logger.error()` con contexto

### 3.1 Sentry (2h)
1. `pnpm add @sentry/nextjs` → wizard setup
2. `withSentryConfig()` en `next.config.ts`
3. Reemplazar `console.error` por `Sentry.captureException` en rutas API y botProcessor

### 3.2 GitHub Actions CI/CD (2h)
- Crear `.github/workflows/ci.yml` con jobs: `lint`, `typecheck`, `test`
- PR debe mostrar ✅ verde en los 3 checks

---

## SPRINT 5 — Refactor Pesado (17h) 🟢

**Pre-requisito:** Sprint 2 ✅ | Los tests de Sprint 3 protegen los refactors

### 4.1 Dashboard Page (4h)
`page.tsx` (186 lineas) → Extraer:
1. `src/lib/dashboardData.ts` — `getDashboardData(userId)` con `Promise.all()`
2. `src/lib/dashboardCalculations.ts` — funciones puras: `calculateBalances()`, `calculateTrends()`, `calculateHouseholdSplit()`
3. Server Components en `components/dashboard/`: `DashboardGreeting`, `TelegramBotBanner`, `AccountsGrid`, `DashboardCharts`
4. page.tsx final ~100 lineas

### 4.2 BotProcessor (6h)
`botProcessor.ts` (719 lineas) → 7 archivos en `src/services/bot/`:
- `commands.ts` — /stats, /list, /balance, /config, /ayuda, /vincular, /desvincular
- `stateMachine.ts` — FlowState y transiciones
- `keywords.ts` — aprendizaje/consulta de bot_rules
- `messages.ts` — templates constantes
- `index.ts` — BotProcessor que compone todo (ya existen: `types.ts`, `parser.ts`, `ai.ts`)

### 4.3 TransactionForm (3h)
~580 lineas → hooks + subcomponentes:
- Hooks: `useTransactionForm`, `useCategories`, `useCreditCardInfo`, `useSplitPreview`
- Componentes: `TypeToggle`, `CategoryGrid`, `InstallmentsSection`, `RecurringSection`, `HouseholdSection`, `BillingMonthPreview`

### 4.4 HouseholdManager (4h)
~879 lineas → hooks + subcomponentes:
- Hooks: `useHouseholdMembers`, `useHouseholdIncomes`, `useInviteLink`, `useSettlements`
- Componentes: `MemberList`, `IncomeEditor`, `SplitEditor`, `TransactionList`, `SettlementHistory`, `GoalPreview`, `LeaveModal`, `DeleteModal`

---

## SPRINT 6 — Features y DB (9.5h) 🟢

**Pre-requisito:** Sprint 2 ✅ | Paralelizable con Sprints 3-4-5

### 5.2 Audit Trail (3h)
- Migracion `00013_audit_log.sql`: tabla `audit_logs` (user_id, action, entity_type, entity_id, details JSONB, ip_address) + indices + RLS
- `src/services/auditService.ts`
- Integrar en: create/update/delete de transacciones, cuentas, metas, splits, settlements

### 5.3 PWA Icons (1h)
- Generar `icon-192.png` y `icon-512.png` (no existen en `public/`)
- Verificar `manifest.json` y meta tags

### 5.4 Accesibilidad (3h)
- `aria-label` en botones solo-icono (~15+ componentes)
- `role="dialog"`, `aria-modal` en modales
- Focus trap en LeaveModal, DeleteModal
- Contraste dark mode (texto gris sobre fondo oscuro)
- `prefers-reduced-motion` con `useReducedMotion()` de Framer Motion

### 7.1 Mejorar Cron (2h)
- Usar fecha real del cron para `transaction_date` (no forzar dia 1)
- Validar que no exista hijo antes de generar
- Soportar frecuencias: quarterly, biannual, annual

### 7.2 TTL bot_pending (30m)
- En cron `keepalive`, `DELETE` de `bot_pending` con >24h

### 7.3 Indices (1h)
- Migracion `00014_additional_indexes.sql`: indices en transactions, household_balances, goal_deposits, bot_rules

---

## SPRINT 7 — Optimizacion (5h) ⚪

**Pre-requisito:** Sprint 5 ✅ (refactor permite lazy loading)

### 6.1 Lazy Loading (2h)
- Recharts: `dynamic(() => import(...), { ssr: false })` en `DashboardCharts`
- `canvas-confetti`: `await import('canvas-confetti')` al completar meta
- `zxcvbn`: `await import('zxcvbn')` en signup
- `AyudaContent`: `dynamic()` con skeleton

### 6.2 Debounce (1h)
- Crear `useDebounce` hook en `src/hooks/useDebounce.ts`
- Aplicar en FAQ search (250ms)

### 6.3 Memoizacion (2h)
- `React.memo` en: `AccountItem`, `TransactionItem`, `GoalItem`
- `useMemo`/`useCallback` en: `HouseholdManager` (autoSplitMap), `TransactionForm` (billingMonth, splitPreview)

---

## SPRINT 8 — Deployment (45m) 🟢

### 8.2 Vercel Env Vars (30m)
Verificar/agregar en Vercel Dashboard: 22 variables de entorno (8 actualizadas en Sprint 1, 4 nuevas de Upstash/Sentry/SMTP)

### 8.3 Deploy Previews (15m)
- Activar en Vercel Dashboard → Git → Preview Deployments

---

## Resumen

```
Sprint 1 🔴 Seguridad       8h     ← EMPEZAR AQUI
  ↓
Sprint 2 🟢 Estabilizacion   5h
  ↓
  ├─ Sprint 3 🟡 Testing     16.5h  (paralelo)
  ├─ Sprint 4 🟡 Monitoreo    6h    (paralelo)
  └─ Sprint 5 🟢 Refactor    17h    (paralelo)
           ↓
Sprint 6 🟢 Features+DB      9.5h
           ↓
Sprint 7 ⚪ Optimizacion      5h
           ↓
Sprint 8 🟢 Deployment       45m
────────────────────────────────────
TOTAL                        ~67.5h
```

## Reglas

- Sprints 1 y 2 son bloqueantes para todo lo demas
- Sprints 3, 4 y 5 pueden ejecutarse en paralelo (equipo de 2-3 personas)
- Cada sprint termina con `pnpm build && pnpm test` en verde
- Commitear despues de cada tarea, no acumular
