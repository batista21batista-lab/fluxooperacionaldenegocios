import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DadosOcr } from '@/types/ocr'
import DadosConsolidados from './DadosConsolidados'

const base: DadosOcr = {
  tipo_documento: 'outro', legivel: true, nome: null, cpf: null, rg: null, data_nascimento: null, nome_mae: null,
  estado_civil: null, endereco: null, cep: null, data_emissao: null, data_validade: null, renda_mensal: null,
  empregador: null, observacoes: null,
}
const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('DadosConsolidados', () => {
  it('não mostra nada sem leituras', () => {
    expect(renderToStaticMarkup(<DadosConsolidados leituras={[]} segundoComprador={false} />)).toBe('')
  })

  it('lista divergências entre documentos e contra o cadastro, e avisa do 2º comprador não marcado', () => {
    const html = renderToStaticMarkup(
      <DadosConsolidados
        segundoComprador={false}
        cadastro={{ nome: 'José da Silva', cpf: '12345678909' }}
        leituras={[
          {
            fonte: 'Ficha cadastral',
            dados: {
              ...base, tipo_documento: 'ficha_cadastral', nome: 'José da Silva', cpf: '12345678909',
              estado_civil: 'casado(a)', campos_incertos: ['estado_civil'],
              proponente_2: {
                nome: 'Maria Souza', cpf: '98765432100', rg: null, data_nascimento: null, sexo: null,
                estado_civil: null, nacionalidade: null, naturalidade: null, nome_pai: null, nome_mae: null,
                profissao: null, empregador: null, renda_mensal: null, email: null, telefone: null, endereco: null,
              },
            },
          },
          { fonte: 'RG ou CNH', dados: { ...base, tipo_documento: 'rg', nome: 'JOSE DA SILVA', cpf: '11144477735' } },
        ]}
      />,
    )
    const t = texto(html)
    expect(t).toContain('2 divergências')
    expect(t).toContain('CPF do cadastro : 123.456.789-09 ≠ 111.444.777-35 (RG ou CNH)')
    expect(t).toContain('1º comprador · CPF : 123.456.789-09 (Ficha cadastral) ≠ 111.444.777-35 (RG ou CNH)')
    expect(t).toContain('CPF: 111.444.777-35 · RG ou CNH') // o RG vence a ficha
    expect(t).toContain('Casado(a) · Ficha cadastral conferir')
    expect(t).toContain('Os documentos trazem um 2º comprador')
    expect(t).toContain('2º comprador Nome: Maria Souza · Ficha cadastral')
  })
})
