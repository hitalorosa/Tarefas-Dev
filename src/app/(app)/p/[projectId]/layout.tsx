import { notFound } from 'next/navigation'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { MEMBROS, lerEstado, semBanco } from '@/lib/estado'
import { ProjectChrome } from '@/components/project-chrome'
import type { CampoPainel } from '@/components/customize-panel'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { workspace, user } = await requireMembership()

  if (semBanco()) {
    const e = await lerEstado()
    const projeto = e.projetos.find((p) => p.id === projectId)
    if (!projeto) notFound()

    const noProjeto = new Set(e.campos.filter((c) => c.projetos.includes(projectId)).map((c) => c.id))

    return (
      <div className="flex h-full flex-col">
        <ProjectChrome
          projeto={{
            id: projeto.id,
            name: projeto.name,
            color: projeto.color,
            status: projeto.status,
            statusNote: null,
            favorito: projeto.favorito,
          }}
          membros={MEMBROS.map((m) => ({ name: m.user.name, color: m.user.avatarColor }))}
          campos={e.campos
            .filter((c) => noProjeto.has(c.id))
            .map((c) => ({ id: c.id, name: c.name, type: c.type, options: c.options }))}
          disponiveis={e.campos
            .filter((c) => !noProjeto.has(c.id))
            .map((c) => ({ id: c.id, name: c.name, type: c.type }))}
          abertas={e.tarefas.filter((t) => t.projectId === projectId && !t.completed).length}
        />
        {children}
      </div>
    )
  }

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: {
      stars: { where: { userId: user.id }, select: { id: true } },
      fields: {
        orderBy: { order: 'asc' },
        include: { field: { include: { options: { orderBy: { order: 'asc' } } } } },
      },
    },
  })
  if (!project) notFound()

  const [abertas, membros, todosCampos] = await Promise.all([
    db.task.count({ where: { projectId, completed: false, parentId: null } }),
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { name: true, avatarColor: true } } },
    }),
    db.customField.findMany({ where: { workspaceId: workspace.id }, orderBy: { order: 'asc' } }),
  ])

  const idsNoProjeto = new Set(project.fields.map((f) => f.fieldId))
  const campos: CampoPainel[] = project.fields.map((pf) => ({
    id: pf.field.id,
    name: pf.field.name,
    type: pf.field.type,
    options: pf.field.options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
  }))

  return (
    <div className="flex h-full flex-col">
      <ProjectChrome
        projeto={{
          id: project.id,
          name: project.name,
          color: project.color,
          status: project.status,
          statusNote: project.statusNote,
          favorito: project.stars.length > 0,
        }}
        membros={membros.map((m) => ({ name: m.user.name, color: m.user.avatarColor }))}
        campos={campos}
        disponiveis={todosCampos
          .filter((c) => !idsNoProjeto.has(c.id))
          .map((c) => ({ id: c.id, name: c.name, type: c.type }))}
        abertas={abertas}
      />
      {children}
    </div>
  )
}
