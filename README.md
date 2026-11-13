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

Projeto de desenvolvimento: **Pastas-Digitais** (sa-east-1), com as 3 migrations já aplicadas. Migrations em `supabase/migrations/` — aplique com `supabase db push` (CLI linkada ao projeto) ou cole no SQL Editor, na ordem.

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

### Perfis e hierarquia (RLS)

| Perfil | Acesso |
|---|---|
| Autônomo | Suas pastas e as de quem está abaixo dele na hierarquia; envia documentos (não aprova) |
| Equipe Pastas | Todas as pastas; aprova/rejeita documentos; move para Cadastro; empreendimentos |
| Administrador | Tudo, incluindo usuários, importação de autônomos, catálogo e parâmetros |

A tabela `autonomos` guarda a lista de autônomos **por apelido** (importada da planilha em Administração →
Autônomos), cada um com seu superintendente, diretor e diretor geral. Cada usuário é vinculado a um apelido
(`profiles.autonomo_id`) e toda pasta pertence a um autônomo (`pastas.autonomo_id`): quem está acima vê as pastas
de quem está abaixo. Da planilha só entram apelido, designação, empresa, zona, CRECI e os vínculos.

Novos usuários entram como Autônomo; só o Administrador altera perfil e vínculo (protegido por trigger).
Para criar o primeiro Administrador:

```sql
update public.profiles set perfil = 'admin' where email = 'seu@email.com';
```

### OCR dos documentos

A Edge Function `supabase/functions/ocr-documento` lê imagens/PDFs com Claude e devolve os campos (nome, CPF, RG,
datas, endereço, renda…). É usada na **Nova pasta** (lê o RG/CNH e preenche nome e CPF) e a cada envio de documento
no detalhe da pasta (resultado em `documentos.ocr_dados`, gravável só pela função).

Requer o segredo `ANTHROPIC_API_KEY` em Supabase → Edge Functions → Secrets. Sem ele a função responde 503 e o
restante do sistema continua funcionando. Os documentos são enviados à API da Anthropic para leitura.

### Tipos TypeScript

`src/types/database.ts` é gerado pelo Supabase. Para atualizar: `npm run db:types` (CLI linkada).

## Deploy

Vercel: importe o repositório, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O `vercel.json` já faz o fallback de SPA.
