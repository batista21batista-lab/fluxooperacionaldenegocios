import { readSheet } from 'read-excel-file/browser'
import { supabase } from '@/lib/supabase'

export type AutonomoResumo = { id: string; apelido: string; designacao: string | null }

/** Todos os autônomos ativos (paginado: o PostgREST devolve no máximo 1000 por vez). */
export async function listarAutonomos(): Promise<AutonomoResumo[]> {
  const todos: AutonomoResumo[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from('autonomos')
      .select('id, apelido, designacao')
      .eq('ativo', true)
      .order('apelido')
      .range(de, de + 999)
    if (error) throw error
    todos.push(...data)
    if (data.length < 1000) return todos
  }
}

/** O próprio autônomo e quem está abaixo dele (para quem ele pode abrir pasta). */
export async function listarMinhaEstrutura(meuId: string): Promise<AutonomoResumo[]> {
  const { data, error } = await supabase
    .from('autonomos')
    .select('id, apelido, designacao')
    .eq('ativo', true)
    .or(`id.eq.${meuId},superintendente_id.eq.${meuId},diretor_id.eq.${meuId},diretor_geral_id.eq.${meuId}`)
    .order('apelido')
    .limit(1000)
  if (error) throw error
  return data
}

export type LinhaImportacao = {
  apelido: string
  designacao: string | null
  empresa: string | null
  zona: string | null
  creci_tipo: string | null
  creci_status: string | null
  super: string | null
  diretor: string | null
  geral: string | null
}

// Cabeçalho da planilha -> campo. Só estas colunas são lidas; dados pessoais
// (nascimento, idade, sexo) ficam de fora de propósito.
const COLUNAS: Record<string, keyof LinhaImportacao> = {
  'apelido': 'apelido',
  'designação técnica': 'designacao',
  'empresa': 'empresa',
  'zona': 'zona',
  'creci tipo': 'creci_tipo',
  'creci status': 'creci_status',
  'corretor associado super': 'super',
  'corretor associado d': 'diretor',
  'corretor associado g': 'geral',
}

export async function lerPlanilhaAutonomos(arquivo: File): Promise<LinhaImportacao[]> {
  const linhas = await readSheet(arquivo)
  const cabecalho = (linhas[0] ?? []).map((c) => String(c ?? '').trim().toLowerCase())
  const indice = new Map<keyof LinhaImportacao, number>()
  cabecalho.forEach((nome, i) => {
    const campo = COLUNAS[nome]
    if (campo) indice.set(campo, i)
  })
  if (!indice.has('apelido')) throw new Error('A planilha precisa ter a coluna "Apelido" na primeira linha.')

  const texto = (linha: unknown[], campo: keyof LinhaImportacao) => {
    const i = indice.get(campo)
    const v = i === undefined ? null : linha[i]
    return v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim()
  }
  return linhas
    .slice(1)
    .map((l) => ({
      apelido: texto(l, 'apelido') ?? '',
      designacao: texto(l, 'designacao'),
      empresa: texto(l, 'empresa'),
      zona: texto(l, 'zona'),
      creci_tipo: texto(l, 'creci_tipo'),
      creci_status: texto(l, 'creci_status'),
      super: texto(l, 'super'),
      diretor: texto(l, 'diretor'),
      geral: texto(l, 'geral'),
    }))
    .filter((l) => l.apelido !== '')
}
