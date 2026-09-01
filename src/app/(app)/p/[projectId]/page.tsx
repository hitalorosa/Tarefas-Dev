import { carregarQuadro } from '@/lib/board-data'
import { Board } from '@/components/board'
import { BoardToolbar } from '@/components/board-toolbar'
import { PainelTarefa } from '@/components/task-panel-server'

export default async function QuadroPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { projectId } = await params
  const sp = await searchParams
  const { colunas, filtros, marcas, campos, pessoas, podeArrastar } = await carregarQuadro(projectId, sp)

  return (
    <>
      <BoardToolbar filtros={filtros} marcas={marcas} campos={campos} />
      <Board
        projectId={projectId}
        colunasIniciais={colunas}
        podeArrastar={podeArrastar}
        catalogo={{ campos, marcas, pessoas }}
      />
      <PainelTarefa taskId={typeof sp.tarefa === 'string' ? sp.tarefa : undefined} />
    </>
  )
}
