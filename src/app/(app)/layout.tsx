import Link from 'next/link'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { Sidebar } from '@/components/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace } = await requireMembership()

  const projetos = await db.project.findMany({
    where: { workspaceId: workspace.id, archived: false },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, color: true, icon: true },
  })

  const alertas = await db.ruleViolation.count({
    where: { status: 'aberta', rule: { workspaceId: workspace.id } },
  })

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        workspace={{ name: workspace.name }}
        user={{ name: user.name, email: user.email, color: user.avatarColor }}
        projetos={projetos}
        alertas={alertas}
      />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
