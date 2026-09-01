/// Paleta das opções de campo e das marcas. Mesma família do quadro,
/// escolhida pra ler bem em fundo escuro sem virar néon.
export const PALETA = [
  { nome: 'Verde', hex: '#51cf66' },
  { nome: 'Menta', hex: '#38d9a9' },
  { nome: 'Azul', hex: '#4dabf7' },
  { nome: 'Índigo', hex: '#748ffc' },
  { nome: 'Violeta', hex: '#9775fa' },
  { nome: 'Rosa', hex: '#f783ac' },
  { nome: 'Vermelho', hex: '#ff6b6b' },
  { nome: 'Laranja', hex: '#ff922b' },
  { nome: 'Amarelo', hex: '#fcc419' },
  { nome: 'Lima', hex: '#a9e34b' },
  { nome: 'Ciano', hex: '#22b8cf' },
  { nome: 'Cinza', hex: '#868e96' },
] as const

export function corPorIndice(i: number) {
  return PALETA[i % PALETA.length].hex
}

export const TIPOS_CAMPO = [
  { valor: 'enum', rotulo: 'Lista suspensa', ajuda: 'Opções fixas e coloridas' },
  { valor: 'text', rotulo: 'Texto', ajuda: 'Texto livre, uma linha' },
  { valor: 'number', rotulo: 'Número', ajuda: 'Valor numérico' },
  { valor: 'date', rotulo: 'Data', ajuda: 'Uma data' },
  { valor: 'person', rotulo: 'Pessoa', ajuda: 'Alguém da equipe' },
] as const
