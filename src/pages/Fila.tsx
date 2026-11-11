import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ClassificacaoBadge, StatusBadge } from '@/components/Badges'
import { formatarData } from '@/lib/format'

function prazo(dias: number) {
  if (dias < 0) return <span className="font-medium text-destructive">{Math.abs(dias)}d em atraso</span>
  if (dias === 0) return <span className="font-medium text-amber-600">Hoje</span>
  return <span>{dias}d</span>
}

export default function Fila() {
  const { data: linhas, isLoading, error } = useQuery({
    queryKey: ['fila'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fila_prioridade').select('*').order('posicao')
      if (error) throw error
      return data
    },
  })

  const data = linhas?.filter((p) => p.pasta_id)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Fila de prioridade</h1>
        <p className="text-sm text-muted-foreground">
          Ordenada por documentação aprovada e, em empate, pela data de entrega.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {error && <p className="text-destructive">Erro ao carregar a fila.</p>}
      {data && data.length === 0 && <p className="text-muted-foreground">Nenhuma pasta na fila.</p>}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                {['#', 'Cliente', 'Empreendimento', 'Corretor', 'Documentação', 'Classe', 'Status', 'Entrega'].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.pasta_id} className="border-t">
                  <td className="px-3 py-2 font-semibold">{p.posicao}</td>
                  <td className="px-3 py-2">
                    <Link to={`/pastas/${p.pasta_id}`} className="font-medium hover:underline">
                      {p.cliente_nome}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{p.empreendimento_nome}</td>
                  <td className="px-3 py-2">{p.corretor_nome}</td>
                  <td className="px-3 py-2">
                    {p.pontuacao}/{p.pontuacao_maxima} ({Math.round(p.percentual ?? 0)}%)
                  </td>
                  <td className="px-3 py-2">
                    {p.classificacao && <ClassificacaoBadge valor={p.classificacao} />}
                  </td>
                  <td className="px-3 py-2">
                    {p.status && <StatusBadge valor={p.status} />}
                  </td>
                  <td className="px-3 py-2">
                    {p.data_entrega && formatarData(p.data_entrega)} · {prazo(p.dias_para_entrega ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
