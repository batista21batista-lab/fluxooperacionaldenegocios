import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatarData } from '@/lib/format'

export default function Empreendimentos() {
  const qc = useQueryClient()
  const [nome, setNome] = useState('')
  const [construtora, setConstrutora] = useState('')
  const [cidade, setCidade] = useState('')
  const [lancamento, setLancamento] = useState('')

  const { data } = useQuery({
    queryKey: ['empreendimentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empreendimentos').select('*').order('nome')
      if (error) throw error
      return data
    },
  })

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('empreendimentos').insert({
        nome: nome.trim(),
        construtora: construtora.trim() || null,
        cidade: cidade.trim() || null,
        data_lancamento: lancamento || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setNome('')
      setConstrutora('')
      setCidade('')
      setLancamento('')
      qc.invalidateQueries({ queryKey: ['empreendimentos'] })
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    criar.mutate()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Empreendimentos</h1>
      <form onSubmit={submit} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-5">
        <Input placeholder="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <Input placeholder="Construtora" value={construtora} onChange={(e) => setConstrutora(e.target.value)} />
        <Input placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        <Input type="date" value={lancamento} onChange={(e) => setLancamento(e.target.value)} />
        <Button type="submit" disabled={criar.isPending}>
          Adicionar
        </Button>
        {criar.error && <p className="text-sm text-destructive sm:col-span-5">Não foi possível salvar.</p>}
      </form>
      <ul className="divide-y rounded-lg border">
        {data?.length === 0 && <li className="p-4 text-muted-foreground">Nenhum empreendimento cadastrado.</li>}
        {data?.map((e) => (
          <li key={e.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
            <span className="font-medium">{e.nome}</span>
            <span className="text-muted-foreground">
              {[e.construtora, e.cidade, e.data_lancamento && `Lançamento ${formatarData(e.data_lancamento)}`]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
