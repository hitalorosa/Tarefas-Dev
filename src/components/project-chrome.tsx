'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ChevronDown, Palette, Plus, Settings2, Share2, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PALETA } from '@/lib/colors'
import { Menu, ItemMenu, SeparadorMenu, TituloMenu } from '@/components/ui/menu'
import { CustomizePanel, type CampoPainel } from '@/components/customize-panel'
import { alternarFavorito, arquivarProjeto, definirStatus, mudarCorProjeto, renomearProjeto } from '@/app/(app)/projeto'

const STATUS = [
  { id: 'em_dia', rotulo: 'Em dia', cor: '#51cf66' },
  { id: 'em_risco', rotulo: 'Em risco', cor: '#fcc419' },
  { id: 'atrasado', rotulo: 'Atrasado', cor: '#ff6b6b' },
  { id: 'pausado', rotulo: 'Pausado', cor: '#868e96' },
] as const

export type ProjetoChrome = {
  id: string
  name: string
  color: string
  status: string | null
  statusNote: string | null
  favorito: boolean
}

export function ProjectChrome({
  projeto,
  membros,
  campos,
  disponiveis,
  abertas,
}: {
  projeto: ProjetoChrome
  membros: { name: string; color: string }[]
  campos: CampoPainel[]
  disponiveis: { id: string; name: string; type: string }[]
  abertas: number
}) {
  const path = usePathname()
  const [personalizar, setPersonalizar] = useState(false)
  const [renomeando, setRenomeando] = useState(false)
  const [, startTransition] = useTransition()

  const base = `/p/${projeto.id}`
  const abas = [
    { href: base, rotulo: 'Quadro', exato: true },
    { href: `${base}/visao-geral`, rotulo: 'Visão geral' },
    { href: `${base}/lista`, rotulo: 'Lista' },
    { href: `${base}/cronograma`, rotulo: 'Cronograma' },
    { href: `${base}/painel`, rotulo: 'Painel' },
    { href: `${base}/calendario`, rotulo: 'Calendário' },
    { href: `${base}/canvas`, rotulo: 'Canvas' },
  ]

  const status = STATUS.find((s) => s.id === projeto.status)

  return (
    <>
      <header className="shrink-0 border-b border-line px-5 pt-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: projeto.color }} />

          {renomeando ? (
            <input
              autoFocus
              defaultValue={projeto.name}
              onBlur={(e) => {
                startTransition(() => renomearProjeto(projeto.id, e.target.value))
                setRenomeando(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setRenomeando(false)
              }}
              className="rounded border border-accent bg-canvas px-1.5 py-0.5 text-[15px] font-semibold outline-none"
            />
          ) : (
            <Menu
              gatilho={() => (
                <button className="flex items-center gap-1 rounded px-1 py-0.5 text-[15px] font-semibold tracking-tight hover:bg-hover">
                  {projeto.name}
                  <ChevronDown className="h-3.5 w-3.5 text-faint" />
                </button>
              )}
            >
              <ItemMenu onClick={() => setRenomeando(true)}>Renomear projeto</ItemMenu>
              <ItemMenu icone={Settings2} onClick={() => setPersonalizar(true)}>
                Personalizar
              </ItemMenu>
              <SeparadorMenu />
              <TituloMenu>Cor</TituloMenu>
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {PALETA.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    title={p.nome}
                    onClick={() => startTransition(() => mudarCorProjeto(projeto.id, p.hex))}
                    className="h-4 w-4 rounded-full hover:scale-125"
                    style={{ background: p.hex }}
                  />
                ))}
              </div>
              <SeparadorMenu />
              <ItemMenu icone={Trash2} perigo onClick={() => startTransition(() => arquivarProjeto(projeto.id))}>
                Arquivar projeto
              </ItemMenu>
            </Menu>
          )}

          <button
            type="button"
            title={projeto.favorito ? 'Tirar dos favoritos' : 'Marcar como favorito'}
            onClick={() => startTransition(() => alternarFavorito(projeto.id))}
            className={cn(
              'grid h-6 w-6 place-items-center rounded transition-colors',
              projeto.favorito ? 'text-warn' : 'text-faint hover:text-soft',
            )}
          >
            <Star className="h-4 w-4" fill={projeto.favorito ? 'currentColor' : 'none'} />
          </button>

          <Menu
            largura="w-52"
            gatilho={() => (
              <button className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[12px] text-soft hover:bg-hover">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: status?.cor ?? 'transparent', boxShadow: status ? undefined : 'inset 0 0 0 1px #5f677a' }}
                />
                {status?.rotulo ?? 'Definir status'}
              </button>
            )}
          >
            {STATUS.map((s) => (
              <ItemMenu key={s.id} onClick={() => startTransition(() => definirStatus(projeto.id, s.id))}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.cor }} />
                  {s.rotulo}
                </span>
              </ItemMenu>
            ))}
            {projeto.status && (
              <>
                <SeparadorMenu />
                <ItemMenu onClick={() => startTransition(() => definirStatus(projeto.id, null))}>
                  Limpar status
                </ItemMenu>
              </>
            )}
          </Menu>

          <span className="ml-1 hidden whitespace-nowrap text-xs text-faint lg:inline">
            {abertas} {abertas === 1 ? 'tarefa aberta' : 'tarefas abertas'}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {membros.slice(0, 5).map((m, i) => (
                <span
                  key={i}
                  title={m.name}
                  className="grid h-6 w-6 place-items-center rounded-full border-2 border-canvas text-[9px] font-semibold text-white"
                  style={{ background: m.color }}
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </span>
              ))}
              {membros.length > 5 && (
                <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-canvas bg-raised text-[9px] text-soft">
                  +{membros.length - 5}
                </span>
              )}
            </div>

            <button
              type="button"
              className="btn shrink-0 gap-1.5 whitespace-nowrap border border-line bg-raised px-2.5 py-1 text-[12px] hover:bg-hover"
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartilhar
            </button>

            <button
              type="button"
              onClick={() => setPersonalizar(true)}
              className="btn shrink-0 gap-1.5 whitespace-nowrap border border-line bg-raised px-2.5 py-1 text-[12px] hover:bg-hover"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Personalizar
            </button>
          </div>
        </div>

        <nav className="mt-2.5 flex items-center gap-0.5 overflow-x-auto">
          {abas.map((a) => {
            const ativo = a.exato ? path === a.href : path.startsWith(a.href)
            return (
              <Link
                key={a.href}
                href={a.href}
                className={cn(
                  'relative shrink-0 px-3 py-2 text-[13px] transition-colors',
                  ativo ? 'text-ink' : 'text-soft hover:text-ink',
                )}
              >
                {a.rotulo}
                {ativo && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
              </Link>
            )
          })}
          <button
            type="button"
            title="Adicionar vista"
            className="ml-1 grid h-6 w-6 shrink-0 place-items-center rounded text-faint hover:bg-hover hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </nav>
      </header>

      <CustomizePanel
        projectId={projeto.id}
        campos={campos}
        disponiveis={disponiveis}
        aberto={personalizar}
        fechar={() => setPersonalizar(false)}
      />
    </>
  )
}
