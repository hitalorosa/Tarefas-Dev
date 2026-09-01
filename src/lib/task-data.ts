import { db } from './db'
import { requireMembership } from './auth'
import { MEMBROS, lerEstado, semBanco } from './estado'

/// Um quadro onde a tarefa aparece. A mesma tarefa pode estar em vários, e cada
/// um tem a sua seção — por isso a seção mora aqui, não na tarefa.
export type QuadroDaTarefa = {
  projectId: string
  name: string
  color: string
  icon: string
  sectionId: string | null
  secoes: { id: string; name: string }[]
}

export type TarefaDetalhe = {
  id: string
  name: string
  description: string
  completed: boolean
  startOn: string | null // AAAA-MM-DD, o formato do <input type="date">
  dueAt: string | null
  dueTime: string | null
  recurrence: string | null
  responsavelId: string | null
  marcaId: string | null
  quadros: QuadroDaTarefa[]
  /// projetos do workspace onde ela ainda NÃO está, para poder anexar
  quadrosDisponiveis: { id: string; name: string; color: string; icon: string }[]
  subtarefas: { id: string; name: string; completed: boolean }[]
  /// quem precisa terminar antes desta andar
  travadaPor: { id: string; name: string; completed: boolean }[]
  /// quem está esperando por esta
  travando: { id: string; name: string; completed: boolean }[]
  comentarios: { id: string; autor: string; cor: string; corpo: string; quando: string }[]
  campos: {
    id: string
    name: string
    options: { id: string; label: string; color: string }[]
    valorId: string | null
  }[]
  pessoas: { id: string; name: string; color: string }[]
  marcas: { id: string; name: string; color: string }[]
  /// tarefas dos mesmos quadros, para escolher uma dependência
  candidatas: { id: string; name: string }[]
  comentarioSuportado: boolean
}

const soData = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export async function carregarTarefa(taskId: string): Promise<TarefaDetalhe | null> {
  if (semBanco()) return doCookie(taskId)
  return doBanco(taskId)
}

async function doCookie(taskId: string): Promise<TarefaDetalhe | null> {
  const e = await lerEstado()
  const t = e.tarefas.find((x) => x.id === taskId)
  if (!t) return null

  const resumo = (x: (typeof e.tarefas)[number]) => ({
    id: x.id,
    name: x.name,
    completed: x.completed,
  })

  const idsDosQuadros = new Set(t.quadros.map((q) => q.projectId))
  const camposDosQuadros = e.campos.filter((c) => c.projetos.some((p) => idsDosQuadros.has(p)))

  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    completed: t.completed,
    startOn: t.startOn,
    dueAt: t.dueAt,
    dueTime: t.dueTime,
    recurrence: t.recurrence,
    responsavelId: t.assigneeId,
    marcaId: t.brandId,
    quadros: t.quadros.flatMap((q) => {
      const p = e.projetos.find((x) => x.id === q.projectId)
      if (!p) return []
      return [
        {
          projectId: p.id,
          name: p.name,
          color: p.color,
          icon: p.icon,
          sectionId: q.sectionId,
          secoes: e.secoes
            .filter((s) => s.projectId === p.id)
            .sort((a, b) => a.order - b.order)
            .map((s) => ({ id: s.id, name: s.name })),
        },
      ]
    }),
    quadrosDisponiveis: e.projetos
      .filter((p) => !idsDosQuadros.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, color: p.color, icon: p.icon })),
    subtarefas: t.subtasks,
    travadaPor: t.blockedByIds.flatMap((id) => {
      const b = e.tarefas.find((x) => x.id === id)
      return b ? [resumo(b)] : []
    }),
    travando: e.tarefas.filter((x) => x.blockedByIds.includes(t.id)).map(resumo),
    comentarios: [],
    campos: camposDosQuadros.map((c) => ({
      id: c.id,
      name: c.name,
      options: c.options,
      valorId: t.fieldValues.find((v) => v.fieldId === c.id)?.optionId ?? null,
    })),
    pessoas: MEMBROS.map((m) => ({ id: m.id, name: m.user.name, color: m.user.avatarColor })),
    marcas: e.marcas,
    candidatas: e.tarefas
      .filter((x) => x.id !== t.id && x.quadros.some((q) => idsDosQuadros.has(q.projectId)))
      .map((x) => ({ id: x.id, name: x.name })),
    // comentário não cabe no cookie de 4 KB
    comentarioSuportado: false,
  }
}

async function doBanco(taskId: string): Promise<TarefaDetalhe | null> {
  const { workspace } = await requireMembership()

  const t = await db.task.findFirst({
    where: { id: taskId, workspaceId: workspace.id },
    include: {
      quadros: {
        include: {
          project: {
            include: { sections: { orderBy: { order: 'asc' }, select: { id: true, name: true } } },
          },
        },
      },
      subtasks: { orderBy: { createdAt: 'asc' }, select: { id: true, name: true, completed: true } },
      fieldValues: { select: { fieldId: true, optionId: true } },
      blockedBy: { include: { blocker: { select: { id: true, name: true, completed: true } } } },
      blocking: { include: { blocked: { select: { id: true, name: true, completed: true } } } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true, avatarColor: true } } },
      },
    },
  })
  if (!t) return null

  const idsDosQuadros = t.quadros.map((q) => q.projectId)

  const [campos, membros, marcas, projetos, candidatas] = await Promise.all([
    db.projectCustomField.findMany({
      where: { projectId: { in: idsDosQuadros } },
      orderBy: { order: 'asc' },
      include: { field: { include: { options: { orderBy: { order: 'asc' } } } } },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    }),
    db.brand.findMany({ where: { workspaceId: workspace.id }, orderBy: { order: 'asc' } }),
    db.project.findMany({
      where: { workspaceId: workspace.id, archived: false },
      orderBy: { order: 'asc' },
    }),
    db.task.findMany({
      where: {
        workspaceId: workspace.id,
        parentId: null,
        id: { not: t.id },
        quadros: { some: { projectId: { in: idsDosQuadros } } },
      },
      select: { id: true, name: true },
      take: 100,
    }),
  ])

  // o mesmo campo pode estar ligado a mais de um quadro da tarefa
  const camposUnicos = [...new Map(campos.map((pf) => [pf.field.id, pf.field])).values()]

  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    completed: t.completed,
    startOn: soData(t.startOn),
    dueAt: soData(t.dueAt),
    dueTime: t.dueTime,
    recurrence: t.recurrence,
    responsavelId: t.assigneeId,
    marcaId: t.brandId,
    quadros: t.quadros.map((q) => ({
      projectId: q.projectId,
      name: q.project.name,
      color: q.project.color,
      icon: q.project.icon,
      sectionId: q.sectionId,
      secoes: q.project.sections,
    })),
    quadrosDisponiveis: projetos
      .filter((p) => !idsDosQuadros.includes(p.id))
      .map((p) => ({ id: p.id, name: p.name, color: p.color, icon: p.icon })),
    subtarefas: t.subtasks,
    travadaPor: t.blockedBy.map((d) => d.blocker),
    travando: t.blocking.map((d) => d.blocked),
    comentarios: t.comments.map((c) => ({
      id: c.id,
      autor: c.isAi ? 'Assistente' : (c.author?.name ?? 'Alguém'),
      cor: c.author?.avatarColor ?? '#868e96',
      corpo: c.body,
      quando: c.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    })),
    campos: camposUnicos.map((f) => ({
      id: f.id,
      name: f.name,
      options: f.options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
      valorId: t.fieldValues.find((v) => v.fieldId === f.id)?.optionId ?? null,
    })),
    pessoas: membros.map((m) => ({ id: m.user.id, name: m.user.name, color: m.user.avatarColor })),
    marcas: marcas.map((m) => ({ id: m.id, name: m.name, color: m.color })),
    candidatas,
    comentarioSuportado: true,
  }
}
