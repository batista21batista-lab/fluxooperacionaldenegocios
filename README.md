# Pastas Digitais · Lopes Consultoria de Imóveis

Gestão digital de pastas de clientes para lançamentos imobiliários.

**Stack:** React 18 · Vite · TypeScript · Tailwind CSS 3 · shadcn/ui · Supabase · Vercel

## Começando

```bash
npm install
cp .env.example .env.local   # preencha URL e anon key do Supabase
npm run dev
```

Componentes shadcn/ui: `npx shadcn@latest add button card table ...` (já configurado em `components.json`).

## Banco de dados (Supabase)

Migrations em `supabase/migrations/` — aplique com `supabase db push` (CLI linkada ao projeto) ou cole no SQL Editor, na ordem.

| Tabela / objeto | Função |
|---|---|
| `profiles` | Usuários (1:1 com `auth.users`), perfil e equipe |
| `equipes` | Equipes de vendas (supervisor + corretores) |
| `empreendimentos` | Lançamentos |
| `clientes` | Compradores (CPF único) |
| `pastas` | Cliente × empreendimento; status, classificação, pontuação e prazo |
| `tipos_documento` | Catálogo de documentos com **peso** (pontos) e obrigatoriedade |
| `documentos` | Documento por tipo em cada pasta (`pendente/enviado/aprovado/rejeitado`) |
| `pasta_historico` | Auditoria de status/classificação |
| `configuracoes` | Cortes de classificação (`ouro_min`, `prata_min`) |
| `fila_prioridade` (view) | Fila automática |
| bucket `documentos` | Arquivos privados, caminho `{pasta_id}/{tipo_documento_id}/{arquivo}` |

### Regras de negócio

- **Pontuação** = soma dos pesos dos documentos *aprovados*; **percentual** = pontuação ÷ máximo (tipos ativos).
- **Classificação:** Ouro ≥ 90%, Prata ≥ 60%, Bronze abaixo (editável em `configuracoes`).
- **Status:** `completa` quando todos os documentos obrigatórios estão aprovados, senão `incompleta`. `cadastro` é a etapa seguinte, definida por Equipe Pastas/Diretor via RPC `mover_para_cadastro` (só pastas completas) e não é sobrescrita pelo recálculo.
- **Fila:** maior % de documentação primeiro; empate pela menor `data_entrega`; pastas em Cadastro saem da fila. Toda a regra está na view `fila_prioridade`.
- Tudo é recalculado por triggers ao inserir/alterar/remover documentos.

### Perfis (RLS)

| Perfil | Acesso |
|---|---|
| Corretor | Só seus clientes/pastas; envia documentos (não aprova) |
| Supervisor | Lê as pastas dos corretores da sua equipe |
| Equipe Pastas | Todas as pastas; aprova/rejeita documentos; move para Cadastro |
| Diretor | Tudo, incluindo catálogo, parâmetros, usuários e exclusões |

Novos usuários entram como `corretor`; só o Diretor altera perfil/equipe (protegido por trigger). Para criar o primeiro Diretor:

```sql
update public.profiles set perfil = 'diretor' where email = 'seu@email.com';
```

### Tipos TypeScript

`src/types/database.ts` está escrito à mão. Com o projeto linkado: `npm run db:types`.

## Deploy

Vercel: importe o repositório, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O `vercel.json` já faz o fallback de SPA.
