// Seed: cria a ESTRUTURA de um workspace de marketing. Sem tarefas — o quadro
// comeca vazio de proposito. Rode com DEMO=1 pra ganhar tarefas de exemplo.
import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'
import { corPorIndice } from '../src/lib/colors.js'

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' }),
})

const EMAIL = 'hitalo@plano.dev'
const SENHA = 'plano123'

/// Padrao "Disparo": gera o par tarefa-do-disparo + tarefa-de-arte, amarrado
/// por dependencia NATIVA, com as datas D-3 / D-1 e a subtarefa COPY.
const SPEC_DISPARO = {
  version: 1,
  inputs: [
    { key: 'data', label: 'Data do disparo', type: 'date', required: true },
    { key: 'tema', label: 'Tema / base', type: 'text', required: true, placeholder: 'Carrinho abandonado' },
    { key: 'cupom', label: 'Cupom', type: 'text', placeholder: 'SETEMBRO20' },
    { key: 'marca', label: 'Marca', type: 'brand', required: true },
    { key: 'pecas', label: 'Quantas imagens', type: 'number', default: 4 },
  ],
  tasks: [
    {
      ref: 'disparo',
      name: 'Disparo {data} - {tema}{cupom? ({cupom})}',
      project: 'operacao',
      section: 'DISPARO API',
      startOffsetDays: -3,
      dueOffsetDays: -1,
      businessDayOnly: true,
      assignee: 'me',
      fields: { Canal: 'DISPARO API' },
      description: [
        'DISPARO {data} — {tema}',
        '',
        'Base: {tema}',
        'Oferta: ',
        'Cupom: {cupom} — validade travada so no dia {data}',
        'Estrutura: teaser + manha + tarde + urgencia',
        'UTM: utm_campaign={dataSlug}',
        '',
        'ACOES',
        '1. Criar o cupom e travar a validade',
        '2. Montar o recorte da base (sem repetir contato de disparo proximo)',
        '3. Programar o envio',
      ].join('\n'),
      subtasks: [{ name: 'COPY', description: 'Teaser + mensagens do dia. Uma secao por mensagem.' }],
    },
    {
      ref: 'arte',
      name: '{temaUpper} | ARTES (IMAGENS)',
      project: 'design',
      section: 'FAZER',
      dueOffsetDays: -2,
      businessDayOnly: true,
      fields: { 'Tipo de peça': 'API', Importância: 'Prioridade' },
      description: [
        '{temaUpper} — {pecas} imagens (1 por mensagem)',
        '',
        'Preencher por peca: HEADING / SUB / Elementos / Botao.',
        'Rosto e prova social nunca gerados por IA.',
      ].join('\n'),
      /// a arte trava o disparo: dependencia de verdade, nao convencao de nome
      blocks: ['disparo'],
    },
  ],
}

const REGRAS = [
  {
    name: 'Tarefa atrasada',
    kind: 'overdue',
    severity: 'grave',
    description: 'Passou do prazo e continua aberta.',
    config: '{}',
  },
  {
    name: 'Entrega sem quem a destrave',
    kind: 'missing_dependency',
    severity: 'grave',
    description:
      'Tarefa criada por um padrao que preve dependencia mas ficou sem ninguem bloqueando. E o furo que fazia disparo ir pro ar sem arte.',
    config: JSON.stringify({ templates: ['Disparo'] }),
  },
  {
    name: 'Tarefa sem data',
    kind: 'missing_date',
    severity: 'aviso',
    description: 'Sem prazo ela nao aparece em cronograma, calendario nem filtro. Some.',
    config: '{}',
  },
  {
    name: 'Aberta na coluna de concluido',
    kind: 'open_in_done',
    severity: 'aviso',
    description: 'Esta na coluna de feito mas nunca foi fechada. Ou foi feita e ninguem marcou, ou nunca foi feita.',
    config: '{}',
  },
  {
    name: 'Tarefa sem marca ou canal',
    kind: 'missing_field',
    severity: 'info',
    description: 'Sem marca e sem canal ela nao entra em nenhum recorte.',
    config: JSON.stringify({ requireBrand: true, fields: ['Canal'] }),
  },
  {
    name: 'Mesma base em disparos proximos',
    kind: 'duplicate_audience',
    severity: 'grave',
    description:
      'Dois disparos da mesma marca a menos de 4 dias com a mesma base. O contato recebe a mesma oferta duas vezes e ela deixa de parecer oportunidade.',
    config: JSON.stringify({ windowDays: 4 }),
  },
  {
    name: 'Isso ja rodou e nao deu certo',
    kind: 'ai_judgment',
    severity: 'aviso',
    description:
      'A IA compara o briefing novo com o que ja foi rodado e teve veredicto "nao funcionou" e avisa antes de mandar pro designer.',
    config: JSON.stringify({ kinds: ['briefing', 'copy'], minSimilarity: 0.6 }),
  },
]

async function main() {
  const existente = await db.user.findUnique({ where: { email: EMAIL } })
  if (existente) {
    console.log('seed ja rodou (usuario existe). nada a fazer.')
    return
  }

  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: 'Hitalo Rosa',
      passwordHash: await bcrypt.hash(SENHA, 10),
      avatarColor: '#6741d9',
    },
  })

  const ws = await db.workspace.create({
    data: {
      name: 'Maxiba Performance',
      slug: 'maxiba',
      members: { create: { userId: user.id, role: 'owner' } },
      aiSettings: { create: { keySource: 'server', model: 'claude-sonnet-5' } },
    },
  })

  // ── marcas: marca e coluna de verdade, nao campo customizado duplicado ──
  const marcas = await Promise.all(
    [
      { name: 'Nouê', color: '#2f9e44', order: 0 },
      { name: 'DrySkin', color: '#1971c2', order: 1 },
      { name: 'New Hair', color: '#e8590c', order: 2 },
    ].map((m) => db.brand.create({ data: { ...m, workspaceId: ws.id } })),
  )

  // ── campos: vivem no workspace, valem em todo projeto ──
  const campos = [
    {
      name: 'Canal',
      options: ['DISPARO API', 'GRUPO VIP', 'SOCIAL MEDIA', 'PÁGINA', 'EMAIL', 'CRIATIVO', 'CRM', 'LANÇAMENTO', 'TIKTOK SHOP'],
    },
    { name: 'Importância', options: ['Normal', 'Prioridade', 'Urgente'] },
    { name: 'Tipo de peça', options: ['API', 'GRUPO VIP', 'CRIATIVO', 'BANNER', 'CAMPANHA', 'SOCIAL MEDIA', 'EMAIL MKT', 'LANÇAMENTO'] },
  ]
  const camposCriados = []
  for (const [i, c] of campos.entries()) {
    camposCriados.push(
      await db.customField.create({
        data: {
          workspaceId: ws.id,
          name: c.name,
          type: 'enum',
          order: i,
          options: { create: c.options.map((label, j) => ({ label, order: j, color: corPorIndice(j) })) },
        },
      }),
    )
  }

  // ── projetos ──
  const projetos = [
    {
      key: 'operacao',
      name: 'Operação',
      color: '#1971c2',
      icon: 'zap',
      sections: ['ROTINA', 'DISPARO API', 'SOCIAL MEDIA', 'A FAZER', 'FAZENDO', 'FEITO'],
    },
    {
      key: 'design',
      name: 'Design',
      color: '#2f9e44',
      icon: 'palette',
      sections: ['FAZER', 'FAZENDO', 'ALTERAÇÃO', 'STAND-BY', 'FEITO'],
    },
  ]

  const criados: Record<string, string> = {}
  for (const [i, p] of projetos.entries()) {
    const proj = await db.project.create({
      data: {
        workspaceId: ws.id,
        name: p.name,
        color: p.color,
        icon: p.icon,
        order: i,
        sections: {
          create: p.sections.map((name, j) => ({ name, order: j * 1000, isDone: name === 'FEITO' })),
        },
        canvases: { create: { name: 'Quadro branco' } },
        fields: { create: camposCriados.map((f, j) => ({ fieldId: f.id, order: j })) },
      },
    })
    criados[p.key] = proj.id
  }

  await db.template.create({
    data: {
      workspaceId: ws.id,
      name: 'Disparo',
      kind: 'disparo',
      description: 'Gera o par disparo + arte, amarrado por dependência, com datas D-3 / D-1 e a subtarefa COPY.',
      spec: JSON.stringify(SPEC_DISPARO),
    },
  })

  for (const r of REGRAS) {
    await db.rule.create({ data: { ...r, workspaceId: ws.id } })
  }

  console.log('workspace:', ws.name, '| projetos:', Object.keys(criados).join(', '))
  console.log('marcas:', marcas.map((m) => m.name).join(', '))
  console.log('campos:', camposCriados.map((c) => c.name).join(', '))
  console.log('regras do guardiao:', REGRAS.length)
  console.log('')
  console.log('  entrar com:', EMAIL, '/', SENHA)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
