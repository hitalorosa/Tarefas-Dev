'use client'

import { useEffect, useRef } from 'react'
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { Search } from 'lucide-react'

type Sidebar = { toggleSidebar: (opcoes: { name: string; tab?: string }) => void }

type Props = {
  initialData: { elements: unknown[]; appState: Record<string, unknown> }
  onChange: (elements: readonly never[], appState: never) => void
  excalidrawAPI: (api: unknown) => void
  onLinkOpen: (element: { link?: string | null }, event: { preventDefault: () => void }) => void
}

/// O pacote do canvas não traduz o painel de busca: a tradução pt-BR dele não
/// cobre essas telas e ele cai no inglês. Não existe ponto de injeção na API,
/// então trocamos no lugar.
const FALTANDO: Record<string, string> = {
  'Find on canvas': 'Procurar no canvas',
  'Find text on canvas...': 'Procurar texto no canvas...',
  'No matches found...': 'Nada encontrado...',
}

/// O contador vem interpolado ("2 results", "1 / 2 results"), então não cabe no
/// dicionário acima.
const CONTAGEM = /^(\d+(?:\s*\/\s*\d+)?)\s+results?$/

/// Import estático do Excalidraw, isolado num arquivo só para isto: o namespace
/// MainMenu (com os DefaultItems) não sobrevive a um next/dynamic. Quem carrega
/// isto de forma preguiçosa é o CanvasBoard.
export default function CanvasExcalidraw({
  initialData,
  onChange,
  excalidrawAPI,
  onLinkOpen,
}: Props) {
  const api = useRef<Sidebar | null>(null)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const raiz = caixa.current
    if (!raiz) return

    function traduzir() {
      const painel = raiz?.querySelector('.sidebar')
      if (!painel) return
      for (const campo of painel.querySelectorAll('input[placeholder]')) {
        const entrada = campo as HTMLInputElement
        const pronto = FALTANDO[entrada.placeholder]
        if (pronto) entrada.placeholder = pronto
      }
      const passeio = document.createTreeWalker(painel, NodeFilter.SHOW_TEXT)
      let no = passeio.nextNode()
      while (no) {
        const bruto = no.nodeValue?.trim() ?? ''
        let pronto = FALTANDO[bruto]
        const contagem = CONTAGEM.exec(bruto)
        if (contagem) {
          const total = Number(contagem[1].split('/').pop())
          pronto = `${contagem[1]} ${total === 1 ? 'resultado' : 'resultados'}`
        }
        // só escreve quando muda de fato, senão o observador se persegue
        if (pronto && no.nodeValue !== pronto) no.nodeValue = pronto
        no = passeio.nextNode()
      }
    }

    const olho = new MutationObserver(traduzir)
    olho.observe(raiz, { childList: true, subtree: true, characterData: true })
    traduzir()
    return () => olho.disconnect()
  }, [])

  return (
    <div ref={caixa} className="h-full w-full">
      <Excalidraw
        initialData={initialData as never}
        onChange={onChange as never}
        excalidrawAPI={
          ((instancia: unknown) => {
            api.current = instancia as Sidebar
            excalidrawAPI(instancia)
          }) as never
        }
        onLinkOpen={onLinkOpen as never}
        langCode="pt-BR"
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      >
        {/* Menu próprio: o de fábrica traz uma seção "Excalidraw links" com
            GitHub, Discord e as redes deles. Isto aqui é o Plano, não a vitrine
            de outro produto. */}
        <MainMenu>
          <MainMenu.Item
            icon={<Search />}
            shortcut="Ctrl+F"
            onSelect={() => api.current?.toggleSidebar({ name: 'default', tab: 'search' })}
          >
            Procurar no canvas
          </MainMenu.Item>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>
    </div>
  )
}
