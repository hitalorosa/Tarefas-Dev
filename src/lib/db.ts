import { PrismaClient } from '../generated/prisma'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Singleton: em dev o HMR do Next recria o modulo a cada troca de arquivo e
// sem isso abriria uma conexao nova por reload ate estourar.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function create() {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db'
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })
}

export const db: PrismaClient = globalForPrisma.prisma ?? create()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
