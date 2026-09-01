import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/// Ordenacao fracionaria: inserir entre dois itens nao precisa reescrever a lista toda.
export function orderBetween(before?: number | null, after?: number | null) {
  if (before == null && after == null) return 1000
  if (before == null) return (after as number) - 1000
  if (after == null) return before + 1000
  return (before + after) / 2
}

export function formatDayMonth(d: Date | string | null | undefined) {
  if (!d) return null
  const date = typeof d === 'string' ? new Date(d) : d
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

/// Empurra pra tras ate cair em dia util (sabado/domingo nao valem como prazo de entrega).
export function previousBusinessDay(d: Date) {
  const x = new Date(d)
  while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() - 1)
  return x
}
