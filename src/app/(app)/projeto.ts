'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'

async function projetoDoWorkspace(projectId: string) {
  const { workspace, user } = await requireMembership()
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } })
  if (!project) throw new Error('Projeto não encontrado neste workspace')
  return { project, workspace, user }
}

export async function renomearProjeto(projectId: string, name: string) {
  const limpo = name.trim().slice(0, 80)
  if (!limpo) return
  await projetoDoWorkspace(projectId)
  await db.project.update({ where: { id: projectId }, data: { name: limpo } })
  revalidatePath('/', 'layout')
}

export async function mudarCorProjeto(projectId: string, color: string) {
  await projetoDoWorkspace(projectId)
  await db.project.update({ where: { id: projectId }, data: { color } })
  revalidatePath('/', 'layout')
}

export async function definirStatus(projectId: string, status: string | null, statusNote?: string) {
  await projetoDoWorkspace(projectId)
  await db.project.update({
    where: { id: projectId },
    data: { status, statusNote: status ? (statusNote?.trim().slice(0, 300) ?? null) : null },
  })
  revalidatePath(`/p/${projectId}`, 'layout')
}

export async function alternarFavorito(projectId: string) {
  const { user } = await projetoDoWorkspace(projectId)
  const existente = await db.projectStar.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  })
  if (existente) await db.projectStar.delete({ where: { id: existente.id } })
  else await db.projectStar.create({ data: { projectId, userId: user.id } })
  revalidatePath('/', 'layout')
}

export async function criarProjeto(name: string) {
  const { workspace } = await requireMembership()
  const limpo = name.trim().slice(0, 80)
  if (!limpo) throw new Error('Dê um nome ao projeto')

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
  await projetoDoWorkspace(projectId)
  await db.project.update({ where: { id: projectId }, data: { archived: true } })
  revalidatePath('/', 'layout')
}

export async function atualizarDescricaoProjeto(projectId: string, description: string) {
  await projetoDoWorkspace(projectId)
  await db.project.update({
    where: { id: projectId },
    data: { description: description.trim().slice(0, 5000) || null },
  })
  revalidatePath(`/p/${projectId}`, 'layout')
}
