# Plano

Quadro de tarefas + canvas + um assistente que conhece o histórico da equipe.
Feito para times de marketing, mas o núcleo serve para tarefa em geral.

O nome é provisório.

## Por que existe

Nasceu de um estudo do Asana real de uma operação de marketing. Os furos que
motivaram cada decisão de arquitetura estão anotados no código:

| Furo no Asana | O que Plano faz |
|---|---|
| 0 de 61 tarefas usavam dependência nativa — o vínculo vivia só no nome | `TaskDependency` de verdade, criada pelos padrões automaticamente |
| O campo "Marcas" existia duplicado em dois projetos e o filtro mentia | Campo customizado vive no **workspace**, não no projeto |
| Marca era campo customizado, some em qualquer recorte | `Brand` é entidade de primeira classe |
| Tarefas sem data e sem campo viravam zona cega | Guardião acusa: sem data, sem campo, sem marca |
| Tarefas abertas dentro da coluna "Feito" | Seção tem `isDone`: cair nela fecha, sair reabre |
| Briefing que já falhou voltava a ser produzido | `KnowledgeItem` guarda veredicto; a IA compara antes de subir |

## Como rodar

```bash
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

Entrar com `hitalo@plano.dev` / `plano123` (definido no seed).

## Stack

- **Next.js 16** (App Router, React 19, Server Actions) — um codebase só para site e API
- **Prisma 7 + Postgres** via driver adapter `@prisma/adapter-pg` (JavaScript puro,
  sem módulo nativo). Sem enum e sem Json nativos, de propósito.
- **Tailwind v4** com tokens semânticos em `globals.css`
- **dnd-kit** no quadro
- **@excalidraw/excalidraw** no canvas
- **@anthropic-ai/sdk** só no servidor — a chave nunca chega ao navegador

## Segurança

- Sessão em cookie httpOnly, com registro no banco (dá para revogar).
- Toda server action confere que o recurso pertence ao workspace de quem chamou.
- Chave de IA do workspace (BYOK) cifrada em AES-256-GCM com a `ENCRYPTION_KEY`
  do servidor. Perder essa variável = perder as chaves salvas.

## Deploy no Vercel

O código já está pronto. Falta só um banco.

1. **Crie um Postgres gerenciado** — Neon, Supabase ou Vercel Postgres. Copie a
   connection string.
2. **No Vercel**, defina três variáveis de ambiente:
   - `DATABASE_URL` — a string do passo 1
   - `AUTH_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   - `ENCRYPTION_KEY` — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

   Gere valores novos. Os do `.env` local não devem viajar.
3. **Rode as migrações uma vez** contra o banco novo:
   `DATABASE_URL="..." npm run db:deploy`
4. **Popule a estrutura inicial** (usuário, marcas, campos, regras):
   `DATABASE_URL="..." npm run db:seed`

Depois disso é só apontar o Vercel para o repositório. O `postinstall` do
`package.json` roda `prisma generate` no build — sem ele o Vercel buildaria sem
cliente do Prisma, porque `src/generated` não vai para o git.

### Por que Postgres e não SQLite

A primeira versão usava SQLite. Ela não sobe em serverless por dois motivos, e
os dois apareceram no primeiro build do Vercel:

- **não há disco para gravar** — funções serverless têm sistema de arquivos
  somente leitura, então o banco em arquivo não persiste nem aceita escrita;
- **o `better-sqlite3` é um módulo nativo** e o npm do Vercel bloqueia install
  scripts de dependências, então o binário nunca chega a ser compilado.

O driver adapter `@prisma/adapter-pg` é JavaScript puro e não tem nenhum dos dois
problemas. O schema já vinha escrito sem enum e sem Json nativos, o que fez a
troca de banco custar três arquivos.

## Estado

**Pronto**
- Modelo de dados completo (workspace, projetos, seções, tarefas, subtarefas,
  campos, marcas, dependências, canvas, padrões, regras, memória, IA)
- Autenticação e sessão
- Quadro kanban: criar, concluir, arrastar entre colunas, ordenação fracionária
- Seções editáveis: renomear, mover, excluir sem perder tarefa, marcar concluído
- Filtrar / Ordenar / Agrupar / Opções / buscar — estado na URL, então é
  compartilhável e sobrevive ao reload
- Painel **Personalizar** com gestão de campos e opções coloridas
- Vistas: Quadro, Visão geral, Lista, Cronograma, Painel, Calendário, Canvas
- Canvas Excalidraw embutido, com salvamento automático
- Postgres via driver adapter, pronto para serverless

**Próximo**
1. Painel da tarefa (descrição, subtarefas, campos, dependências, comentários)
2. A ponte `CanvasNode` — caixa no canvas que É uma tarefa, nos dois sentidos
3. Motor de padrões — o "Disparo" gera o par tarefa+arte amarrado
4. Guardião rodando as regras
5. Assistente de IA com ferramentas sobre o banco + memória de resultado
6. Tempo real e convite de membro
7. Empacotar: PWA e depois Tauri v2 (desktop e mobile do mesmo código)
