import { PrismaClient } from '../generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

// Postgres via driver adapter (pg). Sem módulo nativo: compila em qualquer
// runtime serverless, que é onde o better-sqlite3 morria.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function create() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL ausente')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

export const db: PrismaClient = globalForPrisma.prisma ?? create()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
