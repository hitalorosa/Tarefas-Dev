import { notFound } from 'next/navigation'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { CanvasBoard } from '@/components/canvas-board'

export default async function CanvasPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { workspace } = await requireMembership()

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  })
  if (!project) notFound()

  // projeto antigo pode não ter canvas ainda
  let canvas = await db.canvas.findFirst({ where: { projectId }, orderBy: { createdAt: 'asc' } })
  if (!canvas) canvas = await db.canvas.create({ data: { projectId, name: 'Quadro branco' } })

  return (
    <CanvasBoard
      key={canvas.id}
      canvasId={canvas.id}
      elementosIniciais={canvas.elements}
      appStateInicial={canvas.appState}
    />
  )
}
