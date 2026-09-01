import 'server-only'
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib'
import { cookies } from 'next/headers'
import {
  CAMPOS_DEMO,
  MARCAS_DEMO,
  MEMBROS_DEMO,
  PROJETOS_DEMO,
  USUARIO_DEMO,
  WORKSPACE_DEMO,
  canvasDemo,
  tarefasDemo,
} from './demo'

/// MODO SEM BANCO
///
/// Enquanto não existe DATABASE_URL, o app guarda o estado num cookie do
/// navegador. O quadro funciona de verdade — criar, mover, concluir, renomear
/// seção, mexer em campo — e cada pessoa tem o seu próprio estado.
///
/// O teto é o do próprio cookie: 4 KB. Por isso a serialização usa chaves de uma
/// letra e só grava o que difere do padrão. Ao estourar, a ação avisa em vez de
/// perder o que já estava salvo.

export const COOKIE_ESTADO = 'plano_estado'
const LIMITE_BYTES = 3800 // 4096 menos nome, atributos e folga

export function semBanco() {
  return !process.env.DATABASE_URL
}

/// Vínculo da tarefa com um quadro. Seção e ordem moram aqui porque cada
/// quadro organiza a mesma tarefa do seu jeito.
export type Vinculo = { projectId: string; sectionId: string; order: number }

export type Tarefa = {
  id: string
  quadros: Vinculo[]
  name: string
  description: string | null
  brandId: string | null
  assigneeId: string | null
  startOn: string | null // AAAA-MM-DD
  dueAt: string | null
  startTime: string | null // HH:MM
  dueTime: string | null
  recurrence: string | null
  completed: boolean
  origin: string
  fieldValues: { fieldId: string; optionId: string }[]
  blockedByIds: string[]
  subtasks: { id: string; name: string; completed: boolean }[]
  comentarios: number
  alertas: number
}

export type Secao = { id: string; projectId: string; name: string; order: number; isDone: boolean }

export type Projeto = {
  id: string
  name: string
  color: string
  icon: string
  description: string | null
  status: string | null
  favorito: boolean
}

export type Campo = {
  id: string
  name: string
  type: string
  projetos: string[]
  options: { id: string; label: string; color: string }[]
}

export type Estado = {
  projetos: Projeto[]
  secoes: Secao[]
  tarefas: Tarefa[]
  marcas: { id: string; name: string; color: string }[]
  campos: Campo[]
  canvas: Record<string, string> // projectId -> elements JSON
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/// Estado de partida: o mesmo conjunto de exemplo, já montado.
export function estadoPadrao(): Estado {
  return {
    projetos: PROJETOS_DEMO.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      icon: p.icon,
      description: p.description,
      status: p.status,
      favorito: false,
    })),
    secoes: PROJETOS_DEMO.flatMap((p) =>
      p.sections.map((s) => ({
        id: s.id,
        projectId: p.id,
        name: s.name,
        order: s.order,
        isDone: s.isDone,
      })),
    ),
    tarefas: tarefasDemo().map((t) => ({
      id: t.id,
      quadros: [{ projectId: t.projectId, sectionId: t.sectionId, order: t.order }],
      name: t.name,
      description: t.description,
      brandId: t.brandId,
      assigneeId: t.assigneeId,
      startOn: iso(t.startOn),
      dueAt: iso(t.dueAt),
      startTime: null,
      dueTime: null,
      recurrence: null,
      completed: t.completed,
      origin: t.origin,
      fieldValues: t.fieldValues.map((v) => ({ fieldId: v.fieldId, optionId: v.optionId })),
      blockedByIds: t.blockedBy.map((b) => b.blocker.id),
      subtasks: t.subtasks,
      comentarios: t._count.comments,
      alertas: t._count.violations,
    })),
    marcas: MARCAS_DEMO.map((m) => ({ id: m.id, name: m.name, color: m.color })),
    campos: CAMPOS_DEMO.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      projetos: PROJETOS_DEMO.map((p) => p.id),
      options: c.options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
    })),
    canvas: Object.fromEntries(PROJETOS_DEMO.map((p) => [p.id, canvasDemo(p.id).elements])),
  }
}

// ── serialização compacta ────────────────────────────────────────────────────
// Descrição e canvas ficam de fora do cookie de propósito: são os dois campos
// que estouram 4 KB sozinhos. Eles continuam vindo do padrão.

const VERSAO = 4

type Compacto = {
  /// muda quando o formato muda. Cookie de versão antiga é descartado em vez de
  /// ser lido de través — posição de campo trocada vira dado sem sentido.
  v?: number
  p: [string, string, string, string | null, number][] // id, nome, cor, status, favorito
  s: [string, string, string, number, number][] // id, projeto, nome, ordem, isDone
  /// id, nome, marca, início, fim, concluída, opções, subtarefas, quadros, hora, repetição
  t: [
    string,
    string,
    string | null,
    string | null,
    string | null,
    number,
    string,
    string,
    string,
    string | null,
    string | null,
    string | null,
  ][]
  c: [string, string, string[], [string, string, string][]][] // id, nome, projetos, opcoes
}

/// JSON puro no cookie inflava 67% porque aspas e chaves viram %22 e %7B.
/// Brotli + base64url resolve: o alfabeto do base64url passa intacto pela
/// codificação de cookie, e o conteúdo é repetitivo, então comprime muito
/// (18 tarefas: 3 KB de JSON viram 1,4 KB; 144 tarefas ainda cabem).
function comprimir(e: Estado): string {
  const c: Compacto = {
    v: VERSAO,
    p: e.projetos.map((p) => [p.id, p.name, p.color, p.status, p.favorito ? 1 : 0]),
    s: e.secoes.map((s) => [s.id, s.projectId, s.name, s.order, s.isDone ? 1 : 0]),
    t: e.tarefas.map((t) => [
      t.id,
      t.name,
      t.brandId,
      t.startOn,
      t.dueAt,
      t.completed ? 1 : 0,
      t.fieldValues.map((v) => v.optionId).join('|'),
      // subtarefa é "nome~0|nome~1"; o til não aparece em nome de tarefa
      t.subtasks.map((x) => `${x.name.replace(/[~|]/g, ' ')}~${x.completed ? 1 : 0}`).join('|'),
      // vínculo é "projeto~seção~ordem"
      t.quadros.map((q) => `${q.projectId}~${q.sectionId}~${q.order}`).join('|'),
      t.startTime,
      t.dueTime,
      t.recurrence,
    ]),
    c: e.campos.map((f) => [f.id, f.name, f.projetos, f.options.map((o) => [o.id, o.label, o.color])]),
  }
  return brotliCompressSync(Buffer.from(JSON.stringify(c), 'utf8')).toString('base64url')
}

function descomprimir(bruto: string): Estado | null {
  try {
    const c = JSON.parse(
      brotliDecompressSync(Buffer.from(bruto, 'base64url')).toString('utf8'),
    ) as Compacto
    if (c.v !== VERSAO) return null
    const padrao = estadoPadrao()
    const porId = new Map(padrao.tarefas.map((t) => [t.id, t]))

    const opcoes = new Map<string, string>() // optionId -> fieldId
    for (const [fid, , , ops] of c.c) for (const [oid] of ops) opcoes.set(oid, fid)

    return {
      projetos: c.p.map(([id, name, color, status, fav]) => {
        const base = padrao.projetos.find((p) => p.id === id)
        return {
          id,
          name,
          color,
          status,
          favorito: !!fav,
          icon: base?.icon ?? 'folder',
          description: base?.description ?? null,
        }
      }),
      secoes: c.s.map(([id, projectId, name, order, isDone]) => ({
        id,
        projectId,
        name,
        order,
        isDone: !!isDone,
      })),
      tarefas: c.t.map(([id, name, brandId, startOn, dueAt, completed, ops, subs, quadros, startTime, dueTime, recurrence]) => {
        const base = porId.get(id)
        return {
          id,
          name,
          brandId,
          startOn,
          dueAt,
          startTime: startTime ?? null,
          dueTime: dueTime ?? null,
          recurrence: recurrence ?? null,
          completed: !!completed,
          quadros: (quadros ?? '')
            .split('|')
            .filter(Boolean)
            .map((v) => {
              const [projectId, sectionId, order] = v.split('~')
              return { projectId, sectionId, order: Number(order) || 0 }
            }),
          description: base?.description ?? null,
          assigneeId: base?.assigneeId ?? null,
          origin: base?.origin ?? 'human',
          fieldValues: ops
            ? ops
                .split('|')
                .filter(Boolean)
                .flatMap((oid) => {
                  const fid = opcoes.get(oid)
                  return fid ? [{ fieldId: fid, optionId: oid }] : []
                })
            : [],
          blockedByIds: base?.blockedByIds ?? [],
          // cookie gravado antes das subtarefas existirem não traz o campo:
          // cair no padrão é melhor do que apagar a lista de quem já usava
          subtasks: subs !== undefined
            ? subs.split('|').filter(Boolean).map((item, i) => {
                const corte = item.lastIndexOf('~')
                return {
                  id: `${id}-s${i}`,
                  name: corte > 0 ? item.slice(0, corte) : item,
                  completed: item.slice(corte + 1) === '1',
                }
              })
            : (base?.subtasks ?? []),
          comentarios: base?.comentarios ?? 0,
          alertas: base?.alertas ?? 0,
        }
      }),
      marcas: padrao.marcas,
      campos: c.c.map(([id, name, projetos, ops]) => ({
        id,
        name,
        type: padrao.campos.find((f) => f.id === id)?.type ?? 'enum',
        projetos,
        options: ops.map(([oid, label, color]) => ({ id: oid, label, color })),
      })),
      canvas: padrao.canvas,
    }
  } catch {
    return null
  }
}

// ── leitura e escrita ────────────────────────────────────────────────────────

export async function lerEstado(): Promise<Estado> {
  const jar = await cookies()
  const bruto = jar.get(COOKIE_ESTADO)?.value
  if (!bruto) return estadoPadrao()
  return descomprimir(bruto) ?? estadoPadrao()
}

export type ResultadoGravacao = { ok: true } | { ok: false; erro: string }

export async function gravarEstado(e: Estado): Promise<ResultadoGravacao> {
  const valor = comprimir(e)
  if (valor.length > LIMITE_BYTES) {
    return {
      ok: false,
      erro:
        'O cookie chegou ao limite de 4 KB e esta mudança não coube. Apague alguma tarefa, ou ligue o banco de dados para não ter esse teto.',
    }
  }
  const jar = await cookies()
  jar.set(COOKIE_ESTADO, valor, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })
  return { ok: true }
}

/// Quanto do cookie já foi usado — a interface mostra isso para o limite não
/// chegar de surpresa.
export function usoDoCookie(e: Estado) {
  const bytes = comprimir(e).length
  return { bytes, limite: LIMITE_BYTES, pct: Math.min(100, Math.round((bytes / LIMITE_BYTES) * 100)) }
}

export async function limparEstado() {
  const jar = await cookies()
  jar.delete(COOKIE_ESTADO)
}

// ── identidade sem banco ─────────────────────────────────────────────────────

export const USUARIO = USUARIO_DEMO
export const WORKSPACE = WORKSPACE_DEMO
export const MEMBROS = MEMBROS_DEMO

export function canvasSemBanco(projectId: string) {
  return canvasDemo(projectId)
}

/// Lê, altera e grava. Todas as ações do modo sem banco passam por aqui.
export async function mutar(fn: (e: Estado) => void): Promise<ResultadoGravacao> {
  const e = await lerEstado()
  fn(e)
  return gravarEstado(e)
}

export function novoId() {
  return Math.random().toString(36).slice(2, 9)
}

/// Tarefas do cookie no mesmo formato que o Prisma devolve (Date em vez de
/// string, relações embutidas). Deixa as vistas de Painel, Calendário,
/// Cronograma e Visão geral funcionarem sem duplicar o mapeamento.
export async function tarefasComoPrisma(projectId?: string) {
  const e = await lerEstado()
  const data = (s: string | null) => (s ? new Date(`${s}T12:00:00`) : null)

  return e.tarefas
    .filter((t) => !projectId || t.quadros.some((q) => q.projectId === projectId))
    .map((t) => {
      // quando o projeto foi pedido, seção e ordem vêm do vínculo daquele quadro
      const vinculo = projectId ? t.quadros.find((q) => q.projectId === projectId) : t.quadros[0]
      return {
      id: t.id,
      name: t.name,
      description: t.description,
      completed: t.completed,
      completedAt: t.completed ? data(t.dueAt) : null,
      startOn: data(t.startOn),
      dueAt: data(t.dueAt),
      startTime: t.startTime,
      dueTime: t.dueTime,
      recurrence: t.recurrence,
      updatedAt: data(t.dueAt) ?? new Date(),
      order: vinculo?.order ?? 0,
      projectId: vinculo?.projectId ?? '',
      sectionId: vinculo?.sectionId ?? null,
      brandId: t.brandId,
      assigneeId: t.assigneeId,
      brand: e.marcas.find((m) => m.id === t.brandId) ?? null,
      assignee: (() => {
        const m = MEMBROS_DEMO.find((x) => x.id === t.assigneeId)
        return m ? { id: m.id, name: m.user.name, avatarColor: m.user.avatarColor } : null
      })(),
      section: (() => {
        const s = e.secoes.find((x) => x.id === vinculo?.sectionId)
        return s ? { id: s.id, name: s.name } : null
      })(),
      blockedBy: t.blockedByIds.flatMap((id) => {
        const b = e.tarefas.find((x) => x.id === id)
        return b ? [{ blocker: { name: b.name, completed: b.completed } }] : []
      }),
      }
    })
}
