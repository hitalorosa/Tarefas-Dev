import { db } from './db'
import { requireMembership } from './auth'
import { MEMBROS, lerEstado, semBanco } from './estado'

export type TarefaDetalhe = {
  id: string
  projectId: string
  projeto: { id: string; name: string; color: string }
  secao: { id: string; name: string } | null
  name: string
  description: string
  completed: boolean
  startOn: string | null // AAAA-MM-DD, o formato do <input type="date">
  dueAt: string | null
  responsavelId: string | null
  marcaId: string | null
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
  /// opções de escolha para os seletores do painel
  pessoas: { id: string; name: string; color: string }[]
  marcas: { id: string; name: string; color: string }[]
  secoes: { id: string; name: string }[]
  /// tarefas do mesmo projeto, para escolher uma dependência
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

  const projeto = e.projetos.find((p) => p.id === t.projectId)
  if (!projeto) return null

  const resumo = (x: (typeof e.tarefas)[number]) => ({
    id: x.id,
    name: x.name,
    completed: x.completed,
  })

  return {
    id: t.id,
    projectId: t.projectId,
    projeto: { id: projeto.id, name: projeto.name, color: projeto.color },
    secao: (() => {
      const s = e.secoes.find((x) => x.id === t.sectionId)
      return s ? { id: s.id, name: s.name } : null
    })(),
    name: t.name,
    description: t.description ?? '',
    completed: t.completed,
    startOn: t.startOn,
    dueAt: t.dueAt,
    responsavelId: t.assigneeId,
    marcaId: t.brandId,
    subtarefas: t.subtasks,
    travadaPor: t.blockedByIds.flatMap((id) => {
      const b = e.tarefas.find((x) => x.id === id)
      return b ? [resumo(b)] : []
    }),
    travando: e.tarefas.filter((x) => x.blockedByIds.includes(t.id)).map(resumo),
    comentarios: [],
    campos: e.campos
      .filter((c) => c.projetos.includes(t.projectId))
      .map((c) => ({
        id: c.id,
        name: c.name,
        options: c.options,
        valorId: t.fieldValues.find((v) => v.fieldId === c.id)?.optionId ?? null,
      })),
    pessoas: MEMBROS.map((m) => ({ id: m.id, name: m.user.name, color: m.user.avatarColor })),
    marcas: e.marcas,
    secoes: e.secoes
      .filter((s) => s.projectId === t.projectId)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, name: s.name })),
    candidatas: e.tarefas
      .filter((x) => x.projectId === t.projectId && x.id !== t.id)
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
      project: { select: { id: true, name: true, color: true } },
      section: { select: { id: true, name: true } },
      subtasks: { orderBy: { order: 'asc' }, select: { id: true, name: true, completed: true } },
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

  const [campos, membros, marcas, secoes, candidatas] = await Promise.all([
    db.projectCustomField.findMany({
      where: { projectId: t.projectId },
      orderBy: { order: 'asc' },
      include: { field: { include: { options: { orderBy: { order: 'asc' } } } } },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    }),
    db.brand.findMany({ where: { workspaceId: workspace.id }, orderBy: { order: 'asc' } }),
    db.section.findMany({ where: { projectId: t.projectId }, orderBy: { order: 'asc' } }),
    db.task.findMany({
      where: { projectId: t.projectId, parentId: null, id: { not: t.id } },
      select: { id: true, name: true },
      take: 100,
    }),
  ])

  return {
    id: t.id,
    projectId: t.projectId,
    projeto: t.project,
    secao: t.section,
    name: t.name,
    description: t.description ?? '',
    completed: t.completed,
    startOn: soData(t.startOn),
    dueAt: soData(t.dueAt),
    responsavelId: t.assigneeId,
    marcaId: t.brandId,
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
    campos: campos.map((pf) => ({
      id: pf.field.id,
      name: pf.field.name,
      options: pf.field.options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
      valorId: t.fieldValues.find((v) => v.fieldId === pf.field.id)?.optionId ?? null,
    })),
    pessoas: membros.map((m) => ({ id: m.user.id, name: m.user.name, color: m.user.avatarColor })),
    marcas: marcas.map((m) => ({ id: m.id, name: m.name, color: m.color })),
    secoes: secoes.map((s) => ({ id: s.id, name: s.name })),
    candidatas,
    comentarioSuportado: true,
  }
}
