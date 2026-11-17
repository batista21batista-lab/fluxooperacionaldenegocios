import { supabase } from '@/lib/supabase'
import type { Leitura, Titular } from '@/lib/divergencias'
import type { Documento, TipoDocumento } from '@/types/database'
import type { DadosOcr } from '@/types/ocr'

/** Pasta com cliente, empreendimento, autônomo, catálogo ativo, documentos e histórico. */
export async function carregarPasta(id: string) {
  const [p, tipos, docs, hist] = await Promise.all([
    supabase
      .from('pastas')
      .select('*, clientes(nome, cpf, telefone, email), empreendimentos(nome), autonomos(apelido)')
      .eq('id', id)
      .single(),
    supabase.from('tipos_documento').select('*').eq('ativo', true).order('ordem'),
    supabase.from('documentos').select('*').eq('pasta_id', id),
    supabase.from('pasta_historico').select('*').eq('pasta_id', id).order('created_at', { ascending: false }),
  ])
  if (p.error) throw p.error
  if (tipos.error) throw tipos.error
  if (docs.error) throw docs.error
  return { pasta: p.data, tipos: tipos.data, docs: docs.data, historico: hist.data ?? [] }
}

export type PastaCarregada = Awaited<ReturnType<typeof carregarPasta>>
export type Exigencia = { t: TipoDocumento; titular: Titular }

export const chaveExigencia = (tipoId: string, titular: string) => `${tipoId}|${titular}`

/** Um item por exigência: todo tipo para o 1º comprador; os marcados no catálogo também para o 2º. */
export function exigencias(tipos: TipoDocumento[], segundoComprador: boolean): Exigencia[] {
  return tipos.flatMap((t) => [
    { t, titular: 'comprador_1' as const },
    ...(segundoComprador && t.exige_segundo_comprador ? [{ t, titular: 'comprador_2' as const }] : []),
  ])
}

/** Leituras de OCR concluídas, na ordem de envio, prontas para o cruzamento de campos. */
export function leiturasDaPasta(docs: Documento[], tipos: TipoDocumento[], segundoComprador: boolean): Leitura[] {
  const nomeTipo = new Map(tipos.map((t) => [t.id, t.nome]))
  return docs
    .filter((d) => d.ocr_status === 'concluido' && d.ocr_dados && (d.titular === 'comprador_1' || segundoComprador))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((d) => ({
      fonte: `${nomeTipo.get(d.tipo_documento_id) ?? 'Documento'}${d.titular === 'comprador_2' ? ' (2º comprador)' : ''}`,
      titular: d.titular as Titular,
      dados: d.ocr_dados as unknown as DadosOcr,
    }))
}
