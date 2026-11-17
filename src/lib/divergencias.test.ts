import { describe, expect, it } from 'vitest'
import type { DadosOcr, PessoaOcr } from '@/types/ocr'
import {
  chaveDeComparacao,
  normalizarParaComparacao,
  padronizarEstadoCivil,
  prioridadeDaFonte,
  resolverCampos,
  type Leitura,
} from './divergencias'

/** Leitura no formato antigo (sem os campos de ficha), como as já gravadas no banco. */
function leitura(fonte: string, dados: Partial<DadosOcr>, titular?: Leitura['titular']): Leitura {
  const base: DadosOcr = {
    tipo_documento: 'outro', legivel: true, nome: null, cpf: null, rg: null, data_nascimento: null, nome_mae: null,
    estado_civil: null, endereco: null, cep: null, data_emissao: null, data_validade: null, renda_mensal: null,
    empregador: null, observacoes: null,
  }
  return { fonte, titular, dados: { ...base, ...dados } }
}

const pessoa = (p: Partial<PessoaOcr>): PessoaOcr => ({
  nome: null, cpf: null, rg: null, data_nascimento: null, sexo: null, estado_civil: null, nacionalidade: null,
  naturalidade: null, nome_pai: null, nome_mae: null, profissao: null, empregador: null, renda_mensal: null,
  email: null, telefone: null, endereco: null, ...p,
})

describe('normalizarParaComparacao', () => {
  it('ignora acento, caixa, espaços e pontuação de documento', () => {
    expect(normalizarParaComparacao('  JOSÉ  da Silva ')).toBe('jose da silva')
    expect(normalizarParaComparacao('Casado(a)')).toBe('casado')
    expect(normalizarParaComparacao('123.456.789-09')).toBe('12345678909')
    expect(normalizarParaComparacao(null)).toBe('')
  })
})

describe('padronizarEstadoCivil', () => {
  it.each([
    ['SOLTEIRO(A)', 'solteiro'],
    ['Casada', 'casado'],
    ['divorciado', 'divorciado'],
    ['Separada judicialmente', 'separado'],
    ['Viúvo', 'viuvo'],
    ['União Estável', 'uniao_estavel'],
    ['convivente', 'uniao_estavel'],
    ['', null],
    ['???', null],
  ])('%s → %s', (entrada, esperado) => {
    expect(padronizarEstadoCivil(entrada)).toBe(esperado)
  })
})

describe('chaveDeComparacao', () => {
  it('compara CPF, CEP e telefone só pelos dígitos', () => {
    expect(chaveDeComparacao('cpf', '123.456.789-09')).toBe(chaveDeComparacao('cpf', '12345678909'))
    expect(chaveDeComparacao('cep', '01310-100')).toBe('01310100')
    expect(chaveDeComparacao('telefone', '(11) 98888-7777')).toBe('11988887777')
  })
  it('compara RG sem pontuação, mantendo o dígito X', () => {
    expect(chaveDeComparacao('rg', '12.345.678-x')).toBe('12345678X')
  })
})

describe('prioridadeDaFonte', () => {
  it('documento oficial > ficha > demais nos dados pessoais', () => {
    expect(prioridadeDaFonte('rg', 'nome')).toBe(1)
    expect(prioridadeDaFonte('ficha_cadastral', 'nome')).toBe(2)
    expect(prioridadeDaFonte('comprovante_residencia', 'nome')).toBe(3)
  })
  it('comprovante de residência manda no endereço e o de renda manda na renda', () => {
    expect(prioridadeDaFonte('comprovante_residencia', 'numero')).toBe(1)
    expect(prioridadeDaFonte('ficha_cadastral', 'numero')).toBe(2)
    expect(prioridadeDaFonte('rg', 'numero')).toBe(3)
    expect(prioridadeDaFonte('comprovante_renda', 'renda_mensal')).toBe(1)
  })
})

describe('resolverCampos', () => {
  it('o RG vence a ficha no nome, e a grafia diferente não conta como divergência', () => {
    const r = resolverCampos([
      leitura('Ficha', { tipo_documento: 'ficha_cadastral', nome: 'jose da silva' }),
      leitura('RG', { tipo_documento: 'rg', nome: 'JOSÉ DA SILVA' }),
    ])
    expect(r.campos.comprador_1.nome).toMatchObject({ valor: 'JOSÉ DA SILVA', fonte: 'RG', divergente: false })
    expect(r.divergencias).toEqual([])
  })

  it('registra divergência de CPF com o documento de cada lado, mesmo com pontuação diferente', () => {
    const r = resolverCampos([
      leitura('Ficha', { tipo_documento: 'ficha_cadastral', cpf: '123.456.789-09' }),
      leitura('CNH', { tipo_documento: 'cnh', cpf: '12345678900' }),
      leitura('RG', { tipo_documento: 'rg', cpf: '12345678909' }),
    ])
    expect(r.campos.comprador_1.cpf).toMatchObject({ valor: '12345678900', fonte: 'CNH', divergente: true })
    expect(r.divergencias).toEqual([
      {
        titular: 'comprador_1', campo: 'cpf', rotulo: 'CPF',
        valores: [
          { valor: '123.456.789-09', fontes: ['Ficha', 'RG'] },
          { valor: '12345678900', fontes: ['CNH'] },
        ],
      },
    ])
  })

  it('com a mesma prioridade, vale o documento enviado primeiro', () => {
    const r = resolverCampos([
      leitura('RG', { tipo_documento: 'rg', data_nascimento: '1985-03-10' }),
      leitura('CNH', { tipo_documento: 'cnh', data_nascimento: '1985-03-01' }),
    ])
    expect(r.campos.comprador_1.data_nascimento?.fonte).toBe('RG')
    expect(r.divergencias.map((d) => d.campo)).toEqual(['data_nascimento'])
  })

  it('padroniza o estado civil antes de comparar', () => {
    const r = resolverCampos([
      leitura('Ficha', { tipo_documento: 'ficha_cadastral', estado_civil: 'Casado(a)' }),
      leitura('Certidão', { tipo_documento: 'certidao_estado_civil', estado_civil: 'CASADA' }),
    ])
    expect(r.campos.comprador_1.estado_civil).toMatchObject({ valor: 'casado', fonte: 'Certidão' })
    expect(r.divergencias).toEqual([])
  })

  it('a ficha preenche o 2º comprador pelo proponente_2', () => {
    const r = resolverCampos([
      leitura('Ficha', {
        tipo_documento: 'ficha_cadastral', nome: 'José da Silva',
        proponente_2: pessoa({ nome: 'Maria Souza', cpf: '98765432100' }),
      }),
      leitura('RG da Maria', { tipo_documento: 'rg', nome: 'MARIA SOUZA SILVA' }, 'comprador_2'),
    ])
    expect(r.campos.comprador_1.nome?.valor).toBe('José da Silva')
    expect(r.campos.comprador_2.cpf).toMatchObject({ valor: '98765432100', fonte: 'Ficha' })
    expect(r.campos.comprador_2.nome).toMatchObject({ valor: 'MARIA SOUZA SILVA', fonte: 'RG da Maria' })
    expect(r.divergencias).toMatchObject([{ titular: 'comprador_2', campo: 'nome' }])
  })

  it('o comprovante de residência vence a ficha no endereço; o CEP antigo (nível principal) também entra', () => {
    const r = resolverCampos([
      leitura('Ficha', {
        tipo_documento: 'ficha_cadastral',
        endereco_detalhado: {
          logradouro: 'Rua A', numero: '12', complemento: 'Apto 3', bairro: null, cidade: 'São Paulo', uf: 'SP',
          cep: '01310-100',
        },
      }),
      leitura('Conta de luz', { tipo_documento: 'comprovante_residencia', cep: '01310100' }),
    ])
    expect(r.campos.comprador_1.cep).toMatchObject({ fonte: 'Conta de luz', divergente: false })
    expect(r.campos.comprador_1.numero).toMatchObject({ valor: '12', fonte: 'Ficha' })
  })

  it('campo incerto perde para um certo da mesma prioridade', () => {
    const r = resolverCampos([
      leitura('Ficha 1', { tipo_documento: 'ficha_cadastral', rg: '12345678', campos_incertos: ['rg'] }),
      leitura('Ficha 2', { tipo_documento: 'ficha_cadastral', rg: '12345673' }),
    ])
    expect(r.campos.comprador_1.rg).toMatchObject({ valor: '12345673', incerto: false })
  })

  it('marca como incerto o campo do 2º proponente pelo caminho completo', () => {
    const r = resolverCampos([
      leitura('Ficha', {
        tipo_documento: 'ficha_cadastral',
        proponente_2: pessoa({ cpf: '98765432100' }),
        campos_incertos: ['proponente_2.cpf'],
      }),
    ])
    expect(r.campos.comprador_2.cpf?.incerto).toBe(true)
  })

  it('documento ilegível só serve de último recurso e não gera divergência', () => {
    const r = resolverCampos([
      leitura('RG borrado', { tipo_documento: 'rg', legivel: false, nome: 'J0SE DA SILV4' }),
      leitura('Ficha', { tipo_documento: 'ficha_cadastral', nome: 'José da Silva', nome_mae: 'Ana' }),
      leitura('CNH borrada', { tipo_documento: 'cnh', legivel: false, nome_pai: 'Pedro' }),
    ])
    expect(r.campos.comprador_1.nome).toMatchObject({ valor: 'José da Silva', fonte: 'Ficha' })
    expect(r.campos.comprador_1.nome_pai?.valor).toBe('Pedro')
    expect(r.divergencias).toEqual([])
  })

  it('ignora leituras simuladas e não aponta divergência de renda', () => {
    const r = resolverCampos([
      leitura('Simulado', { simulado: true, nome: 'CLIENTE TESTE 1234' }),
      leitura('Holerite', { tipo_documento: 'comprovante_renda', renda_mensal: 5200 }),
      leitura('Ficha', { tipo_documento: 'ficha_cadastral', renda_mensal: 5000 }),
    ])
    expect(r.campos.comprador_1.nome).toBeUndefined()
    expect(r.campos.comprador_1.renda_mensal).toMatchObject({ valor: 5200, fonte: 'Holerite', divergente: false })
    expect(r.divergencias).toEqual([])
  })
})
