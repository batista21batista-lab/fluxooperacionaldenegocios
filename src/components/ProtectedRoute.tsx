import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { PerfilAcesso } from '@/types/database'

export default function ProtectedRoute({ perfis }: { perfis?: PerfilAcesso[] }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <p className="p-8 text-muted-foreground">Carregando…</p>
  if (!session) return <Navigate to="/login" replace />
  if (!profile || !profile.ativo)
    return <p className="p-8 text-destructive">Usuário inativo ou sem perfil. Fale com o Diretor.</p>
  if (perfis && !perfis.includes(profile.perfil)) return <Navigate to="/" replace />
  return <Outlet />
}
