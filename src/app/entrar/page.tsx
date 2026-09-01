import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { semBanco } from '@/lib/estado'
import { LoginForm } from './login-form'

export default async function EntrarPage() {
  if (await getCurrentUser()) redirect('/')

  return (
    <main className="grid min-h-full place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-[15px] font-bold text-white">
              P
            </div>
            <span className="text-lg font-semibold tracking-tight">Plano</span>
          </div>
          <p className="text-sm leading-relaxed text-soft">
            O quadro, o canvas e o histórico da equipe no mesmo lugar.
          </p>
        </div>
        {semBanco() && (
          <p className="mb-4 rounded-lg border border-line bg-surface px-3 py-2.5 text-[12px] leading-relaxed text-soft">
            Ainda sem banco de dados. Entre com qualquer e-mail e senha — o quadro funciona e fica salvo
            num cookie deste navegador.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  )
}
