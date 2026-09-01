'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'

/// Toda ação confere que a tarefa pertence ao workspace de quem chamou.
/// Sem isso, um id adivinhado dá acesso ao quadro de outra empresa.
async function tarefaDoWorkspace(taskId: string) {
  const { workspace, user } = await requireMembership()
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: workspace.id },
    include: { section: true },
  })
  if (!task) throw new Error('Tarefa não encontrada neste workspace')
  return { task, workspace, user }
}

export async function criarTarefa(formData: FormData) {
  const { workspace, user } = await requireMembership()
  const parsed = z
    .object({ sectionId: z.string().min(1), name: z.string().trim().min(1).max(300) })
    .safeParse({ sectionId: formData.get('sectionId'), name: formData.get('name') })
  if (!parsed.success) return

  const section = await db.section.findFirst({
    where: { id: parsed.data.sectionId, project: { workspaceId: workspace.id } },
    include: { project: true },
  })
  if (!section) throw new Error('Seção não encontrada')

  const ultima = await db.task.findFirst({
    where: { sectionId: section.id, parentId: null },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  await db.task.create({
    data: {
      workspaceId: workspace.id,
      projectId: section.projectId,
      sectionId: section.id,
      name: parsed.data.name,
      creatorId: user.id,
      order: (ultima?.order ?? 0) + 1000,
      completed: section.isDone,
      completedAt: section.isDone ? new Date() : null,
    },
  })

  revalidatePath(`/p/${section.projectId}`)
}

export async function moverTarefa(taskId: string, sectionId: string, order: number) {
  const { task, workspace } = await tarefaDoWorkspace(taskId)
  const destino = await db.section.findFirst({
    where: { id: sectionId, project: { workspaceId: workspace.id } },
  })
  if (!destino) throw new Error('Seção não encontrada')

  // a coluna de concluído fecha a tarefa; sair dela reabre
  const fechando = destino.isDone && !task.completed
  const reabrindo = !destino.isDone && task.completed && task.section?.isDone

  await db.task.update({
    where: { id: taskId },
    data: {
      sectionId,
      order,
      ...(fechando ? { completed: true, completedAt: new Date() } : {}),
      ...(reabrindo ? { completed: false, completedAt: null } : {}),
    },
  })

  revalidatePath(`/p/${task.projectId}`)
}

export async function alternarConcluida(taskId: string) {
  const { task } = await tarefaDoWorkspace(taskId)
  const virando = !task.completed

  // fechar joga na coluna de concluído do projeto, se existir
  let sectionId = task.sectionId
  if (virando) {
    const done = await db.section.findFirst({ where: { projectId: task.projectId, isDone: true } })
    if (done) sectionId = done.id
  }

  await db.task.update({
    where: { id: taskId },
    data: { completed: virando, completedAt: virando ? new Date() : null, sectionId },
  })

  revalidatePath(`/p/${task.projectId}`)
}

export async function renomearTarefa(taskId: string, name: string) {
  const limpo = name.trim()
  if (!limpo) return
  const { task } = await tarefaDoWorkspace(taskId)
  await db.task.update({ where: { id: taskId }, data: { name: limpo.slice(0, 300) } })
  revalidatePath(`/p/${task.projectId}`)
}

export async function apagarTarefa(taskId: string) {
  const { task } = await tarefaDoWorkspace(taskId)
  await db.task.delete({ where: { id: taskId } })
  revalidatePath(`/p/${task.projectId}`)
}

export async function criarSecao(projectId: string, name: string) {
  const { workspace } = await requireMembership()
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } })
  if (!project) throw new Error('Projeto não encontrado')

  const ultima = await db.section.findFirst({
    where: { projectId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  await db.section.create({
    data: { projectId, name: name.trim().slice(0, 80) || 'Nova seção', order: (ultima?.order ?? 0) + 1000 },
  })
  revalidatePath(`/p/${projectId}`)
}
