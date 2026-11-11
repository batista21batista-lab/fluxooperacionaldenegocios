import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Fila from '@/pages/Fila'
import NovaPasta from '@/pages/NovaPasta'
import PastaDetalhe from '@/pages/PastaDetalhe'
import Empreendimentos from '@/pages/Empreendimentos'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Fila />} />
                <Route path="/pastas/nova" element={<NovaPasta />} />
                <Route path="/pastas/:id" element={<PastaDetalhe />} />
                <Route element={<ProtectedRoute perfis={['equipe_pastas', 'diretor']} />}>
                  <Route path="/empreendimentos" element={<Empreendimentos />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
