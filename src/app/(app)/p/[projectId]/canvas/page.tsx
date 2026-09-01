import { notFound } from 'next/navigation'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { canvasSemBanco, lerEstado, semBanco } from '@/lib/estado'
import { CanvasBoard, type TarefaVinculavel } from '@/components/canvas-board'

export default async function CanvasPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params

  if (semBanco()) {
    const e = await lerEstado()
    if (!e.projetos.some((p) => p.id === projectId)) notFound()
    const c = canvasSemBanco(projectId)
    const tarefas: TarefaVinculavel[] = e.tarefas
      .filter((t) => t.quadros.some((q) => q.projectId === projectId))
      .map((t) => ({ id: t.id, name: t.name, concluida: t.completed }))

    return (
      <CanvasBoard
        key={c.id}
        canvasId={c.id}
        projectId={projectId}
        elementosIniciais={c.elements}
        appStateInicial={c.appState}
        tarefas={tarefas}
        guardarNoNavegador
      />
    )
  }

  const { workspace } = await requireMembership()
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  })
  if (!project) notFound()

  // projeto antigo pode não ter canvas ainda
  let canvas = await db.canvas.findFirst({ where: { projectId }, orderBy: { createdAt: 'asc' } })
  if (!canvas) canvas = await db.canvas.create({ data: { projectId, name: 'Quadro branco' } })

  const tarefas = await db.task.findMany({
    where: { workspaceId: workspace.id, parentId: null, quadros: { some: { projectId } } },
    select: { id: true, name: true, completed: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <CanvasBoard
      key={canvas.id}
      canvasId={canvas.id}
      projectId={projectId}
      elementosIniciais={canvas.elements}
      appStateInicial={canvas.appState}
      tarefas={tarefas.map((t) => ({ id: t.id, name: t.name, concluida: t.completed }))}
    />
  )
}
