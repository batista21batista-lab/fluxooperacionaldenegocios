import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Equipes() {
  const qc = useQueryClient()
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['admin', 'equipes'],
    queryFn: async () => {
      const [eq, pr] = await Promise.all([
        supabase.from('equipes').select('*').order('nome'),
        supabase.from('profiles').select('equipe_id').eq('ativo', true),
      ])
      if (eq.error) throw eq.error
      const contagem = new Map<string, number>()
      pr.data?.forEach((p) => p.equipe_id && contagem.set(p.equipe_id, (contagem.get(p.equipe_id) ?? 0) + 1))
      return eq.data.map((e) => ({ ...e, membros: contagem.get(e.id) ?? 0 }))
    },
  })

  const refresh = () => {
    setErro(null)
    qc.invalidateQueries({ queryKey: ['admin', 'equipes'] })
    qc.invalidateQueries({ queryKey: ['equipes'] })
  }
  const falha = (e: { code?: string }) =>
    setErro(e.code === '23505' ? 'Já existe uma equipe com esse nome.' : 'Não foi possível salvar.')

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('equipes').insert({ nome: nome.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setNome('')
      refresh()
    },
    onError: falha,
  })
  const atualizar = useMutation({
    mutationFn: async ({ id, campos }: { id: string; campos: { nome?: string; ativa?: boolean } }) => {
      const { error } = await supabase.from('equipes').update(campos).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: falha,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (nome.trim()) criar.mutate()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <Input placeholder="Nome da nova equipe" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Button type="submit" disabled={criar.isPending}>
          Adicionar
        </Button>
      </form>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <ul className="divide-y rounded-lg border">
        {data?.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nenhuma equipe cadastrada.</li>}
        {data?.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <Input
              className="max-w-xs"
              defaultValue={e.nome}
              onBlur={(ev) => {
                const v = ev.target.value.trim()
                if (v && v !== e.nome) atualizar.mutate({ id: e.id, campos: { nome: v } })
                else ev.target.value = e.nome
              }}
            />
            <span className="text-muted-foreground">{e.membros} membro(s) ativo(s)</span>
            <label className="ml-auto flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={e.ativa}
                onChange={(ev) => atualizar.mutate({ id: e.id, campos: { ativa: ev.target.checked } })}
              />
              Ativa
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
