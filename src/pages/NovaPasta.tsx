import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { listarAutonomos, listarMinhaEstrutura } from '@/lib/autonomos'
import { lerArquivo, lerDocumento } from '@/lib/ocr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cpfValido, formatarCpf, nomeArquivoSeguro, soDigitos } from '@/lib/format'

const TIPOS_ACEITOS = 'application/pdf,image/jpeg,image/png,image/webp'

export default function NovaPasta() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const revisor = profile?.perfil === 'equipe_pastas' || profile?.perfil === 'admin'
  const meuAutonomo = profile?.autonomo_id ?? null

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [empId, setEmpId] = useState('')
  const [unidade, setUnidade] = useState('')
  const [entrega, setEntrega] = useState('')
  const [autonomoId, setAutonomoId] = useState(meuAutonomo ?? '')
  const [apelidoDigitado, setApelidoDigitado] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  // Documento de identificação lido por OCR; depois de criar a pasta ele é anexado a ela.
  const inputRef = useRef<HTMLInputElement>(null)
  const [docId, setDocId] = useState<File | null>(null)
  const [avisoOcr, setAvisoOcr] = useState<string | null>(null)

  const { data: emps } = useQuery({
    queryKey: ['empreendimentos', 'ativos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empreendimentos').select('id, nome').eq('ativo', true).order('nome')
      if (error) throw error
      return data
    },
  })
  const autonomos = useQuery({
    queryKey: ['autonomos', revisor ? 'todos' : `estrutura-${meuAutonomo}`],
    queryFn: () => (revisor ? listarAutonomos() : listarMinhaEstrutura(meuAutonomo!)),
    enabled: revisor || !!meuAutonomo,
    staleTime: 5 * 60_000,
  })

  const ocr = useMutation({
    mutationFn: lerArquivo,
    onSuccess: (d) => {
      if (d.nome) setNome(d.nome)
      if (d.cpf && cpfValido(d.cpf)) setCpf(formatarCpf(d.cpf))
      const faltou = [!d.nome && 'nome', !(d.cpf && cpfValido(d.cpf)) && 'CPF'].filter(Boolean).join(' e ')
      setAvisoOcr(
        !d.legivel
          ? `Documento difícil de ler${d.observacoes ? `: ${d.observacoes}` : ''}. Confira os campos.`
          : faltou
            ? `Não foi possível ler ${faltou}. Preencha manualmente.`
            : 'Dados lidos do documento. Confira antes de criar a pasta.',
      )
    },
    onError: (e: Error) => setAvisoOcr(`${e.message} Preencha manualmente; o arquivo será anexado mesmo assim.`),
  })

  function escolherDocumento(arquivo: File) {
    if (arquivo.size > 10 * 1024 * 1024) return setAvisoOcr('Arquivo acima de 10 MB.')
    setDocId(arquivo)
    setAvisoOcr(null)
    ocr.mutate(arquivo)
  }

  const criar = useMutation({
    mutationFn: async () => {
      const cpfNum = soDigitos(cpf)
      const autonomo = revisor
        ? autonomos.data?.find((a) => a.apelido === apelidoDigitado.trim().toUpperCase())?.id
        : autonomoId
      if (!autonomo) throw new Error(revisor ? 'Escolha um apelido da lista de autônomos.' : 'Selecione o autônomo.')

      // reaproveita o cliente se este CPF já é visível para o usuário
      const { data: existente } = await supabase.from('clientes').select('id').eq('cpf', cpfNum).maybeSingle()
      let clienteId = existente?.id
      if (!clienteId) {
        const { data, error } = await supabase
          .from('clientes')
          .insert({ nome: nome.trim(), cpf: cpfNum, telefone: telefone || null, email: email || null })
          .select('id')
          .single()
        if (error) {
          throw new Error(
            error.code === '23505' ? 'Este CPF já está cadastrado por outro autônomo.' : 'Erro ao cadastrar o cliente.',
          )
        }
        clienteId = data.id
      }
      const { data: pasta, error } = await supabase
        .from('pastas')
        .insert({
          cliente_id: clienteId,
          empreendimento_id: empId,
          autonomo_id: autonomo,
          unidade: unidade.trim() || null,
          data_entrega: entrega,
        })
        .select('id')
        .single()
      if (error) {
        throw new Error(
          error.code === '23505' ? 'Este cliente já tem pasta neste empreendimento.' : 'Erro ao criar a pasta.',
        )
      }

      // Anexa o documento lido como "RG ou CNH". Se algo falhar aqui, a pasta já existe:
      // o usuário reenvia pelo detalhe.
      if (docId) {
        const { data: tipo } = await supabase.from('tipos_documento').select('id').ilike('nome', 'RG%').limit(1).maybeSingle()
        if (tipo) {
          const path = `${pasta.id}/${tipo.id}/${Date.now()}-${nomeArquivoSeguro(docId.name)}`
          const up = await supabase.storage.from('documentos').upload(path, docId)
          if (!up.error) {
            const { data: doc } = await supabase
              .from('documentos')
              .insert({ pasta_id: pasta.id, tipo_documento_id: tipo.id, status: 'enviado', arquivo_path: path })
              .select('id')
              .single()
            if (doc) void lerDocumento(doc.id).catch(() => undefined)
          }
        }
      }
      return pasta.id
    },
    onSuccess: (id) => navigate(`/pastas/${id}`),
    onError: (e: Error) => setErro(e.message),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!cpfValido(cpf)) return setErro('CPF inválido.')
    criar.mutate()
  }

  if (!revisor && !meuAutonomo) {
    return (
      <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
        Seu usuário ainda não está vinculado a um apelido de autônomo. Peça ao Administrador para fazer o vínculo antes
        de abrir pastas.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Nova pasta</h1>

      <section className="space-y-2 rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">Comece pelo documento do cliente (RG ou CNH)</p>
        <p className="text-sm text-muted-foreground">
          Envie uma foto ou PDF: o sistema lê nome e CPF e já anexa o documento à pasta. Você confere antes de criar.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={TIPOS_ACEITOS}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) escolherDocumento(f)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={ocr.isPending}>
            {ocr.isPending ? 'Lendo documento…' : docId ? 'Trocar documento' : 'Enviar documento'}
          </Button>
          {docId && <span className="text-sm text-muted-foreground">{docId.name}</span>}
        </div>
        {avisoOcr && <p className="text-sm">{avisoOcr}</p>}
      </section>

      <fieldset className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium text-muted-foreground">Cliente</legend>
        <div className="space-y-1 sm:col-span-2">
          <Label>Nome completo *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>CPF *</Label>
          <Input value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} inputMode="numeric" required />
        </div>
        <div className="space-y-1">
          <Label>Telefone</Label>
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium text-muted-foreground">Negócio</legend>
        <div className="space-y-1 sm:col-span-2">
          <Label>Autônomo (apelido) *</Label>
          {revisor ? (
            <>
              <Input
                list="autonomos-nova-pasta"
                placeholder="Digite o apelido"
                value={apelidoDigitado}
                onChange={(e) => setApelidoDigitado(e.target.value)}
                required
              />
              <datalist id="autonomos-nova-pasta">
                {autonomos.data?.map((a) => (
                  <option key={a.id} value={a.apelido}>
                    {a.designacao}
                  </option>
                ))}
              </datalist>
            </>
          ) : (
            <Select value={autonomoId} onChange={(e) => setAutonomoId(e.target.value)} required>
              {autonomos.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.apelido}
                  {a.id === meuAutonomo ? ' (você)' : ''}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Empreendimento *</Label>
          <Select value={empId} onChange={(e) => setEmpId(e.target.value)} required>
            <option value="">Selecione…</option>
            {emps?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
          {emps?.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum empreendimento ativo. Peça à Equipe Pastas para cadastrar.</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Unidade</Label>
          <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex.: Torre A, 1204" />
        </div>
        <div className="space-y-1">
          <Label>Data de entrega da pasta *</Label>
          <Input type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} required />
        </div>
      </fieldset>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" disabled={criar.isPending || ocr.isPending}>
        {criar.isPending ? 'Criando…' : 'Criar pasta'}
      </Button>
    </form>
  )
}
