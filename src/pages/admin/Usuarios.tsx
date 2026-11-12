import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Select } from '@/components/ui/select'
import type { PerfilAcesso, Profile } from '@/types/database'

const perfis: { valor: PerfilAcesso; rotulo: string }[] = [
  { valor: 'corretor', rotulo: 'Corretor' },
  { valor: 'equipe_pastas', rotulo: 'Equipe Pastas' },
  { valor: 'supervisor', rotulo: 'Supervisor' },
  { valor: 'diretor', rotulo: 'Diretor' },
]

export default function Usuarios() {
  const { profile: eu } = useAuth()
  const qc = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)

  const usuarios = useQuery({
    queryKey: ['admin', 'usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('nome')
      if (error) throw error
      return data
    },
  })
  const equipes = useQuery({
    queryKey: ['equipes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipes').select('*').order('nome')
      if (error) throw error
      return data
    },
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<Pick<Profile, 'perfil' | 'equipe_id' | 'ativo'>> }) => {
      const { error } = await supabase.from('profiles').update(campos).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setErro(null)
      qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
    },
    onError: () => setErro('Não foi possível salvar a alteração.'),
  })

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Novos usuários são criados no Supabase (Authentication → Users) e entram como Corretor. Aqui você define perfil,
        equipe e acesso. Supervisores e corretores precisam de uma equipe para o supervisor enxergar as pastas.
      </p>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              {['Usuário', 'Perfil', 'Equipe', 'Ativo'].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.data?.map((u) => {
              const proprio = u.id === eu?.id
              const semEquipe = !u.equipe_id && (u.perfil === 'supervisor' || u.perfil === 'corretor')
              return (
                <tr key={u.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {u.nome} {proprio && <span className="text-xs text-muted-foreground">(você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={u.perfil}
                      disabled={proprio}
                      onChange={(e) => atualizar.mutate({ id: u.id, campos: { perfil: e.target.value as PerfilAcesso } })}
                    >
                      {perfis.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.rotulo}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={u.equipe_id ?? ''}
                      onChange={(e) => atualizar.mutate({ id: u.id, campos: { equipe_id: e.target.value || null } })}
                    >
                      <option value="">Sem equipe</option>
                      {equipes.data?.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.nome}
                          {!q.ativa && ' (inativa)'}
                        </option>
                      ))}
                    </Select>
                    {semEquipe && <p className="mt-1 text-xs text-amber-600">Sem equipe</p>}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={u.ativo}
                      disabled={proprio}
                      onChange={(e) => atualizar.mutate({ id: u.id, campos: { ativo: e.target.checked } })}
                      aria-label={`Ativo: ${u.nome}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
