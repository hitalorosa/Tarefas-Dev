'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'
import { MEMBROS, lerEstado, mutar, novoId, semBanco } from '@/lib/estado'

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
  const parsed = z
    .object({ sectionId: z.string().min(1), name: z.string().trim().min(1).max(300) })
    .safeParse({ sectionId: formData.get('sectionId'), name: formData.get('name') })
  if (!parsed.success) return

  if (semBanco()) {
    const e = await lerEstado()
    const secao = e.secoes.find((s) => s.id === parsed.data.sectionId)
    if (!secao) return
    const ultima = Math.max(0, ...e.tarefas.filter((t) => t.sectionId === secao.id).map((t) => t.order))
    await mutar((st) => {
      st.tarefas.push({
        id: novoId(),
        projectId: secao.projectId,
        sectionId: secao.id,
        name: parsed.data.name,
        description: null,
        brandId: null,
        assigneeId: MEMBROS[0].id,
        startOn: null,
        dueAt: null,
        completed: secao.isDone,
        order: ultima + 1000,
        origin: 'human',
        fieldValues: [],
        blockedByIds: [],
        subtasks: { feitas: 0, total: 0 },
        comentarios: 0,
        alertas: 0,
      })
    })
    revalidatePath(`/p/${secao.projectId}`, 'layout')
    return
  }

  const { workspace, user } = await requireMembership()
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
  if (semBanco()) {
    const e = await lerEstado()
    const destino = e.secoes.find((s) => s.id === sectionId)
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!destino || !tarefa) return
    const origem = e.secoes.find((s) => s.id === tarefa.sectionId)
    await mutar((st) => {
      const t = st.tarefas.find((x) => x.id === taskId)!
      t.sectionId = sectionId
      t.order = order
      if (destino.isDone && !t.completed) t.completed = true
      if (!destino.isDone && t.completed && origem?.isDone) t.completed = false
    })
    revalidatePath(`/p/${destino.projectId}`, 'layout')
    return
  }

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
  if (semBanco()) {
    const e = await lerEstado()
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!tarefa) return
    const feito = e.secoes.find((s) => s.projectId === tarefa.projectId && s.isDone)
    await mutar((st) => {
      const t = st.tarefas.find((x) => x.id === taskId)!
      t.completed = !t.completed
      if (t.completed && feito) t.sectionId = feito.id
    })
    revalidatePath(`/p/${tarefa.projectId}`, 'layout')
    return
  }

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

  if (semBanco()) {
    const e = await lerEstado()
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!tarefa) return
    await mutar((st) => {
      st.tarefas.find((x) => x.id === taskId)!.name = limpo.slice(0, 300)
    })
    revalidatePath(`/p/${tarefa.projectId}`, 'layout')
    return
  }

  const { task } = await tarefaDoWorkspace(taskId)
  await db.task.update({ where: { id: taskId }, data: { name: limpo.slice(0, 300) } })
  revalidatePath(`/p/${task.projectId}`)
}

export async function apagarTarefa(taskId: string) {
  if (semBanco()) {
    const e = await lerEstado()
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!tarefa) return
    await mutar((st) => {
      st.tarefas = st.tarefas.filter((x) => x.id !== taskId)
      // ninguém pode continuar travado por uma tarefa que não existe mais
      for (const t of st.tarefas) t.blockedByIds = t.blockedByIds.filter((id) => id !== taskId)
    })
    revalidatePath(`/p/${tarefa.projectId}`, 'layout')
    return
  }

  const { task } = await tarefaDoWorkspace(taskId)
  await db.task.delete({ where: { id: taskId } })
  revalidatePath(`/p/${task.projectId}`)
}
