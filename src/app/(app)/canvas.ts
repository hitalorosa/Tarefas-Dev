'use server'

import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'
import { semBanco } from '@/lib/estado'

/// Salva a cena do Excalidraw. Sem revalidatePath de propósito: o canvas salva a
/// cada pausa de digitação e revalidar aqui faria a tela piscar a cada traço.
export async function salvarCanvas(canvasId: string, elements: string, appState: string) {
  // o canvas sozinho passa de 4 KB: sem banco ele fica somente leitura
  if (semBanco()) return

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

/// Canvas próprio da tarefa. Cada tarefa pode ter o seu, para desenhar o fluxo
/// daquela entrega sem poluir o quadro do projeto inteiro. Criado na primeira
/// vez que é aberto — não faz sentido ter uma linha vazia para cada tarefa.
export async function abrirCanvasDaTarefa(taskId: string) {
  if (semBanco()) {
    // sem banco o desenho mora no armazenamento local do navegador, então aqui
    // basta um id estável para servir de chave
    return { id: `tarefa-${taskId}`, elements: '[]', appState: '{}', noNavegador: true }
  }

  const { workspace } = await requireMembership()
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: workspace.id },
    select: { id: true },
  })
  if (!task) throw new Error('Tarefa não encontrada neste workspace')

  let canvas = await db.canvas.findUnique({ where: { taskId } })
  if (!canvas) {
    canvas = await db.canvas.create({ data: { taskId, name: 'Fluxo da tarefa' } })
  }
  return {
    id: canvas.id,
    elements: canvas.elements,
    appState: canvas.appState,
    noNavegador: false,
  }
}
