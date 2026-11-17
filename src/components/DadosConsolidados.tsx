import { cn } from '@/lib/utils'
import { formatarCep, formatarCpf, formatarData, formatarTelefone, soDigitos } from '@/lib/format'
import { useConsolidado } from '@/lib/useConsolidado'
import {
  CAMPOS,
  chaveDeComparacao,
  type Campo,
  type CampoResolvido,
  type Leitura,
  type Titular,
} from '@/lib/divergencias'

export const ROTULO_TITULAR: Record<Titular, string> = { comprador_1: '1º comprador', comprador_2: '2º comprador' }

const ESTADO_CIVIL: Record<string, string> = {
  solteiro: 'Solteiro(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)', separado: 'Separado(a)',
  viuvo: 'Viúvo(a)', uniao_estavel: 'União estável',
}

export function formatar(campo: Campo, valor: string | number): string {
  if (campo === 'cpf') return formatarCpf(String(valor))
  if (campo === 'data_nascimento' && /^\d{4}-\d{2}-\d{2}/.test(String(valor))) return formatarData(String(valor))
  if (campo === 'renda_mensal') return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (campo === 'estado_civil') return ESTADO_CIVIL[String(valor)] ?? String(valor)
  if (campo === 'cep') return formatarCep(String(valor))
  if (campo === 'telefone') return formatarTelefone(String(valor))
  return String(valor)
}

type Props = {
  leituras: Leitura[]
  segundoComprador: boolean
  /** Dados digitados no cadastro da pasta, comparados com o 1º comprador. */
  cadastro?: { nome: string; cpf: string } | null
}

/** Cruza as leituras de todos os documentos da pasta: valor escolhido por campo, origem e divergências. */
export default function DadosConsolidados({ leituras, segundoComprador, cadastro }: Props) {
  const { campos, divergencias } = useConsolidado(leituras)
  if (leituras.length === 0) return null

  // O cadastro digitado também é uma fonte: avisa se os documentos dizem outra coisa.
  const contraCadastro: { rotulo: string; cadastro: string; lido: CampoResolvido }[] = []
  if (cadastro) {
    const { nome, cpf } = campos.comprador_1
    if (cpf && soDigitos(String(cpf.valor)) !== cadastro.cpf) {
      contraCadastro.push({ rotulo: 'CPF', cadastro: formatarCpf(cadastro.cpf), lido: cpf })
    }
    if (nome && chaveDeComparacao('nome', nome.valor) !== chaveDeComparacao('nome', cadastro.nome)) {
      contraCadastro.push({ rotulo: 'Nome', cadastro: cadastro.nome, lido: nome })
    }
  }

  const temSegundoNosDocs = Object.keys(campos.comprador_2).length > 0
  const titulares: Titular[] = segundoComprador || temSegundoNosDocs ? ['comprador_1', 'comprador_2'] : ['comprador_1']
  const totalAlertas = divergencias.length + contraCadastro.length

  return (
    <section className="overflow-hidden rounded-lg border">
      <h2 className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted px-4 py-2 text-sm font-medium">
        Dados lidos dos documentos
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            totalAlertas ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700',
          )}
        >
          {totalAlertas ? `${totalAlertas} divergência${totalAlertas > 1 ? 's' : ''}` : 'Sem divergências'}
        </span>
      </h2>

      <div className="space-y-4 p-4 text-sm">
        {(divergencias.length > 0 || contraCadastro.length > 0) && (
          <ul className="space-y-1.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            {contraCadastro.map((c) => (
              <li key={`cad-${c.rotulo}`}>
                <b>{c.rotulo} do cadastro</b>: {c.cadastro} <span className="text-red-700">≠</span>{' '}
                {formatar(c.rotulo === 'CPF' ? 'cpf' : 'nome', c.lido.valor)} ({c.lido.fonte})
              </li>
            ))}
            {divergencias.map((d) => (
              <li key={`${d.titular}-${d.campo}`}>
                <b>
                  {titulares.length > 1 && `${ROTULO_TITULAR[d.titular]} · `}
                  {d.rotulo}
                </b>
                :{' '}
                {d.valores.map((v, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-red-700"> ≠ </span>}
                    {formatar(d.campo, v.valor)} ({v.fontes.join(', ')})
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}

        {!segundoComprador && temSegundoNosDocs && (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
            Os documentos trazem um 2º comprador, mas a pasta não está marcada como de casal. Marque “Pasta com 2º
            comprador” para pedir os documentos dele.
          </p>
        )}

        <div className={cn('grid gap-4', titulares.length > 1 && 'md:grid-cols-2')}>
          {titulares.map((t) => {
            const lista = (Object.keys(CAMPOS) as Campo[]).filter((c) => campos[t][c])
            return (
              <div key={t}>
                <h3 className="mb-1 font-medium">{ROTULO_TITULAR[t]}</h3>
                {lista.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum dado lido ainda.</p>
                ) : (
                  <dl className="space-y-0.5 text-xs">
                    {lista.map((c) => {
                      const r = campos[t][c]!
                      return (
                        <div key={c} className="flex flex-wrap items-baseline gap-x-1">
                          <dt className="text-muted-foreground">{CAMPOS[c]}:</dt>
                          <dd className={cn(r.divergente && 'font-medium text-red-700')}>{formatar(c, r.valor)}</dd>
                          <dd className="text-muted-foreground">· {r.fonte}</dd>
                          {r.incerto && (
                            <dd className="rounded bg-amber-100 px-1 text-amber-800" title="O OCR teve dúvida neste campo">
                              conferir
                            </dd>
                          )}
                        </div>
                      )
                    })}
                  </dl>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Valor escolhido pela fonte mais confiável: documento oficial antes da ficha; comprovante de residência para o
          endereço; comprovante de renda para a renda. Logradouro, bairro, cidade e UF que faltarem vêm da consulta do
          CEP, que também confere a cidade e a UF lidas. Confira sempre antes de usar.
        </p>
      </div>
    </section>
  )
}
