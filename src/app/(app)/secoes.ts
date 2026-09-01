'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'

async function secaoDoWorkspace(sectionId: string) {
  const { workspace } = await requireMembership()
  const section = await db.section.findFirst({
    where: { id: sectionId, project: { workspaceId: workspace.id } },
  })
  if (!section) throw new Error('Seção não encontrada neste workspace')
  return section
}

export async function renomearSecao(sectionId: string, name: string) {
  const limpo = name.trim().slice(0, 80)
  if (!limpo) return
  const section = await secaoDoWorkspace(sectionId)
  await db.section.update({ where: { id: sectionId }, data: { name: limpo } })
  revalidatePath(`/p/${section.projectId}`, 'layout')
}

export async function adicionarSecao(projectId: string, name: string, depoisDe?: string) {
  const { workspace } = await requireMembership()
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } })
  if (!project) throw new Error('Projeto não encontrado')

  const secoes = await db.section.findMany({ where: { projectId }, orderBy: { order: 'asc' } })
  let order: number
  if (depoisDe) {
    const i = secoes.findIndex((s) => s.id === depoisDe)
    const atual = secoes[i]?.order ?? 0
    const proxima = secoes[i + 1]?.order
    order = proxima == null ? atual + 1000 : (atual + proxima) / 2
  } else {
    order = (secoes.at(-1)?.order ?? 0) + 1000
  }

  const criada = await db.section.create({
    data: { projectId, name: name.trim().slice(0, 80) || 'Nova seção', order },
  })
  revalidatePath(`/p/${projectId}`, 'layout')
  return criada.id
}

/// Troca de lugar com a seção vizinha. Sem "arrastar coluna" ainda — isso resolve 90% dos casos.
export async function moverSecao(sectionId: string, direcao: 'esquerda' | 'direita') {
  const section = await secaoDoWorkspace(sectionId)
  const secoes = await db.section.findMany({
    where: { projectId: section.projectId },
    orderBy: { order: 'asc' },
  })
  const i = secoes.findIndex((s) => s.id === sectionId)
  const j = direcao === 'esquerda' ? i - 1 : i + 1
  if (j < 0 || j >= secoes.length) return

  await db.$transaction([
    db.section.update({ where: { id: secoes[i].id }, data: { order: secoes[j].order } }),
    db.section.update({ where: { id: secoes[j].id }, data: { order: secoes[i].order } }),
  ])
  revalidatePath(`/p/${section.projectId}`, 'layout')
}

/// Excluir NUNCA apaga tarefa junto: elas vão pra seção vizinha.
/// Perder trabalho por clicar num menu é o tipo de coisa que faz largar a ferramenta.
export async function excluirSecao(sectionId: string) {
  const section = await secaoDoWorkspace(sectionId)
  const secoes = await db.section.findMany({
    where: { projectId: section.projectId },
    orderBy: { order: 'asc' },
  })
  if (secoes.length <= 1) throw new Error('O projeto precisa de pelo menos uma seção')

  const i = secoes.findIndex((s) => s.id === sectionId)
  const destino = secoes[i - 1] ?? secoes[i + 1]

  await db.$transaction([
    db.task.updateMany({ where: { sectionId }, data: { sectionId: destino.id } }),
    db.section.delete({ where: { id: sectionId } }),
  ])
  revalidatePath(`/p/${section.projectId}`, 'layout')
}

export async function marcarSecaoConcluida(sectionId: string, isDone: boolean) {
  const section = await secaoDoWorkspace(sectionId)
  if (isDone) {
    // só uma coluna de concluído por projeto, senão "fechar" fica ambíguo
    await db.section.updateMany({ where: { projectId: section.projectId }, data: { isDone: false } })
  }
  await db.section.update({ where: { id: sectionId }, data: { isDone } })
  revalidatePath(`/p/${section.projectId}`, 'layout')
}
