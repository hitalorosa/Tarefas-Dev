/// Repetição de tarefa. Guardada como texto curto para caber no cookie e para
/// a migração de banco não precisar de tipo novo.
///
///   "diaria"            todo dia
///   "semanal:1,3"       terça e quinta (0 = domingo)
///   "mensal"            todo mês, no mesmo dia
///   "anual"             todo ano, no mesmo dia
///   "periodica:10"      a cada 10 dias

export type TipoRepeticao = 'diaria' | 'semanal' | 'mensal' | 'anual' | 'periodica'

export type Repeticao = {
  tipo: TipoRepeticao
  /// dias da semana (0 = domingo), só para semanal
  dias: number[]
  /// intervalo em dias, só para periódica
  intervalo: number
}

export const TIPOS_REPETICAO: { id: TipoRepeticao; rotulo: string }[] = [
  { id: 'diaria', rotulo: 'Diariamente' },
  { id: 'semanal', rotulo: 'Semanalmente' },
  { id: 'mensal', rotulo: 'Mensalmente' },
  { id: 'anual', rotulo: 'Anualmente' },
  { id: 'periodica', rotulo: 'Periodicamente' },
]

/// Rótulos na ordem em que a semana é lida aqui: segunda primeiro.
export const DIAS_SEMANA = [
  { valor: 1, rotulo: '2ª' },
  { valor: 2, rotulo: '3ª' },
  { valor: 3, rotulo: '4ª' },
  { valor: 4, rotulo: '5ª' },
  { valor: 5, rotulo: '6ª' },
  { valor: 6, rotulo: 'S' },
  { valor: 0, rotulo: 'D' },
]

export function lerRepeticao(bruto: string | null | undefined): Repeticao | null {
  if (!bruto) return null
  const [tipo, resto] = bruto.split(':')
  if (!TIPOS_REPETICAO.some((t) => t.id === tipo)) return null
  return {
    tipo: tipo as TipoRepeticao,
    dias: tipo === 'semanal' && resto ? resto.split(',').map(Number).filter((n) => n >= 0 && n <= 6) : [],
    intervalo: tipo === 'periodica' ? Math.max(1, Number(resto) || 7) : 0,
  }
}

export function escreverRepeticao(r: Repeticao | null): string | null {
  if (!r) return null
  if (r.tipo === 'semanal') return `semanal:${[...r.dias].sort().join(',')}`
  if (r.tipo === 'periodica') return `periodica:${Math.max(1, r.intervalo)}`
  return r.tipo
}

export function descreverRepeticao(r: Repeticao | null): string | null {
  if (!r) return null
  switch (r.tipo) {
    case 'diaria':
      return 'Todo dia'
    case 'semanal': {
      if (!r.dias.length) return 'Toda semana'
      const nomes = DIAS_SEMANA.filter((d) => r.dias.includes(d.valor)).map((d) => d.rotulo)
      return `Toda ${nomes.join(', ')}`
    }
    case 'mensal':
      return 'Todo mês'
    case 'anual':
      return 'Todo ano'
    case 'periodica':
      return `A cada ${r.intervalo} dias`
  }
}

/// Próxima data depois de `a partir de`, seguindo a regra. É o que roda quando
/// a tarefa é concluída: a repetição só faz sentido se a próxima nascer sozinha.
export function proximaData(r: Repeticao, apartirDe: Date): Date {
  const d = new Date(apartirDe)
  d.setHours(12, 0, 0, 0)

  switch (r.tipo) {
    case 'diaria':
      d.setDate(d.getDate() + 1)
      return d

    case 'semanal': {
      if (!r.dias.length) {
        d.setDate(d.getDate() + 7)
        return d
      }
      // anda dia a dia até cair num dia marcado — no máximo uma volta
      for (let i = 1; i <= 7; i++) {
        const tentativa = new Date(d)
        tentativa.setDate(d.getDate() + i)
        if (r.dias.includes(tentativa.getDay())) return tentativa
      }
      d.setDate(d.getDate() + 7)
      return d
    }

    case 'mensal': {
      const dia = d.getDate()
      d.setDate(1)
      d.setMonth(d.getMonth() + 1)
      // 31 de janeiro repetido em fevereiro vira o último dia do mês
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(dia, ultimo))
      return d
    }

    case 'anual':
      d.setFullYear(d.getFullYear() + 1)
      return d

    case 'periodica':
      d.setDate(d.getDate() + Math.max(1, r.intervalo))
      return d
  }
}

/// As próximas N ocorrências, para a prévia no calendário.
export function proximasDatas(r: Repeticao, apartirDe: Date, quantas = 12): Date[] {
  const fora: Date[] = []
  let atual = apartirDe
  for (let i = 0; i < quantas; i++) {
    atual = proximaData(r, atual)
    fora.push(atual)
  }
  return fora
}
