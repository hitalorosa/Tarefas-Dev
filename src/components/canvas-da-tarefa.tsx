'use client'

import { useEffect, useState } from 'react'
import { PenLine, X } from 'lucide-react'
import { abrirCanvasDaTarefa } from '@/app/(app)/canvas'
import { CanvasBoard } from '@/components/canvas-board'

type Cena = { id: string; elements: string; appState: string; noNavegador: boolean }

/// Canvas da própria tarefa, em tela cheia. Serve para desenhar o fluxo daquela
/// entrega — o quadro do projeto é outro assunto e não deve virar rascunho.
export function CanvasDaTarefa({
  taskId,
  projectId,
  nome,
}: {
  taskId: string
  projectId: string
  nome: string
}) {
  const [cena, setCena] = useState<Cena | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!cena) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setCena(null)
      }
    }
    // captura: o painel da tarefa também escuta Esc, e quem está por cima fecha primeiro
    document.addEventListener('keydown', tecla, true)
    return () => document.removeEventListener('keydown', tecla, true)
  }, [cena])

  async function abrir() {
    setCarregando(true)
    try {
      setCena(await abrirCanvasDaTarefa(taskId))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <>
      <section className="mb-5">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold">
          <PenLine className="h-3.5 w-3.5" />
          Canvas
        </h3>
        <button
          type="button"
          onClick={abrir}
          disabled={carregando}
          className="w-full rounded-lg border border-dashed border-line px-3 py-3 text-center text-[12px] text-faint transition-colors hover:border-faint hover:text-soft disabled:opacity-50"
        >
          {carregando ? 'Abrindo…' : 'Desenhar o fluxo desta tarefa'}
        </button>
      </section>

      {cena && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-canvas">
          <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
            <PenLine className="h-4 w-4 text-faint" />
            <span className="truncate text-[13px] font-medium">{nome}</span>
            <span className="text-[11px] text-faint">· canvas da tarefa</span>
            <button
              type="button"
              onClick={() => setCena(null)}
              title="Fechar (Esc)"
              className="ml-auto grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1">
            <CanvasBoard
              key={cena.id}
              canvasId={cena.id}
              projectId={projectId}
              elementosIniciais={cena.elements}
              appStateInicial={cena.appState}
              tarefas={[]}
              guardarNoNavegador={cena.noNavegador}
            />
          </div>
        </div>
      )}
    </>
  )
}
