import { cn } from '@/lib/utils'
import type { ClassificacaoPasta, StatusPasta } from '@/types/database'

const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold'

const classe: Record<ClassificacaoPasta, string> = {
  ouro: 'bg-ouro/15 text-ouro',
  prata: 'bg-prata/20 text-slate-600',
  bronze: 'bg-bronze/15 text-bronze',
}
const status: Record<StatusPasta, { label: string; cls: string }> = {
  completa: { label: 'Completa', cls: 'bg-emerald-100 text-emerald-700' },
  incompleta: { label: 'Incompleta', cls: 'bg-amber-100 text-amber-700' },
  cadastro: { label: 'Cadastro', cls: 'bg-sky-100 text-sky-700' },
}

export const ClassificacaoBadge = ({ valor }: { valor: ClassificacaoPasta }) => (
  <span className={cn(base, classe[valor])}>{valor.charAt(0).toUpperCase() + valor.slice(1)}</span>
)
export const StatusBadge = ({ valor }: { valor: StatusPasta }) => (
  <span className={cn(base, status[valor].cls)}>{status[valor].label}</span>
)
