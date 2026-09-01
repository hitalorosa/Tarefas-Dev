'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, Check, Group, ListFilter, Plus, Search, Settings2, X } from 'lucide-react'
import { Menu, ItemMenu, SeparadorMenu, TituloMenu } from '@/components/ui/menu'
import { AGRUPAMENTOS, FILTROS_RAPIDOS, ORDENACOES, type FiltrosQuadro } from '@/lib/board-query'
import { cn } from '@/lib/utils'

export type OpcaoCampo = { id: string; label: string; color: string }
export type CampoDoProjeto = { id: string; name: string; type: string; options: OpcaoCampo[] }

export function BoardToolbar({
  filtros,
  marcas,
  campos,
}: {
  filtros: FiltrosQuadro
  marcas: { id: string; name: string; color: string }[]
  campos: CampoDoProjeto[]
}) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const [pendente, startTransition] = useTransition()
  const [buscando, setBuscando] = useState(!!filtros.busca)

  function aplicar(mudancas: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === null || v === '') p.delete(k)
      else p.set(k, v)
    }
    startTransition(() => router.replace(`${path}?${p.toString()}`, { scroll: false }))
  }

  function alternarRapido(id: string) {
    const atual = new Set(filtros.rapidos)
    atual.has(id) ? atual.delete(id) : atual.add(id)
    aplicar({ f: [...atual].join(',') || null })
  }

  const ativos =
    filtros.rapidos.length + (filtros.marca ? 1 : 0) + (filtros.campo ? 1 : 0) + (filtros.busca ? 1 : 0)

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-line px-5 py-2">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('plano:nova-tarefa'))}
        className="btn shrink-0 gap-1.5 whitespace-nowrap border border-line bg-raised px-2.5 py-1.5 text-[13px] text-ink hover:bg-hover"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar uma tarefa
      </button>

      <div className="ml-auto flex items-center gap-0.5">
        {buscando ? (
          <div className="mr-1 flex items-center gap-1.5 rounded-lg border border-line bg-raised px-2 py-1">
            <Search className="h-3.5 w-3.5 text-faint" />
            <input
              autoFocus
              defaultValue={filtros.busca}
              placeholder="Buscar tarefa"
              onKeyDown={(e) => {
                if (e.key === 'Enter') aplicar({ q: e.currentTarget.value })
                if (e.key === 'Escape') {
                  setBuscando(false)
                  aplicar({ q: null })
                }
              }}
              className="w-40 bg-transparent text-[13px] outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={() => {
                setBuscando(false)
                aplicar({ q: null })
              }}
              className="text-faint hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <BotaoBarra onClick={() => setBuscando(true)} icone={Search} rotulo="Buscar" apenasIcone />
        )}

        {/* FILTRAR */}
        <Menu
          alinhamento="direita"
          largura="w-72"
          gatilho={({ aberto }) => (
            <BotaoBarra icone={ListFilter} rotulo="Filtrar" ativo={aberto || ativos > 0} contador={ativos} />
          )}
        >
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Filtros</span>
            {ativos > 0 && (
              <button
                type="button"
                onClick={() => aplicar({ f: null, marca: null, cf: null, q: null })}
                className="text-[11px] text-soft hover:text-ink"
              >
                Apagar
              </button>
            )}
          </div>

          <TituloMenu>Filtros rápidos</TituloMenu>
          {FILTROS_RAPIDOS.map((r) => (
            <ItemMenu key={r.id} onClick={() => alternarRapido(r.id)}>
              <span className="flex items-center gap-2">
                <Caixa marcada={filtros.rapidos.includes(r.id)} />
                {r.rotulo}
              </span>
            </ItemMenu>
          ))}

          {marcas.length > 0 && (
            <>
              <SeparadorMenu />
              <TituloMenu>Marca</TituloMenu>
              {marcas.map((m) => (
                <ItemMenu
                  key={m.id}
                  onClick={() => aplicar({ marca: filtros.marca === m.id ? null : m.id })}
                >
                  <span className="flex items-center gap-2">
                    <Caixa marcada={filtros.marca === m.id} />
                    <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                    {m.name}
                  </span>
                </ItemMenu>
              ))}
            </>
          )}

          {campos
            .filter((c) => c.options.length > 0)
            .map((c) => (
              <div key={c.id}>
                <SeparadorMenu />
                <TituloMenu>{c.name}</TituloMenu>
                {c.options.map((o) => {
                  const marcado = filtros.campo?.fieldId === c.id && filtros.campo.optionId === o.id
                  return (
                    <ItemMenu
                      key={o.id}
                      onClick={() => aplicar({ cf: marcado ? null : `${c.id}:${o.id}` })}
                    >
                      <span className="flex items-center gap-2">
                        <Caixa marcada={marcado} />
                        <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />
                        {o.label}
                      </span>
                    </ItemMenu>
                  )
                })}
              </div>
            ))}
        </Menu>

        {/* ORDENAR */}
        <Menu
          alinhamento="direita"
          gatilho={({ aberto }) => (
            <BotaoBarra
              icone={ArrowUpDown}
              rotulo="Ordenar"
              ativo={aberto || filtros.ordenar !== 'manual'}
            />
          )}
        >
          {ORDENACOES.map((o) => (
            <ItemMenu key={o.id} onClick={() => aplicar({ ordenar: o.id === 'manual' ? null : o.id })}>
              <span className="flex items-center gap-2">
                <Check
                  className={cn('h-3.5 w-3.5', filtros.ordenar === o.id ? 'text-accent-ink' : 'opacity-0')}
                />
                {o.rotulo}
              </span>
            </ItemMenu>
          ))}
        </Menu>

        {/* AGRUPAR */}
        <Menu
          alinhamento="direita"
          gatilho={({ aberto }) => (
            <BotaoBarra icone={Group} rotulo="Agrupar" ativo={aberto || filtros.agrupar !== 'secao'} />
          )}
        >
          {AGRUPAMENTOS.map((g) => (
            <ItemMenu key={g.id} onClick={() => aplicar({ agrupar: g.id === 'secao' ? null : g.id })}>
              <span className="flex items-center gap-2">
                <Check
                  className={cn('h-3.5 w-3.5', filtros.agrupar === g.id ? 'text-accent-ink' : 'opacity-0')}
                />
                {g.rotulo}
              </span>
            </ItemMenu>
          ))}
          <SeparadorMenu />
          <div className="px-3 pb-2 text-[11px] leading-relaxed text-faint">
            Fora de “Seção” o quadro fica só de leitura — arrastar não teria onde salvar.
          </div>
        </Menu>

        {/* OPÇÕES */}
        <Menu
          alinhamento="direita"
          gatilho={({ aberto }) => <BotaoBarra icone={Settings2} rotulo="Opções" ativo={aberto} />}
        >
          <ItemMenu onClick={() => aplicar({ vazias: filtros.ocultarVazias ? null : 'ocultar' })}>
            <span className="flex items-center gap-2">
              <Caixa marcada={filtros.ocultarVazias} />
              Ocultar colunas vazias
            </span>
          </ItemMenu>
        </Menu>
      </div>

      {pendente && <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
    </div>
  )
}

function BotaoBarra({
  icone: Icone,
  rotulo,
  ativo,
  contador,
  apenasIcone,
  onClick,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  ativo?: boolean
  contador?: number
  apenasIcone?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={rotulo}
      className={cn(
        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] transition-colors',
        ativo ? 'bg-accent-bg text-accent-ink' : 'text-soft hover:bg-hover hover:text-ink',
      )}
    >
      <Icone className="h-3.5 w-3.5" />
      {!apenasIcone && rotulo}
      {contador ? (
        <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">{contador}</span>
      ) : null}
    </button>
  )
}

function Caixa({ marcada }: { marcada: boolean }) {
  return (
    <span
      className={cn(
        'grid h-3.5 w-3.5 shrink-0 place-items-center rounded border',
        marcada ? 'border-accent bg-accent text-white' : 'border-faint',
      )}
    >
      {marcada && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
    </span>
  )
}
