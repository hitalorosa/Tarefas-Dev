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
npx prisma migrate dev
node --experimental-strip-types --env-file=.env prisma/seed.ts
npm run dev
```

Entrar com `hitalo@plano.dev` / `plano123` (definido no seed).

## Stack

- **Next.js 16** (App Router, React 19, Server Actions) — um codebase só para site e API
- **Prisma 7 + SQLite** em dev via driver adapter. Produção é Postgres: troca o
  `provider` no schema e a `DATABASE_URL`. Por isso não usamos enum nem Json nativos.
- **Tailwind v4** com tokens semânticos em `globals.css`
- **dnd-kit** no quadro
- **@excalidraw/excalidraw** no canvas
- **@anthropic-ai/sdk** só no servidor — a chave nunca chega ao navegador

## Segurança

- Sessão em cookie httpOnly, com registro no banco (dá para revogar).
- Toda server action confere que o recurso pertence ao workspace de quem chamou.
- Chave de IA do workspace (BYOK) cifrada em AES-256-GCM com a `ENCRYPTION_KEY`
  do servidor. Perder essa variável = perder as chaves salvas.

## Deploy — leia antes de apontar o Vercel

**Como está, não sobe no Vercel.** O banco é SQLite através do `better-sqlite3`,
e serverless não tem disco onde gravar: o build passa e o app quebra no primeiro
acesso ao banco. Para publicar é preciso, nesta ordem:

1. criar um Postgres gerenciado (Neon, Supabase ou Vercel Postgres);
2. trocar `provider = "sqlite"` por `"postgresql"` em `prisma/schema.prisma`;
3. trocar o adapter em `src/lib/db.ts` por `@prisma/adapter-pg`;
4. rodar `npx prisma migrate deploy` contra o novo banco;
5. definir no Vercel: `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`
   (gerar valores novos — os do `.env` local não devem viajar).

O schema já foi escrito pensando nisso: sem enum e sem Json nativos, que são
justamente o que costuma quebrar na troca de banco.

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

**Próximo**
1. Painel da tarefa (descrição, subtarefas, campos, dependências, comentários)
2. A ponte `CanvasNode` — caixa no canvas que É uma tarefa, nos dois sentidos
3. Motor de padrões — o "Disparo" gera o par tarefa+arte amarrado
4. Guardião rodando as regras
5. Assistente de IA com ferramentas sobre o banco + memória de resultado
6. Postgres + deploy, tempo real e convite de membro
7. Empacotar: PWA e depois Tauri v2 (desktop e mobile do mesmo código)
