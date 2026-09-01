import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/// Diagnóstico de implantação: responde o que falta para o app funcionar.
/// Nunca devolve a connection string nem a mensagem crua do banco — só o
/// código do erro e uma explicação, porque a mensagem do driver às vezes
/// carrega host e usuário dentro.
export async function GET() {
  const estado: Record<string, unknown> = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, passo: 'Defina DATABASE_URL nas variáveis de ambiente.', ambiente: estado },
      { status: 503 },
    )
  }

  try {
    const [usuarios, workspaces, projetos] = await Promise.all([
      db.user.count(),
      db.workspace.count(),
      db.project.count(),
    ])

    if (usuarios === 0) {
      return NextResponse.json(
        {
          ok: false,
          passo: 'Banco criado e migrado, mas vazio. Rode o seed: npm run db:seed',
          ambiente: estado,
          contagens: { usuarios, workspaces, projetos },
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      ok: true,
      passo: 'Tudo no lugar.',
      ambiente: estado,
      contagens: { usuarios, workspaces, projetos },
    })
  } catch (e) {
    const codigo = (e as { code?: string }).code ?? (e as Error).name
    const explicacoes: Record<string, string> = {
      P2021: 'As tabelas não existem. Rode as migrações: npm run db:deploy',
      P1001: 'Não consegui alcançar o banco. Confira o host e se o IP está liberado.',
      P1000: 'Usuário ou senha do banco recusados.',
      P1003: 'O banco apontado na URL não existe.',
      '42P01': 'As tabelas não existem. Rode as migrações: npm run db:deploy',
      '28P01': 'Usuário ou senha do banco recusados.',
      ENOTFOUND: 'Host do banco não resolve. Confira a URL.',
      ECONNREFUSED: 'O banco recusou a conexão.',
    }
    return NextResponse.json(
      {
        ok: false,
        passo: explicacoes[codigo] ?? 'Falha ao falar com o banco.',
        codigo,
        ambiente: estado,
      },
      { status: 503 },
    )
  }
}
