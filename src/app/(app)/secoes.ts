'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'
import { lerEstado, mutar, novoId, semBanco } from '@/lib/estado'

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

  if (semBanco()) {
    const e = await lerEstado()
    const s = e.secoes.find((x) => x.id === sectionId)
    if (!s) return
    await mutar((st) => {
      st.secoes.find((x) => x.id === sectionId)!.name = limpo
    })
    revalidatePath(`/p/${s.projectId}`, 'layout')
    return
  }

  const section = await secaoDoWorkspace(sectionId)
  await db.section.update({ where: { id: sectionId }, data: { name: limpo } })
  revalidatePath(`/p/${section.projectId}`, 'layout')
}

export async function adicionarSecao(projectId: string, name: string, depoisDe?: string) {
  const limpo = name.trim().slice(0, 80) || 'Nova seção'

  if (semBanco()) {
    const e = await lerEstado()
    const irmas = e.secoes.filter((s) => s.projectId === projectId).sort((a, b) => a.order - b.order)
    let order: number
    if (depoisDe) {
      const i = irmas.findIndex((s) => s.id === depoisDe)
      const atual = irmas[i]?.order ?? 0
      const proxima = irmas[i + 1]?.order
      order = proxima == null ? atual + 1000 : (atual + proxima) / 2
    } else {
      order = (irmas.at(-1)?.order ?? 0) + 1000
    }
    await mutar((st) => {
      st.secoes.push({ id: novoId(), projectId, name: limpo, order, isDone: false })
    })
    revalidatePath(`/p/${projectId}`, 'layout')
    return
  }

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

  const criada = await db.section.create({ data: { projectId, name: limpo, order } })
  revalidatePath(`/p/${projectId}`, 'layout')
  return criada.id
}

/// Troca de lugar com a seção vizinha. Sem "arrastar coluna" ainda — isso resolve 90% dos casos.
export async function moverSecao(sectionId: string, direcao: 'esquerda' | 'direita') {
  if (semBanco()) {
    const e = await lerEstado()
    const s = e.secoes.find((x) => x.id === sectionId)
    if (!s) return
    const irmas = e.secoes.filter((x) => x.projectId === s.projectId).sort((a, b) => a.order - b.order)
    const i = irmas.findIndex((x) => x.id === sectionId)
    const j = direcao === 'esquerda' ? i - 1 : i + 1
    if (j < 0 || j >= irmas.length) return
    await mutar((st) => {
      const a = st.secoes.find((x) => x.id === irmas[i].id)!
      const b = st.secoes.find((x) => x.id === irmas[j].id)!
      const tmp = a.order
      a.order = b.order
      b.order = tmp
    })
    revalidatePath(`/p/${s.projectId}`, 'layout')
    return
  }

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
  if (semBanco()) {
    const e = await lerEstado()
    const s = e.secoes.find((x) => x.id === sectionId)
    if (!s) return
    const irmas = e.secoes.filter((x) => x.projectId === s.projectId).sort((a, b) => a.order - b.order)
    if (irmas.length <= 1) return
    const i = irmas.findIndex((x) => x.id === sectionId)
    const destino = irmas[i - 1] ?? irmas[i + 1]
    await mutar((st) => {
      for (const t of st.tarefas) if (t.sectionId === sectionId) t.sectionId = destino.id
      st.secoes = st.secoes.filter((x) => x.id !== sectionId)
    })
    revalidatePath(`/p/${s.projectId}`, 'layout')
    return
  }

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
  if (semBanco()) {
    const e = await lerEstado()
    const s = e.secoes.find((x) => x.id === sectionId)
    if (!s) return
    await mutar((st) => {
      // só uma coluna de concluído por projeto, senão "fechar" fica ambíguo
      if (isDone) for (const x of st.secoes) if (x.projectId === s.projectId) x.isDone = false
      st.secoes.find((x) => x.id === sectionId)!.isDone = isDone
    })
    revalidatePath(`/p/${s.projectId}`, 'layout')
    return
  }

  const section = await secaoDoWorkspace(sectionId)
  if (isDone) {
    await db.section.updateMany({ where: { projectId: section.projectId }, data: { isDone: false } })
  }
  await db.section.update({ where: { id: sectionId }, data: { isDone } })
  revalidatePath(`/p/${section.projectId}`, 'layout')
}
