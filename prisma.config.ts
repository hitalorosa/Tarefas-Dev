import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma 7: a url do banco saiu do schema.prisma e vive aqui.
// Trocar pra Postgres = mudar o provider no schema e a DATABASE_URL no .env.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
})
