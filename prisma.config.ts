import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7: a url do banco saiu do schema.prisma e vive aqui.
//
// NÃO usar o helper env() do Prisma: ele lança quando a variável não existe, e
// isso derruba o `prisma generate` do postinstall no build — mesmo que gerar o
// cliente não dependa de banco nenhum. Só migrate e db pull precisam da url,
// então ela entra como opcional e falha na hora certa, com mensagem clara.
const url = process.env.DATABASE_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(url ? { datasource: { url } } : {}),
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
})
