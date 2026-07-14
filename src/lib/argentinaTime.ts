const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires'

export function getArgentinaISOString(date?: Date): string {
  const d = date || new Date()
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ARGENTINA_TZ, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.000-03:00`
}

export function getArgentinaMonthKey(): string {
  return getArgentinaISOString().slice(0, 7)
}

export function getArgentinaDate(): Date {
  const iso = getArgentinaISOString()
  return new Date(iso)
}
