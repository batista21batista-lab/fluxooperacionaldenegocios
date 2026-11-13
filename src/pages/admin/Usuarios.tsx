import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { listarAutonomos } from '@/lib/autonomos'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { PerfilAcesso, Profile } from '@/types/database'

// supervisor/diretor são tratados como Autônomo: o alcance vem da hierarquia da planilha.
const perfis: { valor: PerfilAcesso; rotulo: string }[] = [
  { valor: 'corretor', rotulo: 'Autônomo' },
  { valor: 'equipe_pastas', rotulo: 'Equipe Pastas' },
  { valor: 'admin', rotulo: 'Administrador' },
]
const ehAutonomo = (p: PerfilAcesso) => p === 'corretor' || p === 'supervisor' || p === 'diretor'

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
  const autonomos = useQuery({ queryKey: ['autonomos', 'todos'], queryFn: listarAutonomos, staleTime: 5 * 60_000 })
  const porApelido = new Map(autonomos.data?.map((a) => [a.apelido, a.id]))
  const porId = new Map(autonomos.data?.map((a) => [a.id, a.apelido]))

  const atualizar = useMutation({
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<Pick<Profile, 'perfil' | 'autonomo_id' | 'ativo'>> }) => {
      const { error } = await supabase.from('profiles').update(campos).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setErro(null)
      qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] })
    },
    onError: (e: { code?: string }) =>
      setErro(e.code === '23505' ? 'Esse autônomo já está vinculado a outro usuário.' : 'Não foi possível salvar a alteração.'),
  })

  function vincular(u: Profile, apelido: string, campo: HTMLInputElement) {
    const v = apelido.trim().toUpperCase()
    const atual = u.autonomo_id ? (porId.get(u.autonomo_id) ?? '') : ''
    if (v === atual) return
    if (v === '') return atualizar.mutate({ id: u.id, campos: { autonomo_id: null } })
    const id = porApelido.get(v)
    if (!id) {
      setErro(`Apelido "${v}" não está na lista de autônomos.`)
      campo.value = atual
      return
    }
    atualizar.mutate({ id: u.id, campos: { autonomo_id: id } })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Novos usuários são criados no Supabase (Authentication → Users) e entram como Autônomo. Vincule cada um ao seu
        apelido: é o vínculo que define o que ele enxerga (as próprias pastas e as de quem está abaixo dele). Equipe
        Pastas e Administrador veem tudo.
      </p>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <datalist id="lista-autonomos">
        {autonomos.data?.map((a) => (
          <option key={a.id} value={a.apelido}>
            {a.designacao}
          </option>
        ))}
      </datalist>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              {['Usuário', 'Perfil', 'Apelido (autônomo)', 'Ativo'].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.data?.map((u) => {
              const proprio = u.id === eu?.id
              const perfilUi = ehAutonomo(u.perfil) ? 'corretor' : u.perfil
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
                      value={perfilUi}
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
                    <Input
                      key={`${u.id}-${u.autonomo_id}-${autonomos.data?.length ?? 0}`}
                      list="lista-autonomos"
                      placeholder="Digite o apelido"
                      defaultValue={u.autonomo_id ? (porId.get(u.autonomo_id) ?? '') : ''}
                      onBlur={(e) => vincular(u, e.target.value, e.target)}
                    />
                    {ehAutonomo(u.perfil) && !u.autonomo_id && (
                      <p className="mt-1 text-xs text-amber-600">Sem vínculo: não consegue abrir pastas</p>
                    )}
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
