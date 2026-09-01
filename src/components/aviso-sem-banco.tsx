'use client'

import { useState } from 'react'
import { Database, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/// Faixa do modo sem banco. Diz onde os dados estão e o quanto do cookie já foi
/// usado — o teto de 4 KB não pode chegar de surpresa.
export function AvisoSemBanco({ uso }: { uso: { bytes: number; limite: number; pct: number } }) {
  const [fechado, setFechado] = useState(false)
  if (fechado) return null

  const apertado = uso.pct >= 80

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2.5 border-b px-5 py-1.5 text-[12px]',
        apertado ? 'border-warn/30 bg-warn-bg text-warn' : 'border-line bg-surface text-soft',
      )}
    >
      <Database className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        Sem banco de dados: tudo é salvo num cookie deste navegador.{' '}
        {apertado
          ? 'O espaço está acabando — ligue o Postgres para não ter esse teto.'
          : 'Funciona para montar a estrutura; some quando o Postgres entrar.'}
      </span>

      <span className="flex shrink-0 items-center gap-1.5" title={`${uso.bytes} de ${uso.limite} bytes`}>
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-canvas">
          <span
            className={cn('block h-full rounded-full', apertado ? 'bg-warn' : 'bg-accent')}
            style={{ width: `${uso.pct}%` }}
          />
        </span>
        <span className="tabular-nums">{uso.pct}%</span>
      </span>

      <button
        type="button"
        onClick={() => setFechado(true)}
        title="Esconder"
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
