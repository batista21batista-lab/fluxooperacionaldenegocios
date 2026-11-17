/**
 * Consulta de CEP (ViaCEP) para completar e conferir o endereço lido dos documentos.
 * O ViaCEP é público, sem chave; só o CEP sai do navegador.
 */
import { chaveDeComparacao, type Campo, type Resolucao, type Titular } from '@/lib/divergencias'

export type EnderecoCep = { cep: string; logradouro: string; bairro: string; cidade: string; uf: string }

export const FONTE_CEP = 'Consulta do CEP'

/** Devolve o endereço do CEP, ou null se o CEP não existe. Lança erro se o serviço falhar. */
export async function buscarCep(cep: string, signal?: AbortSignal): Promise<EnderecoCep | null> {
  const d = cep.replace(/\D/g, '')
  if (d.length !== 8) return null
  const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal })
  if (!r.ok) throw new Error(`ViaCEP respondeu ${r.status}`)
  const j = (await r.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
  if (j.erro) return null
  return { cep: d, logradouro: j.logradouro ?? '', bairro: j.bairro ?? '', cidade: j.localidade ?? '', uf: j.uf ?? '' }
}

const COMPLETAVEIS: [Campo, keyof EnderecoCep][] = [
  ['logradouro', 'logradouro'],
  ['bairro', 'bairro'],
  ['cidade', 'cidade'],
  ['uf', 'uf'],
]
/** Só cidade e UF são comparadas: logradouro e bairro variam muito na escrita ("R." x "Rua", bairro popular). */
const CONFERIDOS: ReadonlySet<Campo> = new Set(['cidade', 'uf'])

/**
 * Completa os campos de endereço que faltam com os dados do CEP e registra divergência quando a cidade ou a UF
 * lidas não batem com o CEP. Não altera a resolução recebida.
 */
export function aplicarCep(resolucao: Resolucao, titular: Titular, endereco: EnderecoCep): Resolucao {
  const campos = { ...resolucao.campos[titular] }
  const divergencias = [...resolucao.divergencias]

  for (const [campo, chave] of COMPLETAVEIS) {
    const doCep = endereco[chave]
    if (!doCep) continue
    const atual = campos[campo]
    if (!atual) {
      campos[campo] = { valor: doCep, fonte: FONTE_CEP, tipo_documento: 'cep', incerto: false, divergente: false }
      continue
    }
    if (CONFERIDOS.has(campo) && chaveDeComparacao(campo, atual.valor) !== chaveDeComparacao(campo, doCep)) {
      campos[campo] = { ...atual, divergente: true }
      const existente = divergencias.findIndex((d) => d.titular === titular && d.campo === campo)
      const item = { valor: doCep, fontes: [FONTE_CEP] }
      if (existente >= 0) {
        divergencias[existente] = { ...divergencias[existente], valores: [...divergencias[existente].valores, item] }
      } else {
        divergencias.push({
          titular, campo, rotulo: campo === 'uf' ? 'UF' : 'Cidade',
          valores: [{ valor: atual.valor, fontes: [atual.fonte] }, item],
        })
      }
    }
  }
  return { campos: { ...resolucao.campos, [titular]: campos }, divergencias }
}
