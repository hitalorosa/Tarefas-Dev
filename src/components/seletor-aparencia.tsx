'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { PALETA } from '@/lib/colors'
import { CHAVES_ICONE, IconeProjeto } from '@/components/ui/icones'
import { cn } from '@/lib/utils'
import { mudarCorProjeto, mudarIconeProjeto } from '@/app/(app)/projeto'

/// Cor e ícone do projeto no mesmo painel, com abas — é o formato do Asana e
/// evita dois menus separados para a mesma decisão de aparência.
export function SeletorAparencia({
  projectId,
  cor,
  icone,
}: {
  projectId: string
  cor: string
  icone: string
}) {
  const [aba, setAba] = useState<'cor' | 'icone'>('cor')
  const [, startTransition] = useTransition()

  return (
    <div className="w-[248px] px-2 pb-2">
      <div className="mb-2 flex gap-3 border-b border-line px-1">
        {(
          [
            ['cor', 'Cor'],
            ['icone', 'Ícone'],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={cn(
              'relative py-1.5 text-[12px] transition-colors',
              aba === id ? 'text-ink' : 'text-faint hover:text-soft',
            )}
          >
            {rotulo}
            {aba === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {aba === 'cor' ? (
        <div className="grid grid-cols-6 gap-1.5 px-1">
          {PALETA.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={p.nome}
              onClick={() => startTransition(() => mudarCorProjeto(projectId, p.hex))}
              className="grid h-8 w-8 place-items-center rounded-md transition-transform hover:scale-110"
              style={{ background: p.hex }}
            >
              {cor === p.hex && <Check className="h-4 w-4 text-canvas" strokeWidth={3} />}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto px-1">
          {CHAVES_ICONE.map((chave) => (
            <button
              key={chave}
              type="button"
              onClick={() => startTransition(() => mudarIconeProjeto(projectId, chave))}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-md transition-colors',
                icone === chave ? 'bg-accent text-white' : 'text-soft hover:bg-hover hover:text-ink',
              )}
            >
              <IconeProjeto nome={chave} className="h-4 w-4" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
