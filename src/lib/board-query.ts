import type { Prisma } from '@/generated/prisma'
import { addDays, startOfDay } from './utils'

export type FiltrosQuadro = {
  rapidos: string[] // abertas | concluidas | minhas | semana | proxima | atrasadas
  marca: string | null
  campo: { fieldId: string; optionId: string } | null
  busca: string
  ordenar: 'manual' | 'prazo' | 'nome' | 'criacao'
  agrupar: 'secao' | 'marca' | 'responsavel' | 'importancia'
  ocultarVazias: boolean
}

export const FILTROS_RAPIDOS = [
  { id: 'abertas', rotulo: 'Tarefas por concluir' },
  { id: 'concluidas', rotulo: 'Tarefas concluídas' },
  { id: 'minhas', rotulo: 'Só as minhas tarefas' },
  { id: 'atrasadas', rotulo: 'Atrasadas' },
  { id: 'semana', rotulo: 'Previsto para esta semana' },
  { id: 'proxima', rotulo: 'Previsto para a próxima semana' },
] as const

export const ORDENACOES = [
  { id: 'manual', rotulo: 'Manual (arrastar)' },
  { id: 'prazo', rotulo: 'Data de conclusão' },
  { id: 'nome', rotulo: 'Nome' },
  { id: 'criacao', rotulo: 'Mais recentes' },
] as const

export const AGRUPAMENTOS = [
  { id: 'secao', rotulo: 'Seção' },
  { id: 'marca', rotulo: 'Marca' },
  { id: 'responsavel', rotulo: 'Responsável' },
  { id: 'importancia', rotulo: 'Importância' },
] as const

type Params = Record<string, string | string[] | undefined>

function um(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export function lerFiltros(sp: Params): FiltrosQuadro {
  const cf = um(sp.cf)?.split(':')
  return {
    rapidos: (um(sp.f) ?? '').split(',').filter(Boolean),
    marca: um(sp.marca) || null,
    campo: cf && cf.length === 2 ? { fieldId: cf[0], optionId: cf[1] } : null,
    busca: (um(sp.q) ?? '').trim(),
    ordenar: (um(sp.ordenar) as FiltrosQuadro['ordenar']) || 'manual',
    agrupar: (um(sp.agrupar) as FiltrosQuadro['agrupar']) || 'secao',
    ocultarVazias: um(sp.vazias) === 'ocultar',
  }
}

export function filtrosAtivos(f: FiltrosQuadro) {
  return f.rapidos.length + (f.marca ? 1 : 0) + (f.campo ? 1 : 0) + (f.busca ? 1 : 0)
}

/// Traduz os filtros pro where do Prisma. O que não dá pra expressar aqui
/// (agrupar, ordenar por nome, esconder coluna vazia) é resolvido depois, em memória.
export function whereDasTarefas(f: FiltrosQuadro, userId: string): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [{ parentId: null }]
  const hoje = startOfDay(new Date())

  if (f.rapidos.includes('abertas') && !f.rapidos.includes('concluidas')) and.push({ completed: false })
  if (f.rapidos.includes('concluidas') && !f.rapidos.includes('abertas')) and.push({ completed: true })
  if (f.rapidos.includes('minhas')) and.push({ assigneeId: userId })
  if (f.rapidos.includes('atrasadas')) and.push({ completed: false, dueAt: { lt: hoje } })

  if (f.rapidos.includes('semana')) {
    const fim = addDays(hoje, 7 - hoje.getDay())
    and.push({ dueAt: { gte: hoje, lte: fim } })
  }
  if (f.rapidos.includes('proxima')) {
    const inicio = addDays(hoje, 7 - hoje.getDay())
    and.push({ dueAt: { gt: inicio, lte: addDays(inicio, 7) } })
  }

  if (f.marca) and.push({ brandId: f.marca })
  if (f.campo) and.push({ fieldValues: { some: { fieldId: f.campo.fieldId, optionId: f.campo.optionId } } })
  if (f.busca) and.push({ name: { contains: f.busca } })

  return { AND: and }
}

export function ordemDasTarefas(f: FiltrosQuadro): Prisma.TaskOrderByWithRelationInput[] {
  switch (f.ordenar) {
    case 'prazo':
      return [{ dueAt: 'asc' }]
    case 'nome':
      return [{ name: 'asc' }]
    case 'criacao':
      return [{ createdAt: 'desc' }]
    default:
      // ordem manual pertence ao vínculo com o quadro, não à tarefa:
      // quem ordena por ela é quem consulta o vínculo
      return [{ createdAt: 'asc' }]
  }
}
