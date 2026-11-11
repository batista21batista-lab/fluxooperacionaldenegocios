import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PerfilAcesso } from '@/types/database'

const rotulo: Record<PerfilAcesso, string> = {
  corretor: 'Corretor',
  equipe_pastas: 'Equipe Pastas',
  supervisor: 'Supervisor',
  diretor: 'Diretor',
}

export default function Layout() {
  const { profile, signOut } = useAuth()
  const revisor = profile?.perfil === 'equipe_pastas' || profile?.perfil === 'diretor'
  const links = [
    { to: '/', label: 'Fila de prioridade' },
    { to: '/pastas/nova', label: 'Nova pasta' },
    ...(revisor ? [{ to: '/empreendimentos', label: 'Empreendimentos' }] : []),
  ]
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <nav className="flex items-center gap-6 text-sm">
            <span className="font-semibold">Pastas Digitais</span>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) => cn('text-muted-foreground', isActive && 'font-medium text-foreground')}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span>
              {profile?.nome} · <span className="text-muted-foreground">{profile && rotulo[profile.perfil]}</span>
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  )
}
