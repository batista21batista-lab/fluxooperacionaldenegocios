import { useState } from 'react'
import { cn } from '@/lib/utils'
import Usuarios from '@/pages/admin/Usuarios'
import Equipes from '@/pages/admin/Equipes'
import Documentos from '@/pages/admin/Documentos'

const abas = [
  { id: 'usuarios', rotulo: 'Usuários', Componente: Usuarios },
  { id: 'equipes', rotulo: 'Equipes', Componente: Equipes },
  { id: 'documentos', rotulo: 'Documentos e classificação', Componente: Documentos },
] as const

export default function Admin() {
  const [ativa, setAtiva] = useState<(typeof abas)[number]['id']>('usuarios')
  const Atual = abas.find((a) => a.id === ativa)!.Componente
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Administração</h1>
      <div className="flex gap-1 border-b">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAtiva(a.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              ativa === a.id ? 'border-primary font-medium' : 'border-transparent text-muted-foreground',
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <Atual />
    </div>
  )
}
