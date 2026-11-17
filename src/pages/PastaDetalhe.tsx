import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { ClassificacaoBadge, StatusBadge } from '@/components/Badges'
import { cn } from '@/lib/utils'
import { formatarCpf, formatarData, nomeArquivoSeguro, soDigitos } from '@/lib/format'
import { lerDocumento, ROTULOS_OCR } from '@/lib/ocr'
import type { StatusDocumento } from '@/types/database'
import type { DadosOcr } from '@/types/ocr'
import type { Titular } from '@/lib/divergencias'
import { carregarPasta, chaveExigencia as chave, exigencias, leiturasDaPasta } from '@/lib/pasta'
import DadosConsolidados, { ROTULO_TITULAR } from '@/components/DadosConsolidados'

const rotuloDoc: Record<StatusDocumento | 'ausente', { txt: string; cls: string }> = {
  ausente: { txt: 'Não enviado', cls: 'bg-slate-100 text-slate-600' },
  pendente: { txt: 'Pendente', cls: 'bg-slate-100 text-slate-600' },
  enviado: { txt: 'Em análise', cls: 'bg-sky-100 text-sky-700' },
  aprovado: { txt: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
  rejeitado: { txt: 'Rejeitado', cls: 'bg-red-100 text-red-700' },
}

export default function PastaDetalhe() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const qc = useQueryClient()
  const revisor = profile?.perfil === 'equipe_pastas' || profile?.perfil === 'admin'
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [alvo, setAlvo] = useState<{ tipoId: string; titular: Titular } | null>(null)
  const [lendo, setLendo] = useState<string | null>(null)

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ['pasta', id] })
    qc.invalidateQueries({ queryKey: ['fila'] })
  }
  const falha = (msg: string) => (e: unknown) => setErro(e instanceof Error && e.message ? `${msg} ${e.message}` : msg)

  const pasta = useQuery({
    queryKey: ['pasta', id],
    queryFn: () => carregarPasta(id),
  })

  const enviar = useMutation({
    mutationFn: async ({ tipoId, titular, arquivo }: { tipoId: string; titular: Titular; arquivo: File }) => {
      const path = `${id}/${tipoId}/${Date.now()}-${nomeArquivoSeguro(arquivo.name)}`
      const up = await supabase.storage.from('documentos').upload(path, arquivo)
      if (up.error) throw up.error
      const { data, error } = await supabase
        .from('documentos')
        .upsert(
          { pasta_id: id, tipo_documento_id: tipoId, titular, status: 'enviado', arquivo_path: path },
          { onConflict: 'pasta_id,tipo_documento_id,titular' },
        )
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: (docId) => {
      setErro(null)
      recarregar()
      ocr.mutate(docId) // leitura automática logo após o envio
    },
    onError: falha('Falha ao enviar o documento.'),
  })

  const ocr = useMutation({
    mutationFn: lerDocumento,
    onMutate: (docId) => setLendo(docId),
    onSettled: () => {
      setLendo(null)
      recarregar() // sucesso ou erro ficam gravados no documento
    },
  })

  const revisar = useMutation({
    mutationFn: async ({ docId, status, motivo }: { docId: string; status: 'aprovado' | 'rejeitado'; motivo?: string }) => {
      const { error } = await supabase
        .from('documentos')
        .update({ status, motivo_rejeicao: status === 'rejeitado' ? (motivo ?? null) : null })
        .eq('id', docId)
      if (error) throw error
    },
    onSuccess: () => {
      setErro(null)
      recarregar()
    },
    onError: falha('Falha ao atualizar o documento.'),
  })

  const segundo = useMutation({
    mutationFn: async (valor: boolean) => {
      const { error } = await supabase.from('pastas').update({ segundo_comprador: valor }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setErro(null)
      recarregar()
    },
    onError: falha('Não foi possível alterar o 2º comprador.'),
  })

  const cadastro = useMutation({
    mutationFn: async (voltar: boolean) => {
      const { error } = await supabase.rpc('mover_para_cadastro', { p_pasta: id, p_voltar: voltar })
      if (error) throw error
    },
    onSuccess: () => {
      setErro(null)
      recarregar()
    },
    onError: falha('Não foi possível alterar a etapa.'),
  })

  async function abrir(path: string) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 60)
    if (error || !data) return setErro('Não foi possível abrir o arquivo.')
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  function rejeitar(docId: string) {
    const motivo = window.prompt('Motivo da rejeição:')?.trim()
    if (motivo) revisar.mutate({ docId, status: 'rejeitado', motivo })
  }

  if (pasta.isLoading) return <p className="text-muted-foreground">Carregando…</p>
  if (pasta.error || !pasta.data) return <p className="text-destructive">Pasta não encontrada ou sem permissão.</p>

  const { pasta: p, tipos, docs, historico } = pasta.data
  const cli = p.clientes
  const porSlot = new Map(docs.map((d) => [chave(d.tipo_documento_id, d.titular), d]))
  const slots = exigencias(tipos, p.segundo_comprador)
  const leituras = leiturasDaPasta(docs, tipos, p.segundo_comprador)

  function alternarSegundo(valor: boolean) {
    const docsDoSegundo = docs.filter((d) => d.titular === 'comprador_2').length
    if (!valor && docsDoSegundo > 0 &&
      !window.confirm(`Há ${docsDoSegundo} documento(s) do 2º comprador. Eles ficam guardados, mas deixam de contar na pontuação. Continuar?`)) {
      return
    }
    segundo.mutate(valor)
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Fila
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{cli?.nome}</h1>
          <p className="text-sm text-muted-foreground">
            CPF {cli && formatarCpf(cli.cpf)} · {p.empreendimentos?.nome}
            {p.autonomos?.apelido && ` · ${p.autonomos.apelido}`}
            {p.unidade && ` · ${p.unidade}`} · Entrega {formatarData(p.data_entrega)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/pastas/${id}/imprimir`} className="text-sm text-muted-foreground hover:underline">
            Imprimir ficha
          </Link>
          <ClassificacaoBadge valor={p.classificacao} />
          <StatusBadge valor={p.status} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>
            Documentação: {p.pontuacao}/{p.pontuacao_maxima} pontos
          </span>
          <span className="font-medium">{Math.round(p.percentual)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${p.percentual}%` }} />
        </div>
      </div>

      {revisor && (
        <div className="flex gap-2">
          {p.status === 'completa' && (
            <Button onClick={() => cadastro.mutate(false)} disabled={cadastro.isPending}>
              Enviar para Cadastro
            </Button>
          )}
          {p.status === 'cadastro' && (
            <Button variant="outline" onClick={() => cadastro.mutate(true)} disabled={cadastro.isPending}>
              Devolver da etapa de Cadastro
            </Button>
          )}
        </div>
      )}

      <label className="flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={p.segundo_comprador}
          disabled={segundo.isPending}
          onChange={(e) => alternarSegundo(e.target.checked)}
        />
        Pasta com 2º comprador (cônjuge ou segundo proponente)
      </label>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <DadosConsolidados leituras={leituras} segundoComprador={p.segundo_comprador} cadastro={cli} />

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          if (arquivo && alvo) {
            if (arquivo.size > 10 * 1024 * 1024) setErro('Arquivo acima de 10 MB.')
            else enviar.mutate({ ...alvo, arquivo })
          }
          e.target.value = ''
        }}
      />

      <section className="overflow-hidden rounded-lg border">
        <h2 className="border-b bg-muted px-4 py-2 text-sm font-medium">Documentos</h2>
        <ul className="divide-y">
          {slots.map(({ t, titular }) => {
            const d = porSlot.get(chave(t.id, titular))
            const doisTitulares = p.segundo_comprador && t.exige_segundo_comprador
            const st = rotuloDoc[d?.status ?? 'ausente']
            const bloqueado = d?.status === 'aprovado' && !revisor
            const lido = d?.ocr_status === 'concluido' ? (d.ocr_dados as DadosOcr | null) : null
            const emLeitura = !!d && (lendo === d.id || (d.ocr_status === 'processando' && lendo === null && ocr.isPending))
            const cpfDiverge = titular === 'comprador_1' && !!lido?.cpf && !!cli && soDigitos(lido.cpf) !== cli.cpf
            return (
              <li key={chave(t.id, titular)} className="space-y-2 px-4 py-3 text-sm">
               <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {t.nome}
                    {doisTitulares && <span className="font-normal"> · {ROTULO_TITULAR[titular]}</span>}{' '}
                    <span className="text-xs font-normal text-muted-foreground">· {t.peso} pts</span>
                    {!t.obrigatorio && <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>}
                  </p>
                  {t.descricao && <p className="text-xs text-muted-foreground">{t.descricao}</p>}
                  {d?.status === 'rejeitado' && d.motivo_rejeicao && (
                    <p className="text-xs text-destructive">Motivo: {d.motivo_rejeicao}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', st.cls)}>{st.txt}</span>
                  {d?.arquivo_path && (
                    <Button variant="ghost" size="sm" onClick={() => abrir(d.arquivo_path!)}>
                      Ver
                    </Button>
                  )}
                  {!bloqueado && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={enviar.isPending}
                      onClick={() => {
                        setAlvo({ tipoId: t.id, titular })
                        inputRef.current?.click()
                      }}
                    >
                      {d?.arquivo_path ? 'Substituir' : 'Enviar'}
                    </Button>
                  )}
                  {revisor && d?.status === 'enviado' && (
                    <>
                      <Button size="sm" onClick={() => revisar.mutate({ docId: d.id, status: 'aprovado' })}>
                        Aprovar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => rejeitar(d.id)}>
                        Rejeitar
                      </Button>
                    </>
                  )}
                  {d?.arquivo_path && !emLeitura && (
                    <Button variant="ghost" size="sm" onClick={() => ocr.mutate(d.id)} disabled={ocr.isPending}>
                      {d.ocr_status ? 'Ler de novo' : 'Ler documento'}
                    </Button>
                  )}
                </div>
               </div>
                {emLeitura && <p className="text-xs text-muted-foreground">Lendo o documento…</p>}
                {!emLeitura && d?.ocr_status === 'erro' && (
                  <p className="text-xs text-amber-700">Leitura automática falhou: {d.ocr_erro}</p>
                )}
                {!emLeitura && lido && (
                  <div className="rounded-md bg-muted/60 p-3 text-xs">
                    <p className="mb-1 font-medium">
                      Leitura automática {lido.legivel ? '' : '· documento pouco legível'}
                      {lido.simulado && (
                        <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-amber-900">
                          SIMULAÇÃO · dados não vieram do documento
                        </span>
                      )}
                    </p>
                    {cpfDiverge && (
                      <p className="mb-1 font-medium text-destructive">
                        CPF lido ({formatarCpf(lido.cpf!)}) é diferente do CPF do cliente.
                      </p>
                    )}
                    <dl className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                      {ROTULOS_OCR.filter(([k]) => lido[k] != null && lido[k] !== '').map(([k, rotulo]) => (
                        <div key={k} className="flex gap-1">
                          <dt className="text-muted-foreground">{rotulo}:</dt>
                          <dd>{k === 'renda_mensal' ? Number(lido[k]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(lido[k])}</dd>
                        </div>
                      ))}
                    </dl>
                    {lido.observacoes && <p className="mt-1 text-amber-700">Obs.: {lido.observacoes}</p>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Histórico</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {historico.map((h) => (
            <li key={h.id}>
              {new Date(h.created_at).toLocaleString('pt-BR')} —{' '}
              {h.evento === 'criada' ? 'Pasta criada' : `${h.evento}: ${h.de ?? '—'} → ${h.para}`}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
