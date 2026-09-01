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

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

function maiuscula(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/// Prazo escrito como gente fala, não como banco guarda: "Hoje", "Amanhã",
/// "Quinta-feira", "7 set", "1 – 3 set". Quem olha o quadro quer saber se é
/// pra agora, não a data absoluta.
export function formatarPrazo(
  inicio: Date | string | null | undefined,
  fim: Date | string | null | undefined,
  hora?: string | null,
): string | null {
  const data = (v: Date | string | null | undefined) => {
    if (!v) return null
    const d = typeof v === 'string' ? new Date(v) : v
    return Number.isNaN(d.getTime()) ? null : startOfDay(d)
  }

  const i = data(inicio)
  const f = data(fim)
  if (!i && !f) return null

  const hoje = startOfDay(new Date())
  const dias = (d: Date) => Math.round((d.getTime() - hoje.getTime()) / 86400000)
  const curto = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()]}`

  /// um dia sozinho vira palavra quando está perto
  const palavra = (d: Date) => {
    const n = dias(d)
    if (n === 0) return 'Hoje'
    if (n === 1) return 'Amanhã'
    if (n === -1) return 'Ontem'
    if (n > 1 && n < 7) return maiuscula(SEMANA[d.getDay()])
    return curto(d)
  }

  const sufixo = hora ? ` ${hora}` : ''

  if (i && f && i.getTime() !== f.getTime()) {
    const esquerda = dias(i) === 0 ? 'Hoje' : i.getMonth() === f.getMonth() ? String(i.getDate()) : curto(i)
    return `${esquerda} – ${curto(f)}${sufixo}`
  }

  return palavra(f ?? i!) + sufixo
}

/// Quando algo aconteceu, do jeito que se lê num histórico: minutos enquanto é
/// recente, e depois só a hora — quem olha uma hora depois quer saber "que horas
/// foi", não "há 87 minutos".
export function formatarQuando(quando: Date | number | string): string {
  const d = quando instanceof Date ? quando : new Date(quando)
  const agora = new Date()
  const minutos = Math.floor((agora.getTime() - d.getTime()) / 60000)

  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`

  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const dia = startOfDay(d).getTime()
  const hoje = startOfDay(agora).getTime()

  if (dia === hoje) return hora
  if (dia === hoje - 86400000) return `ontem ${hora}`
  return `${d.getDate()} ${MESES[d.getMonth()]} ${hora}`
}
