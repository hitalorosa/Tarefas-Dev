'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createSession, verifyPassword } from '@/lib/auth'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Digite a senha'),
})

export type LoginState = { erro?: string }

export async function entrar(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    senha: String(formData.get('senha') ?? ''),
  })
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  // só a consulta entra no try: o redirect lá embaixo funciona lançando,
  // e um catch aqui em volta o engoliria
  let user
  try {
    user = await db.user.findUnique({ where: { email: parsed.data.email } })
  } catch {
    return { erro: 'Não consegui falar com o banco de dados. Veja /api/saude para saber o que falta.' }
  }

  // mesma resposta pros dois casos: não entregar quais e-mails existem
  if (!user || !(await verifyPassword(parsed.data.senha, user.passwordHash))) {
    return { erro: 'E-mail ou senha não conferem' }
  }

  await createSession(user.id)
  redirect('/')
}
