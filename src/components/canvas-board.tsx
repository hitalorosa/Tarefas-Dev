'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import '@excalidraw/excalidraw/index.css'
import { salvarCanvas } from '@/app/(app)/canvas'

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

export function CanvasBoard({
  canvasId,
  elementosIniciais,
  appStateInicial,
  somenteLeitura,
}: {
  canvasId: string
  elementosIniciais: string
  appStateInicial: string
  /// sem banco o canvas não tem onde ser gravado: desenha, mas não persiste
  somenteLeitura?: boolean
}) {
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo'>('ocioso')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimo = useRef<string>('')

  const inicial = (() => {
    try {
      const elements = JSON.parse(elementosIniciais || '[]')
      const appState = JSON.parse(appStateInicial || '{}')
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
    (elements: readonly { isDeleted?: boolean }[], appState: CameraCanvas) => {
      if (somenteLeitura) return
      const vivos = elements.filter((e) => !e.isDeleted)
      const serializado = JSON.stringify(vivos)
      if (serializado === ultimo.current) return
      ultimo.current = serializado

      if (timer.current) clearTimeout(timer.current)
      setEstado('salvando')
      timer.current = setTimeout(async () => {
        const guardar = {
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
          viewBackgroundColor: appState.viewBackgroundColor,
        }
        try {
          await salvarCanvas(canvasId, serializado, JSON.stringify(guardar))
          setEstado('salvo')
          setTimeout(() => setEstado('ocioso'), 1500)
        } catch {
          setEstado('ocioso')
        }
      }, ESPERA_MS)
    },
    [canvasId, somenteLeitura],
  )

  return (
    <div className="relative flex-1">
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
          <span className="text-faint">{somenteLeitura ? 'não é salvo sem banco' : 'tudo salvo'}</span>
        )}
      </div>

      <Excalidraw
        initialData={inicial}
        onChange={aoMudar}
        langCode="pt-BR"
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  )
}
