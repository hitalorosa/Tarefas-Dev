import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { USUARIO, WORKSPACE, semBanco } from './estado'

const COOKIE = 'plano_session'
const COOKIE_SEM_BANCO = 'plano_entrou'
const MAX_AGE_S = 60 * 60 * 24 * 30

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash)
}

export async function createSession(userId: string) {
  // sem banco não há tabela de sessão: um cookie simples marca que entrou
  if (semBanco()) {
    const jar = await cookies()
    jar.set(COOKIE_SEM_BANCO, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE_S,
    })
    return
  }

  const id = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + MAX_AGE_S * 1000)
  await db.session.create({ data: { id, userId, expiresAt } })
  const jar = await cookies()
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const jar = await cookies()
  if (semBanco()) {
    jar.delete(COOKIE_SEM_BANCO)
    return
  }
  const id = jar.get(COOKIE)?.value
  if (id) await db.session.deleteMany({ where: { id } })
  jar.delete(COOKIE)
}

export async function getCurrentUser() {
  const jar = await cookies()

  if (semBanco()) {
    return jar.get(COOKIE_SEM_BANCO)?.value ? USUARIO : null
  }

  const id = jar.get(COOKIE)?.value
  if (!id) return null

  // banco fora do ar não pode derrubar a página inteira: sem sessão legível a
  // resposta segura é "não autenticado", e aí a tela de login aparece normal
  let session
  try {
    session = await db.session.findUnique({ where: { id }, include: { user: true } })
  } catch {
    return null
  }
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id } }).catch(() => {})
    return null
  }
  return session.user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar')
  return user
}

/// Usuario + workspace ativo (o primeiro do qual ele e membro).
export async function requireMembership() {
  const user = await requireUser()

  if (semBanco()) {
    return { user: USUARIO, workspace: WORKSPACE, role: 'owner' }
  }

  const membership = await db.workspaceMember.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) redirect('/comecar')
  return { user, workspace: membership.workspace, role: membership.role }
}
