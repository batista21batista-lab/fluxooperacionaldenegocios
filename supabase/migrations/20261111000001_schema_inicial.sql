-- =====================================================================
-- Pastas Digitais · Lopes Consultoria de Imóveis
-- Schema inicial: tipos, tabelas, regras de pontuação/fila, RLS, storage
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos (enums)
-- ---------------------------------------------------------------------
create type public.perfil_acesso as enum ('corretor', 'equipe_pastas', 'supervisor', 'diretor');
create type public.status_pasta as enum ('completa', 'incompleta', 'cadastro');
create type public.classificacao_pasta as enum ('ouro', 'prata', 'bronze');
create type public.status_documento as enum ('pendente', 'enviado', 'aprovado', 'rejeitado');

-- ---------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------

-- Equipes de vendas (cada equipe tem 1+ supervisores e N corretores)
create table public.equipes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  ativa      boolean not null default true,
  created_at timestamptz not null default now()
);

-- Usuários do sistema (1:1 com auth.users)
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text not null,
  email      text not null,
  telefone   text,
  creci      text,
  perfil     public.perfil_acesso not null default 'corretor',
  equipe_id  uuid references public.equipes (id) on delete set null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_equipe_idx on public.profiles (equipe_id);

-- Lançamentos imobiliários
create table public.empreendimentos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  construtora     text,
  cidade          text,
  data_lancamento date,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Clientes (compradores)
create table public.clientes (
  id           uuid primary key default gen_random_uuid(),
  corretor_id  uuid not null default auth.uid() references public.profiles (id),
  nome         text not null,
  cpf          text not null unique,
  email        text,
  telefone     text,
  estado_civil text,
  renda_mensal numeric(12, 2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint clientes_cpf_formato check (cpf ~ '^[0-9]{11}$')
);
create index clientes_corretor_idx on public.clientes (corretor_id);

-- Catálogo de documentos exigidos. "peso" = pontos que o documento vale.
create table public.tipos_documento (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  descricao   text,
  peso        integer not null check (peso > 0),
  obrigatorio boolean not null default true,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Parâmetros de negócio (cortes de classificação em % da pontuação máxima)
create table public.configuracoes (
  chave      text primary key,
  valor      numeric not null,
  descricao  text,
  updated_at timestamptz not null default now()
);

-- Pasta digital: um cliente em um empreendimento
create table public.pastas (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clientes (id) on delete restrict,
  empreendimento_id uuid not null references public.empreendimentos (id) on delete restrict,
  corretor_id       uuid not null default auth.uid() references public.profiles (id),
  unidade           text,
  data_entrega      date not null,                 -- prazo de entrega da pasta
  observacoes       text,

  -- Campos calculados (mantidos por trigger; usuários não escrevem direto)
  status            public.status_pasta not null default 'incompleta',
  classificacao     public.classificacao_pasta not null default 'bronze',
  pontuacao         integer not null default 0,
  pontuacao_maxima  integer not null default 0,
  percentual        numeric(5, 2) not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (cliente_id, empreendimento_id)
);
create index pastas_corretor_idx on public.pastas (corretor_id);
create index pastas_empreendimento_idx on public.pastas (empreendimento_id);
create index pastas_fila_idx on public.pastas (percentual desc, data_entrega asc);

-- Documentos anexados (um registro por tipo de documento em cada pasta)
create table public.documentos (
  id                uuid primary key default gen_random_uuid(),
  pasta_id          uuid not null references public.pastas (id) on delete cascade,
  tipo_documento_id uuid not null references public.tipos_documento (id),
  status            public.status_documento not null default 'pendente',
  arquivo_path      text,                          -- caminho no bucket "documentos"
  motivo_rejeicao   text,
  enviado_por       uuid references public.profiles (id),
  revisado_por      uuid references public.profiles (id),
  revisado_em       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (pasta_id, tipo_documento_id)
);
create index documentos_pasta_idx on public.documentos (pasta_id);

-- Histórico de mudanças relevantes da pasta
create table public.pasta_historico (
  id         uuid primary key default gen_random_uuid(),
  pasta_id   uuid not null references public.pastas (id) on delete cascade,
  usuario_id uuid references public.profiles (id),
  evento     text not null,                        -- status | classificacao | criada
  de         text,
  para       text,
  created_at timestamptz not null default now()
);
create index pasta_historico_pasta_idx on public.pasta_historico (pasta_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. Funções auxiliares de autorização (usadas pelas policies de RLS)
-- ---------------------------------------------------------------------
create or replace function public.meu_perfil()
returns public.perfil_acesso
language sql stable security definer set search_path = ''
as $$ select perfil from public.profiles where id = auth.uid() and ativo $$;

create or replace function public.minha_equipe()
returns uuid
language sql stable security definer set search_path = ''
as $$ select equipe_id from public.profiles where id = auth.uid() and ativo $$;

-- Equipe Pastas e Diretor enxergam tudo; Supervisor enxerga sua equipe;
-- Corretor enxerga apenas o que é seu.
create or replace function public.pode_ver_corretor(p_corretor uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case public.meu_perfil()
    when 'diretor'       then true
    when 'equipe_pastas' then true
    when 'supervisor'    then exists (
      select 1 from public.profiles c
      where c.id = p_corretor
        and c.equipe_id is not null
        and c.equipe_id = public.minha_equipe()
    )
    when 'corretor'      then p_corretor = auth.uid()
    else false
  end
$$;

create or replace function public.pode_ver_pasta(p_pasta uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.pastas p
    where p.id = p_pasta and public.pode_ver_corretor(p.corretor_id)
  )
$$;

create or replace function public.eh_revisor()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.meu_perfil() in ('equipe_pastas', 'diretor'), false) $$;

-- ---------------------------------------------------------------------
-- 4. Pontuação, status e classificação
-- ---------------------------------------------------------------------

-- Classifica pelo percentual da pontuação máxima, usando os cortes em configuracoes.
create or replace function public.classificar(p_percentual numeric)
returns public.classificacao_pasta
language sql stable set search_path = ''
as $$
  select case
    when p_percentual >= (select valor from public.configuracoes where chave = 'ouro_min')  then 'ouro'::public.classificacao_pasta
    when p_percentual >= (select valor from public.configuracoes where chave = 'prata_min') then 'prata'::public.classificacao_pasta
    else 'bronze'::public.classificacao_pasta
  end
$$;

-- Recalcula pontuação, classificação e status de uma pasta.
--  * pontuação  = soma dos pesos dos documentos APROVADOS
--  * máxima     = soma dos pesos de todos os tipos ativos
--  * completa   = todos os tipos obrigatórios ativos aprovados
--  * 'cadastro' é etapa posterior, definida manualmente (ver mover_para_cadastro)
--                e não é sobrescrita pelo recálculo.
create or replace function public.recalcular_pasta(p_pasta uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_pontos int;
  v_max    int;
  v_pend   int;
  v_pct    numeric(5, 2);
begin
  select coalesce(sum(t.peso), 0) into v_max
  from public.tipos_documento t where t.ativo;

  select coalesce(sum(t.peso), 0) into v_pontos
  from public.documentos d
  join public.tipos_documento t on t.id = d.tipo_documento_id
  where d.pasta_id = p_pasta and d.status = 'aprovado' and t.ativo;

  select count(*) into v_pend
  from public.tipos_documento t
  where t.ativo and t.obrigatorio
    and not exists (
      select 1 from public.documentos d
      where d.pasta_id = p_pasta and d.tipo_documento_id = t.id and d.status = 'aprovado'
    );

  v_pct := case when v_max = 0 then 0 else round(v_pontos * 100.0 / v_max, 2) end;

  update public.pastas
  set pontuacao        = v_pontos,
      pontuacao_maxima = v_max,
      percentual       = v_pct,
      classificacao    = public.classificar(v_pct),
      status           = case
                           when status = 'cadastro' then status
                           when v_pend = 0 then 'completa'::public.status_pasta
                           else 'incompleta'::public.status_pasta
                         end
  where id = p_pasta;
end;
$$;

-- Recalcula todas as pastas (use após alterar pesos/cortes). Só Diretor.
create or replace function public.recalcular_todas_pastas()
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  if public.meu_perfil() is distinct from 'diretor' and auth.uid() is not null then
    raise exception 'Apenas o Diretor pode recalcular todas as pastas';
  end if;
  for r in select id from public.pastas loop
    perform public.recalcular_pasta(r.id);
  end loop;
end;
$$;

-- Equipe Pastas / Diretor movem uma pasta COMPLETA para a etapa de Cadastro,
-- ou a devolvem (volta a ser avaliada automaticamente).
create or replace function public.mover_para_cadastro(p_pasta uuid, p_voltar boolean default false)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_status public.status_pasta;
begin
  if not public.eh_revisor() then
    raise exception 'Sem permissão para alterar a etapa de cadastro';
  end if;

  select status into v_status from public.pastas where id = p_pasta for update;
  if not found then raise exception 'Pasta não encontrada'; end if;

  if p_voltar then
    update public.pastas set status = 'incompleta' where id = p_pasta;  -- recálculo corrige
    perform public.recalcular_pasta(p_pasta);
  else
    if v_status <> 'completa' then
      raise exception 'Só pastas completas podem ir para Cadastro (status atual: %)', v_status;
    end if;
    update public.pastas set status = 'cadastro' where id = p_pasta;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Fila de prioridade automática
--    Ordem: maior % de documentação aprovada primeiro; empate -> menor
--    data de entrega; depois quem chegou antes. Pastas em Cadastro saem da fila.
--    (Regra concentrada nesta view: ajuste aqui se o critério mudar.)
-- ---------------------------------------------------------------------
create or replace view public.fila_prioridade
with (security_invoker = true) as
select
  row_number() over (order by p.percentual desc, p.data_entrega asc, p.created_at asc) as posicao,
  p.id as pasta_id,
  p.cliente_id,
  c.nome as cliente_nome,
  p.empreendimento_id,
  e.nome as empreendimento_nome,
  p.corretor_id,
  pr.nome as corretor_nome,
  p.status,
  p.classificacao,
  p.pontuacao,
  p.pontuacao_maxima,
  p.percentual,
  p.data_entrega,
  (p.data_entrega - current_date) as dias_para_entrega
from public.pastas p
join public.clientes c        on c.id = p.cliente_id
join public.empreendimentos e on e.id = p.empreendimento_id
join public.profiles pr       on pr.id = p.corretor_id
where p.status <> 'cadastro';

-- ---------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger trg_profiles_updated        before update on public.profiles        for each row execute function public.set_updated_at();
create trigger trg_empreendimentos_updated before update on public.empreendimentos for each row execute function public.set_updated_at();
create trigger trg_clientes_updated        before update on public.clientes        for each row execute function public.set_updated_at();
create trigger trg_pastas_updated          before update on public.pastas          for each row execute function public.set_updated_at();
create trigger trg_documentos_updated      before update on public.documentos      for each row execute function public.set_updated_at();

-- Cria o profile automaticamente quando um usuário se cadastra no Supabase Auth.
-- Todo novo usuário entra como 'corretor'; o Diretor promove depois.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede auto-promoção: só o Diretor altera perfil/equipe/ativo.
create or replace function public.proteger_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null
     and public.meu_perfil() is distinct from 'diretor'
     and (new.perfil, new.equipe_id, new.ativo) is distinct from (old.perfil, old.equipe_id, old.ativo) then
    raise exception 'Apenas o Diretor pode alterar perfil, equipe ou status do usuário';
  end if;
  return new;
end;
$$;
create trigger trg_profiles_proteger before update on public.profiles
  for each row execute function public.proteger_profile();

-- Pasta nova: calcula valores iniciais e registra no histórico.
create or replace function public.pasta_apos_inserir()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.recalcular_pasta(new.id);
  insert into public.pasta_historico (pasta_id, usuario_id, evento, para)
  values (new.id, auth.uid(), 'criada', 'incompleta');
  return new;
end;
$$;
create trigger trg_pastas_apos_inserir after insert on public.pastas
  for each row execute function public.pasta_apos_inserir();

-- Histórico de mudança de status/classificação.
create or replace function public.pasta_registrar_historico()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.pasta_historico (pasta_id, usuario_id, evento, de, para)
    values (new.id, auth.uid(), 'status', old.status::text, new.status::text);
  end if;
  if new.classificacao is distinct from old.classificacao then
    insert into public.pasta_historico (pasta_id, usuario_id, evento, de, para)
    values (new.id, auth.uid(), 'classificacao', old.classificacao::text, new.classificacao::text);
  end if;
  return new;
end;
$$;
create trigger trg_pastas_historico after update on public.pastas
  for each row execute function public.pasta_registrar_historico();

-- Documentos: quem não é revisor só pode enviar (nunca aprovar/rejeitar).
create or replace function public.documento_validar()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.eh_revisor() then
    if new.status in ('aprovado', 'rejeitado') then
      raise exception 'Apenas Equipe Pastas ou Diretor podem aprovar/rejeitar documentos';
    end if;
    if tg_op = 'UPDATE' and old.status = 'aprovado' then
      raise exception 'Documento já aprovado não pode ser alterado';
    end if;
  end if;

  if new.status in ('aprovado', 'rejeitado') and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    new.revisado_por := auth.uid();
    new.revisado_em  := now();
  end if;
  if new.status = 'enviado' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    new.enviado_por := coalesce(auth.uid(), new.enviado_por);
    new.motivo_rejeicao := null;
  end if;
  if new.status = 'rejeitado' and new.motivo_rejeicao is null then
    raise exception 'Informe o motivo da rejeição';
  end if;
  return new;
end;
$$;
create trigger trg_documentos_validar before insert or update on public.documentos
  for each row execute function public.documento_validar();

-- Qualquer mudança em documentos recalcula a pasta.
create or replace function public.documento_recalcular()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.recalcular_pasta(coalesce(new.pasta_id, old.pasta_id));
  return null;
end;
$$;
create trigger trg_documentos_recalcular after insert or update or delete on public.documentos
  for each row execute function public.documento_recalcular();

-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------
alter table public.equipes         enable row level security;
alter table public.profiles        enable row level security;
alter table public.empreendimentos enable row level security;
alter table public.clientes        enable row level security;
alter table public.tipos_documento enable row level security;
alter table public.configuracoes   enable row level security;
alter table public.pastas          enable row level security;
alter table public.documentos      enable row level security;
alter table public.pasta_historico enable row level security;

-- Tabelas de referência: leitura para qualquer usuário logado
create policy equipes_select         on public.equipes         for select to authenticated using (true);
create policy empreendimentos_select on public.empreendimentos for select to authenticated using (true);
create policy tipos_documento_select on public.tipos_documento for select to authenticated using (true);
create policy configuracoes_select   on public.configuracoes   for select to authenticated using (true);

create policy equipes_diretor         on public.equipes         for all to authenticated
  using (public.meu_perfil() = 'diretor') with check (public.meu_perfil() = 'diretor');
create policy tipos_documento_diretor on public.tipos_documento for all to authenticated
  using (public.meu_perfil() = 'diretor') with check (public.meu_perfil() = 'diretor');
create policy configuracoes_diretor   on public.configuracoes   for all to authenticated
  using (public.meu_perfil() = 'diretor') with check (public.meu_perfil() = 'diretor');
create policy empreendimentos_gestao  on public.empreendimentos for all to authenticated
  using (public.meu_perfil() in ('diretor', 'equipe_pastas'))
  with check (public.meu_perfil() in ('diretor', 'equipe_pastas'));

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.meu_perfil() in ('diretor', 'equipe_pastas')
  or (public.meu_perfil() = 'supervisor' and equipe_id is not null and equipe_id = public.minha_equipe())
);
create policy profiles_update_proprio  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_diretor  on public.profiles for update to authenticated
  using (public.meu_perfil() = 'diretor') with check (public.meu_perfil() = 'diretor');

-- clientes
create policy clientes_select on public.clientes for select to authenticated
  using (public.pode_ver_corretor(corretor_id));
create policy clientes_insert on public.clientes for insert to authenticated
  with check (public.pode_ver_corretor(corretor_id));
create policy clientes_update on public.clientes for update to authenticated
  using (public.pode_ver_corretor(corretor_id)) with check (public.pode_ver_corretor(corretor_id));
create policy clientes_delete on public.clientes for delete to authenticated
  using (public.meu_perfil() = 'diretor');

-- pastas
create policy pastas_select on public.pastas for select to authenticated
  using (public.pode_ver_corretor(corretor_id));
create policy pastas_insert on public.pastas for insert to authenticated
  with check (public.pode_ver_corretor(corretor_id));
create policy pastas_update on public.pastas for update to authenticated
  using (public.pode_ver_corretor(corretor_id)) with check (public.pode_ver_corretor(corretor_id));
create policy pastas_delete on public.pastas for delete to authenticated
  using (public.meu_perfil() = 'diretor');

-- Campos calculados/status só mudam via triggers e RPCs (security definer):
revoke update on public.pastas from authenticated, anon;
grant  update (unidade, data_entrega, observacoes, corretor_id) on public.pastas to authenticated;
revoke insert on public.pastas from authenticated, anon;
grant  insert (cliente_id, empreendimento_id, corretor_id, unidade, data_entrega, observacoes)
  on public.pastas to authenticated;

-- documentos
create policy documentos_select on public.documentos for select to authenticated
  using (public.pode_ver_pasta(pasta_id));
create policy documentos_insert on public.documentos for insert to authenticated
  with check (public.pode_ver_pasta(pasta_id));
create policy documentos_update on public.documentos for update to authenticated
  using (public.pode_ver_pasta(pasta_id)) with check (public.pode_ver_pasta(pasta_id));
create policy documentos_delete on public.documentos for delete to authenticated
  using (public.pode_ver_pasta(pasta_id) and (public.eh_revisor() or status <> 'aprovado'));

-- histórico: somente leitura (escrito por triggers)
create policy pasta_historico_select on public.pasta_historico for select to authenticated
  using (public.pode_ver_pasta(pasta_id));

-- RPCs expostas
revoke all on function public.recalcular_pasta(uuid) from public, anon, authenticated;
revoke all on function public.recalcular_todas_pastas() from public, anon;
revoke all on function public.mover_para_cadastro(uuid, boolean) from public, anon;
grant execute on function public.recalcular_todas_pastas() to authenticated;
grant execute on function public.mover_para_cadastro(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Storage: bucket privado "documentos"
--    Convenção de caminho: {pasta_id}/{tipo_documento_id}/{arquivo}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy documentos_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'documentos'
         and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.pode_ver_pasta(((storage.foldername(name))[1])::uuid));
create policy documentos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos'
         and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.pode_ver_pasta(((storage.foldername(name))[1])::uuid));
create policy documentos_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'documentos'
         and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.pode_ver_pasta(((storage.foldername(name))[1])::uuid));
create policy documentos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documentos'
         and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.eh_revisor());
