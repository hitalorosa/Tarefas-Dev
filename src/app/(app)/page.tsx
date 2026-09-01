import { redirect } from 'next/navigation'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'
import { lerEstado, semBanco } from '@/lib/estado'

export default async function AppIndex() {
  const { workspace } = await requireMembership()

  if (semBanco()) {
    const e = await lerEstado()
    if (!e.projetos[0]) redirect('/config')
    redirect(`/p/${e.projetos[0].id}`)
  }

  const primeiro = await db.project.findFirst({
    where: { workspaceId: workspace.id, archived: false },
    orderBy: { order: 'asc' },
    select: { id: true },
  })
  if (!primeiro) redirect('/config')
  redirect(`/p/${primeiro.id}`)
}
