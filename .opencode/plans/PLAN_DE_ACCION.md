# Plan de Acción — Finanzas AR

## Prioridades

- 🔴 **Crítico** — Hacer ya, riesgo de seguridad o funcionalidad rota
- 🟡 **Alto** — Hacer pronto, mejora sustancial de calidad/confiabilidad
- 🟢 **Medio** — Hacer cuando se pueda, mejora incremental
- ⚪ **Bajo** — Nice to have, no bloquea nada

---

---

## FASE 1 — SEGURIDAD (🔴 Crítico)

---

### 1.1 Rotar todas las API keys expuestas

**Problema:** `.env.local` contiene keys de producción reales. Si alguien más vio el archivo o si hay backups sin encriptar, las keys están comprometidas.

**Acciones:**

1. **Rotar `OPENAI_API_KEY`**
   - Ir a https://platform.openai.com/api-keys
   - Crear una nueva key
   - Actualizar `.env.local` con la nueva key
   - Eliminar la key vieja
   - Verificar que el bot de Telegram siga funcionando (enviar un mensaje de prueba)

2. **Rotar `TELEGRAM_BOT_TOKEN`**
   - Ir a @BotFather en Telegram
   - Usar comando `/revoke` para generar un nuevo token
   - Actualizar `.env.local` con el nuevo token
   - Actualizar el webhook: `POST https://api.telegram.org/bot<NUEVO_TOKEN>/setWebhook?url=<URL_DEL_WEBHOOK>&secret_token=<WEBHOOK_SECRET>`
   - Probar el bot

3. **Rotar `SUPABASE_SERVICE_ROLE_KEY`**
   - Ir a Supabase Dashboard > Project Settings > API
   - Generar una nueva `service_role` key (esto revoca la anterior)
   - Actualizar `.env.local`
   - Testear cron jobs y APIs que usan admin client

4. **Rotar `RECAPTCHA_SECRET_KEY`**
   - Ir a https://www.google.com/recaptcha/admin
   - Generar nuevas keys para el sitio
   - Actualizar `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` y `RECAPTCHA_SECRET_KEY` en `.env.local`
   - Probar el registro de usuario

5. **Rotar `CRON_SECRET`**
   - Generar un nuevo secreto aleatorio: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Actualizar `.env.local`
   - Actualizar `vercel.json` si el cron usa el secreto en la URL

6. **Rotar `TELEGRAM_WEBHOOK_SECRET`**
   - Generar un nuevo secreto aleatorio
   - Actualizar `.env.local`
   - Reconfigurar el webhook con el nuevo `secret_token`

---

### 1.2 Migrar rate limiting de Map a Upstash Redis (base ya implementada)

**Problema:** `src/lib/security.ts` ya tiene `checkRateLimit()` con `Map` en memoria, `getClientIp()`, `requireOrigin()` y `setInterval` de limpieza. Esto **no escala en Vercel serverless** (cada cold start reinicia contadores, `setInterval` no es confiable). El rate limiting actual es funcional en desarrollo pero casi inútil en producción.

**Estado actual:** ✅ Rate limiting base implementado en `register/route.ts` (5/min) y `telegram/route.ts` (60/min). Falta migrar a Redis.

**Acciones:**

1. **Instalar dependencias**
   ```
   pnpm add @upstash/ratelimit @upstash/redis
   ```

2. **Crear cuenta en Upstash** (https://upstash.com)
   - Crear una Redis database (free tier alcanza para rate limiting)
   - Obtener `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`
   - Agregar ambas a `.env.local` y a Vercel env vars

3. **Refactorizar `src/lib/security.ts`**
   - Extraer rate limiting a `src/lib/rateLimit.ts`
   - Crear limiters pre-configurados: `registerLimiter`, `telegramLimiter`, `generalLimiter`
   - Cada uno con ventana deslizante y límites apropiados
   - Remover `rateLimitStore` Map, `setInterval`, `checkRateLimit()`
   - Mantener `getClientIp()` y `requireOrigin()`

4. **Actualizar `src/app/api/auth/register/route.ts`**
   - Reemplazar `checkRateLimit(ip, ...)` por `registerLimiter.limit(ip)`

5. **Actualizar `src/app/api/bot/telegram/route.ts`**
   - Reemplazar `checkRateLimit(ip, ...)` por `telegramLimiter.limit(ip)`

6. **Agregar rate limiting a TODAS las rutas API que faltan**
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
   - `GET /api/households/balances` + `incomes` + `export`
   - `POST /api/households/incomes`
   - `POST /api/goals/deposit`
   - `POST /api/transactions/generate-one`

7. **Testear**
   - Hacer requests rápidos a cada endpoint y verificar que responde 429 después del límite
   - Verificar que los headers `X-RateLimit-*` aparecen en las respuestas

---

### 1.3 Endurecer Content Security Policy (headers base ya agregados)

**Problema:** `next.config.ts` ya tiene CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy y X-XSS-Protection. Pero el CSP aún incluye `'unsafe-eval'` y `'unsafe-inline'` en `script-src`, lo que debilita la protección XSS. El script de tema en `layout.tsx:34` sigue usando `dangerouslySetInnerHTML`.

**Estado actual:** ✅ Headers de seguridad implementados. Falta endurecer CSP y mover script inline.

**Acciones:**

1. **Investigar si `'unsafe-eval'` es realmente necesario**
   - Buscar usos de `eval()`, `new Function()`, `setTimeout(string)` en el código
   - Probar sin `'unsafe-eval'` en staging

2. **Mover script de tema fuera de inline**
   - Crear `/public/theme.js` con el script de detección de tema
   - Reemplazar `dangerouslySetInnerHTML` en `layout.tsx` por `<Script src="/theme.js" strategy="beforeInteractive" />` (importado de `next/script`)

3. **Actualizar CSP en `next.config.ts`**
   - Remover `'unsafe-eval'` y `'unsafe-inline'` de `script-src`
   - Mantener `'unsafe-inline'` en `style-src` solo si es necesario

4. **Testear en staging**
   - Google Sign-In debe seguir funcionando
   - Tema sin flicker
   - reCAPTCHA debe cargar

---

### 1.4 Revisar lógica de `effectiveUserId` en el bot de Telegram

**Problema:** `src/app/api/bot/telegram/route.ts:64` — cuando un usuario no vinculado envía un comando, se usa `BOT_USER_ID` como fallback.

**Acciones:**

1. **Analizar flujo completo en `botProcessor.ts`**
   - Revisar qué comandos usan `effectiveUserId`
   - Verificar que no puedan modificar datos del bot

2. **Corregir la lógica**
   - Si no está vinculado y no es `/vincular` ni `/desvincular`, devolver solo mensaje de error sin pasar a `BotProcessor`
   - Remover el fallback `BOT_USER_ID`
   - Evaluar si `BOT_USER_ID` se usa en otro lado; si no, eliminar la variable

---

### 1.5 Sanitizar salida del bot de Telegram

**Problema:** `botProcessor.ts` genera texto que se envía a Telegram. Si `parse_mode: 'HTML'` está activo, input del usuario en respuestas podría causar inyección HTML.

**Acciones:**

1. **Revisar `telegramClient.ts` — `sendMessage()`**
   - Verificar si usa `parse_mode: 'HTML'`

2. **Si usa HTML, crear helper `escapeHtml()`**
   - Escapar `<`, `>`, `&`, `"`, `'` en todos los textos que incluyan input del usuario
   - Aplicar en todas las respuestas de `botProcessor.ts`

---

### 1.6 ✅ Sanitización de mensajes de error en API routes

**Completado en commit `25f9f44`.** Todas las rutas API ahora devuelven mensajes genéricos (`'Error interno del servidor'`, `'Acceso no permitido'`, etc.) en lugar de `error.message`. Los detalles reales del error se loguean con `console.error` para debugging sin exponer información sensible al cliente.

---

---

## FASE 2 — TESTING (🟡 Alto)

---

### 2.1 Tests unitarios para servicios core

**Acciones:**

1. **`tests/services/exchangeRateService.test.ts`**
   - Mock de fetch. Test: devuelve tasa, fallback 1400 en error, fallback si data.venta undefined.

2. **`tests/services/cryptoPriceService.test.ts`**
   - Mock de fetch. Test: devuelve BTC/ETH, fallbacks en error, fallbacks datos incompletos.

3. **`tests/services/transactionsService.test.ts`**
   - Mock de Supabase. ~12 tests: getAll, create (simple/cuotas/suscripción), actualizar balance, delete revertir balance, delete hijos cuotas, getHouseholdTransactions, resolveBillingMonth (ciclo real/regla fija/último jueves).

4. **`tests/services/householdSplitService.test.ts`** (ampliar)
   - Ya hay 3 tests. Agregar ~8 tests: splitHouseholdExpense crea share records, no crea para pagador, redondea 2 decimales, settle actualiza balances, crea settlement record, getBalances, consolidateBalances netea recíprocas.

5. **`tests/services/accountsService.test.ts`**
   - ~7 tests: getAll, create (banco/crypto/tarjeta crédito), update balance, delete, getCreditCard, findClosestBillingCycle.

6. **`tests/services/savingsGoalsService.test.ts`**
   - ~5 tests: getAll, getForHousehold, create, deposit actualiza current_amount, deposit no excede target.

7. **`tests/services/subscriptionService.test.ts`**
   - ~3 tests: genera hijos si no existen, no genera sin parent, copia datos del padre.

8. **`tests/services/reportService.test.ts`**
   - ~3 tests: getFixedExpenses agrupa, filtra por tipo, datos mensuales correctos.

9. **`tests/lib/utils.test.ts`**
   - ~15 tests: cn, getTransactionMeta, calculateClosingDate (normal + borde), getBillingMonth, getBillingMonthFromRules, getBillingMonthFromCycle, getEffectiveMonth, isCurrentBillingMonth, estimateNextClosing, normalizeAmount, extractKeywords.

10. **`tests/lib/security.test.ts`**
    - ~7 tests: getClientIp (x-forwarded-for simple/múltiple, x-real-ip, sin headers), requireOrigin (permitido, no permitido, sin allowed origins).

---

### 2.2 Tests de integración para API routes

**Acciones:**

1. **`tests/api/auth/register.test.ts`**
   - POST datos válidos → 200, sin captcha → 400, contraseña débil → 400, sin origin → 403, rate limit → 429.

2. **`tests/api/households/households.test.ts`**
   - Crear hogar → 200, sin auth → 401, invitar → 200, aceptar token válido/inválido, eliminar como admin/miembro.

3. **`tests/api/goals/deposit.test.ts`**
   - Depositar meta propia → 200, ajena → 403, monto negativo → 400.

---

### 2.3 Tests de componentes (React Testing Library)

**Acciones:**

1. **`tests/components/ThemeProvider.test.tsx`** — renderiza children, toggle cambia tema, detecta preferencia sistema.
2. **`tests/components/SessionTimeout.test.tsx`** — muestra warning, oculta al clickear, redirige al salir.
3. **`tests/components/AnimatedCard.test.tsx`** — renderiza datos, badge tipo, formato ARS/USD.
4. **`tests/components/TransactionItem.test.tsx`** — renderiza, badge cuota/suscripción.
5. **`tests/components/GoalItem.test.tsx`** — renderiza nombre/progreso/montos, barra porcentaje.

---

### 2.4 Configurar coverage thresholds

**Acciones:**

1. **Actualizar `vitest.config.ts`** — provider: 'v8', thresholds: 60% lines/functions/statements, 50% branches.
2. **Agregar scripts al `package.json`** — `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.

---

---

## FASE 3 — MONITOREO Y DEVOPS (🟡 Alto)

---

### 3.1 Agregar monitoreo de errores con Sentry

1. `pnpm add @sentry/nextjs`
2. Crear proyecto en Sentry, obtener DSN
3. Crear `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
4. Agregar `withSentryConfig` a `next.config.ts`
5. Reemplazar `console.error` por `Sentry.captureException` en API routes, servicios, y botProcessor

---

### 3.2 Configurar CI/CD con GitHub Actions

1. Crear `.github/workflows/ci.yml` con jobs: `lint`, `typecheck`, `test`
2. Usar `pnpm/action-setup`, `actions/setup-node`, `pnpm install --frozen-lockfile`
3. `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test -- --coverage`

---

### 3.3 Logging estructurado

1. `pnpm add pino pino-pretty`
2. Crear `src/lib/logger.ts` con configuración por entorno
3. Reemplazar todos los `console.error`/`console.warn` por `logger.error()`/`logger.warn()`
4. Agregar contexto (userId, ip, path, operation, entityId)

---

---

## FASE 4 — REFACTOR Y CALIDAD DE CÓDIGO (🟢 Medio)

---

### 4.1 Refactorizar Dashboard page (316 líneas → ~100 líneas)

- Extraer data fetching a `getDashboardData()` con `Promise.all()` para queries independientes
- Extraer cálculos a funciones puras en `src/lib/dashboardCalculations.ts`
- Crear Server Components más chicos: `DashboardGreeting`, `TelegramBotBanner`, `AccountsGrid`, `DashboardCharts`
- Paralelizar: profile, accounts, transactions, goals, categories, exchangeRate, cryptoPrices son independientes

---

### 4.2 Refactorizar BotProcessor (942 líneas → 7 archivos)

Crear `src/services/bot/` con:
- `parser.ts` — parseText, normalizeAmount, extractKeywords, detectPaymentMethod, isCardPayment
- `stateMachine.ts` — FlowState, transiciones
- `commands.ts` — handleCommand, /stats, /list, /balance, /config, /ayuda, /vincular, /desvincular
- `ai.ts` — parseTextWithAI (OpenAI)
- `keywords.ts` — aprendizaje/consulta de bot_rules
- `messages.ts` — templates de mensajes constantes
- `index.ts` — BotProcessor class que compone todo

---

### 4.3 Refactorizar TransactionForm (580 líneas)

- Extraer hooks: `useTransactionForm`, `useCategories`, `useHouseholdContext`, `useCreditCardInfo`, `useSplitPreview`
- Extraer sub-componentes: `TypeToggle`, `CategoryGrid`, `InstallmentsSelect`, `RecurringToggle`, `HouseholdSection`, `BillingMonthPreview`

---

### 4.4 Refactorizar HouseholdManager (879 líneas)

- Extraer hooks: `useHousehold`, `useHouseholdIncomes`, `useInviteLink`
- Extraer sub-componentes: `CreateHouseholdForm`, `MemberList`, `IncomeEditor`, `SplitEditor`, `TransactionList`, `SettlementHistory`, `GoalPreview`, `LeaveModal`, `DeleteModal`

---

### 4.5 Eliminar tipos `any` y mejorar TypeScript

- Crear `TypedSupabaseClient` desde `Database` type
- Actualizar TODAS las firmas de servicios: `supabase: any` → `supabase: TypedSupabaseClient`
- Reemplazar `any[]` por tipos concretos de `database.types.ts`
- Agregar tipos de retorno explícitos en todas las funciones de servicio

---

### 4.6 Centralizar creación de admin client

- Crear `src/lib/supabase/admin.ts` con `createAdminClient()`
- Actualizar los ~18 archivos que repiten `createClient(url, serviceRoleKey)`

---

### 4.7 Corregir `authService.ts` — cliente browser usado en server

- Hacer lazy la creación del cliente supabase (usar getter o inicialización bajo demanda)
- Alternativa: separar en `authService.client.ts` y `authService.server.ts`

---

---

## FASE 5 — FEATURES FALTANTES (🟢 Medio)

---

### 5.1 Configurar SMTP para welcome emails

- Configurar App Password en Gmail (https://myaccount.google.com/apppasswords)
- Completar `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` en `.env.local`
- Probar el webhook `/api/webhooks/welcome-email` con un registro de prueba

---

### 5.2 Agregar audit trail para operaciones financieras

- Crear migración `00013_audit_log.sql` con tabla `audit_logs` (user_id, action, entity_type, entity_id, details JSONB, ip_address)
- Crear `src/services/auditService.ts`
- Agregar logs en: create/update/delete transacción, create/update/delete cuenta, deposit meta, settle balances, split gasto

---

### 5.3 Agregar PWA

- Crear `public/manifest.json` con nombre, iconos, colores, display standalone
- Crear iconos 192x192 y 512x512
- Agregar meta tags en `layout.tsx`: manifest, theme-color, apple-mobile-web-app-capable

---

### 5.4 Mejorar accesibilidad (a11y)

- Agregar `aria-label` a botones solo-icono y inputs sin label
- Verificar `tabIndex` y navegación por teclado en modales
- Agregar `role="dialog"`, `role="alert"`, `role="status"` donde corresponda
- Focus trap en modales (LeaveModal, DeleteModal, success modal signup)
- Verificar contraste de colores en dark mode
- Soporte `prefers-reduced-motion` (deshabilitar animaciones)

---

---

## FASE 6 — OPTIMIZACIÓN (⚪ Bajo)

---

### 6.1 Lazy loading de componentes pesados

- Cargar Recharts dinámicamente con `next/dynamic` y `ssr: false`
- Cargar `canvas-confetti` dinámicamente (solo al completar meta)
- Cargar `zxcvbn` dinámicamente en signup
- Cargar `AyudaContent` con `dynamic()` (360 líneas + framer-motion)

---

### 6.2 Agregar debounce en inputs

- Crear hook `useDebounce` en `src/hooks/useDebounce.ts`
- Aplicar en búsqueda de FAQ en `AyudaContent.tsx` (250ms)
- Aplicar en `MonthSelector.tsx` si es necesario

---

### 6.3 Memoización de componentes

- `React.memo` en: `AccountItem`, `TransactionItem`, `GoalItem`
- `useMemo`/`useCallback` en: `HouseholdManager` (autoSplitMap, membersWithoutIncome), `TransactionForm` (billingMonth, splitPreview)

---

---

## FASE 7 — BASE DE DATOS Y CRON (🟢 Medio)

---

### 7.1 Mejorar cron de suscripciones

- Usar fecha real de ejecución para `transaction_date` (no forzar día 1)
- Validar que no exista hijo para el período actual antes de generar
- Soportar frecuencias quarterly (3 meses), biannual (6 meses), annual (12 meses)
- Agregar logging con pino

---

### 7.2 Agregar TTL a `bot_pending`

- En el cron `keepalive`, agregar DELETE de estados con más de 24 horas de antigüedad

---

### 7.3 Agregar índices si faltan

- Verificar queries frecuentes: transactions por user_id+date, household_id+date, parent_transaction_id; household_balances por household_id+from+to; goal_deposits por goal_id+created_at; bot_rules por user_id+keyword
- Crear migración si es necesario

---

---

## FASE 8 — DEPLOYMENT (🟢 Medio)

---

### 8.1 ✅ Commitear cambios pendientes

**Completado en commit `25f9f44`.** Los 19 archivos modificados + `src/lib/security.ts` fueron commiteados y pusheados a `origin/master` con el mensaje: `feat: hardening de seguridad - rate limiting, CSRF, CSP headers, sanitizacion de errores`.

---

### 8.2 Configurar variables de entorno en Vercel

- Verificar que todas las de `.env.local` están en Vercel Dashboard
- Agregar nuevas: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- Marcar como secrets las que no tienen `NEXT_PUBLIC_`

---

### 8.3 Configurar deploy previews

- En Vercel Dashboard > Git: activar preview deployments para PRs

---

---

## ORDEN DE EJECUCIÓN SUGERIDO

| # | Fase | Tema | Tiempo est. | Estado |
|---|---|---|---|---|
| 1 | 1.1 | Rotar API keys | 1h | 🔴 Pendiente |
| 2 | 1.2 | Migrar rate limiting a Upstash Redis | 3h | 🟡 Base implementada (Map) |
| 3 | 1.3 | Endurecer CSP (headers base ya agregados) | 2h | 🟡 Parcial (faltan unsafe directives) |
| 4 | 1.4 | Revisar effectiveUserId del bot | 1h | 🔴 Pendiente |
| 5 | 1.5 | Sanitizar salida del bot | 1h | 🔴 Pendiente |
| — | 1.6 | Sanitización errores API | — | ✅ Completado |
| 6 | 5.1 | Configurar SMTP | 30m | 🔴 Pendiente |
| 7 | 4.6 | Centralizar admin client | 1h | 🟢 Pendiente |
| 8 | 4.5 | Eliminar tipos `any` | 3h | 🟢 Pendiente |
| 9 | 4.7 | Corregir authService browser/server | 30m | 🟢 Pendiente |
| 10 | 2.1 | Tests unitarios servicios core | 8h | 🟡 Pendiente |
| 11 | 2.2 | Tests integración API routes | 4h | 🟡 Pendiente |
| 12 | 2.3 | Tests componentes | 3h | 🟡 Pendiente |
| 13 | 2.4 | Coverage thresholds | 30m | 🟡 Pendiente |
| 14 | 3.1 | Sentry | 2h | 🟡 Pendiente |
| 15 | 3.3 | Logging estructurado | 2h | 🟡 Pendiente |
| 16 | 3.2 | GitHub Actions CI/CD | 2h | 🟡 Pendiente |
| 17 | 4.1 | Refactor Dashboard | 4h | 🟢 Pendiente |
| 18 | 4.2 | Refactor BotProcessor | 6h | 🟢 Pendiente |
| 19 | 4.3 | Refactor TransactionForm | 3h | 🟢 Pendiente |
| 20 | 4.4 | Refactor HouseholdManager | 4h | 🟢 Pendiente |
| 21 | 7.1 | Mejorar cron suscripciones | 2h | 🟢 Pendiente |
| 22 | 7.2 | TTL bot_pending | 30m | 🟢 Pendiente |
| 23 | 7.3 | Índices adicionales | 1h | 🟢 Pendiente |
| 24 | 5.2 | Audit trail | 3h | 🟢 Pendiente |
| 25 | 5.3 | PWA | 1h | ⚪ Pendiente |
| 26 | 5.4 | Accesibilidad | 3h | 🟢 Pendiente |
| 27 | 6.1 | Lazy loading | 2h | ⚪ Pendiente |
| 28 | 6.2 | Debounce inputs | 1h | ⚪ Pendiente |
| 29 | 6.5 | Memoización | 2h | ⚪ Pendiente |

**Completados:** 2 de 30 tareas  
**Total restante estimado:** ~64 horas de trabajo
