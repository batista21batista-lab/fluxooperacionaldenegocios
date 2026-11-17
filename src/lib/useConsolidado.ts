import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { aplicarCep, buscarCep } from '@/lib/cep'
import { resolverCampos, type Leitura, type Resolucao, type Titular } from '@/lib/divergencias'

const TITULARES: Titular[] = ['comprador_1', 'comprador_2']

/** Cruza as leituras da pasta e completa/confere o endereço de cada comprador pelo CEP. */
export function useConsolidado(leituras: Leitura[]): Resolucao {
  const base = useMemo(() => resolverCampos(leituras), [leituras])
  const ceps = TITULARES.map((t) => String(base.campos[t].cep?.valor ?? '').replace(/\D/g, ''))

  const consultas = useQueries({
    queries: ceps.map((cep) => ({
      queryKey: ['cep', cep],
      queryFn: ({ signal }: { signal: AbortSignal }) => buscarCep(cep, signal),
      enabled: cep.length === 8,
      staleTime: Infinity, // endereço de CEP não muda
      retry: 1,
    })),
  })

  const cep1 = consultas[0].data ?? null
  const cep2 = consultas[1].data ?? null
  return useMemo(() => {
    let r = base
    if (cep1) r = aplicarCep(r, 'comprador_1', cep1)
    if (cep2) r = aplicarCep(r, 'comprador_2', cep2)
    return r
  }, [base, cep1, cep2])
}
