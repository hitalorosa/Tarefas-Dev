'use client'

import { useActionState } from 'react'
import { entrar, type LoginState } from './actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(entrar, {})

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-xs font-medium text-soft">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          className="field"
          placeholder="voce@empresa.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="senha" className="block text-xs font-medium text-soft">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="field"
          placeholder="••••••••"
        />
      </div>

      {state.erro && (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {state.erro}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn w-full bg-accent text-white hover:bg-accent/90">
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
