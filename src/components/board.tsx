'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAbrirTarefa } from '@/components/task-panel'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheckBig,
  ListTree,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import type { CardTarefa, ColunaQuadro } from '@/lib/types'
import { cn, formatarPrazo, orderBetween } from '@/lib/utils'
import { alternarConcluida, criarTarefa, moverTarefa, recolherConcluida } from '@/app/(app)/actions'
import { adicionarSecao, excluirSecao, marcarSecaoConcluida, moverSecao, renomearSecao } from '@/app/(app)/secoes'
import { Menu, ItemMenu, SeparadorMenu } from '@/components/ui/menu'

export function Board({
  projectId,
  colunasIniciais,
  podeArrastar,
}: {
  projectId: string
  colunasIniciais: ColunaQuadro[]
  podeArrastar: boolean
}) {
  const [colunas, setColunas] = useState(colunasIniciais)
  const [arrastando, setArrastando] = useState<CardTarefa | null>(null)
  const [, startTransition] = useTransition()

  // o servidor é a verdade: quando ele revalida, o estado local se rende
  useEffect(() => setColunas(colunasIniciais), [colunasIniciais])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const acharColuna = (id: string) =>
    colunas.find((c) => c.id === id || c.tarefas.some((t) => t.id === id))

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    setArrastando(colunas.flatMap((c) => c.tarefas).find((t) => t.id === id) ?? null)
  }

  // atravessar colunas acontece durante o arrasto, não no soltar —
  // é o que faz o card "entrar" na coluna embaixo do cursor
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const origem = acharColuna(String(active.id))
    const destino = acharColuna(String(over.id))
    if (!origem || !destino || origem.id === destino.id) return

    setColunas((prev) => {
      const o = prev.find((c) => c.id === origem.id)!
      const d = prev.find((c) => c.id === destino.id)!
      const tarefa = o.tarefas.find((t) => t.id === String(active.id))
      if (!tarefa) return prev

      const sobreTarefa = d.tarefas.findIndex((t) => t.id === String(over.id))
      const indice = sobreTarefa >= 0 ? sobreTarefa : d.tarefas.length

      return prev.map((c) => {
        if (c.id === o.id) return { ...c, tarefas: c.tarefas.filter((t) => t.id !== tarefa.id) }
        if (c.id === d.id) {
          const copia = [...c.tarefas]
          copia.splice(indice, 0, tarefa)
          return { ...c, tarefas: copia }
        }
        return c
      })
    })
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setArrastando(null)
    if (!over) return

    const coluna = acharColuna(String(over.id))
    if (!coluna) return

    const de = coluna.tarefas.findIndex((t) => t.id === String(active.id))
    const para = coluna.tarefas.findIndex((t) => t.id === String(over.id))
    const finais = de >= 0 && para >= 0 && de !== para ? arrayMove(coluna.tarefas, de, para) : coluna.tarefas

    const indice = finais.findIndex((t) => t.id === String(active.id))
    if (indice < 0) return
    const ordem = orderBetween(finais[indice - 1]?.order, finais[indice + 1]?.order)

    setColunas((prev) =>
      prev.map((c) =>
        c.id === coluna.id
          ? { ...c, tarefas: finais.map((t) => (t.id === String(active.id) ? { ...t, order: ordem } : t)) }
          : c,
      ),
    )

    startTransition(() => {
      moverTarefa(String(active.id), coluna.id, ordem)
    })
  }

  const corpo = (
    <div className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden px-5 py-4">
      {colunas.map((c, i) => (
        <Coluna
          key={c.id}
          coluna={c}
          projectId={projectId}
          primeira={i === 0}
          primeiraDoQuadro={i === 0}
          ultima={i === colunas.length - 1}
          total={colunas.length}
        />
      ))}
      {!colunas.some((c) => c.virtual) && <AdicionarSecao projectId={projectId} />}
    </div>
  )

  if (!podeArrastar) return corpo

  return (
    <DndContext
      // sem id fixo o dnd-kit numera os aria-describedby por contador global e
      // servidor e cliente chegam em números diferentes -> erro de hidratação
      id="quadro"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setArrastando(null)}
    >
      {corpo}
      <DragOverlay dropAnimation={null}>
        {arrastando ? (
          <div className="w-72 rotate-2 opacity-95">
            <Cartao tarefa={arrastando} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Coluna({
  coluna,
  projectId,
  primeiraDoQuadro,
  primeira,
  ultima,
  total,
}: {
  coluna: ColunaQuadro
  projectId: string
  primeiraDoQuadro: boolean
  primeira: boolean
  ultima: boolean
  total: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id, disabled: coluna.virtual })
  const ids = useMemo(() => coluna.tarefas.map((t) => t.id), [coluna.tarefas])
  const [renomeando, setRenomeando] = useState(false)
  const [compondo, setCompondo] = useState(false)
  const [, startTransition] = useTransition()
  const abertas = coluna.tarefas.filter((t) => !t.completed).length

  // o botão "Adicionar uma tarefa" da barra abre o compositor da primeira coluna
  useEffect(() => {
    if (!primeiraDoQuadro || coluna.virtual) return
    const abrir = () => setCompondo(true)
    window.addEventListener('plano:nova-tarefa', abrir)
    return () => window.removeEventListener('plano:nova-tarefa', abrir)
  }, [primeiraDoQuadro, coluna.virtual])

  return (
    <section className="group/col flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex h-6 items-center gap-2 px-1">
        {renomeando ? (
          <input
            autoFocus
            defaultValue={coluna.name}
            onBlur={(e) => {
              startTransition(() => renomearSecao(coluna.id, e.target.value))
              setRenomeando(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setRenomeando(false)
            }}
            className="w-full rounded border border-accent bg-canvas px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider outline-none"
          />
        ) : (
          <>
            <h2
              onDoubleClick={() => !coluna.virtual && setRenomeando(true)}
              className="flex items-center gap-1.5 truncate text-[11px] font-semibold uppercase tracking-wider text-soft"
            >
              {coluna.cor && <span className="h-2 w-2 rounded-full" style={{ background: coluna.cor }} />}
              {coluna.name}
            </h2>
            <span className="text-[11px] text-faint">{abertas || ''}</span>
            {coluna.isDone && <Check className="h-3.5 w-3.5 text-ok" />}

            {!coluna.virtual && (
              <div
                // has-[[role=menu]] segura os controles visíveis com o menu aberto:
                // sem isso, tirar o mouse da coluna sumia com o menu ainda no ar
                className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/col:opacity-100 has-[[role=menu]]:opacity-100"
              >
                <BotaoIcone
                  titulo="Mover para a esquerda"
                  desativado={primeira}
                  onClick={() => startTransition(() => moverSecao(coluna.id, 'esquerda'))}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </BotaoIcone>
                <BotaoIcone
                  titulo="Mover para a direita"
                  desativado={ultima}
                  onClick={() => startTransition(() => moverSecao(coluna.id, 'direita'))}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </BotaoIcone>
                <BotaoIcone titulo="Adicionar tarefa" onClick={() => setCompondo(true)}>
                  <Plus className="h-3.5 w-3.5" />
                </BotaoIcone>

                <Menu
                  alinhamento="direita"
                  gatilho={() => (
                    <span className="grid h-6 w-6 place-items-center rounded text-faint transition-colors hover:bg-hover hover:text-ink">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </span>
                  )}
                >
                  <ItemMenu icone={Pencil} onClick={() => setRenomeando(true)}>
                    Renomear a seção
                  </ItemMenu>
                  <ItemMenu
                    icone={Plus}
                    onClick={() => startTransition(() => void adicionarSecao(projectId, 'Nova seção', coluna.id))}
                  >
                    Adicionar uma seção
                  </ItemMenu>
                  <ItemMenu
                    icone={CircleCheckBig}
                    onClick={() => startTransition(() => marcarSecaoConcluida(coluna.id, !coluna.isDone))}
                  >
                    {coluna.isDone ? 'Não é mais a coluna de concluído' : 'Usar como coluna de concluído'}
                  </ItemMenu>
                  <SeparadorMenu />
                  <ItemMenu
                    icone={Trash2}
                    perigo
                    onClick={() => {
                      if (total <= 1) return
                      startTransition(() => excluirSecao(coluna.id))
                    }}
                  >
                    Excluir a seção
                  </ItemMenu>
                  <div className="px-3 pb-2 pt-1 text-[11px] leading-relaxed text-faint">
                    Excluir move as tarefas pra seção vizinha. Nada é apagado.
                  </div>
                </Menu>
              </div>
            )}
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl p-1.5 transition-colors',
          isOver ? 'bg-raised/70' : 'bg-surface/40',
        )}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {coluna.tarefas.map((t) => (
            <CartaoArrastavel key={t.id} tarefa={t} desativado={coluna.virtual} />
          ))}
        </SortableContext>

        {coluna.tarefas.length === 0 && !compondo && (
          <p className="px-2 py-1 text-[11px] text-faint">Nada aqui.</p>
        )}

        {!coluna.virtual && (
          <Compositor sectionId={coluna.id} aberto={compondo} setAberto={setCompondo} />
        )}
      </div>
    </section>
  )
}

function BotaoIcone({
  children,
  titulo,
  onClick,
  desativado,
}: {
  children: React.ReactNode
  titulo: string
  onClick: () => void
  desativado?: boolean
}) {
  return (
    <button
      type="button"
      title={titulo}
      disabled={desativado}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded text-faint transition-colors hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function AdicionarSecao({ projectId }: { projectId: string }) {
  const [nome, setNome] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (nome === null) {
    return (
      <button
        type="button"
        onClick={() => setNome('')}
        className="flex h-9 w-56 shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-line px-3 text-[13px] text-faint transition-colors hover:border-faint hover:text-soft"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar uma seção
      </button>
    )
  }

  return (
    <div className="w-56 shrink-0">
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da seção"
        onBlur={() => {
          if (nome.trim()) startTransition(() => void adicionarSecao(projectId, nome))
          setNome(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setNome(null)
        }}
        className="field py-1.5 text-[13px]"
      />
    </div>
  )
}

function CartaoArrastavel({ tarefa, desativado }: { tarefa: CardTarefa; desativado: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
    disabled: desativado,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn('touch-none', isDragging && 'opacity-40')}
    >
      <Cartao tarefa={tarefa} />
    </div>
  )
}

/// Depois de marcar, a tarefa espera aqui antes de pular para a coluna de
/// concluído. Tempo suficiente para ver o que aconteceu e desmarcar se errou.
const ESPERA_RECOLHER_MS = 2500

function Cartao({ tarefa }: { tarefa: CardTarefa }) {
  const [, startTransition] = useTransition()
  const abrir = useAbrirTarefa()
  const recolhendo = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (recolhendo.current) clearTimeout(recolhendo.current) }, [])

  function alternar() {
    if (recolhendo.current) {
      clearTimeout(recolhendo.current)
      recolhendo.current = null
    }

    if (tarefa.completed) {
      startTransition(() => alternarConcluida(tarefa.id))
      return
    }

    // etapa 1: marca sem mover — o card fica apagado no lugar
    startTransition(() => alternarConcluida(tarefa.id, false))
    // etapa 2: só então ele migra
    recolhendo.current = setTimeout(() => {
      recolhendo.current = null
      startTransition(() => recolherConcluida(tarefa.id))
    }, ESPERA_RECOLHER_MS)
  }

  const travada = tarefa.travadaPor.filter((t) => !t.completed)
  const prazo = formatarPrazo(tarefa.startOn, tarefa.dueAt)
  const vencimento = tarefa.dueAt ? new Date(tarefa.dueAt) : null
  const atrasada = !!vencimento && !tarefa.completed && vencimento < new Date(new Date().toDateString())

  // ordem das etiquetas igual à do Asana: importância, depois canal, marca por último
  const peso = (nome: string) => (nome.toLowerCase().startsWith('import') ? 0 : 1)
  const etiquetas = [
    ...[...tarefa.campos]
      .sort((a, b) => peso(a.fieldName) - peso(b.fieldName))
      .map((c) => ({ chave: `${c.fieldName}-${c.label}`, label: c.label, cor: c.color })),
    ...(tarefa.marca
      ? [{ chave: `marca-${tarefa.marca.id}`, label: tarefa.marca.name, cor: tarefa.marca.color }]
      : []),
  ]

  const indicadores =
    tarefa.subtarefas.total > 0 || tarefa.comentarios > 0 || travada.length > 0 || tarefa.alertas > 0

  return (
    <article
      onClick={() => abrir(tarefa.id)}
      className={cn(
        'group cursor-pointer rounded-lg border border-line bg-raised px-3 py-2.5 transition-colors hover:border-faint/50',
        tarefa.completed && 'opacity-50',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={tarefa.completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            alternar()
          }}
          className={cn(
            'mt-px grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border transition-colors',
            tarefa.completed
              ? 'border-ok bg-ok text-canvas'
              : 'border-faint/70 text-faint/50 hover:border-ok hover:text-ok',
          )}
        >
          <Check className="h-[11px] w-[11px]" strokeWidth={3} />
        </button>

        <p className={cn('flex-1 text-[13px] leading-[1.35]', tarefa.completed && 'line-through')}>
          {tarefa.name}
        </p>

        {tarefa.origin === 'ai' && (
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent-ink" aria-label="criada pela IA" />
        )}
      </div>

      {/* etiquetas coladas na borda do card, não indentadas sob o título */}
      {etiquetas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {etiquetas.map((e) => (
            <Chip key={e.chave} label={e.label} cor={e.cor} />
          ))}
        </div>
      )}

      {(tarefa.responsavel || prazo || indicadores) && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-soft">
          {tarefa.responsavel && (
            <span
              className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[8px] font-semibold text-white"
              style={{ background: tarefa.responsavel.color }}
              title={tarefa.responsavel.name}
            >
              {tarefa.responsavel.name.slice(0, 2).toUpperCase()}
            </span>
          )}

          {prazo && <span className={cn(atrasada && 'font-medium text-danger')}>{prazo}</span>}

          {indicadores && (
            <span className="ml-auto flex items-center gap-2 text-faint">
              {travada.length > 0 && (
                <span
                  className="flex items-center gap-0.5 text-warn"
                  title={`Travada por: ${travada.map((t) => t.name).join(', ')}`}
                >
                  <Lock className="h-3 w-3" />
                  {travada.length}
                </span>
              )}
              {tarefa.subtarefas.total > 0 && (
                <span className="flex items-center gap-0.5">
                  {tarefa.subtarefas.total}
                  <ListTree className="h-3 w-3" />
                </span>
              )}
              {tarefa.comentarios > 0 && (
                <span className="flex items-center gap-0.5">
                  {tarefa.comentarios}
                  <MessageSquare className="h-3 w-3" />
                </span>
              )}
              {tarefa.alertas > 0 && (
                <span className="flex items-center gap-0.5 text-danger" title="O guardião marcou esta tarefa">
                  <TriangleAlert className="h-3 w-3" />
                  {tarefa.alertas}
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </article>
  )
}

/// Etiqueta sólida com texto escuro, como no Asana. Nada de contorno: a cor
/// cheia é o que faz o quadro ser lido de longe.
function Chip({ label, cor }: { label: string; cor: string }) {
  return (
    <span
      className="rounded px-1.5 py-[3px] text-[10px] font-medium leading-none"
      style={{ background: cor, color: '#0b0c10' }}
    >
      {label}
    </span>
  )
}

function Compositor({
  sectionId,
  aberto,
  setAberto,
}: {
  sectionId: string
  aberto: boolean
  setAberto: (v: boolean) => void
}) {
  const ref = useRef<HTMLFormElement>(null)

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-faint transition-colors hover:bg-hover hover:text-soft"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar tarefa
      </button>
    )
  }

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await criarTarefa(fd)
        ref.current?.reset()
      }}
      className="rounded-[10px] border border-accent/40 bg-raised p-2"
    >
      <input type="hidden" name="sectionId" value={sectionId} />
      <textarea
        name="name"
        autoFocus
        rows={2}
        placeholder="Nome da tarefa"
        className="w-full resize-none bg-transparent text-[13px] leading-snug outline-none placeholder:text-faint"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
          }
          if (e.key === 'Escape') setAberto(false)
        }}
      />
      <div className="flex items-center gap-2">
        <button type="submit" className="btn bg-accent px-2.5 py-1 text-[12px] text-white hover:bg-accent/90">
          Adicionar
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="btn px-2 py-1 text-[12px] text-soft hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
