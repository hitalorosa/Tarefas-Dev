import 'server-only'
import { cookies } from 'next/headers'
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib'
import { semBanco } from './estado'

/// HISTÓRICO DA TAREFA
///
/// Sem banco ele mora num cookie SEPARADO do estado. Dois motivos: histórico
/// cresce sem parar e o estado não pode ficar refém disso, e se o histórico
/// estourar o limite o pior que acontece é perder registro antigo — nunca a
/// tarefa em si.

const COOKIE = 'plano_atividade'
const LIMITE_BYTES = 3800
const MAXIMO = 60 // registros guardados no total, os mais recentes

export type Atividade = {
  taskId: string
  texto: string
  /// milissegundos desde a época. Guardado assim porque comprime melhor que ISO.
  quando: number
  autor: string
}

type Compacto = [string, string, number, string][]

function comprimir(lista: Atividade[]): string {
  const c: Compacto = lista.map((a) => [a.taskId, a.texto, a.quando, a.autor])
  return brotliCompressSync(Buffer.from(JSON.stringify(c), 'utf8')).toString('base64url')
}

function descomprimir(bruto: string): Atividade[] {
  try {
    const c = JSON.parse(
      brotliDecompressSync(Buffer.from(bruto, 'base64url')).toString('utf8'),
    ) as Compacto
    return c.map(([taskId, texto, quando, autor]) => ({ taskId, texto, quando, autor }))
  } catch {
    return []
  }
}

export async function lerAtividades(taskId?: string): Promise<Atividade[]> {
  const jar = await cookies()
  const bruto = jar.get(COOKIE)?.value
  if (!bruto) return []
  const todas = descomprimir(bruto)
  return taskId ? todas.filter((a) => a.taskId === taskId) : todas
}

/// Anota o que aconteceu. Silencioso de propósito: histórico que derruba a ação
/// que ele deveria registrar é pior do que não ter histórico.
export async function registrar(taskId: string, texto: string, autor = 'Hitalo Rosa') {
  if (!semBanco()) return
  try {
    const jar = await cookies()
    const atual = jar.get(COOKIE)?.value ? descomprimir(jar.get(COOKIE)!.value) : []
    const nova = [...atual, { taskId, texto, quando: Date.now(), autor }].slice(-MAXIMO)

    let valor = comprimir(nova)
    // se estourou, vai cortando os mais antigos até caber
    let corte = nova
    while (valor.length > LIMITE_BYTES && corte.length > 1) {
      corte = corte.slice(Math.ceil(corte.length / 4))
      valor = comprimir(corte)
    }
    if (valor.length > LIMITE_BYTES) return

    jar.set(COOKIE, valor, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    })
  } catch {
    // cookies() fora de contexto de resposta, por exemplo. Não é motivo para
    // a ação inteira falhar.
  }
}
