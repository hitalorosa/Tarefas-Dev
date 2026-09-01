import { notFound } from 'next/navigation'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { ProjectChrome } from '@/components/project-chrome'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { workspace, user } = await requireMembership()

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: {
      stars: { where: { userId: user.id }, select: { id: true } },
      fields: {
        orderBy: { order: 'asc' },
        include: { field: { include: { options: { orderBy: { order: 'asc' } } } } },
      },
      _count: { select: { tasks: true } },
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
        campos={project.fields.map((pf) => ({
          id: pf.field.id,
          name: pf.field.name,
          type: pf.field.type,
          options: pf.field.options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
        }))}
        disponiveis={todosCampos
          .filter((c) => !idsNoProjeto.has(c.id))
          .map((c) => ({ id: c.id, name: c.name, type: c.type }))}
        abertas={abertas}
      />
      {children}
    </div>
  )
}
