/// MODO DEMONSTRAÇÃO
///
/// Sem DATABASE_URL o app não cai: ele serve este conjunto de dados em memória.
/// Serve para ver a estrutura inteira funcionando antes de existir banco.
/// É somente leitura — as ações de escrita saem pela porta dos fundos sem gravar
/// nada, e a interface avisa. Assim que a variável existir, o modo some sozinho.

export function modoDemo() {
  return !process.env.DATABASE_URL
}

const HOJE = () => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d
}

/// datas relativas a hoje: o calendário e o cronograma nunca ficam com cara de morto
function dia(offset: number) {
  const d = HOJE()
  d.setDate(d.getDate() + offset)
  return d
}

export const USUARIO_DEMO = {
  id: 'demo-user',
  name: 'Hitalo Rosa',
  email: 'hitalo@plano.dev',
  avatarColor: '#6741d9',
  passwordHash: '',
  createdAt: HOJE(),
}

export const WORKSPACE_DEMO = {
  id: 'demo-ws',
  name: 'Maxiba Performance',
  slug: 'maxiba',
  createdAt: HOJE(),
}

export const MEMBROS_DEMO = [
  { id: 'm1', role: 'owner', user: { name: 'Hitalo Rosa', email: 'hitalo@plano.dev', avatarColor: '#6741d9' } },
  { id: 'm2', role: 'member', user: { name: 'Paulo André', email: 'paulo@exemplo.com', avatarColor: '#f783ac' } },
  { id: 'm3', role: 'member', user: { name: 'Luan Nakamura', email: 'luan@exemplo.com', avatarColor: '#4dabf7' } },
  { id: 'm4', role: 'member', user: { name: 'Eduardo', email: 'eduardo@exemplo.com', avatarColor: '#38d9a9' } },
]

export const MARCAS_DEMO = [
  { id: 'b-noue', name: 'Nouê', color: '#2f9e44', order: 0 },
  { id: 'b-dry', name: 'DrySkin', color: '#1971c2', order: 1 },
  { id: 'b-nh', name: 'New Hair', color: '#e8590c', order: 2 },
]

export const CAMPOS_DEMO = [
  {
    id: 'f-canal',
    name: 'Canal',
    type: 'enum',
    options: [
      { id: 'o-api', label: 'DISPARO API', color: '#51cf66' },
      { id: 'o-vip', label: 'GRUPO VIP', color: '#38d9a9' },
      { id: 'o-social', label: 'SOCIAL MEDIA', color: '#4dabf7' },
      { id: 'o-pagina', label: 'PÁGINA', color: '#748ffc' },
      { id: 'o-email', label: 'EMAIL', color: '#9775fa' },
      { id: 'o-criativo', label: 'CRIATIVO', color: '#f783ac' },
    ],
  },
  {
    id: 'f-imp',
    name: 'Importância',
    type: 'enum',
    options: [
      { id: 'o-normal', label: 'Normal', color: '#51cf66' },
      { id: 'o-pri', label: 'Prioridade', color: '#ff922b' },
      { id: 'o-urg', label: 'Urgente', color: '#ff6b6b' },
    ],
  },
  {
    id: 'f-tipo',
    name: 'Tipo de peça',
    type: 'enum',
    options: [
      { id: 'o-t-api', label: 'API', color: '#51cf66' },
      { id: 'o-t-vip', label: 'GRUPO VIP', color: '#38d9a9' },
      { id: 'o-t-banner', label: 'BANNER', color: '#4dabf7' },
      { id: 'o-t-camp', label: 'CAMPANHA', color: '#748ffc' },
    ],
  },
]

export const PROJETOS_DEMO = [
  {
    id: 'p-op',
    name: 'Operação',
    color: '#1971c2',
    icon: 'zap',
    description:
      'Disparos, grupo VIP e rotina da operação. Cada disparo nasce em par com a arte que o destrava.',
    status: 'em_dia' as string | null,
    statusNote: null,
    archived: false,
    order: 0,
    workspaceId: WORKSPACE_DEMO.id,
    createdAt: HOJE(),
    sections: [
      { id: 's-rotina', name: 'ROTINA', order: 0, isDone: false, projectId: 'p-op' },
      { id: 's-api', name: 'DISPARO API', order: 1000, isDone: false, projectId: 'p-op' },
      { id: 's-social', name: 'SOCIAL MEDIA', order: 2000, isDone: false, projectId: 'p-op' },
      { id: 's-fazer', name: 'A FAZER', order: 3000, isDone: false, projectId: 'p-op' },
      { id: 's-fazendo', name: 'FAZENDO', order: 4000, isDone: false, projectId: 'p-op' },
      { id: 's-feito', name: 'FEITO', order: 5000, isDone: true, projectId: 'p-op' },
    ],
  },
  {
    id: 'p-design',
    name: 'Design',
    color: '#2f9e44',
    icon: 'palette',
    description: 'Fila do designer. As artes que travam disparo entram aqui com prioridade.',
    status: 'em_risco' as string | null,
    statusNote: null,
    archived: false,
    order: 1,
    workspaceId: WORKSPACE_DEMO.id,
    createdAt: HOJE(),
    sections: [
      { id: 'd-fazer', name: 'FAZER', order: 0, isDone: false, projectId: 'p-design' },
      { id: 'd-fazendo', name: 'FAZENDO', order: 1000, isDone: false, projectId: 'p-design' },
      { id: 'd-alt', name: 'ALTERAÇÃO', order: 2000, isDone: false, projectId: 'p-design' },
      { id: 'd-standby', name: 'STAND-BY', order: 3000, isDone: false, projectId: 'p-design' },
      { id: 'd-feito', name: 'FEITO', order: 4000, isDone: true, projectId: 'p-design' },
    ],
  },
]

type Semente = {
  id: string
  nome: string
  projeto: string
  secao: string
  marca?: string
  resp?: number
  inicio?: number
  fim?: number
  feita?: boolean
  campos?: string[]
  subs?: [number, number]
  travadaPor?: string[]
  comentarios?: number
  alertas?: number
  origem?: string
  descricao?: string
}

const SEMENTES: Semente[] = [
  // ── Operação ──────────────────────────────────────────────────────────────
  {
    id: 't1',
    nome: 'Disparo 09/09 - Carrinho abandonado (VOLTA20)',
    projeto: 'p-op',
    secao: 's-api',
    marca: 'b-dry',
    resp: 0,
    inicio: -3,
    fim: -1,
    campos: ['o-api', 'o-pri'],
    subs: [0, 1],
    travadaPor: ['t10'],
    comentarios: 2,
    descricao: [
      'DISPARO — Carrinho abandonado',
      '',
      'Base: quem largou carrinho nos últimos 14 dias.',
      'Oferta: kit de 2 por R$ 103,92 (de R$ 129,90).',
      'Cupom: VOLTA20, validade travada só no dia.',
      'Estrutura: teaser + manhã + tarde + urgência. 4 mensagens, 4 imagens.',
      '',
      'AÇÕES',
      '1. Criar o cupom e travar a validade',
      '2. Montar o recorte da base, sem repetir contato do disparo anterior',
      '3. Programar o envio',
    ].join('\n'),
  },
  {
    id: 't2',
    nome: 'Disparo 12/09 - Mês do Cliente (CLIENTE10)',
    projeto: 'p-op',
    secao: 's-api',
    marca: 'b-noue',
    resp: 0,
    inicio: 1,
    fim: 3,
    campos: ['o-api', 'o-pri'],
    subs: [0, 1],
    travadaPor: ['t11'],
  },
  {
    id: 't3',
    nome: 'Grupo VIP - mensagens diárias de setembro',
    projeto: 'p-op',
    secao: 's-api',
    marca: 'b-noue',
    resp: 0,
    inicio: -1,
    fim: 4,
    campos: ['o-vip'],
    subs: [4, 12],
    comentarios: 1,
  },
  {
    id: 't4',
    nome: 'BAIXAR TOP VÍDEOS TIKTOK',
    projeto: 'p-op',
    secao: 's-rotina',
    marca: 'b-noue',
    resp: 0,
    fim: 6,
    campos: ['o-social'],
  },
  {
    id: 't5',
    nome: 'SUBIR VÍDEOS YOUTUBE',
    projeto: 'p-op',
    secao: 's-fazer',
    marca: 'b-dry',
    resp: 0,
    fim: -2,
    campos: ['o-social', 'o-pri'],
    alertas: 1,
  },
  {
    id: 't6',
    nome: 'Página modelo Hidraboom',
    projeto: 'p-op',
    secao: 's-fazer',
    marca: 'b-dry',
    resp: 2,
    campos: ['o-pagina', 'o-normal'],
    alertas: 1,
  },
  {
    id: 't7',
    nome: 'Régua de 30 e-mails de setembro',
    projeto: 'p-op',
    secao: 's-fazendo',
    marca: 'b-noue',
    resp: 0,
    fim: 2,
    campos: ['o-email', 'o-pri'],
    subs: [7, 30],
    comentarios: 3,
  },
  {
    id: 't8',
    nome: 'Carrossel institucional - semana 2',
    projeto: 'p-op',
    secao: 's-social',
    marca: 'b-dry',
    resp: 3,
    fim: 5,
    campos: ['o-social'],
  },
  {
    id: 't9',
    nome: 'Banner do site - Mês do Cliente',
    projeto: 'p-op',
    secao: 's-feito',
    marca: 'b-dry',
    resp: 1,
    fim: -4,
    feita: true,
    campos: ['o-pagina'],
  },
  {
    id: 't20',
    nome: 'Campanha de retargeting - setembro',
    projeto: 'p-op',
    secao: 's-feito',
    marca: 'b-noue',
    resp: 3,
    fim: -6,
    feita: true,
    campos: ['o-criativo'],
  },

  // ── Design ────────────────────────────────────────────────────────────────
  {
    id: 't10',
    nome: 'CARRINHO ABANDONADO | ARTES (IMAGENS)',
    projeto: 'p-design',
    secao: 'd-fazendo',
    marca: 'b-dry',
    resp: 1,
    fim: -1,
    campos: ['o-t-api', 'o-urg'],
    comentarios: 1,
    alertas: 1,
    descricao: [
      'CARRINHO ABANDONADO — 4 imagens (1 por mensagem)',
      '',
      'IMG 1 — TEASER',
      'HEADING: SEU CARRINHO CONTINUA ABERTO',
      'SUB: kit de 2 por R$ 103,92, só até 23h59',
      'Elementos: ícone de carrinho com 2 frascos dentro · fundo verde água · tag de preço com o 129,90 riscado',
      'Botão: VER CARRINHO',
      '',
      'IMG 2 — MANHÃ',
      'HEADING: DE R$ 129,90 POR R$ 103,92',
      'SUB: mês novo, oferta nova',
      'Elementos: 2 frascos cruzados, o da frente 15% maior · cupom VOLTA20 em pill · selo FRETE GRÁTIS',
      'Botão: QUERO FECHAR',
      '',
      'Rosto e prova social nunca gerados por IA.',
    ].join('\n'),
  },
  {
    id: 't11',
    nome: 'MÊS DO CLIENTE | ARTES (IMAGENS)',
    projeto: 'p-design',
    secao: 'd-fazer',
    marca: 'b-noue',
    resp: 1,
    fim: 2,
    campos: ['o-t-api', 'o-pri'],
  },
  {
    id: 't12',
    nome: 'GRUPO VIP | 12 imagens diárias',
    projeto: 'p-design',
    secao: 'd-fazer',
    marca: 'b-noue',
    resp: 1,
    inicio: 0,
    fim: 4,
    campos: ['o-t-vip', 'o-pri'],
    subs: [3, 12],
  },
  {
    id: 't13',
    nome: 'BANNER SITE - aniversário Camuflage',
    projeto: 'p-design',
    secao: 'd-fazer',
    marca: 'b-noue',
    resp: 1,
    fim: 7,
    campos: ['o-t-banner'],
  },
  {
    id: 't14',
    nome: '20 estáticos - lote de setembro',
    projeto: 'p-design',
    secao: 'd-alt',
    marca: 'b-dry',
    resp: 1,
    fim: 1,
    campos: ['o-t-camp'],
    comentarios: 4,
  },
  {
    id: 't15',
    nome: 'MOLETOM MOCKUP - Nouê Estrelas',
    projeto: 'p-design',
    secao: 'd-standby',
    marca: 'b-noue',
    resp: 1,
    campos: ['o-t-camp'],
    alertas: 1,
  },
  {
    id: 't16',
    nome: 'Estáticos novo formato',
    projeto: 'p-design',
    secao: 'd-standby',
    marca: 'b-nh',
    resp: 1,
    alertas: 1,
  },
  {
    id: 't17',
    nome: 'CARROSSEL - lançamento',
    projeto: 'p-design',
    secao: 'd-feito',
    marca: 'b-dry',
    resp: 1,
    fim: -5,
    feita: true,
    campos: ['o-t-camp'],
  },
]

const opcaoPorId = new Map(
  CAMPOS_DEMO.flatMap((c) => c.options.map((o) => [o.id, { campo: c, opcao: o }] as const)),
)

export type TarefaDemo = ReturnType<typeof montarTarefa>

function montarTarefa(s: Semente) {
  const marca = MARCAS_DEMO.find((m) => m.id === s.marca) ?? null
  const membro = s.resp != null ? MEMBROS_DEMO[s.resp] : null
  const projeto = PROJETOS_DEMO.find((p) => p.id === s.projeto)!
  const secao = projeto.sections.find((x) => x.id === s.secao)!

  return {
    id: s.id,
    workspaceId: WORKSPACE_DEMO.id,
    projectId: s.projeto,
    sectionId: s.secao,
    parentId: null as string | null,
    name: s.nome,
    description: s.descricao ?? null,
    origin: s.origem ?? 'human',
    completed: !!s.feita,
    completedAt: s.feita ? dia(s.fim ?? 0) : null,
    order: (SEMENTES.indexOf(s) + 1) * 1000,
    startOn: s.inicio != null ? dia(s.inicio) : null,
    dueAt: s.fim != null ? dia(s.fim) : null,
    createdAt: dia(-10),
    updatedAt: dia(s.fim ?? 0),
    brandId: marca?.id ?? null,
    brand: marca,
    assigneeId: membro ? membro.id : null,
    assignee: membro ? { id: membro.id, name: membro.user.name, avatarColor: membro.user.avatarColor } : null,
    section: { id: secao.id, name: secao.name },
    subtasks: Array.from({ length: s.subs?.[1] ?? 0 }, (_, i) => ({ completed: i < (s.subs?.[0] ?? 0) })),
    fieldValues: (s.campos ?? []).flatMap((oid) => {
      const achado = opcaoPorId.get(oid)
      if (!achado) return []
      return [
        {
          fieldId: achado.campo.id,
          optionId: achado.opcao.id,
          field: { id: achado.campo.id, name: achado.campo.name },
          option: { id: achado.opcao.id, label: achado.opcao.label, color: achado.opcao.color },
        },
      ]
    }),
    blockedBy: (s.travadaPor ?? []).flatMap((id) => {
      const b = SEMENTES.find((x) => x.id === id)
      if (!b) return []
      return [{ blocker: { id: b.id, name: b.nome, completed: !!b.feita } }]
    }),
    _count: {
      blocking: SEMENTES.filter((x) => (x.travadaPor ?? []).includes(s.id)).length,
      violations: s.alertas ?? 0,
      comments: s.comentarios ?? 0,
    },
  }
}

export function tarefasDemo(projectId?: string) {
  const todas = SEMENTES.map(montarTarefa)
  return projectId ? todas.filter((t) => t.projectId === projectId) : todas
}

export function projetoDemo(projectId: string) {
  return PROJETOS_DEMO.find((p) => p.id === projectId) ?? null
}

/// Cena inicial do canvas: um mapa do fluxo do disparo, para o quadro branco
/// não abrir vazio na demonstração.
export function canvasDemo(projectId: string) {
  const caixa = (i: number, x: number, y: number, texto: string, cor: string, largura = 230) => [
    {
      id: `demo-r${i}`,
      type: 'rectangle',
      x,
      y,
      width: largura,
      height: 78,
      angle: 0,
      strokeColor: cor,
      backgroundColor: `${cor}22`,
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: 1000 + i,
      version: 2,
      versionNonce: 2000 + i,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    },
    {
      id: `demo-t${i}`,
      type: 'text',
      x: x + 16,
      y: y + 20,
      width: largura - 32,
      height: 40,
      angle: 0,
      // o tema escuro do Excalidraw inverte a cena: escrever escuro aqui
      // e o que sai claro na tela
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: 3000 + i,
      version: 2,
      versionNonce: 4000 + i,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
      text: texto,
      fontSize: 16,
      fontFamily: 2,
      textAlign: 'left',
      verticalAlign: 'top',
      containerId: null,
      originalText: texto,
      lineHeight: 1.25,
      baseline: 16,
    },
  ]

  const seta = (i: number, x: number, y: number, dx: number, dy: number) => ({
    id: `demo-a${i}`,
    type: 'arrow',
    x,
    y,
    width: Math.abs(dx) || 1,
    height: Math.abs(dy) || 1,
    angle: 0,
    strokeColor: '#5f677a',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 2 },
    seed: 5000 + i,
    version: 2,
    versionNonce: 6000 + i,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    points: [
      [0, 0],
      [dx, dy],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
  })

  const elements = [
    ...caixa(1, 60, 60, 'D-5\nDecidir base, oferta e cupom', '#ffc078'),
    ...caixa(2, 60, 200, 'D-4\nNasce a tarefa de ARTES', '#51cf66'),
    ...caixa(3, 60, 340, 'D-3\nNasce a tarefa do DISPARO', '#4dabf7'),
    ...caixa(4, 360, 200, 'Designer entrega\ne a arte destrava o disparo', '#9775fa'),
    ...caixa(5, 360, 340, 'D-1\nCupom, base e envio programado', '#4dabf7'),
    ...caixa(6, 660, 340, 'D\nO disparo sai', '#ffc078', 180),
    seta(1, 175, 142, 0, 52),
    seta(2, 175, 282, 0, 52),
    seta(3, 296, 239, 56, 0),
    seta(4, 475, 282, 0, 52),
    seta(5, 596, 379, 56, 0),
  ]

  return {
    id: `canvas-${projectId}`,
    projectId,
    name: 'Quadro branco',
    elements: JSON.stringify(elements),
    appState: JSON.stringify({ scrollX: 40, scrollY: 20, zoom: { value: 0.9 } }),
    files: '{}',
    createdAt: HOJE(),
    updatedAt: HOJE(),
  }
}
