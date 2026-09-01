'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'
import { mutar, novoId, semBanco, type Projeto } from '@/lib/estado'

async function projetoDoWorkspace(projectId: string) {
  const { workspace, user } = await requireMembership()
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } })
  if (!project) throw new Error('Projeto não encontrado neste workspace')
  return { project, workspace, user }
}

/// Muda um campo do projeto no estado do cookie e revalida.
async function mexerNoProjeto(projectId: string, fn: (p: Projeto) => void) {
  await mutar((st) => {
    const p = st.projetos.find((x) => x.id === projectId)
    if (p) fn(p)
  })
  revalidatePath('/', 'layout')
}

export async function renomearProjeto(projectId: string, name: string) {
  const limpo = name.trim().slice(0, 80)
  if (!limpo) return

  if (semBanco()) return mexerNoProjeto(projectId, (p) => void (p.name = limpo))

  await projetoDoWorkspace(projectId)
  await db.project.update({ where: { id: projectId }, data: { name: limpo } })
  revalidatePath('/', 'layout')
}

export async function mudarCorProjeto(projectId: string, color: string) {
  if (semBanco()) return mexerNoProjeto(projectId, (p) => void (p.color = color))

  await projetoDoWorkspace(projectId)
  await db.project.update({ where: { id: projectId }, data: { color } })
  revalidatePath('/', 'layout')
}

export async function mudarIconeProjeto(projectId: string, icon: string) {
  if (semBanco()) return mexerNoProjeto(projectId, (p) => void (p.icon = icon))

  await projetoDoWorkspace(projectId)
  await db.project.update({ where: { id: projectId }, data: { icon } })
  revalidatePath('/', 'layout')
}

export async function definirStatus(projectId: string, status: string | null, statusNote?: string) {
  if (semBanco()) return mexerNoProjeto(projectId, (p) => void (p.status = status))

  await projetoDoWorkspace(projectId)
  await db.project.update({
    where: { id: projectId },
    data: { status, statusNote: status ? (statusNote?.trim().slice(0, 300) ?? null) : null },
  })
  revalidatePath(`/p/${projectId}`, 'layout')
}

export async function alternarFavorito(projectId: string) {
  if (semBanco()) return mexerNoProjeto(projectId, (p) => void (p.favorito = !p.favorito))

  const { user } = await projetoDoWorkspace(projectId)
  const existente = await db.projectStar.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  })
  if (existente) await db.projectStar.delete({ where: { id: existente.id } })
  else await db.projectStar.create({ data: { projectId, userId: user.id } })
  revalidatePath('/', 'layout')
}

export async function atualizarDescricaoProjeto(projectId: string, description: string) {
  const limpo = description.trim().slice(0, 5000) || null

  if (semBanco()) return mexerNoProjeto(projectId, (p) => void (p.description = limpo))

  await projetoDoWorkspace(projectId)
  await db.project.update({ where: { id: projectId }, data: { description: limpo } })
  revalidatePath(`/p/${projectId}`, 'layout')
}

export async function criarProjeto(name: string) {
  const limpo = name.trim().slice(0, 80)
  if (!limpo) throw new Error('Dê um nome ao projeto')

  if (semBanco()) {
    const id = novoId()
    await mutar((st) => {
      st.projetos.push({
        id,
        name: limpo,
        color: '#1971c2',
        icon: 'folder',
        description: null,
        status: null,
        favorito: false,
      })
      st.secoes.push(
        { id: novoId(), projectId: id, name: 'A FAZER', order: 0, isDone: false },
        { id: novoId(), projectId: id, name: 'FAZENDO', order: 1000, isDone: false },
        { id: novoId(), projectId: id, name: 'FEITO', order: 2000, isDone: true },
      )
      for (const c of st.campos) c.projetos.push(id)
    })
    revalidatePath('/', 'layout')
    return id
  }

  const { workspace } = await requireMembership()
  const ultimo = await db.project.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const project = await db.project.create({
    data: {
      workspaceId: workspace.id,
      name: limpo,
      order: (ultimo?.order ?? 0) + 1,
      sections: {
        create: [
          { name: 'A FAZER', order: 0 },
          { name: 'FAZENDO', order: 1000 },
          { name: 'FEITO', order: 2000, isDone: true },
        ],
      },
      canvases: { create: { name: 'Quadro branco' } },
    },
  })

  revalidatePath('/', 'layout')
  return project.id
}

export async function arquivarProjeto(projectId: string) {
  if (semBanco()) {
    await mutar((st) => {
      if (st.projetos.length <= 1) return
      st.projetos = st.projetos.filter((p) => p.id !== projectId)
      st.secoes = st.secoes.filter((s) => s.projectId !== projectId)
      st.tarefas = st.tarefas.filter((t) => t.projectId !== projectId)
    })
    revalidatePath('/', 'layout')
    return
  }

  await projetoDoWorkspace(projectId)
  await db.project.update({ where: { id: projectId }, data: { archived: true } })
  revalidatePath('/', 'layout')
}
