/** Formato do resultado da Edge Function ocr-documento (coluna documentos.ocr_dados). */

export type EnderecoOcr = {
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
}

export type PessoaOcr = {
  nome: string | null
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  sexo: string | null
  estado_civil: string | null
  nacionalidade: string | null
  naturalidade: string | null
  nome_pai: string | null
  nome_mae: string | null
  profissao: string | null
  empregador: string | null
  renda_mensal: number | null
  email: string | null
  telefone: string | null
  endereco: EnderecoOcr | null
}

export type EmpresaOcr = {
  razao_social: string | null
  nome_fantasia: string | null
  cnpj: string | null
  data_fundacao: string | null
  tipo_constituicao: string | null
  inscricao_estadual: string | null
  inscricao_municipal: string | null
  regime_tributario: string | null
  setor_atividade: string | null
  endereco: EnderecoOcr | null
}

/**
 * Campos devolvidos pela Edge Function ocr-documento.
 * Os campos do nível principal são do 1º proponente / titular do documento. Os marcados com `?` vieram com a
 * leitura de fichas cadastrais e não existem em leituras gravadas antes disso.
 */
export type DadosOcr = {
  /** true quando a função está sem chave e devolveu dados fictícios */
  simulado?: boolean
  tipo_documento: string
  legivel: boolean
  nome: string | null
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  nome_mae: string | null
  estado_civil: string | null
  endereco: string | null
  cep: string | null
  data_emissao: string | null
  data_validade: string | null
  renda_mensal: number | null
  empregador: string | null
  observacoes: string | null
  sexo?: string | null
  nacionalidade?: string | null
  naturalidade?: string | null
  nome_pai?: string | null
  profissao?: string | null
  email?: string | null
  telefone?: string | null
  data_casamento?: string | null
  regime_casamento?: string | null
  endereco_detalhado?: EnderecoOcr | null
  dados_bancarios?: { banco: string | null; agencia: string | null; conta: string | null } | null
  proponente_2?: PessoaOcr | null
  socios?: PessoaOcr[]
  representante?: { papel: 'procurador' | 'representante' | 'fiador' | 'outro'; pessoa: PessoaOcr } | null
  empresa?: EmpresaOcr | null
  /** Caminhos dos campos lidos com dúvida, ex.: "cpf", "proponente_2.rg" */
  campos_incertos?: string[]
}
