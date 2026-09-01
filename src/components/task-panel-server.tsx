import { carregarTarefa } from '@/lib/task-data'
import { TaskPanel } from './task-panel'

/// Carrega a tarefa que o parâmetro ?tarefa= aponta. Some quando o parâmetro
/// não existe, então fechar o painel é só tirar a chave da URL.
export async function PainelTarefa({ taskId }: { taskId?: string }) {
  if (!taskId) return null
  const tarefa = await carregarTarefa(taskId)
  if (!tarefa) return null
  return <TaskPanel tarefa={tarefa} />
}
