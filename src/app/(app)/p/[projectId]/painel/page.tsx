import { AlertTriangle, CalendarOff, CircleCheck, Clock } from 'lucide-react'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, cn, startOfDay } from '@/lib/utils'

export default async function PainelPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const { workspace } = await requireMembership()

  const hoje = startOfDay(new Date())
  const em7 = addDays(hoje, 7)

  const tarefas = await db.task.findMany({
    where: { projectId, workspaceId: workspace.id, parentId: null },
    include: {
      brand: { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, avatarColor: true } },
      section: { select: { id: true, name: true } },
    },
  })

  const abertas = tarefas.filter((t) => !t.completed)
  const concluidas = tarefas.filter((t) => t.completed)
  const atrasadas = abertas.filter((t) => t.dueAt && startOfDay(t.dueAt) < hoje)
  const proximas = abertas.filter((t) => t.dueAt && startOfDay(t.dueAt) >= hoje && startOfDay(t.dueAt) <= em7)
  const semPrazo = abertas.filter((t) => !t.dueAt)

  const porSecao = agrupar(abertas, (t) => t.section?.id ?? 'sem', (t) => t.section?.name ?? 'Sem seção')
  const porMarca = agrupar(abertas, (t) => t.brand?.id ?? 'sem', (t) => t.brand?.name ?? 'Sem marca', (t) => t.brand?.color ?? null)
  const porPessoa = agrupar(
    abertas,
    (t) => t.assignee?.id ?? 'sem',
    (t) => t.assignee?.name ?? 'Sem responsável',
    (t) => t.assignee?.avatarColor ?? null,
  )

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* números — valor único não vira gráfico, vira número */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile icone={Clock} rotulo="Abertas" valor={abertas.length} />
          <Tile icone={CircleCheck} rotulo="Concluídas" valor={concluidas.length} tom="ok" />
          <Tile icone={AlertTriangle} rotulo="Atrasadas" valor={atrasadas.length} tom={atrasadas.length ? 'danger' : undefined} />
          <Tile icone={CalendarOff} rotulo="Sem prazo" valor={semPrazo.length} tom={semPrazo.length ? 'warn' : undefined} />
        </div>

        {/* prazo — estado, não categoria: cor de status sempre com ícone e rótulo */}
        <Cartao titulo="Situação do prazo" subtitulo={`${abertas.length} tarefas abertas`}>
          <Estado
            icone={AlertTriangle}
            rotulo="Atrasadas"
            valor={atrasadas.length}
            total={abertas.length}
            cor="var(--color-danger)"
          />
          <Estado
            icone={Clock}
            rotulo="Vencem em 7 dias"
            valor={proximas.length}
            total={abertas.length}
            cor="var(--color-warn)"
          />
          <Estado
            icone={CalendarOff}
            rotulo="Sem prazo definido"
            valor={semPrazo.length}
            total={abertas.length}
            cor="var(--color-faint)"
          />
        </Cartao>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* magnitude: uma cor só. A comparação está no comprimento, não no matiz. */}
          <Cartao titulo="Abertas por seção">
            <Barras dados={porSecao} corPadrao="var(--color-accent)" />
          </Cartao>

          {/* identidade: a cor pertence à marca, então ela pinta a própria barra */}
          <Cartao titulo="Abertas por marca">
            <Barras dados={porMarca} corPadrao="var(--color-faint)" />
          </Cartao>

          <Cartao titulo="Abertas por responsável">
            <Barras dados={porPessoa} corPadrao="var(--color-faint)" />
          </Cartao>

          <Cartao titulo="Entregues" subtitulo="últimas 10 concluídas">
            <ul className="space-y-1.5">
              {concluidas
                .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
                .slice(0, 10)
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-[12px]">
                    <CircleCheck className="h-3.5 w-3.5 shrink-0 text-ok" />
                    <span className="truncate text-soft">{t.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-faint">
                      {t.completedAt?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </li>
                ))}
              {concluidas.length === 0 && <li className="text-[12px] text-faint">Nada concluído ainda.</li>}
            </ul>
          </Cartao>
        </div>
      </div>
    </div>
  )
}

type Linha = { id: string; rotulo: string; valor: number; cor: string | null }

function agrupar<T>(
  itens: T[],
  chave: (t: T) => string,
  rotulo: (t: T) => string,
  cor?: (t: T) => string | null,
): Linha[] {
  const mapa = new Map<string, Linha>()
  for (const it of itens) {
    const k = chave(it)
    const atual = mapa.get(k)
    if (atual) atual.valor += 1
    else mapa.set(k, { id: k, rotulo: rotulo(it), valor: 1, cor: cor?.(it) ?? null })
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor)
}

function Cartao({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-[13px] font-semibold">{titulo}</h2>
      {subtitulo && <p className="mb-3 text-[11px] text-faint">{subtitulo}</p>}
      <div className={subtitulo ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

function Tile({
  icone: Icone,
  rotulo,
  valor,
  tom,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: number
  tom?: 'ok' | 'warn' | 'danger'
}) {
  const cor =
    tom === 'danger' ? 'text-danger' : tom === 'warn' ? 'text-warn' : tom === 'ok' ? 'text-ok' : 'text-ink'
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-faint">
        <Icone className={cn('h-3.5 w-3.5', cor)} />
        {rotulo}
      </div>
      <div className={cn('mt-1 text-3xl font-semibold tabular-nums', cor)}>{valor}</div>
    </div>
  )
}

function Estado({
  icone: Icone,
  rotulo,
  valor,
  total,
  cor,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: number
  total: number
  cor: string
}) {
  const pct = total ? (valor / total) * 100 : 0
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1 flex items-center gap-2 text-[12px]">
        <span style={{ color: cor }} className="flex shrink-0">
          <Icone className="h-3.5 w-3.5" />
        </span>
        <span className="text-soft">{rotulo}</span>
        <span className="ml-auto tabular-nums text-ink">{valor}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
      </div>
    </div>
  )
}

function Barras({ dados, corPadrao }: { dados: Linha[]; corPadrao: string }) {
  if (dados.length === 0) return <p className="text-[12px] text-faint">Nada aberto aqui.</p>
  const maior = Math.max(...dados.map((d) => d.valor))

  return (
    <ul className="space-y-2">
      {dados.map((d) => (
        <li key={d.id}>
          <div className="mb-1 flex items-center gap-2 text-[12px]">
            {d.cor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.cor }} />}
            <span className="truncate text-soft">{d.rotulo}</span>
            <span className="ml-auto shrink-0 tabular-nums text-ink">{d.valor}</span>
          </div>
          <div className="h-2 rounded-full bg-canvas">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.valor / maior) * 100}%`, background: d.cor ?? corPadrao }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
