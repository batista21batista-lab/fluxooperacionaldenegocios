import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { lerPlanilhaAutonomos, type LinhaImportacao } from '@/lib/autonomos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Resultado = { total: number; novos: number; atualizados: number; desativados: number }

export default function Autonomos() {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [linhas, setLinhas] = useState<LinhaImportacao[] | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [desativar, setDesativar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [busca, setBusca] = useState('')

  const total = useQuery({
    queryKey: ['admin', 'autonomos', 'total'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('autonomos')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true)
      if (error) throw error
      return count ?? 0
    },
  })

  const termo = busca.trim().toUpperCase()
  const lista = useQuery({
    queryKey: ['admin', 'autonomos', 'busca', termo],
    queryFn: async () => {
      let q = supabase
        .from('autonomos')
        .select('id, apelido, designacao, empresa, zona, ativo, superintendente_id, diretor_id')
        .order('apelido')
        .limit(50)
      if (termo) q = q.ilike('apelido', `%${termo.replace(/[%_,()]/g, '')}%`)
      const { data, error } = await q
      if (error) throw error
      const ids = [...new Set(data.flatMap((a) => [a.superintendente_id, a.diretor_id]).filter(Boolean))] as string[]
      const nomes = new Map<string, string>()
      if (ids.length) {
        const { data: sup } = await supabase.from('autonomos').select('id, apelido').in('id', ids)
        sup?.forEach((s) => nomes.set(s.id, s.apelido))
      }
      return data.map((a) => ({
        ...a,
        superNome: a.superintendente_id ? nomes.get(a.superintendente_id) : null,
        diretorNome: a.diretor_id ? nomes.get(a.diretor_id) : null,
      }))
    },
  })

  async function escolher(arquivo: File) {
    setErro(null)
    setResultado(null)
    try {
      setLinhas(await lerPlanilhaAutonomos(arquivo))
      setNomeArquivo(arquivo.name)
    } catch (e) {
      setLinhas(null)
      setErro(e instanceof Error ? e.message : 'Não foi possível ler a planilha.')
    }
  }

  const importar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('importar_autonomos', {
        p_linhas: linhas ?? [],
        p_desativar_ausentes: desativar,
      })
      if (error) throw error
      return data as Resultado
    },
    onSuccess: (r) => {
      setResultado(r)
      setLinhas(null)
      qc.invalidateQueries({ queryKey: ['admin', 'autonomos'] })
      qc.invalidateQueries({ queryKey: ['autonomos'] })
    },
    onError: () => setErro('A importação falhou. Nada foi alterado.'),
  })

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Importar planilha de autônomos</h2>
        <p className="text-sm text-muted-foreground">
          Arquivo .xlsx com as colunas Apelido, Designação Técnica, Empresa, Zona, Corretor Associado Super / D / G e
          Creci. Quem já existe é atualizado pelo apelido; nascimento, idade e sexo não são importados.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) escolher(f)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            Escolher planilha
          </Button>
          {linhas && (
            <>
              <span className="text-sm">
                {nomeArquivo}: <b>{linhas.length}</b> autônomos encontrados
              </span>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={desativar} onChange={(e) => setDesativar(e.target.checked)} />
                Desativar quem não está na planilha
              </label>
              <Button onClick={() => importar.mutate()} disabled={importar.isPending || linhas.length === 0}>
                {importar.isPending ? 'Importando…' : 'Importar'}
              </Button>
            </>
          )}
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {resultado && (
          <p className="text-sm text-emerald-700">
            Importação concluída: {resultado.novos} novos, {resultado.atualizados} atualizados
            {resultado.desativados > 0 && `, ${resultado.desativados} desativados`}.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Autônomos ativos: {total.data ?? '…'}</h2>
          <Input className="max-w-xs" placeholder="Buscar apelido" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                {['Apelido', 'Designação', 'Super', 'Diretor', 'Empresa', 'Zona'].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-muted-foreground">
                    Nenhum autônomo encontrado.
                  </td>
                </tr>
              )}
              {lista.data?.map((a) => (
                <tr key={a.id} className={a.ativo ? 'border-t' : 'border-t text-muted-foreground line-through'}>
                  <td className="px-3 py-2 font-medium">{a.apelido}</td>
                  <td className="px-3 py-2">{a.designacao}</td>
                  <td className="px-3 py-2">{a.superNome ?? '—'}</td>
                  <td className="px-3 py-2">{a.diretorNome ?? '—'}</td>
                  <td className="px-3 py-2">{a.empresa}</td>
                  <td className="px-3 py-2">{a.zona ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Mostrando até 50 resultados. Use a busca para encontrar um apelido.</p>
      </section>
    </div>
  )
}
