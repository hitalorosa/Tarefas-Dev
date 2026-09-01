import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { cn, startOfDay } from '@/lib/utils'
import { semBanco, tarefasComoPrisma } from '@/lib/estado'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default async function CalendarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { projectId } = await params
  const sp = await searchParams
  const { workspace } = await requireMembership()

  const alvo = typeof sp.m === 'string' && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : null
  const hoje = startOfDay(new Date())
  const base = alvo ? new Date(`${alvo}-01T00:00:00`) : new Date(hoje.getFullYear(), hoje.getMonth(), 1)

  const inicioMes = new Date(base.getFullYear(), base.getMonth(), 1)
  const fimMes = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59)
  const inicioGrade = new Date(inicioMes)
  inicioGrade.setDate(1 - inicioMes.getDay())

  const limite = new Date(fimMes.getTime() + 7 * 86400000)

  // formato local: os dois caminhos (banco e cookie) devolvem coisas diferentes,
  // e a vista só precisa deste punhado de campos
  type Item = { id: string; name: string; completed: boolean; dueAt: Date | null; cor: string | null }
  const tarefas: Item[] = semBanco()
    ? (await tarefasComoPrisma(projectId))
        .filter((t) => t.dueAt && t.dueAt >= inicioGrade && t.dueAt <= limite)
        .map((t) => ({ id: t.id, name: t.name, completed: t.completed, dueAt: t.dueAt, cor: t.brand?.color ?? null }))
    : (
        await db.task.findMany({
          where: { projectId, workspaceId: workspace.id, dueAt: { gte: inicioGrade, lte: limite } },
          orderBy: { dueAt: 'asc' },
          include: { brand: { select: { color: true } } },
        })
      ).map((t) => ({ id: t.id, name: t.name, completed: t.completed, dueAt: t.dueAt, cor: t.brand?.color ?? null }))

  const porDia = new Map<string, Item[]>()
  for (const t of tarefas) {
    if (!t.dueAt) continue
    const chave = t.dueAt.toISOString().slice(0, 10)
    if (!porDia.has(chave)) porDia.set(chave, [])
    porDia.get(chave)!.push(t)
  }

  const celulas = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicioGrade)
    d.setDate(inicioGrade.getDate() + i)
    return d
  })

  const mesAnterior = new Date(base.getFullYear(), base.getMonth() - 1, 1)
  const mesSeguinte = new Date(base.getFullYear(), base.getMonth() + 1, 1)
  const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-5 py-2">
        <h2 className="text-[13px] font-semibold capitalize">
          {base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href={`?m=${chaveMes(mesAnterior)}`}
            className="grid h-7 w-7 place-items-center rounded-lg text-soft hover:bg-hover hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={`?m=${chaveMes(hoje)}`}
            className="rounded-lg px-2.5 py-1 text-[12px] text-soft hover:bg-hover hover:text-ink"
          >
            Hoje
          </Link>
          <Link
            href={`?m=${chaveMes(mesSeguinte)}`}
            className="grid h-7 w-7 place-items-center rounded-lg text-soft hover:bg-hover hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-7 border-b border-line px-5 py-1.5">
        {DIAS.map((d) => (
          <div key={d} className="text-[11px] uppercase tracking-wider text-faint">
            {d}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px overflow-auto bg-line px-5 pb-4">
        {celulas.map((d) => {
          const chave = d.toISOString().slice(0, 10)
          const doMes = d.getMonth() === base.getMonth()
          const ehHoje = d.getTime() === hoje.getTime()
          const doDia = porDia.get(chave) ?? []

          return (
            <div
              key={chave}
              className={cn('min-h-24 bg-canvas p-1.5', !doMes && 'opacity-40')}
            >
              <div
                className={cn(
                  'mb-1 inline-grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px]',
                  ehHoje ? 'bg-accent font-semibold text-white' : 'text-faint',
                )}
              >
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {doDia.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    title={t.name}
                    className={cn(
                      'truncate rounded px-1.5 py-0.5 text-[11px]',
                      t.completed ? 'bg-surface text-faint line-through' : 'bg-raised text-soft',
                    )}
                    style={t.cor && !t.completed ? { boxShadow: `inset 2px 0 0 ${t.cor}` } : undefined}
                  >
                    {t.name}
                  </div>
                ))}
                {doDia.length > 3 && (
                  <div className="px-1.5 text-[10px] text-faint">+{doDia.length - 3}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
