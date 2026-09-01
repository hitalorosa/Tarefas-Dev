'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Calendar,
  Check,
  CircleUser,
  Lock,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import type { TarefaDetalhe } from '@/lib/task-data'
import { cn } from '@/lib/utils'
import { alternarConcluida, apagarTarefa, recolherConcluida, renomearTarefa } from '@/app/(app)/actions'
import { definirMarca, definirValorCampo } from '@/app/(app)/campos'
import {
  adicionarDependencia,
  adicionarSubtarefa,
  alternarSubtarefa,
  atualizarDescricaoTarefa,
  comentar,
  definirDatas,
  definirResponsavel,
  moverParaSecao,
  removerDependencia,
  removerSubtarefa,
} from '@/app/(app)/tarefa'

/// Abrir a tarefa é mudar a URL, não estado local: o link do painel aberto pode
/// ser mandado para alguém, e o voltar do navegador fecha.
export function useAbrirTarefa() {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()

  return (taskId: string) => {
    const p = new URLSearchParams(sp.toString())
    p.set('tarefa', taskId)
    router.push(`${path}?${p.toString()}`, { scroll: false })
  }
}

function useFecharTarefa() {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()

  return () => {
    const p = new URLSearchParams(sp.toString())
    p.delete('tarefa')
    router.push(p.size ? `${path}?${p.toString()}` : path, { scroll: false })
  }
}

const ESPERA_RECOLHER_MS = 2500

export function TaskPanel({ tarefa }: { tarefa: TarefaDetalhe }) {
  const fechar = useFecharTarefa()
  const [, startTransition] = useTransition()
  const recolhendo = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      if (recolhendo.current) clearTimeout(recolhendo.current)
    }
  }, [fechar])

  function concluir() {
    if (recolhendo.current) {
      clearTimeout(recolhendo.current)
      recolhendo.current = null
    }
    if (tarefa.completed) {
      startTransition(() => alternarConcluida(tarefa.id))
      return
    }
    startTransition(() => alternarConcluida(tarefa.id, false))
    recolhendo.current = setTimeout(() => {
      recolhendo.current = null
      startTransition(() => recolherConcluida(tarefa.id))
    }, ESPERA_RECOLHER_MS)
  }

  const travada = tarefa.travadaPor.filter((t) => !t.completed)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={fechar} />
      <aside className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[560px] flex-col border-l border-line bg-surface shadow-2xl">
        {/* cabeçalho */}
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
          <button
            type="button"
            onClick={concluir}
            className={cn(
              'btn gap-1.5 border px-2.5 py-1 text-[12px]',
              tarefa.completed
                ? 'border-ok/40 bg-ok-bg text-ok'
                : 'border-line text-soft hover:bg-hover hover:text-ink',
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
            {tarefa.completed ? 'Concluída' : 'Marcar como concluída'}
          </button>

          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              title="Excluir tarefa"
              onClick={() => {
                startTransition(() => apagarTarefa(tarefa.id))
                fechar()
              }}
              className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-danger-bg hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Fechar (Esc)"
              onClick={fechar}
              className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <TituloEditavel tarefa={tarefa} />

          <dl className="mb-5 space-y-0.5">
            <Linha icone={CircleUser} rotulo="Responsável">
              <Seletor
                valor={tarefa.responsavelId ?? ''}
                vazio="Ninguém"
                opcoes={tarefa.pessoas.map((p) => ({ id: p.id, label: p.name, cor: p.color }))}
                aoMudar={(v) => startTransition(() => definirResponsavel(tarefa.id, v || null))}
              />
            </Linha>

            <Linha icone={Calendar} rotulo="Datas">
              <Datas tarefa={tarefa} />
            </Linha>

            <Linha icone={Lock} rotulo="Dependências">
              <Dependencias tarefa={tarefa} />
            </Linha>

            <Linha icone={Tag} rotulo="Projeto">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tarefa.projeto.color }} />
                <span className="text-[13px] text-soft">{tarefa.projeto.name}</span>
                <Seletor
                  valor={tarefa.secao?.id ?? ''}
                  vazio="Sem seção"
                  opcoes={tarefa.secoes.map((s) => ({ id: s.id, label: s.name, cor: null }))}
                  aoMudar={(v) => v && startTransition(() => moverParaSecao(tarefa.id, v))}
                />
              </div>
            </Linha>

            <Linha icone={Tag} rotulo="Marca">
              <Seletor
                valor={tarefa.marcaId ?? ''}
                vazio="Sem marca"
                opcoes={tarefa.marcas.map((m) => ({ id: m.id, label: m.name, cor: m.color }))}
                aoMudar={(v) => startTransition(() => definirMarca(tarefa.id, v || null))}
              />
            </Linha>

            {tarefa.campos.map((c) => (
              <Linha key={c.id} icone={Tag} rotulo={c.name}>
                <Seletor
                  valor={c.valorId ?? ''}
                  vazio="—"
                  opcoes={c.options.map((o) => ({ id: o.id, label: o.label, cor: o.color }))}
                  aoMudar={(v) => startTransition(() => definirValorCampo(tarefa.id, c.id, v || null))}
                />
              </Linha>
            ))}
          </dl>

          {travada.length > 0 && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-warn-bg px-3 py-2 text-[12px] leading-relaxed text-warn">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Travada por {travada.map((t) => t.name).join(', ')}. Enquanto isso não terminar, esta não
                deveria andar.
              </span>
            </p>
          )}

          <Descricao tarefa={tarefa} />
          <Subtarefas tarefa={tarefa} />
          <Comentarios tarefa={tarefa} />
        </div>
      </aside>
    </>
  )
}

function TituloEditavel({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [, startTransition] = useTransition()
  return (
    <textarea
      key={tarefa.id}
      defaultValue={tarefa.name}
      rows={1}
      onBlur={(e) => {
        if (e.target.value.trim() && e.target.value !== tarefa.name) {
          startTransition(() => renomearTarefa(tarefa.id, e.target.value))
        }
      }}
      onInput={(e) => {
        const el = e.currentTarget
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }}
      className={cn(
        'mb-4 w-full resize-none rounded-lg bg-transparent px-2 py-1 text-[19px] font-semibold leading-snug outline-none hover:bg-hover focus:bg-canvas',
        tarefa.completed && 'text-soft line-through',
      )}
    />
  )
}

function Linha({
  icone: Icone,
  rotulo,
  children,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <dt className="flex w-36 shrink-0 items-center gap-1.5 text-[12px] text-faint">
        <Icone className="h-3.5 w-3.5" />
        {rotulo}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

function Seletor({
  valor,
  vazio,
  opcoes,
  aoMudar,
}: {
  valor: string
  vazio: string
  opcoes: { id: string; label: string; cor: string | null }[]
  aoMudar: (v: string) => void
}) {
  const atual = opcoes.find((o) => o.id === valor)
  return (
    <div className="flex items-center gap-1.5">
      {atual?.cor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: atual.cor }} />}
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="w-full cursor-pointer rounded-md bg-transparent px-1.5 py-1 text-[13px] text-ink outline-none hover:bg-hover focus:bg-canvas"
      >
        <option value="">{vazio}</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Datas({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [, startTransition] = useTransition()
  const salvar = (inicio: string | null, fim: string | null) =>
    startTransition(() => definirDatas(tarefa.id, inicio, fim))

  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <input
        type="date"
        defaultValue={tarefa.startOn ?? ''}
        onChange={(e) => salvar(e.target.value || null, tarefa.dueAt)}
        className="rounded-md bg-transparent px-1.5 py-1 text-ink outline-none hover:bg-hover focus:bg-canvas"
      />
      <span className="text-faint">até</span>
      <input
        type="date"
        defaultValue={tarefa.dueAt ?? ''}
        onChange={(e) => salvar(tarefa.startOn, e.target.value || null)}
        className="rounded-md bg-transparent px-1.5 py-1 text-ink outline-none hover:bg-hover focus:bg-canvas"
      />
    </div>
  )
}

function Dependencias({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [, startTransition] = useTransition()
  const [adicionando, setAdicionando] = useState(false)
  const abrir = useAbrirTarefa()

  return (
    <div className="space-y-1">
      {tarefa.travadaPor.map((t) => (
        <div key={t.id} className="group/dep flex items-center gap-1.5 text-[13px]">
          {t.completed ? (
            <Unlock className="h-3 w-3 shrink-0 text-ok" />
          ) : (
            <Lock className="h-3 w-3 shrink-0 text-warn" />
          )}
          <button
            type="button"
            onClick={() => abrir(t.id)}
            className={cn('truncate text-left hover:underline', t.completed ? 'text-faint line-through' : 'text-soft')}
          >
            {t.name}
          </button>
          <button
            type="button"
            title="Remover dependência"
            onClick={() => startTransition(() => removerDependencia(tarefa.id, t.id))}
            className="ml-auto shrink-0 text-faint opacity-0 hover:text-danger group-hover/dep:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {tarefa.travando.length > 0 && (
        <p className="text-[11px] text-faint">
          {tarefa.travando.length === 1 ? 'Uma tarefa espera' : `${tarefa.travando.length} tarefas esperam`} por
          esta.
        </p>
      )}

      {adicionando ? (
        <select
          autoFocus
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) startTransition(() => adicionarDependencia(tarefa.id, e.target.value))
            setAdicionando(false)
          }}
          onBlur={() => setAdicionando(false)}
          className="field py-1 text-[12px]"
        >
          <option value="">Escolha a tarefa que trava esta…</option>
          {tarefa.candidatas
            .filter((c) => !tarefa.travadaPor.some((t) => t.id === c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      ) : (
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          className="flex items-center gap-1 text-[12px] text-faint hover:text-soft"
        >
          <Plus className="h-3 w-3" />
          {tarefa.travadaPor.length ? 'Adicionar outra' : 'Adicionar dependência'}
        </button>
      )}
    </div>
  )
}

function Descricao({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [texto, setTexto] = useState(tarefa.description)
  const [sujo, setSujo] = useState(false)
  const [pendente, startTransition] = useTransition()

  useEffect(() => {
    setTexto(tarefa.description)
    setSujo(false)
  }, [tarefa.id, tarefa.description])

  return (
    <section className="mb-5">
      <h3 className="mb-1.5 text-[12px] font-semibold text-soft">Descrição</h3>
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setSujo(true)
        }}
        rows={texto ? Math.min(20, texto.split('\n').length + 1) : 3}
        placeholder="Contexto, oferta, estrutura, o que é entregar isso…"
        className="field resize-y font-mono text-[12px] leading-relaxed"
      />
      {sujo && (
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              startTransition(async () => {
                await atualizarDescricaoTarefa(tarefa.id, texto)
                setSujo(false)
              })
            }
            className="btn bg-accent px-2.5 py-1 text-[12px] text-white hover:bg-accent/90"
          >
            {pendente ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto(tarefa.description)
              setSujo(false)
            }}
            className="btn px-2 py-1 text-[12px] text-soft hover:text-ink"
          >
            Cancelar
          </button>
        </div>
      )}
    </section>
  )
}

function Subtarefas({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [, startTransition] = useTransition()
  const [nova, setNova] = useState('')
  const feitas = tarefa.subtarefas.filter((s) => s.completed).length

  return (
    <section className="mb-5">
      <h3 className="mb-1.5 text-[12px] font-semibold text-soft">
        Subtarefas{' '}
        {tarefa.subtarefas.length > 0 && (
          <span className="font-normal text-faint">
            {feitas}/{tarefa.subtarefas.length}
          </span>
        )}
      </h3>

      <div className="space-y-0.5">
        {tarefa.subtarefas.map((s) => (
          <div key={s.id} className="group/sub flex items-center gap-2 rounded-md px-1 py-1 hover:bg-hover">
            <button
              type="button"
              onClick={() => startTransition(() => alternarSubtarefa(tarefa.id, s.id))}
              className={cn(
                'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors',
                s.completed
                  ? 'border-ok bg-ok text-canvas'
                  : 'border-faint text-transparent hover:border-ok hover:text-ok',
              )}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </button>
            <span className={cn('flex-1 text-[13px]', s.completed && 'text-faint line-through')}>{s.name}</span>
            <button
              type="button"
              title="Remover"
              onClick={() => startTransition(() => removerSubtarefa(tarefa.id, s.id))}
              className="shrink-0 text-faint opacity-0 hover:text-danger group-hover/sub:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          placeholder="Adicionar subtarefa"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && nova.trim()) {
              startTransition(() => adicionarSubtarefa(tarefa.id, nova))
              setNova('')
            }
          }}
          className="field py-1 text-[12px]"
        />
        <button
          type="button"
          disabled={!nova.trim()}
          onClick={() => {
            startTransition(() => adicionarSubtarefa(tarefa.id, nova))
            setNova('')
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-white disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  )
}

function Comentarios({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [, startTransition] = useTransition()
  const [texto, setTexto] = useState('')

  return (
    <section className="border-t border-line pt-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-soft">
        <MessageSquare className="h-3.5 w-3.5" />
        Comentários
      </h3>

      {tarefa.comentarios.map((c) => (
        <div key={c.id} className="mb-3 flex gap-2.5">
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white"
            style={{ background: c.cor }}
          >
            {c.autor.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[12px] font-medium">{c.autor}</span>
              <span className="text-[11px] text-faint">{c.quando}</span>
            </div>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-soft">{c.corpo}</p>
          </div>
        </div>
      ))}

      {tarefa.comentarioSuportado ? (
        <div className="flex items-start gap-1.5">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="Escrever um comentário"
            className="field resize-none text-[13px]"
          />
          <button
            type="button"
            disabled={!texto.trim()}
            onClick={() => {
              startTransition(() => comentar(tarefa.id, texto))
              setTexto('')
            }}
            className="btn shrink-0 bg-accent px-2.5 py-2 text-[12px] text-white disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-[12px] leading-relaxed text-faint">
          Comentário precisa de banco de dados — não cabe no cookie de 4 KB.
        </p>
      )}
    </section>
  )
}
