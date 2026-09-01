'use server'

import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'

/// Salva a cena do Excalidraw. Sem revalidatePath de propósito: o canvas salva a
/// cada pausa de digitação e revalidar aqui faria a tela piscar a cada traço.
export async function salvarCanvas(canvasId: string, elements: string, appState: string) {
  const { workspace } = await requireMembership()
  const canvas = await db.canvas.findFirst({
    where: { id: canvasId, project: { workspaceId: workspace.id } },
    select: { id: true },
  })
  if (!canvas) throw new Error('Canvas não encontrado neste workspace')

  await db.canvas.update({
    where: { id: canvasId },
    data: { elements, appState },
  })
}
