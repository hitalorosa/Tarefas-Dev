import { Lock } from 'lucide-react'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, cn, startOfDay } from '@/lib/utils'
import { semBanco, tarefasComoPrisma } from '@/lib/estado'

const DIAS_VISIVEIS = 35
const LARGURA_NOME = 260

export default async function CronogramaPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { workspace } = await requireMembership()

  const hoje = startOfDay(new Date())
  const inicio = addDays(hoje, -7)
  const fim = addDays(inicio, DIAS_VISIVEIS - 1)

  const naJanela = (d: Date | null) => !!d && d >= inicio && d <= fim

  type Item = {
    id: string
    name: string
    completed: boolean
    startOn: Date | null
    dueAt: Date | null
    cor: string | null
    travadaPor: string[]
  }
  const bruto = semBanco()
    ? (await tarefasComoPrisma(projectId))
        .filter((t) => naJanela(t.dueAt) || naJanela(t.startOn))
        .sort((a, b) => (a.startOn?.getTime() ?? 0) - (b.startOn?.getTime() ?? 0))
    : await db.task.findMany({
        where: {
          workspaceId: workspace.id,
          quadros: { some: { projectId } },
          parentId: null,
          OR: [{ dueAt: { gte: inicio, lte: fim } }, { startOn: { gte: inicio, lte: fim } }],
        },
        orderBy: [{ startOn: 'asc' }, { dueAt: 'asc' }],
        include: {
          brand: { select: { color: true, name: true } },
          blockedBy: { include: { blocker: { select: { name: true, completed: true } } } },
        },
      })

  const tarefas: Item[] = bruto.map((t) => ({
    id: t.id,
    name: t.name,
    completed: t.completed,
    startOn: t.startOn,
    dueAt: t.dueAt,
    cor: t.brand?.color ?? null,
    travadaPor: t.blockedBy.filter((b) => !b.blocker.completed).map((b) => b.blocker.name),
  }))

  const dias = Array.from({ length: DIAS_VISIVEIS }, (_, i) => addDays(inicio, i))
  const indiceDe = (d: Date) => Math.round((startOfDay(d).getTime() - inicio.getTime()) / 86400000)
  const pct = (n: number) => `${(n / DIAS_VISIVEIS) * 100}%`

  if (tarefas.length === 0) {
    return (
      <div className="grid flex-1 place-items-center text-[13px] text-faint">
        Nenhuma tarefa com data nas próximas semanas.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[1000px] px-5 py-4">
        {/* régua de dias */}
        <div className="sticky top-0 z-10 mb-2 flex bg-canvas pb-1.5">
          <div style={{ width: LARGURA_NOME }} className="shrink-0 text-[11px] uppercase tracking-wider text-faint">
            Tarefa
          </div>
          <div className="relative flex-1">
            <div className="flex">
              {dias.map((d) => {
                const fds = d.getDay() === 0 || d.getDay() === 6
                const ehHoje = d.getTime() === hoje.getTime()
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      'flex-1 text-center text-[9px] leading-tight',
                      ehHoje ? 'font-semibold text-accent-ink' : fds ? 'text-faint/40' : 'text-faint',
                    )}
                  >
                    {d.getDate()}
                    {d.getDate() === 1 && (
                      <div className="text-[8px] uppercase">
                        {d.toLocaleDateString('pt-BR', { month: 'short' })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          {tarefas.map((t) => {
            const iniciaEm = t.startOn ?? t.dueAt
            const de = iniciaEm ? Math.max(0, indiceDe(iniciaEm)) : 0
            const ate = t.dueAt ? Math.min(DIAS_VISIVEIS - 1, indiceDe(t.dueAt)) : de
            const largura = Math.max(1, ate - de + 1)
            const travada = t.travadaPor
            const atrasada = !!t.dueAt && !t.completed && startOfDay(t.dueAt) < hoje

            return (
              <div key={t.id} className="flex items-center">
                <div
                  style={{ width: LARGURA_NOME }}
                  className={cn('shrink-0 truncate pr-3 text-[12px]', t.completed && 'text-soft line-through')}
                >
                  {t.name}
                </div>

                <div className="relative h-6 flex-1">
                  {/* fundo: listras de fim de semana e marca do dia de hoje */}
                  <div className="absolute inset-0 flex">
                    {dias.map((d) => {
                      const fds = d.getDay() === 0 || d.getDay() === 6
                      const ehHoje = d.getTime() === hoje.getTime()
                      return (
                        <div
                          key={d.toISOString()}
                          className={cn(
                            'flex-1 rounded-sm',
                            ehHoje ? 'bg-accent/10' : fds ? 'bg-surface/50' : 'bg-surface/20',
                          )}
                        />
                      )
                    })}
                  </div>

                  <div
                    title={`${t.name}${travada.length ? ` · travada por ${travada.join(', ')}` : ''}`}
                    className={cn(
                      'absolute top-0 flex h-6 items-center gap-1 overflow-hidden rounded-md px-1.5 text-[10px]',
                      t.completed
                        ? 'bg-surface text-faint line-through'
                        : atrasada
                          ? 'bg-danger-bg text-danger'
                          : 'bg-raised text-soft',
                    )}
                    style={{
                      left: pct(de),
                      width: pct(largura),
                      boxShadow: t.cor && !t.completed ? `inset 2px 0 0 ${t.cor}` : undefined,
                    }}
                  >
                    {travada.length > 0 && <Lock className="h-2.5 w-2.5 shrink-0 text-warn" />}
                    <span className="truncate">{t.name}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
