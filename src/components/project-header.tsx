'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type Props = {
  projeto: { id: string; name: string; color: string }
  canvasId: string | null
  abertas: number
}

export function ProjectHeader({ projeto, canvasId, abertas }: Props) {
  const path = usePathname()
  const base = `/p/${projeto.id}`

  const abas = [
    { href: base, label: 'Quadro' },
    { href: `${base}/lista`, label: 'Lista' },
    { href: canvasId ? `${base}/canvas` : base, label: 'Canvas' },
  ]

  return (
    <header className="shrink-0 border-b border-line px-5 pt-3.5">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: projeto.color }} />
        <h1 className="text-[15px] font-semibold tracking-tight">{projeto.name}</h1>
        <span className="text-xs text-faint">
          {abertas} {abertas === 1 ? 'tarefa aberta' : 'tarefas abertas'}
        </span>
      </div>

      <nav className="mt-3 flex gap-1">
        {abas.map((a) => {
          const ativo = a.href === base ? path === base : path.startsWith(a.href)
          return (
            <Link
              key={a.label}
              href={a.href}
              className={cn(
                'relative px-3 py-2 text-[13px] transition-colors',
                ativo ? 'text-ink' : 'text-soft hover:text-ink',
              )}
            >
              {a.label}
              {ativo && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
