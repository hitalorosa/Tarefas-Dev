import { PrismaClient } from '../generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

// Postgres via driver adapter (pg). Sem módulo nativo: compila em qualquer
// runtime serverless, que é onde o better-sqlite3 morria.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function criar() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL ausente — defina a variável de ambiente do banco.')
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

function cliente(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const c = criar()
    // em produção cada instância tem a sua; em dev o HMR recria o módulo a cada
    // salvamento e sem o global abriria uma conexão nova por reload até estourar
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = c
    else return (globalForPrisma.prisma = c)
  }
  return globalForPrisma.prisma
}

/// Proxy preguiçoso: a conexão só nasce no primeiro uso de verdade.
/// Importar este módulo não pode exigir banco — o `next build` avalia os
/// módulos para coletar as rotas, e lá o DATABASE_URL ainda não existe.
export const db = new Proxy({} as PrismaClient, {
  get(_alvo, prop) {
    // receptor de propósito é o cliente, não o proxy: getters internos do
    // Prisma usam `this` e quebrariam se recebessem o proxy
    const c = cliente()
    const valor = Reflect.get(c, prop)
    return typeof valor === 'function' ? valor.bind(c) : valor
  },
})
