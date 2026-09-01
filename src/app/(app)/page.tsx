import { redirect } from 'next/navigation'
import { requireMembership } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function AppIndex() {
  const { workspace } = await requireMembership()
  const primeiro = await db.project.findFirst({
    where: { workspaceId: workspace.id, archived: false },
    orderBy: { order: 'asc' },
    select: { id: true },
  })
  if (!primeiro) redirect('/config')
  redirect(`/p/${primeiro.id}`)
}
