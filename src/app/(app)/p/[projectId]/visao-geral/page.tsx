import { notFound } from 'next/navigation'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { MEMBROS, lerEstado, semBanco, tarefasComoPrisma } from '@/lib/estado'
import { DescricaoProjeto } from '@/components/descricao-projeto'
import { startOfDay } from '@/lib/utils'

type Dados = {
  id: string
  name: string
  description: string | null
  secoes: { id: string; name: string; isDone: boolean }[]
  campos: { id: string; name: string; options: { id: string; label: string; color: string }[] }[]
  abertas: number
  concluidas: number
  atrasadas: number
  semData: number
  membros: { id: string; role: string; name: string; email: string; color: string }[]
  recentes: { id: string; name: string; completed: boolean; updatedAt: Date }[]
}

export default async function VisaoGeralPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const d = semBanco() ? await doCookie(projectId) : await doBanco(projectId)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <section className="mb-6">
          <h2 className="mb-2 text-[13px] font-semibold">Descrição do projeto</h2>
          <DescricaoProjeto projectId={d.id} descricao={d.description ?? ''} />
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero rotulo="Abertas" valor={d.abertas} />
          <Numero rotulo="Concluídas" valor={d.concluidas} />
          <Numero rotulo="Atrasadas" valor={d.atrasadas} tom={d.atrasadas > 0 ? 'danger' : undefined} />
          <Numero rotulo="Sem prazo" valor={d.semData} tom={d.semData > 0 ? 'warn' : undefined} />
        </section>

        <div className="grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[13px] font-semibold">Seções</h2>
            <ul className="space-y-1">
              {d.secoes.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-[13px]"
                >
                  {s.name}
                  {s.isDone && (
                    <span className="ml-auto rounded bg-ok-bg px-1.5 py-0.5 text-[10px] text-ok">concluído</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-[13px] font-semibold">Campos</h2>
            <ul className="space-y-1">
              {d.campos.map((c) => (
                <li key={c.id} className="rounded-lg border border-line bg-raised px-3 py-2">
                  <div className="text-[13px]">{c.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.options.map((o) => (
                      <span key={o.id} className="flex items-center gap-1 text-[11px] text-soft">
                        <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />
                        {o.label}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
              {d.campos.length === 0 && (
                <li className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-faint">
                  Nenhum campo. Adicione em Personalizar.
                </li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-[13px] font-semibold">Pessoas</h2>
            <ul className="space-y-1">
              {d.membros.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-raised px-3 py-2"
                >
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white"
                    style={{ background: m.color }}
                  >
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{m.name}</span>
                    <span className="block truncate text-[11px] text-faint">{m.email}</span>
                  </span>
                  <span className="text-[11px] text-faint">{m.role}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-[13px] font-semibold">Mexido por último</h2>
            <ul className="space-y-1">
              {d.recentes.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-[13px]"
                >
                  <span className={t.completed ? 'text-soft line-through' : ''}>{t.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-faint">
                    {t.updatedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </li>
              ))}
              {d.recentes.length === 0 && (
                <li className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-faint">
                  Nada ainda.
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

async function doCookie(projectId: string): Promise<Dados> {
  const e = await lerEstado()
  const projeto = e.projetos.find((p) => p.id === projectId)
  if (!projeto) notFound()

  const hoje = startOfDay(new Date())
  const tarefas = await tarefasComoPrisma(projectId)
  const abertas = tarefas.filter((t) => !t.completed)

  return {
    id: projeto.id,
    name: projeto.name,
    description: projeto.description,
    secoes: e.secoes
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, name: s.name, isDone: s.isDone })),
    campos: e.campos
      .filter((c) => c.projetos.includes(projectId))
      .map((c) => ({ id: c.id, name: c.name, options: c.options })),
    abertas: abertas.length,
    concluidas: tarefas.filter((t) => t.completed).length,
    atrasadas: abertas.filter((t) => t.dueAt && startOfDay(t.dueAt) < hoje).length,
    semData: abertas.filter((t) => !t.dueAt).length,
    membros: MEMBROS.map((m) => ({
      id: m.id,
      role: m.role,
      name: m.user.name,
      email: m.user.email,
      color: m.user.avatarColor,
    })),
    recentes: [...tarefas]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 6)
      .map((t) => ({ id: t.id, name: t.name, completed: t.completed, updatedAt: t.updatedAt })),
  }
}

async function doBanco(projectId: string): Promise<Dados> {
  const { workspace } = await requireMembership()

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: {
      sections: { orderBy: { order: 'asc' }, select: { id: true, name: true, isDone: true } },
      fields: { include: { field: { include: { options: true } } } },
    },
  })
  if (!project) notFound()

  const hoje = startOfDay(new Date())
  const [abertas, concluidas, atrasadas, semData, membros, recentes] = await Promise.all([
    db.task.count({ where: { quadros: { some: { projectId } }, completed: false, parentId: null } }),
    db.task.count({ where: { quadros: { some: { projectId } }, completed: true } }),
    db.task.count({ where: { quadros: { some: { projectId } }, completed: false, dueAt: { lt: hoje } } }),
    db.task.count({
      where: { quadros: { some: { projectId } }, completed: false, dueAt: null, parentId: null },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { name: true, email: true, avatarColor: true } } },
    }),
    db.task.findMany({
      where: { quadros: { some: { projectId } } },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: { id: true, name: true, completed: true, updatedAt: true },
    }),
  ])

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    secoes: project.sections,
    campos: project.fields.map((pf) => ({
      id: pf.field.id,
      name: pf.field.name,
      options: pf.field.options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
    })),
    abertas,
    concluidas,
    atrasadas,
    semData,
    membros: membros.map((m) => ({
      id: m.id,
      role: m.role,
      name: m.user.name,
      email: m.user.email,
      color: m.user.avatarColor,
    })),
    recentes,
  }
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: 'danger' | 'warn' }) {
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2.5">
      <div
        className={
          tom === 'danger'
            ? 'text-2xl font-semibold text-danger'
            : tom === 'warn'
              ? 'text-2xl font-semibold text-warn'
              : 'text-2xl font-semibold'
        }
      >
        {valor}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-faint">{rotulo}</div>
    </div>
  )
}
