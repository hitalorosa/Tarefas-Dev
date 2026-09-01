'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'
import { corPorIndice } from '@/lib/colors'

async function campoDoWorkspace(fieldId: string) {
  const { workspace } = await requireMembership()
  const field = await db.customField.findFirst({ where: { id: fieldId, workspaceId: workspace.id } })
  if (!field) throw new Error('Campo não encontrado neste workspace')
  return field
}

export async function criarCampo(projectId: string, name: string, type: string) {
  const { workspace } = await requireMembership()
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } })
  if (!project) throw new Error('Projeto não encontrado')

  const limpo = name.trim().slice(0, 60)
  if (!limpo) throw new Error('Dê um nome ao campo')

  const existente = await db.customField.findFirst({
    where: { workspaceId: workspace.id, name: limpo },
  })
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

  revalidatePath(`/p/${projectId}`, 'layout')
  return field.id
}

export async function renomearCampo(fieldId: string, name: string) {
  const limpo = name.trim().slice(0, 60)
  if (!limpo) return
  await campoDoWorkspace(fieldId)
  await db.customField.update({ where: { id: fieldId }, data: { name: limpo } })
  revalidatePath('/p', 'layout')
}

export async function adicionarOpcao(fieldId: string, label: string) {
  await campoDoWorkspace(fieldId)
  const limpo = label.trim().slice(0, 60)
  if (!limpo) return
  const total = await db.customFieldOption.count({ where: { fieldId } })
  await db.customFieldOption.create({
    data: { fieldId, label: limpo, color: corPorIndice(total), order: total },
  })
  revalidatePath('/p', 'layout')
}

export async function editarOpcao(optionId: string, label: string, color: string) {
  const { workspace } = await requireMembership()
  const opcao = await db.customFieldOption.findFirst({
    where: { id: optionId, field: { workspaceId: workspace.id } },
  })
  if (!opcao) throw new Error('Opção não encontrada')
  await db.customFieldOption.update({
    where: { id: optionId },
    data: { label: label.trim().slice(0, 60) || opcao.label, color },
  })
  revalidatePath('/p', 'layout')
}

export async function removerOpcao(optionId: string) {
  const { workspace } = await requireMembership()
  const opcao = await db.customFieldOption.findFirst({
    where: { id: optionId, field: { workspaceId: workspace.id } },
  })
  if (!opcao) throw new Error('Opção não encontrada')
  await db.customFieldOption.delete({ where: { id: optionId } })
  revalidatePath('/p', 'layout')
}

/// Tira o campo DESTE projeto. O campo continua existindo no workspace e nos
/// outros projetos — é o oposto do Asana, onde cada projeto tinha a própria cópia.
export async function desvincularCampo(projectId: string, fieldId: string) {
  const { workspace } = await requireMembership()
  const vinculo = await db.projectCustomField.findFirst({
    where: { projectId, fieldId, project: { workspaceId: workspace.id } },
  })
  if (!vinculo) return
  await db.projectCustomField.delete({ where: { id: vinculo.id } })
  revalidatePath(`/p/${projectId}`, 'layout')
}

export async function vincularCampo(projectId: string, fieldId: string) {
  const { workspace } = await requireMembership()
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } })
  const field = await db.customField.findFirst({ where: { id: fieldId, workspaceId: workspace.id } })
  if (!project || !field) throw new Error('Projeto ou campo não encontrado')
  await db.projectCustomField.upsert({
    where: { projectId_fieldId: { projectId, fieldId } },
    create: { projectId, fieldId, order: 999 },
    update: {},
  })
  revalidatePath(`/p/${projectId}`, 'layout')
}

export async function definirValorCampo(taskId: string, fieldId: string, optionId: string | null) {
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
  const { workspace } = await requireMembership()
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: workspace.id } })
  if (!task) throw new Error('Tarefa não encontrada')
  await db.task.update({ where: { id: taskId }, data: { brandId } })
  revalidatePath(`/p/${task.projectId}`, 'layout')
}
