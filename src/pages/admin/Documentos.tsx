import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TipoDocumento } from '@/types/database'

type Rascunho = Pick<TipoDocumento, 'nome' | 'descricao' | 'peso' | 'ordem' | 'obrigatorio' | 'ativo'>

// Após qualquer mudança de pesos/cortes, todas as pastas são recalculadas no banco.
async function recalcular() {
  const { error } = await supabase.rpc('recalcular_todas_pastas')
  if (error) throw error
}

function Cortes({ aoSalvar }: { aoSalvar: () => void }) {
  const { data } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('chave, valor')
      if (error) throw error
      return Object.fromEntries(data.map((c) => [c.chave, c.valor])) as Record<string, number>
    },
  })
  if (!data) return null
  return <CortesForm key={`${data.ouro_min}-${data.prata_min}`} ouro={data.ouro_min} prata={data.prata_min} aoSalvar={aoSalvar} />
}

function CortesForm({ ouro, prata, aoSalvar }: { ouro: number; prata: number; aoSalvar: () => void }) {
  const [o, setO] = useState(String(ouro))
  const [p, setP] = useState(String(prata))
  const [erro, setErro] = useState<string | null>(null)

  const salvar = useMutation({
    mutationFn: async () => {
      const on = Number(o)
      const pn = Number(p)
      if (!(pn > 0 && pn < on && on <= 100)) throw new Error('Use 0 < Prata < Ouro ≤ 100.')
      const { error } = await supabase
        .from('configuracoes')
        .upsert([
          { chave: 'ouro_min', valor: on },
          { chave: 'prata_min', valor: pn },
        ])
      if (error) throw error
      await recalcular()
    },
    onSuccess: () => {
      setErro(null)
      aoSalvar()
    },
    onError: (e: Error) => setErro(e.message.startsWith('Use') ? e.message : 'Não foi possível salvar.'),
  })

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Classificação da pasta</h2>
      <p className="text-sm text-muted-foreground">
        Percentual mínimo da pontuação máxima para cada classe. Abaixo do corte de Prata, a pasta é Bronze.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Ouro a partir de (%)</Label>
          <Input type="number" min={1} max={100} className="w-32" value={o} onChange={(e) => setO(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Prata a partir de (%)</Label>
          <Input type="number" min={1} max={99} className="w-32" value={p} onChange={(e) => setP(e.target.value)} />
        </div>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar e recalcular pastas'}
        </Button>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </section>
  )
}

function LinhaTipo({
  tipo,
  aoSalvar,
}: {
  tipo: TipoDocumento
  aoSalvar: (id: string, campos: Rascunho) => Promise<void>
}) {
  const [d, setD] = useState<Rascunho>({
    nome: tipo.nome,
    descricao: tipo.descricao,
    peso: tipo.peso,
    ordem: tipo.ordem,
    obrigatorio: tipo.obrigatorio,
    ativo: tipo.ativo,
  })
  const [salvando, setSalvando] = useState(false)
  const alterado = (Object.keys(d) as (keyof Rascunho)[]).some((k) => d[k] !== tipo[k])
  const valido = d.nome.trim() !== '' && d.peso > 0

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2">
        <Input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
        <Input
          className="mt-1 h-8 text-xs"
          placeholder="Descrição"
          value={d.descricao ?? ''}
          onChange={(e) => setD({ ...d, descricao: e.target.value || null })}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min={1}
          className="w-20"
          value={d.peso}
          onChange={(e) => setD({ ...d, peso: Number(e.target.value) })}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          className="w-20"
          value={d.ordem}
          onChange={(e) => setD({ ...d, ordem: Number(e.target.value) })}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={d.obrigatorio}
          onChange={(e) => setD({ ...d, obrigatorio: e.target.checked })}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={d.ativo}
          onChange={(e) => setD({ ...d, ativo: e.target.checked })}
        />
      </td>
      <td className="px-3 py-2">
        <Button
          size="sm"
          disabled={!alterado || !valido || salvando}
          onClick={async () => {
            setSalvando(true)
            try {
              await aoSalvar(tipo.id, { ...d, nome: d.nome.trim() })
            } finally {
              setSalvando(false)
            }
          }}
        >
          Salvar
        </Button>
      </td>
    </tr>
  )
}

export default function Documentos() {
  const qc = useQueryClient()
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState({ nome: '', peso: '10', obrigatorio: true })

  const tipos = useQuery({
    queryKey: ['admin', 'tipos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_documento').select('*').order('ordem').order('nome')
      if (error) throw error
      return data
    },
  })

  const refresh = () => {
    setErro(null)
    qc.invalidateQueries({ queryKey: ['admin', 'tipos'] })
    qc.invalidateQueries({ queryKey: ['configuracoes'] })
    qc.invalidateQueries({ queryKey: ['fila'] })
    qc.invalidateQueries({ queryKey: ['pasta'] })
  }

  async function salvarTipo(id: string, campos: Rascunho) {
    try {
      const { error } = await supabase.from('tipos_documento').update(campos).eq('id', id)
      if (error) throw error
      await recalcular()
      refresh()
    } catch (e) {
      setErro((e as { code?: string }).code === '23505' ? 'Já existe um documento com esse nome.' : 'Não foi possível salvar.')
    }
  }

  const criar = useMutation({
    mutationFn: async () => {
      const peso = Number(novo.peso)
      if (!novo.nome.trim() || !(peso > 0)) throw new Error('invalid')
      const ordem = Math.max(0, ...(tipos.data?.map((t) => t.ordem) ?? [])) + 1
      const { error } = await supabase
        .from('tipos_documento')
        .insert({ nome: novo.nome.trim(), peso, obrigatorio: novo.obrigatorio, ordem })
      if (error) throw error
      await recalcular()
    },
    onSuccess: () => {
      setNovo({ nome: '', peso: '10', obrigatorio: true })
      refresh()
    },
    onError: (e: { code?: string }) =>
      setErro(e.code === '23505' ? 'Já existe um documento com esse nome.' : 'Informe nome e peso válidos.'),
  })

  return (
    <div className="space-y-6">
      <Cortes aoSalvar={refresh} />

      <section className="space-y-3">
        <div>
          <h2 className="font-medium">Catálogo de documentos</h2>
          <p className="text-sm text-muted-foreground">
            O peso é a pontuação do documento. A pasta fica <b>Completa</b> quando todos os obrigatórios ativos estão
            aprovados. Documentos não são excluídos: desative para tirá-los do cálculo (os já enviados são mantidos).
            Cada alteração recalcula todas as pastas.
          </p>
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Documento</th>
                <th className="px-3 py-2 font-medium">Peso</th>
                <th className="px-3 py-2 font-medium">Ordem</th>
                <th className="px-3 py-2 text-center font-medium">Obrigatório</th>
                <th className="px-3 py-2 text-center font-medium">Ativo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {tipos.data?.map((t) => (
                <LinhaTipo
                  key={`${t.id}-${t.nome}-${t.descricao}-${t.peso}-${t.ordem}-${t.obrigatorio}-${t.ativo}`}
                  tipo={t}
                  aoSalvar={salvarTipo}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <div className="space-y-1">
            <Label>Novo documento</Label>
            <Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome" />
          </div>
          <div className="space-y-1">
            <Label>Peso</Label>
            <Input
              type="number"
              min={1}
              className="w-24"
              value={novo.peso}
              onChange={(e) => setNovo({ ...novo, peso: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={novo.obrigatorio}
              onChange={(e) => setNovo({ ...novo, obrigatorio: e.target.checked })}
            />
            Obrigatório
          </label>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
            Adicionar
          </Button>
        </div>
      </section>
    </div>
  )
}
