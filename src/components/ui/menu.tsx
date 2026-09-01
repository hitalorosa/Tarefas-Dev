'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const Ctx = createContext<{ fechar: () => void }>({ fechar: () => {} })

export function Menu({
  gatilho,
  children,
  alinhamento = 'esquerda',
  largura = 'w-56',
}: {
  gatilho: (props: { aberto: boolean }) => React.ReactNode
  children: React.ReactNode
  alinhamento?: 'esquerda' | 'direita'
  largura?: string
}) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setAberto(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setAberto((v) => !v)}>{gatilho({ aberto })}</div>
      {aberto && (
        <Ctx.Provider value={{ fechar: () => setAberto(false) }}>
          <div
            role="menu"
            className={cn(
              'absolute z-50 mt-1 overflow-hidden rounded-xl border border-line bg-raised py-1 shadow-2xl shadow-black/50',
              largura,
              alinhamento === 'direita' ? 'right-0' : 'left-0',
            )}
          >
            {children}
          </div>
        </Ctx.Provider>
      )}
    </div>
  )
}

export function ItemMenu({
  children,
  onClick,
  icone: Icone,
  perigo,
  atalho,
}: {
  children: React.ReactNode
  onClick?: () => void
  icone?: React.ComponentType<{ className?: string }>
  perigo?: boolean
  atalho?: string
}) {
  const { fechar } = useContext(Ctx)
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onClick?.()
        fechar()
      }}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors',
        perigo ? 'text-danger hover:bg-danger-bg' : 'text-soft hover:bg-hover hover:text-ink',
      )}
    >
      {Icone && <Icone className="h-3.5 w-3.5 shrink-0" />}
      <span className="flex-1 truncate">{children}</span>
      {atalho && <span className="text-[11px] text-faint">{atalho}</span>}
    </button>
  )
}

export function SeparadorMenu() {
  return <div className="my-1 h-px bg-line" />
}

export function TituloMenu({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
      {children}
    </div>
  )
}
