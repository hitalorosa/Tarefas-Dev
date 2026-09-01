'use client'

import { useState, useTransition } from 'react'
import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileText,
  FolderOpen,
  Layers,
  Mail,
  PanelRightClose,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { PALETA, TIPOS_CAMPO } from '@/lib/colors'
import { cn } from '@/lib/utils'
import {
  adicionarOpcao,
  criarCampo,
  desvincularCampo,
  editarOpcao,
  removerOpcao,
  renomearCampo,
  vincularCampo,
} from '@/app/(app)/campos'

export type CampoPainel = {
  id: string
  name: string
  type: string
  options: { id: string; label: string; color: string }[]
}

type Props = {
  projectId: string
  campos: CampoPainel[]
  disponiveis: { id: string; name: string; type: string }[]
  aberto: boolean
  fechar: () => void
}

export function CustomizePanel({ projectId, campos, disponiveis, aberto, fechar }: Props) {
  const [tela, setTela] = useState<'raiz' | 'campos'>('raiz')

  if (!aberto) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={fechar} />
      <aside className="fixed right-0 top-0 z-50 flex h-dvh w-[380px] flex-col border-l border-line bg-surface shadow-2xl">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          {tela !== 'raiz' && (
            <button
              type="button"
              onClick={() => setTela('raiz')}
              className="grid h-6 w-6 place-items-center rounded text-soft hover:bg-hover hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="text-[15px] font-semibold">{tela === 'raiz' ? 'Personalizar' : 'Campos'}</h2>
          <button
            type="button"
            onClick={fechar}
            title="Fechar"
            className="ml-auto grid h-6 w-6 place-items-center rounded text-soft hover:bg-hover hover:text-ink"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {tela === 'raiz' ? (
            <TelaRaiz campos={campos} irParaCampos={() => setTela('campos')} />
          ) : (
            <TelaCampos projectId={projectId} campos={campos} disponiveis={disponiveis} />
          )}
        </div>
      </aside>
    </>
  )
}

function TelaRaiz({ campos, irParaCampos }: { campos: CampoPainel[]; irParaCampos: () => void }) {
  return (
    <>
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold">Este projeto</h3>
        <p className="text-[12px] text-soft">Ver e editar as funcionalidades deste projeto</p>
      </div>

      <div className="space-y-1.5">
        <LinhaPainel icone={CircleDot} titulo="Campos" contador={campos.length} onClick={irParaCampos} />
        <LinhaPainel
          icone={FileText}
          titulo="Formulários"
          descricao="Receber pedidos de fora e virar tarefa"
          embreve
        />
        <LinhaPainel icone={Mail} titulo="E-mails" descricao="Criar tarefa a partir de um e-mail" embreve />
        <LinhaPainel
          icone={AppWindow}
          titulo="Aplicativos"
          descricao="Integrações que criam tarefa aqui"
          embreve
        />
        <LinhaPainel icone={FolderOpen} titulo="Coleções" descricao="Agrupar projetos ligados" embreve />
        <LinhaPainel
          icone={Layers}
          titulo="Modelos de status"
          descricao="Padrão do relato semanal do projeto"
          embreve
        />
      </div>
    </>
  )
}

function LinhaPainel({
  icone: Icone,
  titulo,
  descricao,
  contador,
  onClick,
  embreve,
}: {
  icone: React.ComponentType<{ className?: string }>
  titulo: string
  descricao?: string
  contador?: number
  onClick?: () => void
  embreve?: boolean
}) {
  return (
    <button
      type="button"
      disabled={embreve}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-line bg-raised px-3 py-2.5 text-left transition-colors',
        embreve ? 'cursor-default opacity-50' : 'hover:border-faint/50 hover:bg-hover',
      )}
    >
      <Icone className="h-4 w-4 shrink-0 text-soft" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{titulo}</span>
        {descricao && <span className="block truncate text-[11px] text-faint">{descricao}</span>}
      </span>
      {contador != null && <span className="text-[12px] text-faint">{contador}</span>}
      {embreve ? (
        <span className="rounded bg-line px-1.5 py-0.5 text-[10px] text-faint">em breve</span>
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      )}
    </button>
  )
}

function TelaCampos({
  projectId,
  campos,
  disponiveis,
}: {
  projectId: string
  campos: CampoPainel[]
  disponiveis: { id: string; name: string; type: string }[]
}) {
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('enum')
  const [pendente, startTransition] = useTransition()

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold">Adicionado ao projeto</h3>
          <p className="text-[12px] leading-relaxed text-soft">
            Campo pertence ao workspace, não ao projeto. Editar aqui vale em todo lugar onde ele aparece.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCriando((v) => !v)}
          className="btn shrink-0 gap-1 border border-line bg-raised px-2 py-1 text-[12px] hover:bg-hover"
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </button>
      </div>

      {criando && (
        <div className="mb-3 space-y-2 rounded-lg border border-accent/40 bg-raised p-3">
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do campo"
            className="field py-1.5 text-[13px]"
          />
          <div className="flex flex-wrap gap-1">
            {TIPOS_CAMPO.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipo(t.valor)}
                title={t.ajuda}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] transition-colors',
                  tipo === t.valor ? 'bg-accent text-white' : 'bg-canvas text-soft hover:text-ink',
                )}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!nome.trim() || pendente}
            onClick={() =>
              startTransition(async () => {
                await criarCampo(projectId, nome, tipo)
                setNome('')
                setCriando(false)
              })
            }
            className="btn w-full bg-accent py-1.5 text-[12px] text-white hover:bg-accent/90"
          >
            Criar campo
          </button>

          {disponiveis.length > 0 && (
            <div className="border-t border-line pt-2">
              <p className="mb-1 text-[11px] text-faint">Ou reaproveitar um campo que já existe:</p>
              <div className="flex flex-wrap gap-1">
                {disponiveis.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await vincularCampo(projectId, d.id)
                        setCriando(false)
                      })
                    }
                    className="rounded-md bg-canvas px-2 py-1 text-[11px] text-soft hover:text-ink"
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {campos.map((c) => (
          <BlocoCampo key={c.id} projectId={projectId} campo={c} />
        ))}
        {campos.length === 0 && (
          <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12px] text-faint">
            Nenhum campo neste projeto ainda.
          </p>
        )}
      </div>
    </>
  )
}

function BlocoCampo({ projectId, campo }: { projectId: string; campo: CampoPainel }) {
  const [aberto, setAberto] = useState(false)
  const [novaOpcao, setNovaOpcao] = useState('')
  const [, startTransition] = useTransition()

  return (
    <div className="rounded-lg border border-line bg-raised">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-faint hover:text-ink"
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', aberto && 'rotate-90')} />
        </button>

        <input
          defaultValue={campo.name}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== campo.name) {
              startTransition(() => renomearCampo(campo.id, e.target.value))
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none focus:text-accent-ink"
        />

        <button
          type="button"
          title="Tirar deste projeto"
          onClick={() => startTransition(() => desvincularCampo(projectId, campo.id))}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-faint hover:bg-danger-bg hover:text-danger"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!aberto && campo.options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 pl-10">
          {campo.options.slice(0, 4).map((o) => (
            <span key={o.id} className="flex items-center gap-1 text-[11px] text-soft">
              <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />
              {o.label}
            </span>
          ))}
          {campo.options.length > 4 && (
            <span className="text-[11px] text-faint">+{campo.options.length - 4}</span>
          )}
        </div>
      )}

      {aberto && (
        <div className="space-y-1 border-t border-line px-3 py-2">
          {campo.type !== 'enum' ? (
            <p className="py-1 text-[11px] text-faint">
              Campo do tipo {TIPOS_CAMPO.find((t) => t.valor === campo.type)?.rotulo ?? campo.type} — sem
              opções pra configurar.
            </p>
          ) : (
            <>
              {campo.options.map((o) => (
                <LinhaOpcao key={o.id} opcao={o} />
              ))}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  value={novaOpcao}
                  onChange={(e) => setNovaOpcao(e.target.value)}
                  placeholder="Nova opção"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && novaOpcao.trim()) {
                      startTransition(() => adicionarOpcao(campo.id, novaOpcao))
                      setNovaOpcao('')
                    }
                  }}
                  className="field py-1 text-[12px]"
                />
                <button
                  type="button"
                  disabled={!novaOpcao.trim()}
                  onClick={() => {
                    startTransition(() => adicionarOpcao(campo.id, novaOpcao))
                    setNovaOpcao('')
                  }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-white disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function LinhaOpcao({ opcao }: { opcao: { id: string; label: string; color: string } }) {
  const [paleta, setPaleta] = useState(false)
  const [, startTransition] = useTransition()

  return (
    <div className="group/opt relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setPaleta((v) => !v)}
        title="Trocar a cor"
        className="h-3 w-3 shrink-0 rounded-full ring-offset-2 ring-offset-raised hover:ring-1 hover:ring-faint"
        style={{ background: opcao.color }}
      />
      <input
        defaultValue={opcao.label}
        onBlur={(e) => {
          if (e.target.value.trim() && e.target.value !== opcao.label) {
            startTransition(() => editarOpcao(opcao.id, e.target.value, opcao.color))
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-[12px] outline-none focus:text-accent-ink"
      />
      <button
        type="button"
        title="Remover opção"
        onClick={() => startTransition(() => removerOpcao(opcao.id))}
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-faint opacity-0 transition-opacity hover:bg-danger-bg hover:text-danger group-hover/opt:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      {paleta && (
        <div className="absolute left-0 top-5 z-10 flex w-44 flex-wrap gap-1.5 rounded-lg border border-line bg-raised p-2 shadow-xl">
          {PALETA.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={p.nome}
              onClick={() => {
                startTransition(() => editarOpcao(opcao.id, opcao.label, p.hex))
                setPaleta(false)
              }}
              className="h-4 w-4 rounded-full hover:scale-125"
              style={{ background: p.hex }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
