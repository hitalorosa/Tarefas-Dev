'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldAlert, Sparkles, Settings, LogOut } from 'lucide-react'
import { IconeProjeto } from '@/components/ui/icones'
import { cn } from '@/lib/utils'

type Props = {
  workspace: { name: string }
  user: { name: string; email: string; color: string }
  projetos: { id: string; name: string; color: string; icon: string }[]
  alertas: number
}

export function Sidebar({ workspace, user, projetos, alertas }: Props) {
  const path = usePathname()

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
          P
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">{workspace.name}</div>
          <div className="text-[11px] leading-tight text-faint">Plano</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <Secao titulo="Projetos" />
        {projetos.map((p) => {
          return (
            <Item key={p.id} href={`/p/${p.id}`} ativo={path.startsWith(`/p/${p.id}`)}>
              <IconeProjeto nome={p.icon} className="h-4 w-4 shrink-0" />
              <span className="truncate">{p.name}</span>
              <span className="ml-auto h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
            </Item>
          )
        })}

        <Secao titulo="Equipe" />
        <Item href="/guardiao" ativo={path.startsWith('/guardiao')}>
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="truncate">Guardião</span>
          {alertas > 0 && (
            <span className="ml-auto rounded-full bg-danger-bg px-1.5 py-0.5 text-[10px] font-semibold text-danger">
              {alertas}
            </span>
          )}
        </Item>
        <Item href="/assistente" ativo={path.startsWith('/assistente')}>
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate">Assistente</span>
        </Item>
        <Item href="/config" ativo={path.startsWith('/config')}>
          <Settings className="h-4 w-4 shrink-0" />
          <span className="truncate">Configurações</span>
        </Item>
      </nav>

      <div className="flex items-center gap-2.5 border-t border-line px-3 py-3">
        <div
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
          style={{ background: user.color }}
        >
          {iniciais(user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium leading-tight">{user.name}</div>
          <div className="truncate text-[11px] leading-tight text-faint">{user.email}</div>
        </div>
        <form action="/api/sair" method="post">
          <button
            type="submit"
            title="Sair"
            className="grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:bg-hover hover:text-ink"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </aside>
  )
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <div className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-faint">{titulo}</div>
  )
}

function Item({
  href,
  ativo,
  children,
}: {
  href: string
  ativo: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
        ativo ? 'bg-accent-bg text-accent-ink' : 'text-soft hover:bg-hover hover:text-ink',
      )}
    >
      {children}
    </Link>
  )
}

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}
