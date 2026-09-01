import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { lerEstado, semBanco, usoDoCookie } from '@/lib/estado'
import { Sidebar } from '@/components/sidebar'
import { AvisoSemBanco } from '@/components/aviso-sem-banco'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace } = await requireMembership()

  let projetos: { id: string; name: string; color: string; icon: string }[]
  let alertas = 0
  let uso: { bytes: number; limite: number; pct: number } | null = null

  if (semBanco()) {
    const e = await lerEstado()
    projetos = e.projetos.map((p) => ({ id: p.id, name: p.name, color: p.color, icon: p.icon }))
    alertas = e.tarefas.reduce((n, t) => n + t.alertas, 0)
    uso = usoDoCookie(e)
  } else {
    projetos = await db.project.findMany({
      where: { workspaceId: workspace.id, archived: false },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, color: true, icon: true },
    })
    alertas = await db.ruleViolation.count({
      where: { status: 'aberta', rule: { workspaceId: workspace.id } },
    })
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {uso && <AvisoSemBanco uso={uso} />}
      <div className="flex min-h-0 flex-1">
        <Sidebar
          workspace={{ name: workspace.name }}
          user={{ name: user.name, email: user.email, color: user.avatarColor }}
          projetos={projetos}
          alertas={alertas}
        />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
