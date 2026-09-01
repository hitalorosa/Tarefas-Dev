import { notFound } from 'next/navigation'
import { db } from './db'
import { requireMembership } from './auth'
import { lerFiltros, ordemDasTarefas, whereDasTarefas, type FiltrosQuadro } from './board-query'
import type { CardTarefa, ColunaQuadro } from './types'

type Params = Record<string, string | string[] | undefined>

/// Carrega o projeto já filtrado, ordenado e agrupado. Serve o Quadro e a Lista —
/// as duas vistas leem exatamente os mesmos filtros da URL.
export async function carregarQuadro(projectId: string, sp: Params) {
  const { workspace, user } = await requireMembership()
  const filtros = lerFiltros(sp)

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: {
      canvases: { select: { id: true }, take: 1 },
      sections: { orderBy: { order: 'asc' } },
      fields: {
        orderBy: { order: 'asc' },
        include: {
          field: { include: { options: { orderBy: { order: 'asc' } } } },
        },
      },
    },
  })
  if (!project) notFound()

  const tarefas = await db.task.findMany({
    where: { projectId, ...whereDasTarefas(filtros, user.id) },
    orderBy: ordemDasTarefas(filtros),
    include: {
      brand: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarColor: true } },
      subtasks: { select: { completed: true } },
      fieldValues: {
        include: {
          field: { select: { id: true, name: true } },
          option: { select: { id: true, label: true, color: true } },
        },
      },
      blockedBy: { include: { blocker: { select: { id: true, name: true, completed: true } } } },
      _count: { select: { blocking: true, violations: true, comments: true } },
    },
  })

  const cartao = (t: (typeof tarefas)[number]): CardTarefa => ({
    id: t.id,
    name: t.name,
    completed: t.completed,
    order: t.order,
    startOn: t.startOn?.toISOString() ?? null,
    dueAt: t.dueAt?.toISOString() ?? null,
    origin: t.origin,
    marca: t.brand,
    responsavel: t.assignee ? { name: t.assignee.name, color: t.assignee.avatarColor } : null,
    campos: t.fieldValues
      .filter((v) => v.option)
      .map((v) => ({ fieldName: v.field.name, label: v.option!.label, color: v.option!.color })),
    subtarefas: { total: t.subtasks.length, feitas: t.subtasks.filter((s) => s.completed).length },
    travadaPor: t.blockedBy.map((d) => d.blocker),
    travando: t._count.blocking,
    alertas: t._count.violations,
    comentarios: t._count.comments,
  })

  const marcas = await db.brand.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, color: true },
  })

  const campos = project.fields.map((pf) => ({
    id: pf.field.id,
    name: pf.field.name,
    type: pf.field.type,
    options: pf.field.options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
  }))

  let colunas: ColunaQuadro[]

  if (filtros.agrupar === 'secao') {
    colunas = project.sections.map((s) => ({
      id: s.id,
      name: s.name,
      isDone: s.isDone,
      order: s.order,
      virtual: false,
      cor: null,
      tarefas: tarefas.filter((t) => t.sectionId === s.id).map(cartao),
    }))
  } else {
    colunas = agrupar(filtros.agrupar, tarefas, marcas, campos).map((g) => ({
      id: g.id,
      name: g.name,
      isDone: false,
      order: 0,
      virtual: true,
      cor: g.cor,
      tarefas: g.tarefas.map(cartao),
    }))
  }

  if (filtros.ocultarVazias) colunas = colunas.filter((c) => c.tarefas.length > 0)

  return {
    project,
    filtros,
    colunas,
    marcas,
    campos,
    tarefas: tarefas.map(cartao),
    podeArrastar: filtros.agrupar === 'secao' && filtros.ordenar === 'manual',
    abertas: tarefas.filter((t) => !t.completed).length,
  }
}

function agrupar(
  modo: FiltrosQuadro['agrupar'],
  tarefas: any[],
  marcas: { id: string; name: string; color: string }[],
  campos: { id: string; name: string; options: { id: string; label: string; color: string }[] }[],
) {
  const grupos: { id: string; name: string; cor: string | null; tarefas: any[] }[] = []

  if (modo === 'marca') {
    for (const m of marcas) {
      grupos.push({ id: `marca:${m.id}`, name: m.name, cor: m.color, tarefas: tarefas.filter((t) => t.brandId === m.id) })
    }
    grupos.push({ id: 'marca:none', name: 'Sem marca', cor: null, tarefas: tarefas.filter((t) => !t.brandId) })
  }

  if (modo === 'responsavel') {
    const vistos = new Map<string, { name: string; color: string }>()
    for (const t of tarefas) if (t.assignee) vistos.set(t.assignee.id, { name: t.assignee.name, color: t.assignee.avatarColor })
    for (const [id, p] of vistos) {
      grupos.push({ id: `resp:${id}`, name: p.name, cor: p.color, tarefas: tarefas.filter((t) => t.assigneeId === id) })
    }
    grupos.push({ id: 'resp:none', name: 'Sem responsável', cor: null, tarefas: tarefas.filter((t) => !t.assigneeId) })
  }

  if (modo === 'importancia') {
    const campo = campos.find((c) => c.name.toLowerCase().startsWith('import'))
    for (const o of campo?.options ?? []) {
      grupos.push({
        id: `imp:${o.id}`,
        name: o.label,
        cor: o.color,
        tarefas: tarefas.filter((t) => t.fieldValues.some((v: any) => v.optionId === o.id)),
      })
    }
    grupos.push({
      id: 'imp:none',
      name: 'Sem importância',
      cor: null,
      tarefas: tarefas.filter(
        (t) => !t.fieldValues.some((v: any) => (campo?.options ?? []).some((o) => o.id === v.optionId)),
      ),
    })
  }

  return grupos
}
