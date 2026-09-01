import { carregarQuadro } from '@/lib/board-data'
import { BoardToolbar } from '@/components/board-toolbar'
import { PainelTarefa } from '@/components/task-panel-server'
import { ListaTarefas } from '@/components/lista-tarefas'

export default async function ListaPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { projectId } = await params
  const sp = await searchParams
  const { colunas, filtros, marcas, campos } = await carregarQuadro(projectId, sp)

  return (
    <>
      <BoardToolbar filtros={filtros} marcas={marcas} campos={campos} />
      <ListaTarefas grupos={colunas} />
      <PainelTarefa taskId={typeof sp.tarefa === 'string' ? sp.tarefa : undefined} />
    </>
  )
}
