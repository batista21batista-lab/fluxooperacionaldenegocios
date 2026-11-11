import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cpfValido, formatarCpf, soDigitos } from '@/lib/format'

export default function NovaPasta() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [empId, setEmpId] = useState('')
  const [unidade, setUnidade] = useState('')
  const [entrega, setEntrega] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const { data: emps } = useQuery({
    queryKey: ['empreendimentos', 'ativos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empreendimentos').select('id, nome').eq('ativo', true).order('nome')
      if (error) throw error
      return data
    },
  })

  const criar = useMutation({
    mutationFn: async () => {
      const cpfNum = soDigitos(cpf)
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
            error.code === '23505' ? 'Este CPF já está cadastrado por outro corretor.' : 'Erro ao cadastrar o cliente.',
          )
        }
        clienteId = data.id
      }
      const { data: pasta, error } = await supabase
        .from('pastas')
        .insert({
          cliente_id: clienteId,
          empreendimento_id: empId,
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

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Nova pasta</h1>

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
      <Button type="submit" disabled={criar.isPending}>
        {criar.isPending ? 'Criando…' : 'Criar pasta'}
      </Button>
    </form>
  )
}
