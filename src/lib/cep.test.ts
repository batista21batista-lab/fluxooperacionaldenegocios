import { afterEach, describe, expect, it, vi } from 'vitest'
import { aplicarCep, buscarCep, FONTE_CEP, type EnderecoCep } from './cep'
import type { Resolucao } from './divergencias'
import { formatarCep, formatarTelefone } from './format'

const paulista: EnderecoCep = { cep: '01310100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' }
const campo = (valor: string, fonte = 'Ficha') => ({ valor, fonte, tipo_documento: 'ficha_cadastral', incerto: false, divergente: false })

describe('aplicarCep', () => {
  it('completa só o que falta, sem trocar o que foi lido', () => {
    const r: Resolucao = {
      campos: { comprador_1: { cep: campo('01310100'), logradouro: campo('Av. Paulista') }, comprador_2: {} },
      divergencias: [],
    }
    const novo = aplicarCep(r, 'comprador_1', paulista)
    expect(novo.campos.comprador_1.logradouro?.valor).toBe('Av. Paulista')
    expect(novo.campos.comprador_1.bairro).toMatchObject({ valor: 'Bela Vista', fonte: FONTE_CEP })
    expect(novo.campos.comprador_1.cidade?.valor).toBe('São Paulo')
    expect(novo.divergencias).toEqual([])
    expect(r.campos.comprador_1.bairro).toBeUndefined() // não altera a entrada
  })

  it('aponta cidade diferente da do CEP, ignorando acento e caixa', () => {
    const r: Resolucao = {
      campos: { comprador_1: {}, comprador_2: { cidade: campo('SAO PAULO'), uf: campo('RJ', 'RG') } },
      divergencias: [],
    }
    const novo = aplicarCep(r, 'comprador_2', paulista)
    expect(novo.campos.comprador_2.cidade?.divergente).toBe(false)
    expect(novo.campos.comprador_2.uf?.divergente).toBe(true)
    expect(novo.divergencias).toEqual([
      { titular: 'comprador_2', campo: 'uf', rotulo: 'UF', valores: [{ valor: 'RJ', fontes: ['RG'] }, { valor: 'SP', fontes: [FONTE_CEP] }] },
    ])
  })

  it('soma o CEP a uma divergência que já existia no campo', () => {
    const r: Resolucao = {
      campos: { comprador_1: { cidade: { ...campo('Santos'), divergente: true } }, comprador_2: {} },
      divergencias: [{
        titular: 'comprador_1', campo: 'cidade', rotulo: 'Cidade',
        valores: [{ valor: 'Santos', fontes: ['Ficha'] }, { valor: 'Guarujá', fontes: ['Conta de luz'] }],
      }],
    }
    const novo = aplicarCep(r, 'comprador_1', paulista)
    expect(novo.divergencias).toHaveLength(1)
    expect(novo.divergencias[0].valores.map((v) => v.valor)).toEqual(['Santos', 'Guarujá', 'São Paulo'])
  })
})

describe('buscarCep', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('consulta o ViaCEP só com os dígitos e trata CEP inexistente', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ erro: 'true' })))
    vi.stubGlobal('fetch', fetch)
    expect(await buscarCep('01310-100')).toEqual(paulista)
    expect(fetch.mock.calls[0][0]).toBe('https://viacep.com.br/ws/01310100/json/')
    expect(await buscarCep('99999999')).toBeNull()
    expect(await buscarCep('123')).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('máscaras', () => {
  it.each([
    ['', ''], ['1', '(1'], ['119', '(11) 9'], ['1133334444', '(11) 3333-4444'],
    ['11988887777', '(11) 98888-7777'], ['(11) 98888-77771234', '(11) 98888-7777'],
  ])('telefone %s → %s', (e, s) => expect(formatarTelefone(e)).toBe(s))
  it.each([['01310', '01310'], ['013101', '01310-1'], ['01310100', '01310-100']])('cep %s → %s', (e, s) =>
    expect(formatarCep(e)).toBe(s))
})
