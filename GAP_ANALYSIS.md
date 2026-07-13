# Análisis de Pendientes — Finanzas AR

**Proyecto:** Gestión financiera personal para Argentina (Next.js 16 + Supabase + Telegram Bot + OpenAI)
**Fecha:** Julio 2026
**Progreso:** 2 de 30 tareas completadas (6.7%) — ~64h estimadas restantes

---

## 🔴 CRÍTICO — Fase 1: Seguridad

### 1.1 Rotar todas las API keys expuestas

**Problema:** `.env.local` contiene keys de producción. Si el repo fue público o hubo backups sin encriptar, están comprometidas.

| Key | Acción | Tiempo est. |
|-----|--------|-------------|
| `OPENAI_API_KEY` | Regenerar en https://platform.openai.com/api-keys | 10m |
| `TELEGRAM_BOT_TOKEN` | `/revoke` con @BotFather, reconfigurar webhook | 15m |
| `SUPABASE_SERVICE_ROLE_KEY` | Regenerar en Supabase Dashboard > API. Esto revoca la anterior y rompe cron jobs + admin client. | 15m |
| `RECAPTCHA_SECRET_KEY` | Regenerar en https://www.google.com/recaptcha/admin | 10m |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | 5m |
| `TELEGRAM_WEBHOOK_SECRET` | Nuevo secreto aleatorio + reconfigurar webhook | 10m |

**Total: ~1h**

---

### 1.2 Migrar rate limiting de Map a Upstash Redis

**Problema:** `src/lib/security.ts:3` usa `Map` en memoria. En Vercel serverless cada cold start reinicia contadores. `setInterval` no es confiable en serverless.

**Archivo actual:** `src/lib/security.ts` — 78 líneas con `rateLimitStore` (Map), `checkRateLimit()`, `getClientIp()`, `requireOrigin()`.

**Endpoints CON rate limit actual:**
- `POST /api/auth/register` — 5 req/min
- `POST /api/bot/telegram` — 60 req/min

**Endpoints SIN rate limit (15 rutas):**
- `POST /api/households/create`
- `POST /api/households/invite`
- `POST /api/households/accept`
- `PATCH /api/households/rename`
- `DELETE /api/households/delete`
- `POST /api/households/leave`
- `POST /api/households/remove-member`
- `POST /api/households/transfer-admin`
- `POST /api/households/split`
- `POST /api/households/settle`
- `GET /api/households/balances`
- `GET /api/households/incomes`
- `GET /api/households/export`
- `POST /api/goals/deposit`
- `POST /api/transactions/generate-one`

**Acciones:**
1. Instalar `@upstash/ratelist` + `@upstash/redis`
2. Crear cuenta en https://upstash.com (Redis free tier)
3. Refactorizar: extraer rate limiting a `src/lib/rateLimit.ts` con limiters pre-configurados
4. Remover `rateLimitStore` Map, `setInterval`, `checkRateLimit()` del security.ts
5. Mantener `getClientIp()` y `requireOrigin()` en security.ts
6. Aplicar rate limiting a los 15 endpoints faltantes

**Tiempo est.: 3h**

---

### 1.3 Endurecer Content Security Policy

**Problema:** `next.config.ts` incluye `'unsafe-eval'` y `'unsafe-inline'` en `script-src`, lo que debilita la protección XSS. El script de tema en `layout.tsx:40` usa `dangerouslySetInnerHTML`.

**Archivo actual:** `src/app/layout.tsx:39-43`

**Acciones:**
1. Investigar si `'unsafe-eval'` es realmente necesario (buscar `eval()`, `new Function()`, `setTimeout(string)`)
2. Probar sin `'unsafe-eval'` en staging
3. Mover script de tema a `public/theme.js` reemplazando `dangerouslySetInnerHTML` por `<Script src="/theme.js" strategy="beforeInteractive" />`
4. Actualizar CSP en `next.config.ts`: remover `'unsafe-eval'` y `'unsafe-inline'` de `script-src`
5. Verificar que Google Sign-In, reCAPTCHA y el tema sigan funcionando

**Tiempo est.: 2h**

---

### 1.4 Revisar `effectiveUserId` del bot de Telegram

**Problema:** `src/app/api/bot/telegram/route.ts:64` — cuando un usuario no vinculado envía un comando (que no es `/vincular` ni `/desvincular`), se usa `BOT_USER_ID` como fallback.

```typescript
// Linea 64
const effectiveUserId = supabaseUserId || BOT_USER_ID
```

**Acciones:**
1. Analizar flujo completo: ¿qué comandos usan `effectiveUserId`?
2. Si no está vinculado y no es `/vincular` ni `/desvincular`, devolver solo mensaje de error sin pasar a `BotProcessor`
3. Remover el fallback `BOT_USER_ID`
4. Evaluar si `BOT_USER_ID` se usa en otro lado; si no, eliminar la variable de entorno

**Tiempo est.: 1h**

---

### 1.5 Sanitizar salida HTML del bot de Telegram

**Problema:** `src/services/telegramClient.ts` usa `parse_mode: 'HTML'` en los 3 métodos de envío (líneas 29, 41, 56). Si el texto incluye input del usuario sin escapar, hay riesgo de inyección HTML.

**Archivos afectados:**
- `src/services/telegramClient.ts:29,41,56` — `sendMessage()`, `sendMessageWithKeyboard()`, `editMessageText()`
- `src/services/botProcessor.ts` (719 líneas) — genera respuestas que incluyen input del usuario

**Acciones:**
1. Crear `escapeHtml()` en `src/lib/utils.ts` (escapar `<`, `>`, `&`, `"`, `'`)
2. Aplicar `escapeHtml()` en todas las respuestas de `botProcessor.ts` que incluyan input del usuario

**Tiempo est.: 1h**

---

### 1.6 Sanitización de errores en API routes ✅ COMPLETADO

Completado en commit `25f9f44`. Todas las rutas API devuelven mensajes genéricos (`'Error interno del servidor'`, `'Acceso no permitido'`) en lugar de `error.message`.

---

## 🟡 ALTO — Fase 2: Testing

### 2.1 Tests unitarios para servicios core

**Estado actual:** 40 tests en 4 archivos
- `tests/householdSplit.test.ts` — 3 tests
- `tests/botParser.test.ts` — 15 tests
- `tests/reportService.test.ts` — 8 tests
- `tests/utils.test.ts` — 14 tests

**Faltan:**

| Archivo | Tests estimados | Descripción |
|---------|-----------------|-------------|
| `tests/services/exchangeRateService.test.ts` | ~3 | Mock fetch: tasa normal, fallback 1400, undefined data.venta |
| `tests/services/cryptoPriceService.test.ts` | ~3 | Mock fetch: BTC/ETH, fallbacks error, datos incompletos |
| `tests/services/transactionsService.test.ts` | ~12 | getAll, create (simple/cuotas/suscripción), update balance, delete revertir balance, delete hijos cuotas, getHouseholdTransactions, resolveBillingMonth |
| `tests/services/householdSplitService.test.ts` | +8 | Ampliar: split crea share records, no crea para pagador, redondeo, settle balances, getBalances, consolidateBalances |
| `tests/services/accountsService.test.ts` | ~7 | getAll, create (banco/crypto/tarjeta), update, delete, getCreditCard, billing cycles |
| `tests/services/savingsGoalsService.test.ts` | ~5 | getAll, getForHousehold, create, deposit, no excede target |
| `tests/services/subscriptionService.test.ts` | ~3 | Genera hijos si no existen, no genera sin parent, copia datos del padre |
| `tests/services/reportService.test.ts` | ~3 | getFixedExpenses agrupa, filtra por tipo, datos mensuales correctos |
| `tests/lib/utils.test.ts` | +15 | cn, getTransactionMeta, calculateClosingDate, getBillingMonth, getEffectiveMonth, isCurrentBillingMonth, normalizeAmount, extractKeywords |
| `tests/lib/security.test.ts` | ~7 | getClientIp (x-forwarded-for simple/múltiple, x-real-ip, sin headers), requireOrigin |
| **Total** | **~66 tests nuevos** | |

**Tiempo est.: 8h**

---

### 2.2 Tests de integración para API routes

**Estado actual:** 0 tests de API

| Archivo | Descripción |
|---------|-------------|
| `tests/api/auth/register.test.ts` | POST válido → 200, sin captcha → 400, contraseña débil → 400, sin origin → 403, rate limit → 429 |
| `tests/api/households/households.test.ts` | Crear hogar, sin auth → 401, invitar, aceptar token válido/inválido, eliminar como admin/miembro |
| `tests/api/goals/deposit.test.ts` | Depositar meta propia → 200, ajena → 403, monto negativo → 400 |

**Tiempo est.: 4h**

---

### 2.3 Tests de componentes (React Testing Library)

**Estado actual:** 0 tests de componentes

| Archivo | Descripción |
|---------|-------------|
| `tests/components/ThemeProvider.test.tsx` | Renderiza children, toggle cambia tema, detecta preferencia sistema |
| `tests/components/SessionTimeout.test.tsx` | Muestra warning, oculta al clickear, redirige al salir |
| `tests/components/AnimatedCard.test.tsx` | Renderiza datos, badge tipo, formato ARS/USD |
| `tests/components/TransactionItem.test.tsx` | Renderiza, badge cuota/suscripción |
| `tests/components/GoalItem.test.tsx` | Renderiza nombre/progreso/montos, barra porcentaje |

**Tiempo est.: 3h**

---

### 2.4 Configurar coverage thresholds

**Problema:** `vitest.config.ts` no tiene configuración de coverage. `package.json` no tiene scripts de test.

**Acciones:**
1. Agregar coverage provider `v8` y thresholds (60% lines, 50% branches)
2. Agregar scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`

**Tiempo est.: 30m**

---

## 🟡 ALTO — Fase 3: Monitoreo y DevOps

### 3.1 Sentry — Monitoreo de errores

**Estado:** No instalado. Todos los errores van a `console.error`.

**Acciones:**
1. `pnpm add @sentry/nextjs`
2. Crear proyecto en Sentry, obtener DSN
3. Crear `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
4. Agregar `withSentryConfig` a `next.config.ts`
5. Reemplazar `console.error` por `Sentry.captureException` en API routes, servicios y botProcessor

**Tiempo est.: 2h**

---

### 3.2 CI/CD con GitHub Actions

**Estado:** No existe `.github/workflows/`.

**Acciones:**
1. Crear `.github/workflows/ci.yml` con jobs: `lint`, `typecheck`, `test`
2. Usar `pnpm/action-setup`, `setup-node`, `pnpm install --frozen-lockfile`
3. `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test -- --coverage`

**Tiempo est.: 2h**

---

### 3.3 Logging estructurado

**Estado:** Solo `console.error`/`console.warn`.

**Acciones:**
1. `pnpm add pino pino-pretty`
2. Crear `src/lib/logger.ts` con configuración por entorno
3. Reemplazar todos los `console.error`/`console.warn` por `logger.error()`/`logger.warn()`
4. Agregar contexto (userId, ip, path, operation, entityId)

**Tiempo est.: 2h**

---

## 🟢 MEDIO — Fase 4: Refactor y Calidad de Código

### 4.1 Refactorizar Dashboard page

**Archivo:** `src/app/(dashboard)/page.tsx` — 186 líneas

**Objetivo:** Reducir a ~100 líneas

**Acciones:**
- Extraer data fetching a `getDashboardData()` con `Promise.all()` para queries independientes
- Extraer cálculos a funciones puras en `src/lib/dashboardCalculations.ts`
- Crear Server Components: `DashboardGreeting`, `TelegramBotBanner`, `AccountsGrid`, `DashboardCharts`
- Paralelizar queries independientes: profile, accounts, transactions, goals, categories, exchangeRate, cryptoPrices

**Tiempo est.: 4h**

---

### 4.2 Refactorizar BotProcessor

**Archivo:** `src/services/botProcessor.ts` — 719 líneas

**Objetivo:** Dividir en ~7 archivos bajo `src/services/bot/`

**Archivos propuestos:**
| Archivo | Contenido | Estado |
|---------|-----------|--------|
| `types.ts` | Tipos: Account, Category, KeywordRule, ParsedTransaction, FlowState | ✅ Existe |
| `parser.ts` | parseText, normalizeAmount, extractKeywords, detectPaymentMethod, isCardPayment | ✅ Existe |
| `ai.ts` | parseTextWithAI (OpenAI) — parseText con IA | ✅ Existe |
| `commands.ts` | handleCommand: /stats, /list, /balance, /config, /ayuda, /vincular, /desvincular | 🔴 Nuevo |
| `stateMachine.ts` | FlowState y transiciones entre estados | 🔴 Nuevo |
| `keywords.ts` | Aprendizaje/consulta de bot_rules (keyword → categoría/cuenta/tipo) | 🔴 Nuevo |
| `messages.ts` | Templates de mensajes constantes | 🔴 Nuevo |
| `index.ts` | BotProcessor class que compone todo lo anterior | 🔴 Nuevo |

**Tiempo est.: 6h**

---

### 4.3 Refactorizar TransactionForm

**Archivo:** `src/components/forms/TransactionForm.tsx` — ~580 líneas

**Acciones:**
- Extraer hooks: `useTransactionForm`, `useCategories`, `useHouseholdContext`, `useCreditCardInfo`, `useSplitPreview`
- Extraer sub-componentes: `TypeToggle`, `CategoryGrid`, `InstallmentsSelect`, `RecurringToggle`, `HouseholdSection`, `BillingMonthPreview`

**Tiempo est.: 3h**

---

### 4.4 Refactorizar HouseholdManager

**Archivo:** `src/components/household/HouseholdManager.tsx` — ~879 líneas

**Acciones:**
- Extraer hooks: `useHousehold`, `useHouseholdIncomes`, `useInviteLink`
- Extraer sub-componentes: `CreateHouseholdForm`, `MemberList`, `IncomeEditor`, `SplitEditor`, `TransactionList`, `SettlementHistory`, `GoalPreview`, `LeaveModal`, `DeleteModal`

**Tiempo est.: 4h**

---

### 4.5 Eliminar tipos `any` y mejorar TypeScript

**Problema:** **54 ocurrencias** de `: any` en los servicios.

**Archivos afectados:**

| Archivo | Ocurrencias | Patrón |
|---------|-------------|--------|
| `src/services/accountsService.ts` | 12 | `supabase: any` en cada método |
| `src/services/botProcessor.ts` | 6 | `(t: any)`, `(a: any)`, `.map((i: any) =>` |
| `src/services/householdService.ts` | 8 | `supabase: any`, `(m: any)` |
| `src/services/householdSplitService.ts` | 14 | `supabase: any`, `(p: any)`, `(i: any)` |
| `src/services/savingsGoalsService.ts` | 6 | `supabase: any` en cada método |
| `src/services/subscriptionService.ts` | 1 | `supabase: any` |
| `src/services/transactionsService.ts` | 6 | `supabase: any` en cada método |

**Acciones:**
1. Crear `TypedSupabaseClient` desde `src/types/database.types.ts`
2. Actualizar firmas: `supabase: any` → `supabase: TypedSupabaseClient`
3. Reemplazar `any[]` por tipos concretos del schema
4. Agregar tipos de retorno explícitos en todas las funciones de servicio

**Tiempo est.: 3h**

---

### 4.6 Centralizar creación de admin client

**Problema:** ~18 archivos repiten:
```typescript
const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
```

**Acciones:**
1. Crear `src/lib/supabase/admin.ts` con `createAdminClient()`
2. Actualizar todos los archivos que usan admin client (API routes, webhooks, bot, page.tsx)

**Tiempo est.: 1h**

---

### 4.7 Corregir authService — cliente browser usado en server

**Problema:** `src/services/authService.ts:17` usa `window.location.origin`. Esto es código de navegador ejecutándose en contexto de servidor.

```typescript
// Linea 16-19
options: {
  emailRedirectTo: `${window.location.origin}/auth/callback`,
},
```

**Acciones:**
1. Hacer lazy la creación del cliente supabase (usar getter o inicialización bajo demanda)
2. Alternativa: separar en `authService.client.ts` y `authService.server.ts`

**Tiempo est.: 30m**

---

## 🟢 MEDIO — Fase 5: Features Faltantes

### 5.1 Configurar SMTP para welcome emails

**Estado:** El webhook `/api/webhooks/welcome-email` está implementado (`src/app/api/webhooks/welcome-email/route.ts` — 120 líneas). Pero **no se envían correos** porque las variables `SMTP_USER` y `SMTP_PASS` no están configuradas.

**Acciones:**
1. Configurar App Password en Gmail (https://myaccount.google.com/apppasswords)
2. Completar `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` en `.env.local` y Vercel
3. Probar el webhook con un registro de prueba

**Tiempo est.: 30m**

---

### 5.2 Agregar audit trail para operaciones financieras

**Estado:** No existe registro de auditoría.

**Acciones:**
1. Crear migración `00013_audit_log.sql` con tabla `audit_logs`:
   - `user_id` (FK), `action`, `entity_type`, `entity_id`, `details` (JSONB), `ip_address`, `created_at`
2. Crear `src/services/auditService.ts`
3. Agregar logs en: create/update/delete transacción, create/update/delete cuenta, deposit meta, settle balances, split gasto

**Tiempo est.: 3h**

---

### 5.3 Completar PWA

**Problema:** `public/manifest.json` referencia iconos `icon-192.png` y `icon-512.png` que **no existen** en `public/`.

**Estado actual:**
- ✅ `manifest.json` configurado (nombre, colores, display standalone)
- ✅ Meta tags apple-mobile-web-app en `layout.tsx`
- ❌ Iconos PWA no existen

**Acciones:**
1. Crear `public/icon-192.png` (192x192)
2. Crear `public/icon-512.png` (512x512)

**Tiempo est.: 1h**

---

### 5.4 Mejorar accesibilidad (a11y)

**Estado:** No se han aplicado prácticas de accesibilidad.

**Acciones:**
1. Agregar `aria-label` a botones solo-icono y inputs sin label
2. Verificar `tabIndex` y navegación por teclado en modales
3. Agregar `role="dialog"`, `role="alert"`, `role="status"` donde corresponda
4. Focus trap en modales (LeaveModal, DeleteModal, success modal signup)
5. Verificar contraste de colores en dark mode
6. Soporte `prefers-reduced-motion` (deshabilitar animaciones con Framer Motion)

**Tiempo est.: 3h**

---

## ⚪ BAJO — Fase 6: Optimización

### 6.1 Lazy loading de componentes pesados

| Componente/Librería | Acción | Motivo |
|---------------------|--------|--------|
| Recharts | `next/dynamic` con `ssr: false` | 4 gráficos en dashboard |
| canvas-confetti | `dynamic()` carga condicional | Solo al completar meta |
| zxcvbn | `dynamic()` en signup | Solo en formulario de registro |
| AyudaContent | `dynamic()` | 360 líneas + framer-motion |

**Tiempo est.: 2h**

---

### 6.2 Agregar debounce en inputs

**Acciones:**
1. Crear hook `useDebounce` en `src/hooks/useDebounce.ts`
2. Aplicar en búsqueda de FAQ en `AyudaContent.tsx` (250ms)
3. Aplicar en `MonthSelector.tsx` si es necesario

**Tiempo est.: 1h**

---

### 6.3 Memoización de componentes y cálculos

**Acciones:**
1. `React.memo` en: `AccountItem`, `TransactionItem`, `GoalItem`
2. `useMemo`/`useCallback` en:
   - `HouseholdManager`: `autoSplitMap`, `membersWithoutIncome`
   - `TransactionForm`: `billingMonth`, `splitPreview`

**Tiempo est.: 2h**

---

## 🟢 MEDIO — Fase 7: Base de Datos y Cron

### 7.1 Mejorar cron de suscripciones

**Archivo:** `src/app/api/cron/generate-subscriptions/route.ts` + `src/services/subscriptionService.ts`

**Acciones:**
1. Usar fecha real de ejecución para `transaction_date` (no forzar día 1)
2. Validar que no exista hijo para el período actual antes de generar
3. Soportar frecuencias: quarterly (3 meses), biannual (6 meses), annual (12 meses)
4. Agregar logging con pino

**Tiempo est.: 2h**

---

### 7.2 Agregar TTL a `bot_pending`

**Problema:** Estados de conversación del bot (`bot_pending`) nunca expiran.

**Acción:** En el cron `keepalive`, agregar `DELETE` de registros con más de 24h de antigüedad.

**Tiempo est.: 30m**

---

### 7.3 Agregar índices para queries frecuentes

**Queries a verificar:**
- `transactions` por `user_id` + `transaction_date`
- `transactions` por `household_id` + `transaction_date`
- `transactions` por `parent_transaction_id`
- `household_balances` por `household_id` + `from_user_id` + `to_user_id`
- `goal_deposits` por `goal_id` + `created_at`
- `bot_rules` por `user_id` + `keyword`

**Tiempo est.: 1h**

---

## 🟢 MEDIO — Fase 8: Deployment

### 8.1 Commitear cambios pendientes ✅ COMPLETADO

Completado en commit `25f9f44`. 19 archivos modificados + `src/lib/security.ts` commiteados a `origin/master`.

---

### 8.2 Configurar variables de entorno en Vercel

**Acciones:**
1. Verificar que todas las de `.env.local` están en Vercel Dashboard
2. Agregar nuevas: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
3. Marcar como secrets las que no tienen `NEXT_PUBLIC_`

**Tiempo est.: 30m**

---

### 8.3 Configurar deploy previews

**Acción:** En Vercel Dashboard > Git: activar preview deployments para PRs.

**Tiempo est.: 15m**

---

## 📊 Resumen Global

```
┌─────────────────────────────────────────────────────┬──────────┬───────────┐
│ Fase                                                 │ Tareas   │ Estado    │
├─────────────────────────────────────────────────────┼──────────┼───────────┤
│ Fase 1 — Seguridad                                   │ 6        │ 1/6 (17%) │
│ Fase 2 — Testing                                     │ 4        │ 0/4 (0%)  │
│ Fase 3 — Monitoreo y DevOps                          │ 3        │ 0/3 (0%)  │
│ Fase 4 — Refactor y Calidad de Código                │ 7        │ 0/7 (0%)  │
│ Fase 5 — Features Faltantes                          │ 4        │ 0/4 (0%)  │
│ Fase 6 — Optimización                                │ 3        │ 0/3 (0%)  │
│ Fase 7 — Base de Datos y Cron                        │ 3        │ 0/3 (0%)  │
│ Fase 8 — Deployment                                  │ 3        │ 1/3 (33%) │
├─────────────────────────────────────────────────────┼──────────┼───────────┤
│ TOTAL                                                │ 33       │ 2/33 (6%) │
└─────────────────────────────────────────────────────┴──────────┴───────────┘
```

**Métricas clave de código:**
- 54 tipos `any` en servicios
- 15 endpoints API sin rate limiting
- 0 tests de integración (solo 40 unitarios)
- 0 monitoreo de errores (sin Sentry)
- 0 CI/CD (sin GitHub Actions)
- 0 logging estructurado (solo console.error)
- PWA configurada pero sin iconos
- SMTP implementado pero no configurado
- Audit trail no implementado

**Orden de ejecución recomendado:** 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 5.1 → 4.6 → 4.5 → 4.7 → 2.x → 3.x → 4.x → 5.x → 7.x → 6.x → 8.x
