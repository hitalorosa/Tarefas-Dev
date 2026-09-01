'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireMembership } from '@/lib/auth'
import { MEMBROS, lerEstado, mutar, novoId, semBanco } from '@/lib/estado'
import { lerRepeticao, proximaData } from '@/lib/repeticao'
import { registrar } from '@/lib/atividade'

/// Toda ação confere que a tarefa pertence ao workspace de quem chamou.
/// Sem isso, um id adivinhado dá acesso ao quadro de outra empresa.
async function tarefaDoWorkspace(taskId: string) {
  const { workspace, user } = await requireMembership()
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: workspace.id },
    include: { quadros: { include: { section: true } } },
  })
  if (!task) throw new Error('Tarefa não encontrada neste workspace')
  return { task, workspace, user }
}

/// Revalida o layout inteiro: a mesma tarefa pode estar em vários quadros, e
/// mexer nela muda todos eles.
function revalidarTudo() {
  revalidatePath('/', 'layout')
}

export type NovaTarefa = {
  sectionId: string
  name: string
  brandId?: string | null
  assigneeId?: string | null
  startOn?: string | null
  dueAt?: string | null
  campos?: { fieldId: string; optionId: string }[]
}

/// Criar já com marca, campos, responsável e prazo. No Asana o compositor abre
/// com esses espaços à mostra, e preencher na hora é bem mais provável do que
/// voltar depois — tarefa sem campo é o que vira zona cega.
export async function criarTarefa(dados: NovaTarefa) {
  const parsed = z
    .object({
      sectionId: z.string().min(1),
      name: z.string().trim().min(1).max(300),
      brandId: z.string().nullish(),
      assigneeId: z.string().nullish(),
      startOn: z.string().nullish(),
      dueAt: z.string().nullish(),
      campos: z.array(z.object({ fieldId: z.string(), optionId: z.string() })).optional(),
    })
    .safeParse(dados)
  if (!parsed.success) return
  const d = parsed.data

  if (semBanco()) {
    const e = await lerEstado()
    const secao = e.secoes.find((s) => s.id === d.sectionId)
    if (!secao) return
    const ultima = Math.max(
      0,
      ...e.tarefas.flatMap((t) => t.quadros.filter((q) => q.sectionId === secao.id).map((q) => q.order)),
    )
    const idNovo = novoId()
    await mutar((st) => {
      st.tarefas.push({
        id: idNovo,
        quadros: [{ projectId: secao.projectId, sectionId: secao.id, order: ultima + 1000 }],
        name: d.name,
        description: null,
        brandId: d.brandId ?? null,
        assigneeId: d.assigneeId ?? MEMBROS[0].id,
        startOn: d.startOn || null,
        dueAt: d.dueAt || null,
        startTime: null,
        dueTime: null,
        recurrence: null,
        completed: secao.isDone,
        origin: 'human',
        fieldValues: d.campos ?? [],
        blockedByIds: [],
        subtasks: [],
        comentarios: 0,
        alertas: 0,
      })
    })
    await registrar(idNovo, 'criou esta tarefa')
    revalidarTudo()
    return
  }

  const { workspace, user } = await requireMembership()
  const section = await db.section.findFirst({
    where: { id: d.sectionId, project: { workspaceId: workspace.id } },
  })
  if (!section) throw new Error('Seção não encontrada')

  const ultima = await db.taskProject.findFirst({
    where: { sectionId: section.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  await db.task.create({
    data: {
      workspaceId: workspace.id,
      name: d.name,
      creatorId: user.id,
      assigneeId: d.assigneeId ?? null,
      brandId: d.brandId ?? null,
      startOn: d.startOn ? new Date(`${d.startOn}T12:00:00`) : null,
      dueAt: d.dueAt ? new Date(`${d.dueAt}T12:00:00`) : null,
      completed: section.isDone,
      completedAt: section.isDone ? new Date() : null,
      quadros: {
        create: {
          projectId: section.projectId,
          sectionId: section.id,
          order: (ultima?.order ?? 0) + 1000,
        },
      },
      fieldValues: d.campos?.length
        ? { create: d.campos.map((c) => ({ fieldId: c.fieldId, optionId: c.optionId })) }
        : undefined,
    },
  })

  revalidarTudo()
}

export async function moverTarefa(taskId: string, sectionId: string, order: number) {
  if (semBanco()) {
    const e = await lerEstado()
    const destino = e.secoes.find((s) => s.id === sectionId)
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!destino || !tarefa) return
    const vinculo = tarefa.quadros.find((q) => q.projectId === destino.projectId)
    const origem = e.secoes.find((s) => s.id === vinculo?.sectionId)

    await mutar((st) => {
      const t = st.tarefas.find((x) => x.id === taskId)!
      const q = t.quadros.find((x) => x.projectId === destino.projectId)
      if (!q) return
      q.sectionId = sectionId
      q.order = order
      if (destino.isDone && !t.completed) t.completed = true
      if (!destino.isDone && t.completed && origem?.isDone) t.completed = false
    })
    await registrar(
      taskId,
      origem
        ? `moveu esta tarefa de "${origem.name}" para "${destino.name}"`
        : `moveu esta tarefa para "${destino.name}"`,
    )
    revalidarTudo()
    return
  }

  const { task, workspace } = await tarefaDoWorkspace(taskId)
  const destino = await db.section.findFirst({
    where: { id: sectionId, project: { workspaceId: workspace.id } },
  })
  if (!destino) throw new Error('Seção não encontrada')

  const vinculo = task.quadros.find((q) => q.projectId === destino.projectId)
  if (!vinculo) throw new Error('Tarefa não está neste quadro')

  // a coluna de concluído fecha a tarefa; sair dela reabre
  const fechando = destino.isDone && !task.completed
  const reabrindo = !destino.isDone && task.completed && vinculo.section?.isDone

  await db.$transaction([
    db.taskProject.update({ where: { id: vinculo.id }, data: { sectionId, order } }),
    ...(fechando || reabrindo
      ? [
          db.task.update({
            where: { id: taskId },
            data: fechando
              ? { completed: true, completedAt: new Date() }
              : { completed: false, completedAt: null },
          }),
        ]
      : []),
  ])

  revalidarTudo()
}

/// Concluir tem duas etapas de propósito, como no Asana: aqui a tarefa só muda
/// de cara, parada onde está. O pulo para a coluna de concluído é
/// recolherConcluida(), numa segunda chamada — assim dá tempo de ver o que
/// aconteceu e de desfazer, que é o caso de quem clicou errado.
export async function alternarConcluida(taskId: string) {
  if (semBanco()) {
    const e = await lerEstado()
    const alvo = e.tarefas.find((t) => t.id === taskId)
    if (!alvo) return
    const virando = !alvo.completed
    const regra = lerRepeticao(alvo.recurrence)

    await mutar((st) => {
      const t = st.tarefas.find((x) => x.id === taskId)!
      t.completed = virando

      // concluir tarefa que se repete faz a próxima nascer. Sem isso a
      // repetição seria só um rótulo bonito que não repete nada.
      if (virando && regra && t.dueAt) {
        const proxima = proximaData(regra, new Date(`${t.dueAt}T12:00:00`))
        const dias = t.startOn
          ? Math.round(
              (new Date(`${t.dueAt}T12:00:00`).getTime() -
                new Date(`${t.startOn}T12:00:00`).getTime()) /
                86400000,
            )
          : null
        const novoInicio = dias != null ? new Date(proxima) : null
        if (novoInicio && dias != null) novoInicio.setDate(proxima.getDate() - dias)

        st.tarefas.push({
          ...t,
          id: novoId(),
          completed: false,
          dueAt: proxima.toISOString().slice(0, 10),
          startOn: novoInicio ? novoInicio.toISOString().slice(0, 10) : null,
          quadros: t.quadros.map((q) => ({ ...q, order: q.order + 1 })),
          subtasks: t.subtasks.map((x) => ({ ...x, id: novoId(), completed: false })),
          blockedByIds: [],
        })
      }
    })
    await registrar(taskId, virando ? 'concluiu esta tarefa' : 'reabriu esta tarefa')
    revalidarTudo()
    return
  }

  const { task, workspace, user } = await tarefaDoWorkspace(taskId)
  const virando = !task.completed
  await db.task.update({
    where: { id: taskId },
    data: { completed: virando, completedAt: virando ? new Date() : null },
  })

  const regra = lerRepeticao(task.recurrence)
  if (virando && regra && task.dueAt) {
    const proxima = proximaData(regra, task.dueAt)
    const dias = task.startOn
      ? Math.round((task.dueAt.getTime() - task.startOn.getTime()) / 86400000)
      : null
    const novoInicio = dias != null ? new Date(proxima.getTime() - dias * 86400000) : null

    const valores = await db.taskFieldValue.findMany({ where: { taskId } })
    await db.task.create({
      data: {
        workspaceId: workspace.id,
        name: task.name,
        description: task.description,
        creatorId: user.id,
        assigneeId: task.assigneeId,
        brandId: task.brandId,
        startOn: novoInicio,
        dueAt: proxima,
        startTime: task.startTime,
        dueTime: task.dueTime,
        recurrence: task.recurrence,
        origin: task.origin,
        quadros: {
          create: task.quadros.map((q) => ({
            projectId: q.projectId,
            sectionId: q.sectionId,
            order: q.order + 1,
          })),
        },
        fieldValues: {
          create: valores.map((v) => ({ fieldId: v.fieldId, optionId: v.optionId })),
        },
      },
    })
  }

  revalidarTudo()
}

/// Segunda etapa: leva a tarefa concluída para a coluna de concluído DAQUELE
/// quadro. Precisa do projeto porque a mesma tarefa pode estar em vários, e
/// cada quadro tem a sua coluna de concluído.
export async function recolherConcluida(taskId: string, projectId: string) {
  if (semBanco()) {
    const e = await lerEstado()
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!tarefa?.completed) return
    const feito = e.secoes.find((s) => s.projectId === projectId && s.isDone)
    if (!feito) return
    await mutar((st) => {
      const q = st.tarefas.find((x) => x.id === taskId)!.quadros.find((x) => x.projectId === projectId)
      if (q) q.sectionId = feito.id
    })
    revalidarTudo()
    return
  }

  const { task } = await tarefaDoWorkspace(taskId)
  if (!task.completed) return
  const done = await db.section.findFirst({ where: { projectId, isDone: true } })
  const vinculo = task.quadros.find((q) => q.projectId === projectId)
  if (!done || !vinculo || vinculo.sectionId === done.id) return

  await db.taskProject.update({ where: { id: vinculo.id }, data: { sectionId: done.id } })
  revalidarTudo()
}

export async function renomearTarefa(taskId: string, name: string) {
  const limpo = name.trim()
  if (!limpo) return

  if (semBanco()) {
    const e = await lerEstado()
    if (!e.tarefas.some((t) => t.id === taskId)) return
    await mutar((st) => {
      st.tarefas.find((x) => x.id === taskId)!.name = limpo.slice(0, 300)
    })
    await registrar(taskId, `renomeou para "${limpo.slice(0, 60)}"`)
    revalidarTudo()
    return
  }

  await tarefaDoWorkspace(taskId)
  await db.task.update({ where: { id: taskId }, data: { name: limpo.slice(0, 300) } })
  revalidarTudo()
}

export async function apagarTarefa(taskId: string) {
  if (semBanco()) {
    const e = await lerEstado()
    if (!e.tarefas.some((t) => t.id === taskId)) return
    await mutar((st) => {
      st.tarefas = st.tarefas.filter((x) => x.id !== taskId)
      // ninguém pode continuar travado por uma tarefa que não existe mais
      for (const t of st.tarefas) t.blockedByIds = t.blockedByIds.filter((id) => id !== taskId)
    })
    revalidarTudo()
    return
  }

  await tarefaDoWorkspace(taskId)
  await db.task.delete({ where: { id: taskId } })
  revalidarTudo()
}

// ── a mesma tarefa em vários quadros ─────────────────────────────────────────

/// Anexa a tarefa a outro quadro. Não é cópia: é a MESMA tarefa aparecendo em
/// duas filas. Renomear, mudar prazo ou concluir vale nos dois lugares — que é
/// justamente o que faz o quadro do executor e o de quem acompanha não saírem
/// de sincronia.
export async function adicionarAQuadro(taskId: string, projectId: string) {
  if (semBanco()) {
    const e = await lerEstado()
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!tarefa || tarefa.quadros.some((q) => q.projectId === projectId)) return
    const primeira = e.secoes
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => a.order - b.order)[0]
    if (!primeira) return
    await mutar((st) => {
      st.tarefas
        .find((x) => x.id === taskId)!
        .quadros.push({ projectId, sectionId: primeira.id, order: 0 })
    })
    const projeto = e.projetos.find((p) => p.id === projectId)
    await registrar(taskId, `anexou esta tarefa ao quadro ${projeto?.name ?? projectId}`)
    revalidarTudo()
    return
  }

  const { task, workspace } = await tarefaDoWorkspace(taskId)
  if (task.quadros.some((q) => q.projectId === projectId)) return
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId: workspace.id } })
  if (!project) throw new Error('Projeto não encontrado')

  const primeira = await db.section.findFirst({ where: { projectId }, orderBy: { order: 'asc' } })
  await db.taskProject.create({
    data: { taskId, projectId, sectionId: primeira?.id ?? null, order: 0 },
  })
  revalidarTudo()
}

/// Tirar do quadro não apaga a tarefa — ela continua nos outros. Mas o último
/// vínculo não pode sair: tarefa fora de todo quadro sumiria da interface.
export async function removerDeQuadro(taskId: string, projectId: string) {
  if (semBanco()) {
    const e = await lerEstado()
    const tarefa = e.tarefas.find((t) => t.id === taskId)
    if (!tarefa || tarefa.quadros.length <= 1) return
    await mutar((st) => {
      const t = st.tarefas.find((x) => x.id === taskId)!
      t.quadros = t.quadros.filter((q) => q.projectId !== projectId)
    })
    const projeto = e.projetos.find((p) => p.id === projectId)
    await registrar(taskId, `tirou esta tarefa do quadro ${projeto?.name ?? projectId}`)
    revalidarTudo()
    return
  }

  const { task } = await tarefaDoWorkspace(taskId)
  if (task.quadros.length <= 1) return
  await db.taskProject.deleteMany({ where: { taskId, projectId } })
  revalidarTudo()
}

/// Cria uma tarefa a partir de uma forma do canvas e devolve o id, para o
/// desenho poder ficar vinculado a ela na hora. O nome vem do texto da forma.
export async function criarTarefaDoCanvas(projectId: string, nome: string) {
  const limpo = nome.trim().replace(/\s+/g, ' ').slice(0, 300)
  if (!limpo) return null

  if (semBanco()) {
    const e = await lerEstado()
    const secao = e.secoes
      .filter((s) => s.projectId === projectId && !s.isDone)
      .sort((a, b) => a.order - b.order)[0]
    if (!secao) return null
    const id = novoId()
    const ultima = Math.max(
      0,
      ...e.tarefas.flatMap((t) => t.quadros.filter((q) => q.sectionId === secao.id).map((q) => q.order)),
    )
    await mutar((st) => {
      st.tarefas.push({
        id,
        quadros: [{ projectId, sectionId: secao.id, order: ultima + 1000 }],
        name: limpo,
        description: null,
        brandId: null,
        assigneeId: MEMBROS[0].id,
        startOn: null,
        dueAt: null,
        startTime: null,
        dueTime: null,
        recurrence: null,
        completed: false,
        origin: 'canvas',
        fieldValues: [],
        blockedByIds: [],
        subtasks: [],
        comentarios: 0,
        alertas: 0,
      })
    })
    await registrar(id, 'criou esta tarefa a partir do canvas')
    revalidarTudo()
    return id
  }

  const { workspace, user } = await requireMembership()
  const secao = await db.section.findFirst({
    where: { projectId, isDone: false, project: { workspaceId: workspace.id } },
    orderBy: { order: 'asc' },
  })
  if (!secao) return null

  const ultima = await db.taskProject.findFirst({
    where: { sectionId: secao.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const criada = await db.task.create({
    data: {
      workspaceId: workspace.id,
      name: limpo,
      creatorId: user.id,
      origin: 'canvas',
      quadros: {
        create: { projectId, sectionId: secao.id, order: (ultima?.order ?? 0) + 1000 },
      },
    },
  })

  revalidarTudo()
  return criada.id
}
