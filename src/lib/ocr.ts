import { supabase } from '@/lib/supabase'
import type { DadosOcr } from '@/types/database'

async function invocar(corpo: Record<string, unknown>): Promise<DadosOcr> {
  const { data, error } = await supabase.functions.invoke('ocr-documento', { body: corpo })
  if (error) {
    // A função devolve { erro } com status de erro; o SDK guarda a resposta em error.context.
    let msg = 'Não foi possível ler o documento.'
    try {
      const detalhe = await (error as { context?: Response }).context?.json()
      if (detalhe?.erro) msg = detalhe.erro
    } catch {
      /* mantém a mensagem padrão */
    }
    throw new Error(msg)
  }
  return data.dados as DadosOcr
}

/** Lê um documento já enviado à pasta; o resultado fica gravado no documento. */
export const lerDocumento = (documentoId: string) => invocar({ documento_id: documentoId })

/** Pré-leitura de um arquivo ainda não enviado (nada é gravado). */
export async function lerArquivo(arquivo: File): Promise<DadosOcr> {
  const base64 = await new Promise<string>((ok, falha) => {
    const leitor = new FileReader()
    leitor.onload = () => ok(String(leitor.result).split(',')[1] ?? '')
    leitor.onerror = () => falha(new Error('Não foi possível abrir o arquivo.'))
    leitor.readAsDataURL(arquivo)
  })
  return invocar({ arquivo_base64: base64, media_type: arquivo.type })
}

export const ROTULOS_OCR: [keyof DadosOcr, string][] = [
  ['nome', 'Nome'],
  ['cpf', 'CPF'],
  ['rg', 'RG'],
  ['data_nascimento', 'Nascimento'],
  ['nome_mae', 'Mãe'],
  ['estado_civil', 'Estado civil'],
  ['endereco', 'Endereço'],
  ['cep', 'CEP'],
  ['data_emissao', 'Emissão'],
  ['data_validade', 'Validade'],
  ['renda_mensal', 'Renda mensal'],
  ['empregador', 'Empregador'],
]
