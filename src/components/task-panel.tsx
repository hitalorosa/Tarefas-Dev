'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDashed,
  Link2,
  Lock,
  Paperclip,
  Plus,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import type { TarefaDetalhe } from '@/lib/task-data'
import { IconeProjeto } from '@/components/ui/icones'
import { SeletorData } from '@/components/seletor-data'
import { CanvasDaTarefa } from '@/components/canvas-da-tarefa'
import { cn, formatarPrazo, formatarQuando } from '@/lib/utils'
import {
  adicionarAQuadro,
  alternarConcluida,
  apagarTarefa,
  recolherConcluida,
  removerDeQuadro,
  renomearTarefa,
} from '@/app/(app)/actions'
import { definirMarca, definirValorCampo } from '@/app/(app)/campos'
import {
  adicionarDependencia,
  adicionarSubtarefa,
  alternarSubtarefa,
  atualizarDescricaoTarefa,
  comentar,
  definirDatas,
  definirRepeticao,
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
    startTransition(() => alternarConcluida(tarefa.id))
    recolhendo.current = setTimeout(() => {
      recolhendo.current = null
      startTransition(() => recolherConcluida(tarefa.id, tarefa.quadros[0]?.projectId ?? ''))
    }, ESPERA_RECOLHER_MS)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={fechar} />
      <aside className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[620px] flex-col border-l border-line bg-surface shadow-2xl">
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
              title="Copiar link da tarefa"
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink"
            >
              <Link2 className="h-4 w-4" />
            </button>
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

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <TituloEditavel tarefa={tarefa} />

          <div className="mb-5 space-y-2.5">
            <Linha rotulo="Responsável">
              <EscolhaPessoa tarefa={tarefa} />
            </Linha>

            <Linha rotulo="Data de conclusão">
              <EscolhaDatas tarefa={tarefa} />
            </Linha>

            <Linha rotulo="Dependências" alinharAoTopo>
              <Dependencias tarefa={tarefa} />
            </Linha>
          </div>

          <BlocoProjeto tarefa={tarefa} />
          <Descricao tarefa={tarefa} />
          <Subtarefas tarefa={tarefa} />
          <CanvasDaTarefa
            taskId={tarefa.id}
            projectId={tarefa.quadros[0]?.projectId ?? ''}
            nome={tarefa.name}
          />
          <Anexos />
          <Atividade tarefa={tarefa} />
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
        '-ml-2 mb-5 w-[calc(100%+1rem)] resize-none overflow-hidden rounded-lg bg-transparent px-2 py-1 text-[21px] font-semibold leading-tight outline-none hover:bg-hover focus:bg-canvas',
        tarefa.completed && 'text-soft line-through',
      )}
    />
  )
}

function Linha({
  rotulo,
  children,
  alinharAoTopo,
}: {
  rotulo: string
  children: React.ReactNode
  alinharAoTopo?: boolean
}) {
  return (
    <div className={cn('flex gap-3', alinharAoTopo ? 'items-start' : 'items-center')}>
      <span className={cn('w-[132px] shrink-0 text-[12px] text-faint', alinharAoTopo && 'pt-1')}>
        {rotulo}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function EscolhaPessoa({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [, startTransition] = useTransition()
  const [abrindo, setAbrindo] = useState(false)
  const atual = tarefa.pessoas.find((p) => p.id === tarefa.responsavelId)

  if (abrindo) {
    return (
      <select
        autoFocus
        defaultValue={tarefa.responsavelId ?? ''}
        onBlur={() => setAbrindo(false)}
        onChange={(e) => {
          startTransition(() => definirResponsavel(tarefa.id, e.target.value || null))
          setAbrindo(false)
        }}
        className="field py-1 text-[13px]"
      >
        <option value="">Ninguém</option>
        {tarefa.pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    )
  }

  if (!atual) {
    return (
      <button
        type="button"
        onClick={() => setAbrindo(true)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-faint hover:bg-hover hover:text-soft"
      >
        <CircleDashed className="h-4 w-4" />
        Ninguém
      </button>
    )
  }

  return (
    <span className="group/p flex items-center gap-2">
      <button
        type="button"
        onClick={() => setAbrindo(true)}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-hover"
      >
        <span
          className="grid h-[22px] w-[22px] place-items-center rounded-full text-[9px] font-semibold text-white"
          style={{ background: atual.color }}
        >
          {atual.name.slice(0, 2).toUpperCase()}
        </span>
        {atual.name}
      </button>
      <button
        type="button"
        title="Tirar responsável"
        onClick={() => startTransition(() => definirResponsavel(tarefa.id, null))}
        className="text-faint opacity-0 transition-opacity hover:text-ink group-hover/p:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

function EscolhaDatas({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [, startTransition] = useTransition()
  return (
    <SeletorData
      inicio={tarefa.startOn}
      fim={tarefa.dueAt}
      horaInicio={tarefa.startTime}
      hora={tarefa.dueTime}
      repeticao={tarefa.recurrence}
      aoMudarDatas={(inicio, fimData, hora, horaIni) =>
        startTransition(() => definirDatas(tarefa.id, inicio, fimData, hora, horaIni))
      }
      aoMudarRepeticao={(regra) => startTransition(() => definirRepeticao(tarefa.id, regra))}
    />
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
            <Unlock className="h-3.5 w-3.5 shrink-0 text-ok" />
          ) : (
            <Lock className="h-3.5 w-3.5 shrink-0 text-warn" />
          )}
          <button
            type="button"
            onClick={() => abrir(t.id)}
            className={cn(
              'truncate text-left hover:underline',
              t.completed ? 'text-faint line-through' : 'text-soft',
            )}
          >
            {t.name}
          </button>
          <button
            type="button"
            title="Remover dependência"
            onClick={() => startTransition(() => removerDependencia(tarefa.id, t.id))}
            className="ml-auto shrink-0 text-faint opacity-0 hover:text-danger group-hover/dep:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {tarefa.travando.length > 0 && (
        <p className="text-[11px] text-faint">
          {tarefa.travando.length === 1
            ? 'Uma tarefa espera'
            : `${tarefa.travando.length} tarefas esperam`}{' '}
          por esta.
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
          className="rounded-md px-1.5 py-1 text-left text-[13px] text-faint hover:bg-hover hover:text-soft"
        >
          {tarefa.travadaPor.length ? 'Adicionar outra dependência' : 'Adicionar dependências'}
        </button>
      )}
    </div>
  )
}

/// Lista de quadros onde a tarefa aparece. É A MESMA tarefa em cada um: mudar
/// nome, prazo ou concluir vale em todos. Só a seção é por quadro, porque cada
/// fila se organiza do seu jeito. Os campos ficam aninhados aqui embaixo.
function BlocoProjeto({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [, startTransition] = useTransition()
  const [aberto, setAberto] = useState(true)
  const [anexando, setAnexando] = useState(false)

  return (
    <section className="mb-5 rounded-lg border border-line">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-[12px] font-semibold">Projetos</span>
        <span className="text-[11px] text-faint">{tarefa.quadros.length}</span>
        {tarefa.quadrosDisponiveis.length > 0 && (
          <button
            type="button"
            title="Anexar a outro quadro"
            onClick={() => setAnexando((v) => !v)}
            className="grid h-5 w-5 place-items-center rounded text-faint hover:bg-hover hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {anexando && (
        <div className="border-b border-line px-3 py-2">
          <p className="mb-1.5 text-[11px] leading-relaxed text-faint">
            A tarefa passa a aparecer também no quadro escolhido. Não é cópia: continua sendo a mesma.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tarefa.quadrosDisponiveis.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  startTransition(() => adicionarAQuadro(tarefa.id, p.id))
                  setAnexando(false)
                }}
                className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] hover:bg-hover"
              >
                <span className="grid h-4 w-4 place-items-center rounded" style={{ background: p.color }}>
                  <IconeProjeto nome={p.icon} className="h-2.5 w-2.5 text-canvas" />
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1 px-3 py-2">
        {tarefa.quadros.map((q) => (
          <div key={q.projectId} className="group/q flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="grid h-5 w-5 place-items-center rounded text-faint hover:text-ink"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !aberto && '-rotate-90')} />
            </button>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded" style={{ background: q.color }}>
              <IconeProjeto nome={q.icon} className="h-3 w-3 text-canvas" />
            </span>
            <span className="text-[13px] font-medium">{q.name}</span>

            <select
              value={q.sectionId ?? ''}
              onChange={(e) => e.target.value && startTransition(() => moverParaSecao(tarefa.id, e.target.value))}
              className="cursor-pointer rounded-md bg-transparent py-0.5 text-[12px] text-soft outline-none hover:bg-hover"
            >
              {q.secoes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {tarefa.quadros.length > 1 && (
              <button
                type="button"
                title="Tirar deste quadro (a tarefa continua nos outros)"
                onClick={() => startTransition(() => removerDeQuadro(tarefa.id, q.projectId))}
                className="ml-auto shrink-0 text-faint opacity-0 hover:text-danger group-hover/q:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {aberto && (
          <div className="mt-1.5 space-y-0.5 pl-6">
            <CampoAninhado
              rotulo="Marcas"
              valor={tarefa.marcas.find((m) => m.id === tarefa.marcaId) ?? null}
              opcoes={tarefa.marcas.map((m) => ({ id: m.id, label: m.name, color: m.color }))}
              aoMudar={(v) => startTransition(() => definirMarca(tarefa.id, v))}
            />
            {tarefa.campos.map((c) => (
              <CampoAninhado
                key={c.id}
                rotulo={c.name}
                valor={c.options.find((o) => o.id === c.valorId) ?? null}
                opcoes={c.options.map((o) => ({ id: o.id, label: o.label, color: o.color }))}
                aoMudar={(v) => startTransition(() => definirValorCampo(tarefa.id, c.id, v))}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function CampoAninhado({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string
  valor: { id: string; label?: string; name?: string; color: string } | null
  opcoes: { id: string; label: string; color: string }[]
  aoMudar: (v: string | null) => void
}) {
  const [editando, setEditando] = useState(false)
  const texto = valor ? ((valor.label ?? valor.name) as string) : null

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="flex w-[116px] shrink-0 items-center gap-1.5 text-[12px] text-faint">
        <CircleDashed className="h-3.5 w-3.5" />
        {rotulo}
      </span>

      {editando ? (
        <select
          autoFocus
          defaultValue={valor?.id ?? ''}
          onBlur={() => setEditando(false)}
          onChange={(e) => {
            aoMudar(e.target.value || null)
            setEditando(false)
          }}
          className="rounded-md border border-line bg-canvas px-1.5 py-0.5 text-[12px] outline-none focus:border-accent"
        >
          <option value="">—</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <button type="button" onClick={() => setEditando(true)} className="rounded px-0.5 hover:bg-hover">
          {texto ? (
            <span
              className="rounded px-1.5 py-[3px] text-[10px] font-medium leading-none"
              style={{ background: valor!.color, color: '#0b0c10' }}
            >
              {texto}
            </span>
          ) : (
            <span className="text-[13px] text-faint">—</span>
          )}
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
      <h3 className="mb-1.5 text-[12px] font-semibold">Descrição</h3>
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setSujo(true)
        }}
        rows={texto ? Math.min(24, texto.split('\n').length + 1) : 3}
        placeholder="Contexto, oferta, estrutura, o que é entregar isso…"
        className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-accent"
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
  const [compondo, setCompondo] = useState(false)
  const feitas = tarefa.subtarefas.filter((s) => s.completed).length

  function salvar() {
    if (!nova.trim()) return
    startTransition(() => adicionarSubtarefa(tarefa.id, nova))
    setNova('')
  }

  return (
    <section className="mb-5">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-[12px] font-semibold">Subtarefas</h3>
        {tarefa.subtarefas.length > 0 && (
          <span className="text-[11px] text-faint">
            {feitas}/{tarefa.subtarefas.length}
          </span>
        )}
        <button
          type="button"
          title="Adicionar subtarefa"
          onClick={() => setCompondo(true)}
          className="grid h-5 w-5 place-items-center rounded text-faint hover:bg-hover hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        {tarefa.subtarefas.map((s) => (
          <div
            key={s.id}
            className="group/sub flex items-center gap-2.5 border-b border-line-soft py-1.5 last:border-0"
          >
            <button
              type="button"
              onClick={() => startTransition(() => alternarSubtarefa(tarefa.id, s.id))}
              className={cn(
                'grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border transition-colors',
                s.completed
                  ? 'border-ok bg-ok text-canvas'
                  : 'border-faint/70 text-faint/50 hover:border-ok hover:text-ok',
              )}
            >
              <Check className="h-[11px] w-[11px]" strokeWidth={3} />
            </button>
            <span className={cn('flex-1 text-[13px]', s.completed && 'text-faint line-through')}>{s.name}</span>
            <button
              type="button"
              title="Remover"
              onClick={() => startTransition(() => removerSubtarefa(tarefa.id, s.id))}
              className="shrink-0 text-faint opacity-0 hover:text-danger group-hover/sub:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {compondo ? (
        <input
          autoFocus
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          placeholder="Nome da subtarefa"
          onBlur={() => {
            salvar()
            setCompondo(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar()
            if (e.key === 'Escape') setCompondo(false)
          }}
          className="mt-1.5 w-full rounded-md border border-accent bg-canvas px-2 py-1.5 text-[13px] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCompondo(true)}
          className="mt-1 rounded-md py-1 text-[13px] text-faint hover:text-soft"
        >
          Adicionar subtarefa
        </button>
      )}
    </section>
  )
}

function Anexos() {
  return (
    <section className="mb-5">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-[12px] font-semibold">
          <Paperclip className="h-3.5 w-3.5" />
          Anexos
        </h3>
      </div>
      <p className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-[12px] text-faint">
        Anexo precisa de um lugar para guardar arquivo. Entra junto com o banco.
      </p>
    </section>
  )
}

/// Abas Comentários / Todas as atividades, como no Asana. O histórico é o que
/// explica por que a tarefa está do jeito que está.
function Atividade({ tarefa }: { tarefa: TarefaDetalhe }) {
  const [, startTransition] = useTransition()
  const [aba, setAba] = useState<'comentarios' | 'tudo'>('comentarios')
  const [ordemAntiga, setOrdemAntiga] = useState(true)
  const [texto, setTexto] = useState('')

  return (
    <section className="border-t border-line pt-3">
      <div className="mb-3 flex items-center gap-4">
        {(
          [
            ['comentarios', 'Comentários'],
            ['tudo', 'Todas as atividades'],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={cn(
              'relative py-1 text-[13px] transition-colors',
              aba === id ? 'text-ink' : 'text-faint hover:text-soft',
            )}
          >
            {rotulo}
            {aba === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOrdemAntiga((v) => !v)}
          className="ml-auto flex items-center gap-1 text-[11px] text-faint hover:text-soft"
        >
          <ArrowUpDown className="h-3 w-3" />
          {ordemAntiga ? 'Mais antigos' : 'Mais recentes'}
        </button>
      </div>

      {aba === 'tudo' && (
        <ul className="mb-4 space-y-2.5">
          {[...tarefa.atividades]
            .sort((a, b) => (ordemAntiga ? a.quando - b.quando : b.quando - a.quando))
            .map((a) => (
              <li key={a.id} className="flex items-baseline gap-2 text-[12px]">
                <span className="text-soft">
                  <span className="text-ink">{a.autor}</span> {a.texto}
                </span>
                <span className="shrink-0 text-faint">· {formatarQuando(a.quando)}</span>
              </li>
            ))}
          {tarefa.atividades.length === 0 && (
            <li className="text-[12px] text-faint">
              Nada registrado ainda. O histórico começa na primeira mudança que você fizer aqui.
            </li>
          )}
        </ul>
      )}

      {tarefa.comentarios.map((c) => (
        <div key={c.id} className="mb-3 flex gap-2.5">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white"
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
        <div className="flex items-start gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[9px] font-semibold text-white">
            HI
          </span>
          <div className="min-w-0 flex-1">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={texto ? 3 : 1}
              placeholder="Adicionar um comentário"
              className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none placeholder:text-faint focus:border-accent"
            />
            {texto.trim() && (
              <button
                type="button"
                onClick={() => {
                  startTransition(() => comentar(tarefa.id, texto))
                  setTexto('')
                }}
                className="btn mt-1.5 bg-accent px-3 py-1 text-[12px] text-white hover:bg-accent/90"
              >
                Comentar
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-[12px] leading-relaxed text-faint">
          Comentário precisa de banco de dados — não cabe no cookie de 4 KB.
        </p>
      )}
    </section>
  )
}
