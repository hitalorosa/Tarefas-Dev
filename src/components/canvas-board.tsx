'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Hand, Link2, ListPlus, Loader2, MousePointer2, Unlink } from 'lucide-react'
import '@excalidraw/excalidraw/index.css'
import { salvarCanvas } from '@/app/(app)/canvas'
import { criarTarefaDoCanvas } from '@/app/(app)/actions'
import { cn } from '@/lib/utils'

// Excalidraw toca em window na importação: só pode existir no cliente.
const Excalidraw = dynamic(() => import('@excalidraw/excalidraw').then((m) => m.Excalidraw), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-[13px] text-faint">Carregando o canvas…</div>
  ),
})

const ESPERA_MS = 900

type CameraCanvas = {
  scrollX: number
  scrollY: number
  zoom: Readonly<{ value: number }>
  viewBackgroundColor: string
}

type ElementoCena = {
  id: string
  link?: string | null
  text?: string
  containerId?: string | null
  isDeleted?: boolean
}

/// O mínimo da API do Excalidraw que usamos. Tipar só isso evita depender da
/// forma interna deles, que muda entre versões.
type ApiCanvas = {
  getSceneElements: () => readonly ElementoCena[]
  getAppState: () => { selectedElementIds: Record<string, boolean>; activeTool?: { type: string } }
  updateScene: (cena: { elements: readonly unknown[] }) => void
  setActiveTool: (ferramenta: { type: string }) => void
}

export type TarefaVinculavel = { id: string; name: string; concluida: boolean }

export function CanvasBoard({
  canvasId,
  projectId,
  elementosIniciais,
  appStateInicial,
  tarefas,
  guardarNoNavegador,
  compacto,
}: {
  canvasId: string
  projectId: string
  elementosIniciais: string
  appStateInicial: string
  tarefas: TarefaVinculavel[]
  /// sem banco o desenho é guardado no armazenamento local deste navegador —
  /// cabe muito mais que num cookie, e o canvas passa a funcionar de verdade
  guardarNoNavegador?: boolean
  /// dentro do painel da tarefa a barra some: lá o espaço é curto
  compacto?: boolean
}) {
  const router = useRouter()
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo'>('ocioso')
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [algumVinculado, setAlgumVinculado] = useState(false)
  const [ferramenta, setFerramenta] = useState<'selecao' | 'mao'>('selecao')
  const [escolhendo, setEscolhendo] = useState(false)
  const [busca, setBusca] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimo = useRef<string>('')
  const api = useRef<ApiCanvas | null>(null)
  /// o Excalidraw chama onChange a cada render. Guardar a seleção anterior e só
  /// atualizar o estado quando ela muda de verdade evita render em laço.
  const selecaoAnterior = useRef('')

  const chaveLocal = `plano_canvas_${canvasId}`

  const inicial = (() => {
    try {
      let bruto = elementosIniciais
      let estadoBruto = appStateInicial
      if (guardarNoNavegador && typeof window !== 'undefined') {
        const salvo = window.localStorage.getItem(chaveLocal)
        if (salvo) {
          const j = JSON.parse(salvo)
          bruto = j.elements ?? bruto
          estadoBruto = j.appState ?? estadoBruto
        }
      }
      const elements = JSON.parse(bruto || '[]')
      const appState = JSON.parse(estadoBruto || '{}')
      // collaborators precisa ser Map; o que veio do banco é objeto e o Excalidraw quebra
      delete appState.collaborators
      return { elements, appState: { ...appState, theme: 'dark' as const } }
    } catch {
      return { elements: [], appState: { theme: 'dark' as const } }
    }
  })()

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const aoMudar = useCallback(
    // do appState só guardamos a posição da câmera — o resto é estado de sessão
    (elements: readonly ElementoCena[], appState: CameraCanvas) => {
      const app = api.current?.getAppState()
      const sel = app?.selectedElementIds ?? {}
      const ids = Object.keys(sel).filter((id) => sel[id])
      const assinatura = ids.join(',')
      if (assinatura !== selecaoAnterior.current) {
        selecaoAnterior.current = assinatura
        setSelecionados(ids)
        setAlgumVinculado(
          (api.current?.getSceneElements() ?? []).some((el) => ids.includes(el.id) && !!el.link),
        )
      }
      const tipo = app?.activeTool?.type
      if (tipo === 'hand' && ferramenta !== 'mao') setFerramenta('mao')
      if (tipo && tipo !== 'hand' && ferramenta !== 'selecao') setFerramenta('selecao')

      const vivos = elements.filter((e) => !e.isDeleted)
      const serializado = JSON.stringify(vivos)
      if (serializado === ultimo.current) return
      ultimo.current = serializado

      if (timer.current) clearTimeout(timer.current)
      setEstado('salvando')
      timer.current = setTimeout(async () => {
        const camera = JSON.stringify({
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
          viewBackgroundColor: appState.viewBackgroundColor,
        })
        try {
          if (guardarNoNavegador) {
            window.localStorage.setItem(
              chaveLocal,
              JSON.stringify({ elements: serializado, appState: camera }),
            )
          } else {
            await salvarCanvas(canvasId, serializado, camera)
          }
          setEstado('salvo')
          setTimeout(() => setEstado('ocioso'), 1500)
        } catch {
          setEstado('ocioso')
        }
      }, ESPERA_MS)
    },
    [canvasId, chaveLocal, ferramenta, guardarNoNavegador],
  )

  function trocarFerramenta(qual: 'selecao' | 'mao') {
    setFerramenta(qual)
    api.current?.setActiveTool({ type: qual === 'mao' ? 'hand' : 'selection' })
  }

  /// Escreve o link nos elementos selecionados. O link aponta para a própria
  /// plataforma, então abrir vira navegação interna, não uma aba nova.
  function vincular(taskId: string | null) {
    if (!api.current) return
    const alvo = new Set(selecionados)
    const elements = api.current.getSceneElements().map((el) =>
      alvo.has(el.id) ? { ...el, link: taskId ? `/p/${projectId}?tarefa=${taskId}` : null } : el,
    )
    api.current.updateScene({ elements })
    setAlgumVinculado(!!taskId)
    setEscolhendo(false)
    setBusca('')
  }

  /// Texto da forma: o próprio, se for texto, ou o rótulo preso a ela.
  function textoDe(id: string) {
    const cena = api.current?.getSceneElements() ?? []
    const proprio = cena.find((el) => el.id === id)
    if (proprio?.text) return proprio.text
    return cena.find((el) => el.containerId === id)?.text ?? ''
  }

  async function virarTarefa() {
    const nome = selecionados.map(textoDe).filter(Boolean).join(' — ')
    if (!nome.trim()) return
    const id = await criarTarefaDoCanvas(projectId, nome)
    if (id) vincular(id)
  }

  const filtradas = busca
    ? tarefas.filter((t) => t.name.toLowerCase().includes(busca.toLowerCase()))
    : tarefas

  const temTexto = selecionados.some((id) => textoDe(id).trim().length > 0)

  return (
    <div className="relative flex-1">
      {!compacto && (
        <div className="absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[11px] backdrop-blur">
          {estado === 'salvando' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-faint" />
              <span className="text-faint">salvando</span>
            </>
          )}
          {estado === 'salvo' && (
            <>
              <Check className="h-3 w-3 text-ok" />
              <span className="text-soft">salvo</span>
            </>
          )}
          {estado === 'ocioso' && (
            <span className="text-faint">
              {guardarNoNavegador ? 'salvo neste navegador' : 'tudo salvo'}
            </span>
          )}
        </div>
      )}

      {/* selecionar x andar: o atalho de espaço existe, mas ninguém descobre */}
      {/* acima do controle de zoom do Excalidraw, que também mora no canto */}
      <div className="absolute bottom-16 left-4 z-20 flex items-center gap-0.5 rounded-full border border-line bg-raised p-1 shadow-xl">
        <BotaoFerramenta
          ativo={ferramenta === 'selecao'}
          titulo="Selecionar (V)"
          onClick={() => trocarFerramenta('selecao')}
        >
          <MousePointer2 className="h-4 w-4" />
        </BotaoFerramenta>
        <BotaoFerramenta
          ativo={ferramenta === 'mao'}
          titulo="Andar pela tela (H, ou segure a barra de espaço)"
          onClick={() => trocarFerramenta('mao')}
        >
          <Hand className="h-4 w-4" />
        </BotaoFerramenta>
      </div>

      {/* barra de vínculo: só aparece quando há algo selecionado */}
      {selecionados.length > 0 && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
          {escolhendo ? (
            <div className="w-[320px] rounded-xl border border-line bg-raised p-2 shadow-2xl shadow-black/50">
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar tarefa para vincular"
                className="field mb-1.5 py-1.5 text-[12px]"
              />
              <div className="max-h-56 overflow-y-auto">
                {filtradas.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => vincular(t.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-hover"
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        t.concluida ? 'bg-ok' : 'bg-faint',
                      )}
                    />
                    <span className={cn('truncate', t.concluida && 'text-faint line-through')}>
                      {t.name}
                    </span>
                  </button>
                ))}
                {filtradas.length === 0 && (
                  <p className="px-2 py-3 text-center text-[12px] text-faint">Nenhuma tarefa.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEscolhendo(false)}
                className="mt-1 w-full rounded-md py-1 text-[12px] text-soft hover:bg-hover"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full border border-line bg-raised px-1.5 py-1 shadow-xl">
              <span className="px-1.5 text-[11px] text-faint">
                {selecionados.length === 1 ? '1 selecionado' : `${selecionados.length} selecionados`}
              </span>

              {temTexto && (
                <button
                  type="button"
                  onClick={virarTarefa}
                  title="Cria uma tarefa com este texto e já deixa o desenho ligado a ela"
                  className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[12px] text-white hover:bg-accent/90"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  Virar tarefa
                </button>
              )}

              <button
                type="button"
                onClick={() => setEscolhendo(true)}
                className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-soft hover:bg-hover hover:text-ink"
              >
                <Link2 className="h-3.5 w-3.5" />
                Vincular
              </button>

              {algumVinculado && (
                <button
                  type="button"
                  title="Tirar o vínculo"
                  onClick={() => vincular(null)}
                  className="grid h-7 w-7 place-items-center rounded-full text-faint hover:bg-hover hover:text-ink"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <Excalidraw
        initialData={inicial}
        onChange={aoMudar}
        langCode="pt-BR"
        excalidrawAPI={(instancia: unknown) => {
          api.current = instancia as ApiCanvas
        }}
        // link do próprio app abre navegando aqui dentro, sem aba nova
        onLinkOpen={(element: { link?: string | null }, event: { preventDefault: () => void }) => {
          const link = element.link
          if (!link) return
          if (link.startsWith('/')) {
            event.preventDefault()
            router.push(link)
          }
        }}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  )
}

function BotaoFerramenta({
  ativo,
  titulo,
  onClick,
  children,
}: {
  ativo: boolean
  titulo: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={titulo}
      onClick={onClick}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-full transition-colors',
        ativo ? 'bg-accent text-white' : 'text-soft hover:bg-hover hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
