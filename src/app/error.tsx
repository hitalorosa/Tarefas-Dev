'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-lg font-semibold">Alguma coisa quebrou aqui</h1>
        <p className="mb-4 text-sm leading-relaxed text-soft">
          Se isto acabou de ser publicado, o mais provável é que o banco de dados ainda não esteja
          configurado. Abra{' '}
          <a href="/api/saude" className="text-accent-ink underline underline-offset-2">
            /api/saude
          </a>{' '}
          para ver o que falta.
        </p>
        {error.digest && (
          <p className="mb-4 font-mono text-[11px] text-faint">referência: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="btn border border-line bg-raised px-3 py-2 text-sm hover:bg-hover"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  )
}
