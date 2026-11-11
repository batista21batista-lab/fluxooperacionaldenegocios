// Tipos do banco escritos à mão a partir de supabase/migrations.
// Quando o projeto Supabase estiver linkado, substitua por: npm run db:types

export type PerfilAcesso = 'corretor' | 'equipe_pastas' | 'supervisor' | 'diretor'
export type StatusPasta = 'completa' | 'incompleta' | 'cadastro'
export type ClassificacaoPasta = 'ouro' | 'prata' | 'bronze'
export type StatusDocumento = 'pendente' | 'enviado' | 'aprovado' | 'rejeitado'

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Equipe = { id: string; nome: string; ativa: boolean; created_at: string }
export type Profile = {
  id: string; nome: string; email: string; telefone: string | null; creci: string | null
  perfil: PerfilAcesso; equipe_id: string | null; ativo: boolean; created_at: string; updated_at: string
}
export type Empreendimento = {
  id: string; nome: string; construtora: string | null; cidade: string | null
  data_lancamento: string | null; ativo: boolean; created_at: string; updated_at: string
}
export type Cliente = {
  id: string; corretor_id: string; nome: string; cpf: string; email: string | null
  telefone: string | null; estado_civil: string | null; renda_mensal: number | null
  created_at: string; updated_at: string
}
export type TipoDocumento = {
  id: string; nome: string; descricao: string | null; peso: number
  obrigatorio: boolean; ordem: number; ativo: boolean; created_at: string
}
export type Configuracao = { chave: string; valor: number; descricao: string | null; updated_at: string }
export type Pasta = {
  id: string; cliente_id: string; empreendimento_id: string; corretor_id: string
  unidade: string | null; data_entrega: string; observacoes: string | null
  status: StatusPasta; classificacao: ClassificacaoPasta
  pontuacao: number; pontuacao_maxima: number; percentual: number
  created_at: string; updated_at: string
}
export type Documento = {
  id: string; pasta_id: string; tipo_documento_id: string; status: StatusDocumento
  arquivo_path: string | null; motivo_rejeicao: string | null
  enviado_por: string | null; revisado_por: string | null; revisado_em: string | null
  created_at: string; updated_at: string
}
export type PastaHistorico = {
  id: string; pasta_id: string; usuario_id: string | null; evento: string
  de: string | null; para: string | null; created_at: string
}
export type FilaPrioridade = {
  posicao: number; pasta_id: string; cliente_id: string; cliente_nome: string
  empreendimento_id: string; empreendimento_nome: string; corretor_id: string; corretor_nome: string
  status: StatusPasta; classificacao: ClassificacaoPasta
  pontuacao: number; pontuacao_maxima: number; percentual: number
  data_entrega: string; dias_para_entrega: number
}

export type Database = {
  public: {
    Tables: {
      equipes: Table<Equipe, Pick<Equipe, 'nome'> & Partial<Equipe>>
      profiles: Table<Profile, Pick<Profile, 'id' | 'nome' | 'email'> & Partial<Profile>>
      empreendimentos: Table<Empreendimento, Pick<Empreendimento, 'nome'> & Partial<Empreendimento>>
      clientes: Table<Cliente, Pick<Cliente, 'nome' | 'cpf'> & Partial<Cliente>>
      tipos_documento: Table<TipoDocumento, Pick<TipoDocumento, 'nome' | 'peso'> & Partial<TipoDocumento>>
      configuracoes: Table<Configuracao, Pick<Configuracao, 'chave' | 'valor'> & Partial<Configuracao>>
      pastas: Table<
        Pasta,
        Pick<Pasta, 'cliente_id' | 'empreendimento_id' | 'data_entrega'> &
          Partial<Pick<Pasta, 'corretor_id' | 'unidade' | 'observacoes'>>,
        Partial<Pick<Pasta, 'corretor_id' | 'unidade' | 'data_entrega' | 'observacoes'>>
      >
      documentos: Table<
        Documento,
        Pick<Documento, 'pasta_id' | 'tipo_documento_id'> &
          Partial<Pick<Documento, 'status' | 'arquivo_path' | 'motivo_rejeicao'>>
      >
      pasta_historico: Table<PastaHistorico, never, never>
    }
    Views: {
      fila_prioridade: { Row: FilaPrioridade; Relationships: [] }
    }
    Functions: {
      mover_para_cadastro: { Args: { p_pasta: string; p_voltar?: boolean }; Returns: undefined }
      recalcular_todas_pastas: { Args: Record<string, never>; Returns: undefined }
    }
    Enums: {
      perfil_acesso: PerfilAcesso
      status_pasta: StatusPasta
      classificacao_pasta: ClassificacaoPasta
      status_documento: StatusDocumento
    }
    CompositeTypes: Record<string, never>
  }
}
