import { notFound } from 'next/navigation'
import { db } from './db'
import { requireMembership } from './auth'
import { lerFiltros, ordemDasTarefas, whereDasTarefas, type FiltrosQuadro } from './board-query'
import { MEMBROS, lerEstado, semBanco, type Estado, type Tarefa } from './estado'
import type { CardTarefa, ColunaQuadro } from './types'
import { addDays, startOfDay } from './utils'

type Params = Record<string, string | string[] | undefined>

/// Carrega o projeto já filtrado, ordenado e agrupado. Serve o Quadro e a Lista —
/// as duas vistas leem exatamente os mesmos filtros da URL.
export async function carregarQuadro(projectId: string, sp: Params) {
  if (semBanco()) return quadroDoCookie(projectId, sp)

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

  const [marcas, membros] = await Promise.all([
    db.brand.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, color: true },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    }),
  ])
  const pessoas = membros.map((m) => ({ id: m.user.id, name: m.user.name, color: m.user.avatarColor }))

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
    pessoas,
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

// ─────────────────────────── MODO SEM BANCO ───────────────────────────
// Mesma saída de carregarQuadro, montada a partir do estado do cookie.
// Filtro, ordenação e agrupamento acontecem em memória — são poucas dezenas
// de tarefas, o custo é irrelevante e evita duplicar as regras em SQL.

export function cartaoDoCookie(t: Tarefa, e: Estado): CardTarefa {
  const marca = e.marcas.find((m) => m.id === t.brandId) ?? null
  const membro = MEMBROS.find((m) => m.id === t.assigneeId)
  const opcoes = new Map(
    e.campos.flatMap((c) => c.options.map((o) => [o.id, { campo: c.name, opcao: o }] as const)),
  )

  return {
    id: t.id,
    name: t.name,
    completed: t.completed,
    order: t.order,
    startOn: t.startOn ? new Date(`${t.startOn}T12:00:00`).toISOString() : null,
    dueAt: t.dueAt ? new Date(`${t.dueAt}T12:00:00`).toISOString() : null,
    origin: t.origin,
    marca,
    responsavel: membro ? { name: membro.user.name, color: membro.user.avatarColor } : null,
    campos: t.fieldValues.flatMap((v) => {
      const achado = opcoes.get(v.optionId)
      return achado
        ? [{ fieldName: achado.campo, label: achado.opcao.label, color: achado.opcao.color }]
        : []
    }),
    subtarefas: { total: t.subtasks.length, feitas: t.subtasks.filter((x) => x.completed).length },
    travadaPor: t.blockedByIds.flatMap((id) => {
      const b = e.tarefas.find((x) => x.id === id)
      return b ? [{ id: b.id, name: b.name, completed: b.completed }] : []
    }),
    travando: e.tarefas.filter((x) => x.blockedByIds.includes(t.id)).length,
    alertas: t.alertas,
    comentarios: t.comentarios,
  }
}

function aplicarFiltros(tarefas: Tarefa[], f: FiltrosQuadro): Tarefa[] {
  const hoje = startOfDay(new Date())
  const dataDe = (t: Tarefa) => (t.dueAt ? startOfDay(new Date(`${t.dueAt}T12:00:00`)) : null)

  return tarefas.filter((t) => {
    if (f.rapidos.includes('abertas') && !f.rapidos.includes('concluidas') && t.completed) return false
    if (f.rapidos.includes('concluidas') && !f.rapidos.includes('abertas') && !t.completed) return false
    if (f.rapidos.includes('minhas') && t.assigneeId !== MEMBROS[0].id) return false

    const d = dataDe(t)
    if (f.rapidos.includes('atrasadas') && (t.completed || !d || d >= hoje)) return false
    if (f.rapidos.includes('semana')) {
      const fim = addDays(hoje, 7 - hoje.getDay())
      if (!d || d < hoje || d > fim) return false
    }
    if (f.rapidos.includes('proxima')) {
      const inicio = addDays(hoje, 7 - hoje.getDay())
      if (!d || d <= inicio || d > addDays(inicio, 7)) return false
    }

    if (f.marca && t.brandId !== f.marca) return false
    if (f.campo && !t.fieldValues.some((v) => v.optionId === f.campo!.optionId)) return false
    if (f.busca && !t.name.toLowerCase().includes(f.busca.toLowerCase())) return false
    return true
  })
}

function ordenar(tarefas: Tarefa[], f: FiltrosQuadro): Tarefa[] {
  const copia = [...tarefas]
  switch (f.ordenar) {
    case 'prazo':
      return copia.sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.order - b.order)
    case 'nome':
      return copia.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    case 'criacao':
      return copia.sort((a, b) => b.order - a.order)
    default:
      return copia.sort((a, b) => a.order - b.order)
  }
}

async function quadroDoCookie(projectId: string, sp: Params) {
  const e = await lerEstado()
  const filtros = lerFiltros(sp)

  const projeto = e.projetos.find((p) => p.id === projectId)
  if (!projeto) notFound()

  const secoes = e.secoes.filter((s) => s.projectId === projectId).sort((a, b) => a.order - b.order)
  const tarefas = ordenar(aplicarFiltros(e.tarefas.filter((t) => t.projectId === projectId), filtros), filtros)

  const campos = e.campos
    .filter((c) => c.projetos.includes(projectId))
    .map((c) => ({ id: c.id, name: c.name, type: c.type, options: c.options }))

  let colunas: ColunaQuadro[]

  if (filtros.agrupar === 'secao') {
    colunas = secoes.map((s) => ({
      id: s.id,
      name: s.name,
      isDone: s.isDone,
      order: s.order,
      virtual: false,
      cor: null,
      tarefas: tarefas.filter((t) => t.sectionId === s.id).map((t) => cartaoDoCookie(t, e)),
    }))
  } else {
    const grupos: ColunaQuadro[] = []
    const monta = (id: string, name: string, cor: string | null, lista: Tarefa[]) =>
      grupos.push({
        id,
        name,
        isDone: false,
        order: 0,
        virtual: true,
        cor,
        tarefas: lista.map((t) => cartaoDoCookie(t, e)),
      })

    if (filtros.agrupar === 'marca') {
      for (const m of e.marcas) monta(`marca:${m.id}`, m.name, m.color, tarefas.filter((t) => t.brandId === m.id))
      monta('marca:none', 'Sem marca', null, tarefas.filter((t) => !t.brandId))
    } else if (filtros.agrupar === 'responsavel') {
      for (const m of MEMBROS) {
        const lista = tarefas.filter((t) => t.assigneeId === m.id)
        if (lista.length) monta(`resp:${m.id}`, m.user.name, m.user.avatarColor, lista)
      }
      monta('resp:none', 'Sem responsável', null, tarefas.filter((t) => !t.assigneeId))
    } else {
      const campo = campos.find((c) => c.name.toLowerCase().startsWith('import'))
      for (const o of campo?.options ?? []) {
        monta(`imp:${o.id}`, o.label, o.color, tarefas.filter((t) => t.fieldValues.some((v) => v.optionId === o.id)))
      }
      const ids = new Set((campo?.options ?? []).map((o) => o.id))
      monta('imp:none', 'Sem importância', null, tarefas.filter((t) => !t.fieldValues.some((v) => ids.has(v.optionId))))
    }
    colunas = grupos
  }

  if (filtros.ocultarVazias) colunas = colunas.filter((c) => c.tarefas.length > 0)

  return {
    project: { id: projeto.id, name: projeto.name, color: projeto.color },
    filtros,
    colunas,
    marcas: e.marcas,
    campos,
    pessoas: MEMBROS.map((m) => ({ id: m.id, name: m.user.name, color: m.user.avatarColor })),
    tarefas: tarefas.map((t) => cartaoDoCookie(t, e)),
    podeArrastar: filtros.agrupar === 'secao' && filtros.ordenar === 'manual',
    abertas: tarefas.filter((t) => !t.completed).length,
  }
}
