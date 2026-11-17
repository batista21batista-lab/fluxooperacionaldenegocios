import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { formatar, ROTULO_TITULAR } from '@/components/DadosConsolidados'
import { CAMPOS, type Campo, type Resolucao, type Titular } from '@/lib/divergencias'
import { formatarCpf, formatarData, formatarTelefone } from '@/lib/format'
import { carregarPasta, chaveExigencia, exigencias, leiturasDaPasta, type PastaCarregada } from '@/lib/pasta'
import { useConsolidado } from '@/lib/useConsolidado'
import type { StatusDocumento } from '@/types/database'

const SITUACAO: Record<StatusDocumento | 'ausente', string> = {
  ausente: 'Não enviado', pendente: 'Pendente', enviado: 'Em análise', aprovado: 'Aprovado', rejeitado: 'Rejeitado',
}
const STATUS_PASTA = { completa: 'Completa', incompleta: 'Incompleta', cadastro: 'Cadastro' } as const
const CLASSIFICACAO = { ouro: 'Ouro', prata: 'Prata', bronze: 'Bronze' } as const

/** Campos impressos por comprador, em blocos. Campo vazio sai com linha para preencher à mão. */
const BLOCOS: [string, Campo[]][] = [
  ['Identificação', ['nome', 'cpf', 'rg', 'data_nascimento', 'sexo', 'estado_civil', 'nacionalidade', 'naturalidade', 'nome_pai', 'nome_mae']],
  ['Contato e endereço', ['telefone', 'email', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']],
  ['Renda', ['profissao', 'empregador', 'renda_mensal']],
]

function Item({ rotulo, valor, fonte }: { rotulo: string; valor?: string | null; fonte?: string }) {
  return (
    <div className="flex items-baseline gap-1 border-b border-dotted border-slate-300 py-0.5">
      <dt className="shrink-0 text-slate-500">{rotulo}:</dt>
      <dd className="min-h-[1.1em] flex-1 font-medium">{valor || ''}</dd>
      {fonte && valor && <dd className="shrink-0 text-[9px] text-slate-400">{fonte}</dd>}
    </div>
  )
}

function Comprador({ titular, resolucao }: { titular: Titular; resolucao: Resolucao }) {
  const campos = resolucao.campos[titular]
  return (
    <section className="break-inside-avoid space-y-2">
      <h2 className="border-b-2 border-slate-800 text-xs font-bold uppercase tracking-wide">{ROTULO_TITULAR[titular]}</h2>
      {BLOCOS.map(([titulo, lista]) => (
        <div key={titulo}>
          <h3 className="mb-0.5 text-[10px] font-semibold uppercase text-slate-500">{titulo}</h3>
          <dl className="grid grid-cols-2 gap-x-6">
            {lista.map((c) => {
              const r = campos[c]
              return (
                <Item
                  key={c}
                  rotulo={CAMPOS[c] + (r?.incerto || r?.divergente ? ' *' : '')}
                  valor={r ? formatar(c, r.valor) : null}
                  fonte={r?.fonte}
                />
              )
            })}
          </dl>
        </div>
      ))}
    </section>
  )
}

export function Ficha({ dados }: { dados: PastaCarregada }) {
  const { profile } = useAuth()
  const { pasta: p, tipos, docs } = dados
  const cli = p.clientes
  const resolucao = useConsolidado(leiturasDaPasta(docs, tipos, p.segundo_comprador))
  const porExigencia = new Map(docs.map((d) => [chaveExigencia(d.tipo_documento_id, d.titular), d]))
  const lista = exigencias(tipos, p.segundo_comprador)
  const pendentes = lista.filter(({ t, titular }) =>
    t.obrigatorio && porExigencia.get(chaveExigencia(t.id, titular))?.status !== 'aprovado')
  const titulares: Titular[] = p.segundo_comprador ? ['comprador_1', 'comprador_2'] : ['comprador_1']
  const marcados = titulares.some((t) => Object.values(resolucao.campos[t]).some((r) => r?.incerto || r?.divergente))

  useEffect(() => {
    document.title = `Ficha - ${cli?.nome ?? 'pasta'}`
  }, [cli?.nome])

  return (
    <article className="mx-auto max-w-[210mm] space-y-4 bg-white p-6 text-[11px] leading-snug text-slate-900 print:max-w-none print:p-0">
      <header className="flex items-end justify-between border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Lopes Consultoria de Imóveis</p>
          <h1 className="text-lg font-bold">Ficha da pasta · {cli?.nome}</h1>
        </div>
        <p className="text-right text-[10px] text-slate-500">
          Emitida em {new Date().toLocaleString('pt-BR')}
          {profile?.nome && <><br />por {profile.nome}</>}
        </p>
      </header>

      <section className="break-inside-avoid">
        <dl className="grid grid-cols-3 gap-x-6">
          <Item rotulo="Cliente" valor={cli?.nome} />
          <Item rotulo="CPF" valor={cli && formatarCpf(cli.cpf)} />
          <Item rotulo="Telefone" valor={cli?.telefone && formatarTelefone(cli.telefone)} />
          <Item rotulo="Empreendimento" valor={p.empreendimentos?.nome} />
          <Item rotulo="Unidade" valor={p.unidade} />
          <Item rotulo="Autônomo" valor={p.autonomos?.apelido} />
          <Item rotulo="Entrega" valor={formatarData(p.data_entrega)} />
          <Item rotulo="Situação" valor={`${STATUS_PASTA[p.status]} · ${CLASSIFICACAO[p.classificacao]}`} />
          <Item rotulo="Documentação" valor={`${p.pontuacao}/${p.pontuacao_maxima} pts (${Math.round(p.percentual)}%)`} />
        </dl>
        {cli?.email && <dl className="mt-0.5"><Item rotulo="E-mail" valor={cli.email} /></dl>}
      </section>

      {titulares.map((t) => <Comprador key={t} titular={t} resolucao={resolucao} />)}
      {marcados && (
        <p className="text-[10px] text-slate-500">* Campo com divergência entre documentos ou lido com dúvida pelo OCR: conferir no original.</p>
      )}

      {resolucao.divergencias.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="border-b-2 border-slate-800 text-xs font-bold uppercase tracking-wide">Divergências entre documentos</h2>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {resolucao.divergencias.map((d) => (
              <li key={`${d.titular}-${d.campo}`}>
                {p.segundo_comprador && `${ROTULO_TITULAR[d.titular]} · `}<b>{d.rotulo}</b>:{' '}
                {d.valores.map((v) => `${formatar(d.campo, v.valor)} (${v.fontes.join(', ')})`).join(' ≠ ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="break-inside-avoid">
        <h2 className="border-b-2 border-slate-800 text-xs font-bold uppercase tracking-wide">Documentos</h2>
        <table className="mt-1 w-full border-collapse text-[11px]">
          <thead className="text-left text-[10px] uppercase text-slate-500">
            <tr>
              <th className="py-0.5 font-semibold">Documento</th>
              {p.segundo_comprador && <th className="font-semibold">Comprador</th>}
              <th className="font-semibold">Exigência</th>
              <th className="font-semibold">Situação</th>
              <th className="font-semibold">Revisado em</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(({ t, titular }) => {
              const d = porExigencia.get(chaveExigencia(t.id, titular))
              return (
                <tr key={chaveExigencia(t.id, titular)} className="border-t border-slate-200">
                  <td className="py-0.5">{t.nome}</td>
                  {p.segundo_comprador && <td>{ROTULO_TITULAR[titular]}</td>}
                  <td>{t.obrigatorio ? 'Obrigatório' : 'Opcional'}</td>
                  <td className={d?.status === 'aprovado' ? '' : 'font-semibold'}>
                    {SITUACAO[d?.status ?? 'ausente']}
                    {d?.status === 'rejeitado' && d.motivo_rejeicao && ` — ${d.motivo_rejeicao}`}
                  </td>
                  <td>{d?.revisado_em ? new Date(d.revisado_em).toLocaleDateString('pt-BR') : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-1">
          {pendentes.length === 0
            ? 'Todos os documentos obrigatórios estão aprovados.'
            : `Pendências obrigatórias (${pendentes.length}): ${pendentes
                .map(({ t, titular }) => (p.segundo_comprador && t.exige_segundo_comprador ? `${t.nome} (${ROTULO_TITULAR[titular]})` : t.nome))
                .join('; ')}.`}
        </p>
      </section>

      <section className="grid break-inside-avoid grid-cols-2 gap-10 pt-8">
        {['Conferido pela Equipe Pastas', 'Recebido pelo Cadastro'].map((r) => (
          <div key={r} className="border-t border-slate-800 pt-1 text-center text-[10px]">
            {r}
            <br />
            Nome e data: ____________________ ___/___/______
          </div>
        ))}
      </section>
    </article>
  )
}

export default function FichaPasta() {
  const { id = '' } = useParams()
  const pasta = useQuery({ queryKey: ['pasta', id], queryFn: () => carregarPasta(id) })

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-between px-6 print:hidden">
        <Link to={`/pastas/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Voltar para a pasta
        </Link>
        <Button onClick={() => window.print()} disabled={!pasta.data}>
          Imprimir / salvar PDF
        </Button>
      </div>
      {pasta.isLoading && <p className="text-center text-muted-foreground">Carregando…</p>}
      {pasta.error && <p className="text-center text-destructive">Pasta não encontrada ou sem permissão.</p>}
      {pasta.data && <Ficha dados={pasta.data} />}
    </div>
  )
}
