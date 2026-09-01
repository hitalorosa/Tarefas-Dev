'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Repeat, X } from 'lucide-react'
import { cn, formatarPrazo } from '@/lib/utils'
import {
  DIAS_SEMANA,
  TIPOS_REPETICAO,
  type Repeticao,
  type TipoRepeticao,
  escreverRepeticao,
  lerRepeticao,
  proximasDatas,
} from '@/lib/repeticao'

const SEMANA = ['2ª', '3ª', '4ª', '5ª', '6ª', 'S', 'D']
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const chave = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/// Calendário com início, conclusão, hora e repetição — o mesmo conjunto do
/// Asana. A semana começa na segunda porque é assim que a agenda de trabalho é
/// lida por aqui.
export function SeletorData({
  inicio,
  fim,
  hora,
  repeticao,
  aoMudarDatas,
  aoMudarRepeticao,
}: {
  inicio: string | null
  fim: string | null
  hora: string | null
  repeticao: string | null
  aoMudarDatas: (inicio: string | null, fim: string | null, hora: string | null) => void
  aoMudarRepeticao: (regra: string | null) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [editandoInicio, setEditandoInicio] = useState(false)
  const [mostrandoHora, setMostrandoHora] = useState(false)
  const [mostrandoRepeticao, setMostrandoRepeticao] = useState(false)
  const [alvo, setAlvo] = useState<'inicio' | 'fim'>('fim')
  const [mes, setMes] = useState(() => {
    const base = fim ?? inicio
    const d = base ? new Date(`${base}T12:00:00`) : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const caixa = useRef<HTMLDivElement>(null)

  const regra = lerRepeticao(repeticao)

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla, true)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla, true)
    }
  }, [aberto])

  const prazo = formatarPrazo(inicio, fim, hora)
  const hoje = chave(new Date())

  // grade do mês começando na segunda-feira
  const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const deslocamento = (primeiro.getDay() + 6) % 7
  const inicioGrade = new Date(primeiro)
  inicioGrade.setDate(1 - deslocamento)
  const dias = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicioGrade)
    d.setDate(inicioGrade.getDate() + i)
    return d
  })

  /// prévia da repetição: mostra no calendário onde a tarefa vai cair de novo
  const repetidos = useMemo(() => {
    if (!regra || !fim) return new Set<string>()
    return new Set(proximasDatas(regra, new Date(`${fim}T12:00:00`), 24).map(chave))
  }, [regra, fim])

  function escolher(d: Date) {
    const valor = chave(d)
    if (alvo === 'inicio') {
      aoMudarDatas(valor, fim && valor > fim ? valor : fim, hora)
      setAlvo('fim')
    } else {
      aoMudarDatas(inicio && valor < inicio ? valor : inicio, valor, hora)
    }
  }

  function alternarDiaDaSemana(valor: number) {
    if (!regra) return
    const dias = regra.dias.includes(valor)
      ? regra.dias.filter((x) => x !== valor)
      : [...regra.dias, valor]
    aoMudarRepeticao(escreverRepeticao({ ...regra, dias }))
  }

  return (
    <div ref={caixa} className="relative">
      <span className="group/d flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] hover:bg-hover',
            prazo ? 'text-ink' : 'text-faint hover:text-soft',
          )}
        >
          <CalendarDays className="h-4 w-4" />
          {prazo ?? 'Sem data'}
          {regra && <Repeat className="h-3 w-3 text-accent-ink" />}
        </button>
        {prazo && (
          <button
            type="button"
            title="Limpar datas"
            onClick={() => aoMudarDatas(null, null, null)}
            className="text-faint opacity-0 transition-opacity hover:text-ink group-hover/d:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </span>

      {aberto && (
        <div className="absolute left-0 top-9 z-50 w-[272px] rounded-xl border border-line bg-raised p-3 shadow-2xl shadow-black/50">
          <div className="mb-2 space-y-1">
            {inicio || editandoInicio ? (
              <Campo
                rotulo="Data de início"
                valor={inicio}
                ativo={alvo === 'inicio'}
                aoFocar={() => setAlvo('inicio')}
                aoLimpar={() => {
                  aoMudarDatas(null, fim, hora)
                  setEditandoInicio(false)
                  setAlvo('fim')
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditandoInicio(true)
                  setAlvo('inicio')
                }}
                className="flex items-center gap-1 rounded-md px-1 py-1 text-[12px] text-faint hover:bg-hover hover:text-soft"
              >
                <Plus className="h-3 w-3" />
                Data de início
              </button>
            )}

            <Campo
              rotulo="Data de conclusão"
              valor={fim}
              ativo={alvo === 'fim'}
              aoFocar={() => setAlvo('fim')}
              aoLimpar={() => aoMudarDatas(inicio, null, null)}
            />

            {(hora || mostrandoHora) && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2 py-1 text-[12px]',
                  hora ? 'border-line' : 'border-accent bg-canvas',
                )}
              >
                <span className="flex-1 text-faint">Horário de conclusão</span>
                <input
                  type="time"
                  value={hora ?? ''}
                  onChange={(e) => aoMudarDatas(inicio, fim, e.target.value || null)}
                  className="bg-transparent text-ink outline-none"
                />
                {hora && (
                  <button
                    type="button"
                    title="Tirar o horário"
                    onClick={() => {
                      aoMudarDatas(inicio, fim, null)
                      setMostrandoHora(false)
                    }}
                    className="text-faint hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
              className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-hover hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[12px]">
              {MESES[mes.getMonth()]} de {mes.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
              className="grid h-6 w-6 place-items-center rounded text-faint hover:bg-hover hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {SEMANA.map((d) => (
              <span key={d} className="py-1 text-[10px] text-faint">
                {d}
              </span>
            ))}

            {dias.map((d) => {
              const k = chave(d)
              const doMes = d.getMonth() === mes.getMonth()
              const ehInicio = k === inicio
              const ehFim = k === fim
              const noMeio = !!inicio && !!fim && k > inicio && k < fim
              const repete = repetidos.has(k)

              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => escolher(d)}
                  className={cn(
                    'grid h-7 place-items-center rounded-md text-[12px] transition-colors',
                    !doMes && 'text-faint/40',
                    doMes && !ehInicio && !ehFim && !noMeio && !repete && 'text-soft hover:bg-hover',
                    // a prévia da repetição é contorno, não preenchimento:
                    // aquilo ainda não existe, é só onde vai cair
                    repete && !ehInicio && !ehFim && 'text-accent-ink ring-1 ring-inset ring-accent/50',
                    noMeio && 'bg-accent-bg text-accent-ink',
                    (ehInicio || ehFim) && 'bg-accent font-semibold text-white',
                    k === hoje && !ehInicio && !ehFim && 'font-semibold text-accent-ink',
                  )}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {mostrandoRepeticao && regra && (
            <div className="mt-2 border-t border-line pt-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[12px] text-faint">Repetir</span>
                <select
                  value={regra.tipo}
                  onChange={(e) =>
                    aoMudarRepeticao(
                      escreverRepeticao({ ...regra, tipo: e.target.value as TipoRepeticao }),
                    )
                  }
                  className="ml-auto cursor-pointer rounded-md bg-transparent py-0.5 text-[12px] text-ink outline-none hover:bg-hover"
                >
                  {TIPOS_REPETICAO.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              {regra.tipo === 'semanal' && (
                <>
                  <p className="mb-1 text-[11px] text-faint">Nestes dias</p>
                  <div className="grid grid-cols-7 gap-1">
                    {DIAS_SEMANA.map((d) => (
                      <button
                        key={d.valor}
                        type="button"
                        onClick={() => alternarDiaDaSemana(d.valor)}
                        className={cn(
                          'grid h-7 place-items-center rounded text-[11px] transition-colors',
                          regra.dias.includes(d.valor)
                            ? 'bg-accent font-semibold text-white'
                            : 'bg-canvas text-soft hover:bg-hover',
                        )}
                      >
                        {d.rotulo}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {regra.tipo === 'periodica' && (
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-faint">A cada</span>
                  <input
                    type="number"
                    min={1}
                    value={regra.intervalo}
                    onChange={(e) =>
                      aoMudarRepeticao(
                        escreverRepeticao({ ...regra, intervalo: Number(e.target.value) || 1 }),
                      )
                    }
                    className="w-14 rounded-md border border-line bg-canvas px-1.5 py-0.5 text-ink outline-none focus:border-accent"
                  />
                  <span className="text-faint">dias</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  aoMudarRepeticao(null)
                  setMostrandoRepeticao(false)
                }}
                className="mt-2 text-[11px] text-faint hover:text-soft"
              >
                Não repetir
              </button>
            </div>
          )}

          <div className="mt-2 flex items-center gap-1 border-t border-line pt-2">
            <BotaoRodape
              titulo="Adicionar hora"
              ativo={!!hora || mostrandoHora}
              onClick={() => setMostrandoHora((v) => !v)}
            >
              <Clock className="h-4 w-4" />
            </BotaoRodape>

            <BotaoRodape
              titulo="Configurar repetição"
              ativo={!!regra || mostrandoRepeticao}
              onClick={() => {
                if (!regra) {
                  // padrão semanal no dia do prazo: é o caso mais comum
                  const base = fim ? new Date(`${fim}T12:00:00`).getDay() : new Date().getDay()
                  aoMudarRepeticao(escreverRepeticao({ tipo: 'semanal', dias: [base], intervalo: 7 }))
                }
                setMostrandoRepeticao((v) => !v)
              }}
            >
              <Repeat className="h-4 w-4" />
            </BotaoRodape>

            <button
              type="button"
              onClick={() => {
                aoMudarDatas(null, null, null)
                aoMudarRepeticao(null)
                setEditandoInicio(false)
                setMostrandoHora(false)
                setMostrandoRepeticao(false)
                setAberto(false)
              }}
              className="ml-auto rounded-md px-1.5 py-1 text-[12px] text-soft hover:bg-hover hover:text-ink"
            >
              Apagar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BotaoRodape({
  titulo,
  ativo,
  onClick,
  children,
}: {
  titulo: string
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={titulo}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md transition-colors',
        ativo ? 'bg-accent-bg text-accent-ink' : 'text-faint hover:bg-hover hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function Campo({
  rotulo,
  valor,
  ativo,
  aoFocar,
  aoLimpar,
}: {
  rotulo: string
  valor: string | null
  ativo: boolean
  aoFocar: () => void
  aoLimpar: () => void
}) {
  const legivel = valor
    ? new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : ''

  return (
    <button
      type="button"
      onClick={aoFocar}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-[12px] transition-colors',
        ativo ? 'border-accent bg-canvas' : 'border-line hover:bg-hover',
      )}
    >
      <span className="flex-1 text-faint">{rotulo}</span>
      <span className={valor ? 'text-ink' : 'text-faint'}>{legivel || '—'}</span>
      {valor && (
        <span
          role="button"
          title="Limpar"
          onClick={(e) => {
            e.stopPropagation()
            aoLimpar()
          }}
          className="text-faint hover:text-ink"
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </button>
  )
}
