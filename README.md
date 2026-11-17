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
- **2º comprador:** a pasta pode ser de casal (`pastas.segundo_comprador`). Cada tipo do catálogo diz se também é
  exigido do 2º comprador (`tipos_documento.exige_segundo_comprador`; de início RG/CNH, CPF, renda e carteira de
  trabalho) e cada documento tem um `titular` (`comprador_1`/`comprador_2`). Numa pasta de casal, esses tipos contam o
  peso para cada comprador e precisam estar aprovados para os dois.
- A **Ficha cadastral** é um tipo obrigatório do catálogo (peso 10); ao ser lida, preenche os dois compradores.
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

Também lê **fichas cadastrais** (inclusive manuscritas e com várias páginas): além do 1º proponente no nível principal,
devolve `proponente_2` (cônjuge/2º comprador), `socios`, `representante` (procurador/fiador), `empresa` (PJ),
`dados_bancarios`, `endereco_detalhado` e `campos_incertos` (campos lidos com dúvida). Formato em `src/types/ocr.ts`.

No detalhe da pasta, o painel *Dados lidos dos documentos* (`src/components/DadosConsolidados.tsx`) mostra o
resultado: valor de cada campo por comprador, de qual documento veio, campos a conferir e divergências (inclusive
contra o nome/CPF do cadastro). `src/lib/divergencias.ts` cruza as leituras de uma pasta (`resolverCampos`): escolhe cada campo pela fonte mais
confiável (documento oficial > ficha > demais; comprovante de residência no endereço; comprovante de renda na renda)
e lista as divergências entre documentos. Testes: `npm test`.

Usa o segredo `ANTHROPIC_API_KEY` (Supabase → Edge Functions → Secrets). **Sem ele a função roda em modo simulação**:
devolve dados fictícios marcados como SIMULAÇÃO, só para testar a esteira. Com a chave, a leitura real entra sozinha
e os documentos passam a ser enviados à API da Anthropic.

### Tipos TypeScript

`src/types/database.ts` é gerado pelo Supabase. Para atualizar: `npm run db:types` (CLI linkada).

## Deploy

Vercel: importe o repositório, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O `vercel.json` já faz o fallback de SPA.
