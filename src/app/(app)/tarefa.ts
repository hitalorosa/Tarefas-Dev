'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'
import { lerEstado, mutar, novoId, semBanco } from '@/lib/estado'

/// Ações do painel da tarefa. Cada uma existe nos dois modos: banco e cookie.

async function doBanco(taskId: string) {
  const { workspace, user } = await requireMembership()
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: workspace.id } })
  if (!task) throw new Error('Tarefa não encontrada neste workspace')
  return { task, user }
}

async function noCookie(taskId: string) {
  const e = await lerEstado()
  return e.tarefas.find((t) => t.id === taskId) ?? null
}

/// A mesma tarefa pode estar em vários quadros, então revalidar um só deixaria
/// os outros desatualizados.
function revalidar() {
  revalidatePath('/', 'layout')
}

export async function definirResponsavel(taskId: string, assigneeId: string | null) {
  if (semBanco()) {
    const t = await noCookie(taskId)
    if (!t) return
    await mutar((st) => void (st.tarefas.find((x) => x.id === taskId)!.assigneeId = assigneeId))
    revalidar()
    return
  }
  await doBanco(taskId)
  await db.task.update({ where: { id: taskId }, data: { assigneeId } })
  revalidar()
}

/// Datas chegam como AAAA-MM-DD. Meio-dia evita o clássico "venceu um dia antes"
/// de quem está em fuso negativo.
export async function definirDatas(
  taskId: string,
  startOn: string | null,
  dueAt: string | null,
  dueTime?: string | null,
) {
  const hora = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : null

  if (semBanco()) {
    const t = await noCookie(taskId)
    if (!t) return
    await mutar((st) => {
      const x = st.tarefas.find((y) => y.id === taskId)!
      x.startOn = startOn || null
      x.dueAt = dueAt || null
      // hora sem data não quer dizer nada
      x.dueTime = dueAt ? hora : null
    })
    revalidar()
    return
  }
  await doBanco(taskId)
  await db.task.update({
    where: { id: taskId },
    data: {
      startOn: startOn ? new Date(`${startOn}T12:00:00`) : null,
      dueAt: dueAt ? new Date(`${dueAt}T12:00:00`) : null,
      dueTime: dueAt ? hora : null,
    },
  })
  revalidar()
}

/// Regra de repetição em texto ("semanal:1,3"), ou null para não repetir.
export async function definirRepeticao(taskId: string, regra: string | null) {
  if (semBanco()) {
    const t = await noCookie(taskId)
    if (!t) return
    await mutar((st) => void (st.tarefas.find((x) => x.id === taskId)!.recurrence = regra))
    revalidar()
    return
  }
  await doBanco(taskId)
  await db.task.update({ where: { id: taskId }, data: { recurrence: regra } })
  revalidar()
}

export async function atualizarDescricaoTarefa(taskId: string, description: string) {
  const limpo = description.slice(0, 8000)
  if (semBanco()) {
    const t = await noCookie(taskId)
    if (!t) return
    await mutar((st) => void (st.tarefas.find((x) => x.id === taskId)!.description = limpo || null))
    revalidar()
    return
  }
  await doBanco(taskId)
  await db.task.update({ where: { id: taskId }, data: { description: limpo || null } })
  revalidar()
}

export async function moverParaSecao(taskId: string, sectionId: string) {
  if (semBanco()) {
    const e = await lerEstado()
    const secao = e.secoes.find((s) => s.id === sectionId)
    if (!secao) return
    await mutar((st) => {
      const q = st.tarefas
        .find((x) => x.id === taskId)
        ?.quadros.find((x) => x.projectId === secao.projectId)
      if (q) q.sectionId = sectionId
    })
    revalidar()
    return
  }

  await doBanco(taskId)
  const secao = await db.section.findUnique({ where: { id: sectionId } })
  if (!secao) return
  await db.taskProject.updateMany({
    where: { taskId, projectId: secao.projectId },
    data: { sectionId },
  })
  revalidar()
}

// ── subtarefas ───────────────────────────────────────────────────────────────

export async function adicionarSubtarefa(taskId: string, name: string) {
  const limpo = name.trim().slice(0, 200)
  if (!limpo) return

  if (semBanco()) {
    const t = await noCookie(taskId)
    if (!t) return
    await mutar((st) => {
      st.tarefas
        .find((x) => x.id === taskId)!
        .subtasks.push({ id: novoId(), name: limpo, completed: false })
    })
    revalidar()
    return
  }

  const { task, user } = await doBanco(taskId)
  // subtarefa não entra em quadro nenhum: ela vive dentro da tarefa-mãe
  await db.task.create({
    data: { workspaceId: task.workspaceId, parentId: taskId, name: limpo, creatorId: user.id },
  })
  revalidar()
}

export async function alternarSubtarefa(taskId: string, subId: string) {
  if (semBanco()) {
    const t = await noCookie(taskId)
    if (!t) return
    await mutar((st) => {
      const s = st.tarefas.find((x) => x.id === taskId)!.subtasks.find((y) => y.id === subId)
      if (s) s.completed = !s.completed
    })
    revalidar()
    return
  }
  await doBanco(taskId)
  const sub = await db.task.findFirst({ where: { id: subId, parentId: taskId } })
  if (!sub) return
  await db.task.update({
    where: { id: subId },
    data: { completed: !sub.completed, completedAt: sub.completed ? null : new Date() },
  })
  revalidar()
}

export async function removerSubtarefa(taskId: string, subId: string) {
  if (semBanco()) {
    const t = await noCookie(taskId)
    if (!t) return
    await mutar((st) => {
      const x = st.tarefas.find((y) => y.id === taskId)!
      x.subtasks = x.subtasks.filter((s) => s.id !== subId)
    })
    revalidar()
    return
  }
  await doBanco(taskId)
  await db.task.deleteMany({ where: { id: subId, parentId: taskId } })
  revalidar()
}

// ── dependências ─────────────────────────────────────────────────────────────

export async function adicionarDependencia(taskId: string, blockerId: string) {
  if (taskId === blockerId) return

  if (semBanco()) {
    const t = await noCookie(taskId)
    if (!t) return
    await mutar((st) => {
      const x = st.tarefas.find((y) => y.id === taskId)!
      // ciclo direto trava as duas para sempre; recusar é mais honesto que aceitar
      const outra = st.tarefas.find((y) => y.id === blockerId)
      if (outra?.blockedByIds.includes(taskId)) return
      if (!x.blockedByIds.includes(blockerId)) x.blockedByIds.push(blockerId)
    })
    revalidar()
    return
  }

  await doBanco(taskId)
  const inverso = await db.taskDependency.findFirst({
    where: { blockerId: taskId, blockedId: blockerId },
  })
  if (inverso) return
  await db.taskDependency.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId: taskId } },
    create: { blockerId, blockedId: taskId },
    update: {},
  })
  revalidar()
}

export async function removerDependencia(taskId: string, blockerId: string) {
  if (semBanco()) {
    const t = await noCookie(taskId)
    if (!t) return
    await mutar((st) => {
      const x = st.tarefas.find((y) => y.id === taskId)!
      x.blockedByIds = x.blockedByIds.filter((id) => id !== blockerId)
    })
    revalidar()
    return
  }
  await doBanco(taskId)
  await db.taskDependency.deleteMany({ where: { blockerId, blockedId: taskId } })
  revalidar()
}

// ── comentários (só com banco: não cabem no cookie) ──────────────────────────

export async function comentar(taskId: string, corpo: string) {
  if (semBanco()) return
  const limpo = corpo.trim().slice(0, 4000)
  if (!limpo) return
  const { user } = await doBanco(taskId)
  await db.comment.create({ data: { taskId, authorId: user.id, body: limpo } })
  revalidar()
}
