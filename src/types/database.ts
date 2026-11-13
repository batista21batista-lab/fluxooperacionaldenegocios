// Gerado pelo Supabase (generate_typescript_types) para o projeto Pastas-Digitais.
// Para atualizar: npm run db:types  (ou peça ao Claude para regenerar).
// Aliases de conveniência no final do arquivo.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      autonomos: {
        Row: {
          apelido: string
          ativo: boolean
          created_at: string
          creci_status: string | null
          creci_tipo: string | null
          designacao: string | null
          diretor_geral_id: string | null
          diretor_id: string | null
          empresa: string | null
          id: string
          superintendente_id: string | null
          updated_at: string
          zona: string | null
        }
        Insert: {
          apelido: string
          ativo?: boolean
          creci_status?: string | null
          creci_tipo?: string | null
          designacao?: string | null
          diretor_geral_id?: string | null
          diretor_id?: string | null
          empresa?: string | null
          id?: string
          superintendente_id?: string | null
          zona?: string | null
        }
        Update: {
          apelido?: string
          ativo?: boolean
          creci_status?: string | null
          creci_tipo?: string | null
          designacao?: string | null
          diretor_geral_id?: string | null
          diretor_id?: string | null
          empresa?: string | null
          superintendente_id?: string | null
          zona?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          corretor_id: string
          cpf: string
          created_at: string
          email: string | null
          estado_civil: string | null
          id: string
          nome: string
          renda_mensal: number | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          corretor_id?: string
          cpf: string
          created_at?: string
          email?: string | null
          estado_civil?: string | null
          id?: string
          nome: string
          renda_mensal?: number | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          corretor_id?: string
          cpf?: string
          created_at?: string
          email?: string | null
          estado_civil?: string | null
          id?: string
          nome?: string
          renda_mensal?: number | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clientes_corretor_id_fkey'
            columns: ['corretor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      configuracoes: {
        Row: { chave: string; descricao: string | null; updated_at: string; valor: number }
        Insert: { chave: string; descricao?: string | null; updated_at?: string; valor: number }
        Update: { chave?: string; descricao?: string | null; updated_at?: string; valor?: number }
        Relationships: []
      }
      documentos: {
        Row: {
          arquivo_path: string | null
          created_at: string
          enviado_por: string | null
          id: string
          motivo_rejeicao: string | null
          ocr_dados: Json | null
          ocr_em: string | null
          ocr_erro: string | null
          ocr_status: string | null
          pasta_id: string
          revisado_em: string | null
          revisado_por: string | null
          status: Database['public']['Enums']['status_documento']
          tipo_documento_id: string
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          created_at?: string
          enviado_por?: string | null
          id?: string
          motivo_rejeicao?: string | null
          pasta_id: string
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database['public']['Enums']['status_documento']
          tipo_documento_id: string
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          created_at?: string
          enviado_por?: string | null
          id?: string
          motivo_rejeicao?: string | null
          pasta_id?: string
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database['public']['Enums']['status_documento']
          tipo_documento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documentos_enviado_por_fkey'
            columns: ['enviado_por']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documentos_pasta_id_fkey'
            columns: ['pasta_id']
            isOneToOne: false
            referencedRelation: 'fila_prioridade'
            referencedColumns: ['pasta_id']
          },
          {
            foreignKeyName: 'documentos_pasta_id_fkey'
            columns: ['pasta_id']
            isOneToOne: false
            referencedRelation: 'pastas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documentos_revisado_por_fkey'
            columns: ['revisado_por']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documentos_tipo_documento_id_fkey'
            columns: ['tipo_documento_id']
            isOneToOne: false
            referencedRelation: 'tipos_documento'
            referencedColumns: ['id']
          },
        ]
      }
      empreendimentos: {
        Row: {
          ativo: boolean
          cidade: string | null
          construtora: string | null
          created_at: string
          data_lancamento: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          construtora?: string | null
          created_at?: string
          data_lancamento?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          construtora?: string | null
          created_at?: string
          data_lancamento?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipes: {
        Row: { ativa: boolean; created_at: string; id: string; nome: string }
        Insert: { ativa?: boolean; created_at?: string; id?: string; nome: string }
        Update: { ativa?: boolean; created_at?: string; id?: string; nome?: string }
        Relationships: []
      }
      pasta_historico: {
        Row: {
          created_at: string
          de: string | null
          evento: string
          id: string
          para: string | null
          pasta_id: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          de?: string | null
          evento: string
          id?: string
          para?: string | null
          pasta_id: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          de?: string | null
          evento?: string
          id?: string
          para?: string | null
          pasta_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pasta_historico_pasta_id_fkey'
            columns: ['pasta_id']
            isOneToOne: false
            referencedRelation: 'fila_prioridade'
            referencedColumns: ['pasta_id']
          },
          {
            foreignKeyName: 'pasta_historico_pasta_id_fkey'
            columns: ['pasta_id']
            isOneToOne: false
            referencedRelation: 'pastas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pasta_historico_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      pastas: {
        Row: {
          autonomo_id: string | null
          classificacao: Database['public']['Enums']['classificacao_pasta']
          cliente_id: string
          corretor_id: string
          created_at: string
          data_entrega: string
          empreendimento_id: string
          id: string
          observacoes: string | null
          percentual: number
          pontuacao: number
          pontuacao_maxima: number
          status: Database['public']['Enums']['status_pasta']
          unidade: string | null
          updated_at: string
        }
        Insert: {
          autonomo_id?: string | null
          classificacao?: Database['public']['Enums']['classificacao_pasta']
          cliente_id: string
          corretor_id?: string
          created_at?: string
          data_entrega: string
          empreendimento_id: string
          id?: string
          observacoes?: string | null
          percentual?: number
          pontuacao?: number
          pontuacao_maxima?: number
          status?: Database['public']['Enums']['status_pasta']
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          autonomo_id?: string | null
          classificacao?: Database['public']['Enums']['classificacao_pasta']
          cliente_id?: string
          corretor_id?: string
          created_at?: string
          data_entrega?: string
          empreendimento_id?: string
          id?: string
          observacoes?: string | null
          percentual?: number
          pontuacao?: number
          pontuacao_maxima?: number
          status?: Database['public']['Enums']['status_pasta']
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pastas_autonomo_id_fkey'
            columns: ['autonomo_id']
            isOneToOne: false
            referencedRelation: 'autonomos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pastas_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pastas_corretor_id_fkey'
            columns: ['corretor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pastas_empreendimento_id_fkey'
            columns: ['empreendimento_id']
            isOneToOne: false
            referencedRelation: 'empreendimentos'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          autonomo_id: string | null
          created_at: string
          creci: string | null
          email: string
          equipe_id: string | null
          id: string
          nome: string
          perfil: Database['public']['Enums']['perfil_acesso']
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          creci?: string | null
          email: string
          equipe_id?: string | null
          id: string
          nome: string
          perfil?: Database['public']['Enums']['perfil_acesso']
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          autonomo_id?: string | null
          created_at?: string
          creci?: string | null
          email?: string
          equipe_id?: string | null
          id?: string
          nome?: string
          perfil?: Database['public']['Enums']['perfil_acesso']
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_autonomo_id_fkey'
            columns: ['autonomo_id']
            isOneToOne: true
            referencedRelation: 'autonomos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_equipe_id_fkey'
            columns: ['equipe_id']
            isOneToOne: false
            referencedRelation: 'equipes'
            referencedColumns: ['id']
          },
        ]
      }
      tipos_documento: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          obrigatorio: boolean
          ordem: number
          peso: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          obrigatorio?: boolean
          ordem?: number
          peso: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          obrigatorio?: boolean
          ordem?: number
          peso?: number
        }
        Relationships: []
      }
    }
    Views: {
      fila_prioridade: {
        Row: {
          autonomo_apelido: string | null
          autonomo_id: string | null
          classificacao: Database['public']['Enums']['classificacao_pasta'] | null
          cliente_id: string | null
          cliente_nome: string | null
          data_entrega: string | null
          dias_para_entrega: number | null
          empreendimento_id: string | null
          empreendimento_nome: string | null
          pasta_id: string | null
          percentual: number | null
          pontuacao: number | null
          pontuacao_maxima: number | null
          posicao: number | null
          status: Database['public']['Enums']['status_pasta'] | null
          superintendente_apelido: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      classificar: {
        Args: { p_percentual: number }
        Returns: Database['public']['Enums']['classificacao_pasta']
      }
      eh_revisor: { Args: never; Returns: boolean }
      meu_perfil: { Args: never; Returns: Database['public']['Enums']['perfil_acesso'] }
      minha_equipe: { Args: never; Returns: string }
      mover_para_cadastro: {
        Args: { p_pasta: string; p_voltar?: boolean }
        Returns: undefined
      }
      importar_autonomos: {
        Args: { p_linhas: Json; p_desativar_ausentes?: boolean }
        Returns: Json
      }
      meu_autonomo: { Args: never; Returns: string }
      pode_ver_autonomo: { Args: { p_autonomo: string }; Returns: boolean }
      pode_ver_pasta: { Args: { p_pasta: string }; Returns: boolean }
      recalcular_pasta: { Args: { p_pasta: string }; Returns: undefined }
      recalcular_todas_pastas: { Args: never; Returns: undefined }
    }
    Enums: {
      classificacao_pasta: 'ouro' | 'prata' | 'bronze'
      perfil_acesso: 'corretor' | 'equipe_pastas' | 'supervisor' | 'diretor' | 'admin'
      status_documento: 'pendente' | 'enviado' | 'aprovado' | 'rejeitado'
      status_pasta: 'completa' | 'incompleta' | 'cadastro'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ---- Aliases de conveniência ----
type Tabelas = Database['public']['Tables']
export type PerfilAcesso = Database['public']['Enums']['perfil_acesso']
export type StatusPasta = Database['public']['Enums']['status_pasta']
export type ClassificacaoPasta = Database['public']['Enums']['classificacao_pasta']
export type StatusDocumento = Database['public']['Enums']['status_documento']
export type Profile = Tabelas['profiles']['Row']
export type Pasta = Tabelas['pastas']['Row']
export type Documento = Tabelas['documentos']['Row']
export type TipoDocumento = Tabelas['tipos_documento']['Row']
export type Autonomo = Tabelas['autonomos']['Row']

/** Campos devolvidos pela Edge Function ocr-documento. */
export type DadosOcr = {
  tipo_documento: string
  legivel: boolean
  nome: string | null
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  nome_mae: string | null
  estado_civil: string | null
  endereco: string | null
  cep: string | null
  data_emissao: string | null
  data_validade: string | null
  renda_mensal: number | null
  empregador: string | null
  observacoes: string | null
}
