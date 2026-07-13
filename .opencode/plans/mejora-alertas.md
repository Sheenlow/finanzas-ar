# Plan: Mejora de Alertas del Sistema

## Contexto

La pagina tiene alertas inconsistentes: 3 `confirm()` nativos del navegador (feos y fuera de lugar), mensajes de error inline con estilos dispares, alertas informativas (warning/success/info) con clases Tailwind ad-hoc diferentes entre si, modales sin animaciones framer-motion, y error boundaries con diseno basico. El objetivo es unificar todo bajo un sistema de alertas coherente con la estetica fintech minimalista del proyecto (Tailwind v4, framer-motion, lucide-react, rounded-2xl, tonos calidos).

---

## Paso 1: Crear componente `ConfirmDialog`

**Archivo:** `src/components/ui/ConfirmDialog.tsx`

Modal de confirmacion reutilizable con:
- `framer-motion` (AnimatePresence + motion.div, spring animation como los modales existentes en signup/UserMenu)
- Backdrop `bg-black/40 backdrop-blur-sm`
- Icono configurable (lucide-react)
- Props: `open`, `title`, `description`, `icon?`, `confirmLabel?`, `cancelLabel?`, `variant` ("danger" | "warning" | "default"), `loading?`, `onConfirm`, `onClose`
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Cierre con Escape y click fuera

---

## Paso 2: Crear componente `Alert`

**Archivo:** `src/components/ui/Alert.tsx`

Alerta inline unificada con variantes:
- **Variantes:** `error`, `success`, `warning`, `info`
- Cada variante: icono lucide-react (XCircle, CheckCircle2, AlertTriangle, Info), color de fondo, borde y texto
- Props: `variant`, `children`, `className?`
- Mapeo de colores:
  - `error`: `bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400`
  - `success`: `bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400`
  - `warning`: `bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400`
  - `info`: `bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400`
- Estructura: `flex items-start gap-2 px-4 py-3 border rounded-xl text-sm`
- Soporte para `dark:` (el proyecto usa dark mode con clase `.dark`)

---

## Paso 3: Reemplazar los 3 `confirm()` nativos

### 3a. `src/components/AccountItem.tsx` (linea 36)
- Agregar estado `showDeleteConfirm`
- Reemplazar `confirm(...)` por `<ConfirmDialog>` con variant "danger", icono Trash2
- El boton "Borrar" abre el modal, el modal ejecuta `handleDelete` real

### 3b. `src/components/GoalItem.tsx` (linea 76)
- Mismo patron: estado + `<ConfirmDialog>` variant "danger"

### 3c. `src/components/TransactionItem.tsx` (linea 18)
- Mismo patron: estado + `<ConfirmDialog>` variant "danger"

---

## Paso 4: Unificar alertas inline con `<Alert>`

| Archivo | Linea | Actual | Cambio |
|---------|-------|--------|--------|
| `login/page.tsx` | 68 | `<p class="text-xs text-rose-600 font-medium">` | `<Alert variant="error">` |
| `signup/page.tsx` | 130 | `<p class="text-xs text-rose-600 font-medium">` | `<Alert variant="error">` |
| `CreateHouseholdForm.tsx` | 41 | `<p class="text-xs text-rose-600">` | `<Alert variant="error">` |
| `HouseholdManager.tsx` | 198 | `<p class="text-xs text-rose-600 mt-2">` | `<Alert variant="error">` |
| `DeleteModal.tsx` | 40 | `<p class="text-xs text-red-600 mb-2">` | `<Alert variant="error">` |
| `SettlementModal.tsx` | 114 | `<p class="text-sm text-red-600">` | `<Alert variant="error">` |
| `UserMenu.tsx` | 204 | `<p class="text-sm text-red-600/text-emerald-600">` | `<Alert variant="error">` o `<Alert variant="success">` |
| `MemberList.tsx` | 148 | `bg-green-50 border border-green-200 rounded-xl` | `<Alert variant="success">` |
| `MemberList.tsx` | 162 | `bg-amber-50 px-3 py-2 rounded-lg` | `<Alert variant="warning">` |
| `MemberList.tsx` | 252 | `bg-amber-50 border border-amber-200 rounded-xl` | `<Alert variant="warning">` |
| `LeaveModal.tsx` | 29 | `bg-amber-50 p-2 rounded-lg` | `<Alert variant="warning">` |
| `AccountForm.tsx` | 217 | `bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg` | `<Alert variant="info">` |
| `BillingMonthPreview.tsx` | 13 | `bg-amber-50 dark:bg-amber-950/20 border...` | `<Alert variant="info">` |

---

## Paso 5: Agregar animaciones framer-motion a modales existentes

Los modales de `signup/page.tsx` y `UserMenu.tsx` ya usan framer-motion. Los siguientes NO:

### 5a. `src/components/household/DeleteModal.tsx`
- Envolver con `AnimatePresence` + `motion.div` para backdrop (fade) y contenido (scale + fade, spring)

### 5b. `src/components/household/LeaveModal.tsx`
- Mismo patron de animacion

### 5c. `src/components/household/SettlementModal.tsx`
- Mismo patron de animacion

### 5d. `src/components/SessionTimeout.tsx`
- Mismo patron de animacion

Patron a usar (consistente con signup/UserMenu):
```tsx
<AnimatePresence>
  {open && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 ... bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
        ...
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

---

## Paso 6: Mejorar error boundaries

### 6a. `src/app/error.tsx`
- Usar icono `AlertTriangle` de lucide-react en vez del `<span>!</span>`
- Agregar `motion.div` con animacion sutil de entrada
- Mejorar el circulo rojo con mejor diseno

### 6b. `src/app/(dashboard)/error.tsx`
- Mismo tratamiento

---

## Paso 7: Mejorar alertas del bot de Telegram (DashboardClient.tsx)

Las 3 variantes (lineas 146-188) ya tienen buen diseno con `border-l-4` de color. Mejoras menores:
- Agregar `motion.section` con `initial/animate` para entrada suave
- Mejorar la consistencia visual entre las 3 variantes

---

## Paso 8: Mejorar la "danger zone" de HouseholdManager.tsx

Lineas 222-227: la zona de peligro `bg-red-50 border border-red-200` es basica.
- Mejorar con un diseno mas impactante manteniendo la fidelidad (dark mode, icono mas visible)

---

## Archivos a crear (2)
- `src/components/ui/ConfirmDialog.tsx`
- `src/components/ui/Alert.tsx`

## Archivos a modificar (18)
- `src/components/AccountItem.tsx`
- `src/components/GoalItem.tsx`
- `src/components/TransactionItem.tsx`
- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`
- `src/components/household/CreateHouseholdForm.tsx`
- `src/components/household/HouseholdManager.tsx`
- `src/components/household/DeleteModal.tsx`
- `src/components/household/LeaveModal.tsx`
- `src/components/household/MemberList.tsx`
- `src/components/household/SettlementModal.tsx`
- `src/components/UserMenu.tsx`
- `src/components/forms/AccountForm.tsx`
- `src/components/forms/transaction/BillingMonthPreview.tsx`
- `src/components/SessionTimeout.tsx`
- `src/app/error.tsx`
- `src/app/(dashboard)/error.tsx`
- `src/components/dashboard/DashboardClient.tsx`

---

## Verificacion

1. `pnpm run build` - Compila sin errores
2. `pnpm run lint` - Sin warnings de ESLint
3. `pnpm test` (si existe) - Tests pasan
4. Revision manual en navegador: verificar light + dark mode, responsive mobile, animaciones fluidas
