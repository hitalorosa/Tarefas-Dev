'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'
import { corPorIndice } from '@/lib/colors'
import { lerEstado, mutar, novoId, semBanco } from '@/lib/estado'

async function campoDoWorkspace(fieldId: string) {
  const { workspace } = await requireMembership()
  const field = await db.customField.findFirst({ where: { id: fieldId, workspaceId: workspace.id } })
  if (!field) throw new Error('Campo não encontrado neste workspace')
  return field
}

/// Revalida tudo: campo é do workspace, então mexer nele muda todos os quadros.
function revalidarTudo() {
  revalidatePath('/', 'layout')
}

export async function criarCampo(projectId: string, name: string, type: string) {
  const limpo = name.trim().slice(0, 60)
  if (!limpo) throw new Error('Dê um nome ao campo')

  if (semBanco()) {
    await mutar((st) => {
      const existente = st.campos.find((c) => c.name === limpo)
      if (existente) {
        if (!existente.projetos.includes(projectId)) existente.projetos.push(projectId)
        return
      }
      st.campos.push({ id: novoId(), name: limpo, type, projetos: [projectId], options: [] })
    })
    revalidarTudo()
    return
  }

  const { workspace } = await requireMembership()
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } })
  if (!project) throw new Error('Projeto não encontrado')

  const existente = await db.customField.findFirst({ where: { workspaceId: workspace.id, name: limpo } })
  // campo é do workspace: se já existe com esse nome, só liga ao projeto
  const field =
    existente ??
    (await db.customField.create({
      data: {
        workspaceId: workspace.id,
        name: limpo,
        type,
        order: await db.customField.count({ where: { workspaceId: workspace.id } }),
      },
    }))

  await db.projectCustomField.upsert({
    where: { projectId_fieldId: { projectId, fieldId: field.id } },
    create: { projectId, fieldId: field.id, order: 999 },
    update: {},
  })

  revalidarTudo()
  return field.id
}

export async function renomearCampo(fieldId: string, name: string) {
  const limpo = name.trim().slice(0, 60)
  if (!limpo) return

  if (semBanco()) {
    await mutar((st) => {
      const c = st.campos.find((x) => x.id === fieldId)
      if (c) c.name = limpo
    })
    revalidarTudo()
    return
  }

  await campoDoWorkspace(fieldId)
  await db.customField.update({ where: { id: fieldId }, data: { name: limpo } })
  revalidarTudo()
}

export async function adicionarOpcao(fieldId: string, label: string) {
  const limpo = label.trim().slice(0, 60)
  if (!limpo) return

  if (semBanco()) {
    await mutar((st) => {
      const c = st.campos.find((x) => x.id === fieldId)
      if (c) c.options.push({ id: novoId(), label: limpo, color: corPorIndice(c.options.length) })
    })
    revalidarTudo()
    return
  }

  await campoDoWorkspace(fieldId)
  const total = await db.customFieldOption.count({ where: { fieldId } })
  await db.customFieldOption.create({
    data: { fieldId, label: limpo, color: corPorIndice(total), order: total },
  })
  revalidarTudo()
}

export async function editarOpcao(optionId: string, label: string, color: string) {
  if (semBanco()) {
    await mutar((st) => {
      for (const c of st.campos) {
        const o = c.options.find((x) => x.id === optionId)
        if (o) {
          o.label = label.trim().slice(0, 60) || o.label
          o.color = color
        }
      }
    })
    revalidarTudo()
    return
  }

  const { workspace } = await requireMembership()
  const opcao = await db.customFieldOption.findFirst({
    where: { id: optionId, field: { workspaceId: workspace.id } },
  })
  if (!opcao) throw new Error('Opção não encontrada')
  await db.customFieldOption.update({
    where: { id: optionId },
    data: { label: label.trim().slice(0, 60) || opcao.label, color },
  })
  revalidarTudo()
}

export async function removerOpcao(optionId: string) {
  if (semBanco()) {
    await mutar((st) => {
      for (const c of st.campos) c.options = c.options.filter((o) => o.id !== optionId)
      // tarefa não pode ficar apontando para opção que não existe mais
      for (const t of st.tarefas) t.fieldValues = t.fieldValues.filter((v) => v.optionId !== optionId)
    })
    revalidarTudo()
    return
  }

  const { workspace } = await requireMembership()
  const opcao = await db.customFieldOption.findFirst({
    where: { id: optionId, field: { workspaceId: workspace.id } },
  })
  if (!opcao) throw new Error('Opção não encontrada')
  await db.customFieldOption.delete({ where: { id: optionId } })
  revalidarTudo()
}

/// Tira o campo DESTE projeto. O campo continua existindo no workspace e nos
/// outros projetos — é o oposto do Asana, onde cada projeto tinha a própria cópia.
export async function desvincularCampo(projectId: string, fieldId: string) {
  if (semBanco()) {
    await mutar((st) => {
      const c = st.campos.find((x) => x.id === fieldId)
      if (c) c.projetos = c.projetos.filter((p) => p !== projectId)
    })
    revalidarTudo()
    return
  }

  const { workspace } = await requireMembership()
  const vinculo = await db.projectCustomField.findFirst({
    where: { projectId, fieldId, project: { workspaceId: workspace.id } },
  })
  if (!vinculo) return
  await db.projectCustomField.delete({ where: { id: vinculo.id } })
  revalidarTudo()
}

export async function vincularCampo(projectId: string, fieldId: string) {
  if (semBanco()) {
    await mutar((st) => {
      const c = st.campos.find((x) => x.id === fieldId)
      if (c && !c.projetos.includes(projectId)) c.projetos.push(projectId)
    })
    revalidarTudo()
    return
  }

  const { workspace } = await requireMembership()
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } })
  const field = await db.customField.findFirst({ where: { id: fieldId, workspaceId: workspace.id } })
  if (!project || !field) throw new Error('Projeto ou campo não encontrado')
  await db.projectCustomField.upsert({
    where: { projectId_fieldId: { projectId, fieldId } },
    create: { projectId, fieldId, order: 999 },
    update: {},
  })
  revalidarTudo()
}

export async function definirValorCampo(taskId: string, fieldId: string, optionId: string | null) {
  if (semBanco()) {
    const e = await lerEstado()
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!tarefa) return
    await mutar((st) => {
      const t = st.tarefas.find((x) => x.id === taskId)!
      t.fieldValues = t.fieldValues.filter((v) => v.fieldId !== fieldId)
      if (optionId) t.fieldValues.push({ fieldId, optionId })
    })
    revalidatePath(`/p/${tarefa.projectId}`, 'layout')
    return
  }

  const { workspace } = await requireMembership()
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: workspace.id } })
  if (!task) throw new Error('Tarefa não encontrada')

  if (optionId === null) {
    await db.taskFieldValue.deleteMany({ where: { taskId, fieldId } })
  } else {
    await db.taskFieldValue.upsert({
      where: { taskId_fieldId: { taskId, fieldId } },
      create: { taskId, fieldId, optionId },
      update: { optionId },
    })
  }
  revalidatePath(`/p/${task.projectId}`, 'layout')
}

export async function definirMarca(taskId: string, brandId: string | null) {
  if (semBanco()) {
    const e = await lerEstado()
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!tarefa) return
    await mutar((st) => {
      st.tarefas.find((x) => x.id === taskId)!.brandId = brandId
    })
    revalidatePath(`/p/${tarefa.projectId}`, 'layout')
    return
  }

  const { workspace } = await requireMembership()
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: workspace.id } })
  if (!task) throw new Error('Tarefa não encontrada')
  await db.task.update({ where: { id: taskId }, data: { brandId } })
  revalidatePath(`/p/${task.projectId}`, 'layout')
}
