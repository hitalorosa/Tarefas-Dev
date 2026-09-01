'use client'

import { useState, useTransition } from 'react'
import { atualizarDescricaoProjeto } from '@/app/(app)/projeto'

export function DescricaoProjeto({ projectId, descricao }: { projectId: string; descricao: string }) {
  const [texto, setTexto] = useState(descricao)
  const [sujo, setSujo] = useState(false)
  const [pendente, startTransition] = useTransition()

  return (
    <div>
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setSujo(true)
        }}
        rows={5}
        placeholder="Do que se trata este projeto, quem participa, o que é sucesso aqui…"
        className="field resize-y leading-relaxed"
      />
      {sujo && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              startTransition(async () => {
                await atualizarDescricaoProjeto(projectId, texto)
                setSujo(false)
              })
            }
            className="btn bg-accent px-3 py-1.5 text-[12px] text-white hover:bg-accent/90"
          >
            {pendente ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto(descricao)
              setSujo(false)
            }}
            className="btn px-2 py-1.5 text-[12px] text-soft hover:text-ink"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
