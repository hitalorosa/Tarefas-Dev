'use client'

import { useState, useTransition } from 'react'
import { Check, ChevronRight, ListTree, Lock, MessageSquare, TriangleAlert } from 'lucide-react'
import type { ColunaQuadro } from '@/lib/types'
import { cn, formatDayMonth } from '@/lib/utils'
import { alternarConcluida } from '@/app/(app)/actions'

export function ListaTarefas({ grupos }: { grupos: ColunaQuadro[] }) {
  const total = grupos.reduce((n, g) => n + g.tarefas.length, 0)

  if (total === 0) {
    return (
      <div className="grid flex-1 place-items-center text-[13px] text-faint">
        Nenhuma tarefa com esses filtros.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full min-w-[860px] border-collapse">
        <thead className="sticky top-0 z-10 bg-canvas">
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
            <th className="w-[45%] py-2 pl-5 pr-3 font-semibold">Tarefa</th>
            <th className="px-3 py-2 font-semibold">Responsável</th>
            <th className="px-3 py-2 font-semibold">Prazo</th>
            <th className="px-3 py-2 font-semibold">Marca</th>
            <th className="px-3 py-2 pr-5 font-semibold">Campos</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <Grupo key={g.id} grupo={g} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Grupo({ grupo }: { grupo: ColunaQuadro }) {
  const [aberto, setAberto] = useState(true)
  const abertas = grupo.tarefas.filter((t) => !t.completed).length

  return (
    <>
      <tr className="border-b border-line-soft bg-surface/40">
        <td colSpan={5} className="py-1.5 pl-3 pr-5">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-soft hover:text-ink"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', aberto && 'rotate-90')} />
            {grupo.cor && <span className="h-2 w-2 rounded-full" style={{ background: grupo.cor }} />}
            {grupo.name}
            <span className="font-normal text-faint">{abertas || ''}</span>
          </button>
        </td>
      </tr>

      {aberto &&
        grupo.tarefas.map((t) => {
          const vencimento = t.dueAt ? new Date(t.dueAt) : null
          const atrasada = !!vencimento && !t.completed && vencimento < new Date(new Date().toDateString())
          const travada = t.travadaPor.filter((b) => !b.completed)

          return (
            <tr key={t.id} className="group border-b border-line-soft hover:bg-surface/60">
              <td className="py-2 pl-5 pr-3">
                <div className="flex items-center gap-2.5">
                  <BotaoConcluir id={t.id} concluida={t.completed} />
                  <span className={cn('text-[13px]', t.completed && 'text-soft line-through')}>{t.name}</span>

                  <span className="flex items-center gap-2 text-[11px] text-faint">
                    {travada.length > 0 && (
                      <span
                        className="flex items-center gap-1 text-warn"
                        title={`Travada por: ${travada.map((b) => b.name).join(', ')}`}
                      >
                        <Lock className="h-3 w-3" />
                        {travada.length}
                      </span>
                    )}
                    {t.subtarefas.total > 0 && (
                      <span className="flex items-center gap-1">
                        <ListTree className="h-3 w-3" />
                        {t.subtarefas.feitas}/{t.subtarefas.total}
                      </span>
                    )}
                    {t.comentarios > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {t.comentarios}
                      </span>
                    )}
                    {t.alertas > 0 && (
                      <span className="flex items-center gap-1 text-danger">
                        <TriangleAlert className="h-3 w-3" />
                        {t.alertas}
                      </span>
                    )}
                  </span>
                </div>
              </td>

              <td className="px-3 py-2">
                {t.responsavel ? (
                  <span className="flex items-center gap-1.5 text-[12px] text-soft">
                    <span
                      className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold text-white"
                      style={{ background: t.responsavel.color }}
                    >
                      {t.responsavel.name.slice(0, 2).toUpperCase()}
                    </span>
                    {t.responsavel.name}
                  </span>
                ) : (
                  <span className="text-[12px] text-faint">—</span>
                )}
              </td>

              <td className="px-3 py-2">
                <span className={cn('text-[12px]', atrasada ? 'font-medium text-danger' : 'text-soft')}>
                  {vencimento ? formatDayMonth(vencimento) : '—'}
                </span>
              </td>

              <td className="px-3 py-2">
                {t.marca ? (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: t.marca.color, color: '#0b0c10' }}
                  >
                    {t.marca.name}
                  </span>
                ) : (
                  <span className="text-[12px] text-faint">—</span>
                )}
              </td>

              <td className="px-3 py-2 pr-5">
                <div className="flex flex-wrap gap-1">
                  {t.campos.map((c) => (
                    <span
                      key={`${c.fieldName}-${c.label}`}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        background: `${c.color}22`,
                        color: c.color,
                        boxShadow: `inset 0 0 0 1px ${c.color}44`,
                      }}
                    >
                      {c.label}
                    </span>
                  ))}
                  {t.campos.length === 0 && <span className="text-[12px] text-faint">—</span>}
                </div>
              </td>
            </tr>
          )
        })}
    </>
  )
}

function BotaoConcluir({ id, concluida }: { id: string; concluida: boolean }) {
  const [, startTransition] = useTransition()
  return (
    <button
      type="button"
      aria-label={concluida ? 'Reabrir tarefa' : 'Concluir tarefa'}
      onClick={() => startTransition(() => alternarConcluida(id))}
      className={cn(
        'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors',
        concluida ? 'border-ok bg-ok text-canvas' : 'border-faint text-transparent hover:border-ok hover:text-ok',
      )}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </button>
  )
}
