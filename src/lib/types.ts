export type CardMarca = { id: string; name: string; color: string } | null

export type CardCampo = {
  fieldName: string
  label: string
  color: string
}

export type CardTarefa = {
  id: string
  name: string
  completed: boolean
  order: number
  startOn: string | null
  dueAt: string | null
  origin: string
  marca: CardMarca
  responsavel: { name: string; color: string } | null
  campos: CardCampo[]
  subtarefas: { total: number; feitas: number }
  /// quem precisa terminar antes desta andar
  travadaPor: { id: string; name: string; completed: boolean }[]
  /// quantas tarefas esperam por esta
  travando: number
  alertas: number
  comentarios: number
}

export type ColunaQuadro = {
  id: string
  name: string
  isDone: boolean
  order: number
  /// coluna gerada por agrupamento (marca, responsável...) — não é seção de verdade,
  /// então não pode ser renomeada nem receber card arrastado
  virtual: boolean
  cor: string | null
  tarefas: CardTarefa[]
}
