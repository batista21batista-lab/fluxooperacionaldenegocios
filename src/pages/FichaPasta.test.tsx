import { writeFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PastaCarregada } from '@/lib/pasta'
import { Ficha } from './FichaPasta'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ profile: { nome: 'Equipe Pastas Teste' } }) }))

const tipo = (id: string, nome: string, peso: number, obrigatorio: boolean, exige: boolean, ordem: number) => ({
  id, nome, peso, obrigatorio, exige_segundo_comprador: exige, ordem, ativo: true, descricao: null, created_at: '',
})
const doc = (tipo_documento_id: string, titular: string, status: string, ocr_dados: unknown = null, extra = {}) => ({
  id: `${tipo_documento_id}-${titular}`, pasta_id: 'p1', tipo_documento_id, titular, status, arquivo_path: 'x',
  motivo_rejeicao: null, enviado_por: null, revisado_por: null, revisado_em: status === 'aprovado' ? '2026-11-16T12:00:00Z' : null,
  created_at: `2026-11-1${tipo_documento_id.length}T10:00:00Z`, updated_at: '', ocr_status: ocr_dados ? 'concluido' : null,
  ocr_dados, ocr_erro: null, ocr_em: null, ...extra,
})
const vazio = {
  rg: null, data_nascimento: null, nome_mae: null, estado_civil: null, endereco: null, cep: null, data_emissao: null,
  data_validade: null, renda_mensal: null, empregador: null, observacoes: null, nome: null, cpf: null,
}

const dados = {
  pasta: {
    id: 'p1', segundo_comprador: true, status: 'incompleta', classificacao: 'prata', pontuacao: 110, pontuacao_maxima: 160,
    percentual: 68.75, unidade: 'Torre A, 1204', data_entrega: '2026-12-01',
    clientes: { nome: 'José da Silva', cpf: '12345678909', telefone: '11988887777', email: 'jose@exemplo.com' },
    empreendimentos: { nome: 'Residencial Aurora' }, autonomos: { apelido: 'CARLOS.M' },
  },
  tipos: [
    tipo('f', 'Ficha cadastral', 10, true, false, 0), tipo('rg', 'RG ou CNH', 10, true, true, 1),
    tipo('res', 'Comprovante de residência', 10, true, false, 3), tipo('renda', 'Comprovante de renda', 20, true, true, 5),
  ],
  docs: [
    doc('f', 'comprador_1', 'aprovado', {
      ...vazio, tipo_documento: 'ficha_cadastral', legivel: true, nome: 'José da Silva', cpf: '12345678909',
      estado_civil: 'Casado(a)', telefone: '11988887777', profissao: 'Engenheiro', renda_mensal: 12000,
      endereco_detalhado: { logradouro: 'Rua das Flores', numero: '120', complemento: 'Apto 31', bairro: null, cidade: 'São Paulo', uf: 'SP', cep: '01310100' },
      campos_incertos: ['endereco_detalhado.numero'],
      proponente_2: { ...vazio, nome: 'Maria Souza', cpf: '98765432100', sexo: null, nacionalidade: null, naturalidade: null, nome_pai: null, profissao: 'Médica', email: null, telefone: null, endereco: null },
    }),
    doc('rg', 'comprador_1', 'aprovado', { ...vazio, tipo_documento: 'rg', legivel: true, nome: 'JOSE DA SILVA', cpf: '12345678909', rg: '12.345.678-9', data_nascimento: '1985-03-10', nome_mae: 'Ana da Silva' }),
    doc('rg', 'comprador_2', 'enviado', { ...vazio, tipo_documento: 'cnh', legivel: true, nome: 'MARIA SOUZA SILVA', cpf: '98765432100' }),
    doc('renda', 'comprador_1', 'rejeitado', null, { motivo_rejeicao: 'Holerite ilegível' }),
  ],
  historico: [],
} as unknown as PastaCarregada

describe('Ficha impressa', () => {
  it('traz pasta, os dois compradores, divergências, documentos e pendências', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}><Ficha dados={dados} /></QueryClientProvider>,
    )
    if (process.env.FICHA_HTML) writeFileSync(process.env.FICHA_HTML, html)
    const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    expect(t).toContain('Ficha da pasta · José da Silva')
    expect(t).toContain('110/160 pts (69%)')
    expect(t).toContain('2º comprador')
    expect(t).toContain('Nome *: MARIA SOUZA SILVA RG ou CNH (2º comprador)') // o RG vence a ficha e diverge
    expect(t).toContain('Número *: 120') // lido com dúvida
    expect(t).toContain('2º comprador · Nome : Maria Souza (Ficha cadastral) ≠ MARIA SOUZA SILVA (RG ou CNH (2º comprador))')
    expect(t).toContain('Rejeitado — Holerite ilegível')
    expect(t).toContain('Pendências obrigatórias (4): RG ou CNH (2º comprador); Comprovante de residência; Comprovante de renda (1º comprador); Comprovante de renda (2º comprador).')
  })
})
