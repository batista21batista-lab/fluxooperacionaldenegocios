/**
 * Cruza as leituras de OCR dos documentos de uma pasta: escolhe o valor de cada campo pela fonte mais confiável e
 * aponta onde os documentos discordam entre si.
 *
 * Regra herdada do sistema anterior (Gemini/Firebase): documento oficial > ficha cadastral > demais, e toda
 * discordância é registrada com o documento de cada lado. Aqui a prioridade também depende do campo (o comprovante
 * de residência manda no endereço, o de renda manda na renda), e tudo é função pura, sem estado de tela.
 */
import type { DadosOcr, EnderecoOcr, PessoaOcr } from '@/types/ocr'

export type Titular = 'comprador_1' | 'comprador_2'

/** Uma leitura de OCR de um documento da pasta. */
export type Leitura = {
  /** Identifica o documento para quem confere (ex.: "RG", "Ficha cadastral" ou o id do documento). */
  fonte: string
  /** De quem é o documento. Padrão: comprador_1. O proponente_2 de uma ficha vai para o outro titular. */
  titular?: Titular
  dados: DadosOcr
}

export const CAMPOS = {
  nome: 'Nome',
  cpf: 'CPF',
  rg: 'RG',
  data_nascimento: 'Data de nascimento',
  sexo: 'Sexo',
  estado_civil: 'Estado civil',
  nacionalidade: 'Nacionalidade',
  naturalidade: 'Naturalidade',
  nome_pai: 'Nome do pai',
  nome_mae: 'Nome da mãe',
  profissao: 'Profissão',
  empregador: 'Empregador',
  renda_mensal: 'Renda mensal',
  email: 'E-mail',
  telefone: 'Telefone',
  cep: 'CEP',
  logradouro: 'Logradouro',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
} as const

export type Campo = keyof typeof CAMPOS
type Valor = string | number

export type CampoResolvido = {
  valor: Valor
  fonte: string
  tipo_documento: string
  /** O modelo marcou o campo como lido com dúvida. */
  incerto: boolean
  /** Algum outro documento legível traz um valor diferente para este campo. */
  divergente: boolean
}

export type Divergencia = {
  titular: Titular
  campo: Campo
  rotulo: string
  /** Um item por valor distinto (após normalização), na ordem em que apareceram. */
  valores: { valor: Valor; fontes: string[] }[]
}

export type Resolucao = {
  campos: Record<Titular, Partial<Record<Campo, CampoResolvido>>>
  divergencias: Divergencia[]
}

// --- Normalização -----------------------------------------------------------

/** Texto para comparação: sem acento, caixa, espaços repetidos, "(a)" de "casado(a)" nem pontuação de documento. */
export function normalizarParaComparacao(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(a\)/g, '')
    .replace(/[.\-()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export type EstadoCivil = 'solteiro' | 'casado' | 'divorciado' | 'separado' | 'viuvo' | 'uniao_estavel'

/** Converte o estado civil escrito no documento ("CASADO(A)", "Viúva", "união estável"…) num valor fixo. */
export function padronizarEstadoCivil(valor: unknown): EstadoCivil | null {
  const v = normalizarParaComparacao(valor)
  if (!v) return null
  if (v.includes('uniao') || v.includes('estavel') || v.includes('convivente')) return 'uniao_estavel'
  if (v.includes('divorciad')) return 'divorciado'
  if (v.includes('separad')) return 'separado'
  if (v.includes('viuv')) return 'viuvo'
  if (v.includes('solteir')) return 'solteiro'
  if (v.includes('casad')) return 'casado'
  return null
}

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

/** Chave usada para decidir se dois valores do mesmo campo são "o mesmo". */
export function chaveDeComparacao(campo: Campo, valor: unknown): string {
  switch (campo) {
    case 'cpf':
    case 'cep':
    case 'telefone':
      return soDigitos(valor)
    case 'rg':
      return String(valor ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
    case 'data_nascimento':
      return String(valor ?? '').trim().slice(0, 10)
    case 'estado_civil':
      return padronizarEstadoCivil(valor) ?? normalizarParaComparacao(valor)
    case 'email':
      return String(valor ?? '').trim().toLowerCase()
    case 'renda_mensal':
      return Number(valor).toFixed(2)
    default:
      return normalizarParaComparacao(valor)
  }
}

// --- Prioridade das fontes ----------------------------------------------------

type Grupo = 'identidade' | 'estado_civil' | 'endereco' | 'renda' | 'contato'

const GRUPO_DO_CAMPO: Record<Campo, Grupo> = {
  nome: 'identidade', cpf: 'identidade', rg: 'identidade', data_nascimento: 'identidade', sexo: 'identidade',
  nacionalidade: 'identidade', naturalidade: 'identidade', nome_pai: 'identidade', nome_mae: 'identidade',
  estado_civil: 'estado_civil',
  cep: 'endereco', logradouro: 'endereco', numero: 'endereco', complemento: 'endereco', bairro: 'endereco',
  cidade: 'endereco', uf: 'endereco',
  profissao: 'renda', empregador: 'renda', renda_mensal: 'renda',
  email: 'contato', telefone: 'contato',
}

/** 1 = mais confiável. Tipos ausentes da tabela valem 3. */
const PRIORIDADE: Record<Grupo, Partial<Record<string, number>>> = {
  identidade: { rg: 1, cnh: 1, cpf: 1, certidao_estado_civil: 1, ficha_cadastral: 2 },
  estado_civil: { certidao_estado_civil: 1, ficha_cadastral: 2 },
  endereco: { comprovante_residencia: 1, ficha_cadastral: 2 },
  renda: { comprovante_renda: 1, carteira_trabalho: 1, imposto_renda: 1, ficha_cadastral: 2 },
  contato: { ficha_cadastral: 1 },
}

/** Prioridade de um tipo de documento para um campo (menor ganha). */
export function prioridadeDaFonte(tipoDocumento: string, campo: Campo): number {
  return PRIORIDADE[GRUPO_DO_CAMPO[campo]][tipoDocumento] ?? 3
}

// --- Extração ---------------------------------------------------------------

type Valores = Partial<Record<Campo, Valor>>

function valoresDoEndereco(e: EnderecoOcr | null | undefined): Valores {
  if (!e) return {}
  return { cep: e.cep ?? undefined, logradouro: e.logradouro ?? undefined, numero: e.numero ?? undefined,
    complemento: e.complemento ?? undefined, bairro: e.bairro ?? undefined, cidade: e.cidade ?? undefined,
    uf: e.uf ?? undefined } as Valores
}

function valoresDaPessoa(p: PessoaOcr): Valores {
  const { endereco, ...resto } = p
  return { ...(resto as Valores), ...valoresDoEndereco(endereco) }
}

/** Campos do 1º proponente (nível principal da leitura). */
function valoresDoPrincipal(d: DadosOcr): Valores {
  return {
    nome: d.nome, cpf: d.cpf, rg: d.rg, data_nascimento: d.data_nascimento, sexo: d.sexo,
    estado_civil: d.estado_civil, nacionalidade: d.nacionalidade, naturalidade: d.naturalidade,
    nome_pai: d.nome_pai, nome_mae: d.nome_mae, profissao: d.profissao, empregador: d.empregador,
    renda_mensal: d.renda_mensal, email: d.email, telefone: d.telefone,
    ...valoresDoEndereco(d.endereco_detalhado),
    // O CEP também vem no nível principal, inclusive em leituras antigas sem endereco_detalhado.
    cep: d.endereco_detalhado?.cep ?? d.cep,
  } as Valores
}

/** Caminho do campo como o modelo o escreve em campos_incertos. */
function caminhosIncertos(campo: Campo, prefixo: '' | 'proponente_2.'): string[] {
  if (GRUPO_DO_CAMPO[campo] === 'endereco') {
    return prefixo
      ? [`${prefixo}endereco.${campo}`, `${prefixo}${campo}`]
      : [`endereco_detalhado.${campo}`, campo]
  }
  return [`${prefixo}${campo}`]
}

type Ocorrencia = {
  titular: Titular
  campo: Campo
  valor: Valor
  chave: string
  fonte: string
  tipo: string
  prioridade: number
  incerto: boolean
  legivel: boolean
  ordem: number
}

const vazio = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

function ocorrencias(leituras: Leitura[]): Ocorrencia[] {
  const saida: Ocorrencia[] = []
  leituras.forEach((l, ordem) => {
    const d = l.dados
    if (!d || d.simulado) return // dado fictício não entra no cruzamento
    const titular = l.titular ?? 'comprador_1'
    const outro: Titular = titular === 'comprador_1' ? 'comprador_2' : 'comprador_1'
    const incertos = new Set(d.campos_incertos ?? [])
    const blocos: [Titular, Valores, '' | 'proponente_2.'][] = [[titular, valoresDoPrincipal(d), '']]
    if (d.proponente_2) blocos.push([outro, valoresDaPessoa(d.proponente_2), 'proponente_2.'])

    for (const [quem, valores, prefixo] of blocos) {
      for (const campo of Object.keys(CAMPOS) as Campo[]) {
        let valor = valores[campo]
        if (vazio(valor)) continue
        if (campo === 'estado_civil') valor = padronizarEstadoCivil(valor) ?? String(valor)
        const chave = chaveDeComparacao(campo, valor)
        if (!chave) continue
        saida.push({
          titular: quem, campo, valor: valor as Valor, chave, fonte: l.fonte, tipo: d.tipo_documento,
          prioridade: prioridadeDaFonte(d.tipo_documento, campo),
          incerto: caminhosIncertos(campo, prefixo).some((c) => incertos.has(c)),
          legivel: d.legivel !== false,
          ordem,
        })
      }
    }
  })
  return saida
}

// --- Resolução --------------------------------------------------------------

/** Campos em que valores diferentes são esperados e não indicam erro (a renda muda de mês a mês). */
const SEM_DIVERGENCIA: ReadonlySet<Campo> = new Set(['renda_mensal', 'empregador', 'profissao'])

/** Ordem de escolha: legível antes de ilegível, depois prioridade da fonte, certeza e ordem de envio. */
function melhor(a: Ocorrencia, b: Ocorrencia): number {
  return Number(!a.legivel) - Number(!b.legivel)
    || a.prioridade - b.prioridade
    || Number(a.incerto) - Number(b.incerto)
    || a.ordem - b.ordem
}

export function resolverCampos(leituras: Leitura[]): Resolucao {
  const grupos = new Map<string, Ocorrencia[]>()
  for (const o of ocorrencias(leituras)) {
    const k = `${o.titular}|${o.campo}`
    grupos.set(k, [...(grupos.get(k) ?? []), o])
  }

  const resolucao: Resolucao = { campos: { comprador_1: {}, comprador_2: {} }, divergencias: [] }

  for (const lista of grupos.values()) {
    const { titular, campo } = lista[0]
    const escolhido = [...lista].sort(melhor)[0]

    // Só documentos legíveis contam para divergência: um documento borrado já é sinalizado à parte.
    const distintos = new Map<string, { valor: Valor; fontes: string[] }>()
    for (const o of lista.filter((o) => o.legivel)) {
      const item = distintos.get(o.chave) ?? { valor: o.valor, fontes: [] }
      if (!item.fontes.includes(o.fonte)) item.fontes.push(o.fonte)
      distintos.set(o.chave, item)
    }
    const divergente = !SEM_DIVERGENCIA.has(campo) && distintos.size > 1

    resolucao.campos[titular][campo] = {
      valor: escolhido.valor, fonte: escolhido.fonte, tipo_documento: escolhido.tipo,
      incerto: escolhido.incerto, divergente,
    }
    if (divergente) {
      resolucao.divergencias.push({ titular, campo, rotulo: CAMPOS[campo], valores: [...distintos.values()] })
    }
  }

  const ordemCampo = Object.keys(CAMPOS)
  resolucao.divergencias.sort((a, b) =>
    a.titular.localeCompare(b.titular) || ordemCampo.indexOf(a.campo) - ordemCampo.indexOf(b.campo))
  return resolucao
}
