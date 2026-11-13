-- =====================================================================
-- Autônomos (cadastro por apelido), hierarquia de visibilidade e OCR
--
-- * autonomos: lista importada da planilha. Cada linha aponta para seu
--   superintendente, diretor e diretor geral (também autônomos).
-- * A visibilidade das pastas passa a vir dessa hierarquia, não do perfil:
--   cada um vê as próprias pastas e as de quem está abaixo dele.
-- * Perfil 'admin' assume a administração (antes: 'diretor').
--   Equipe Pastas e Admin continuam vendo tudo e revisando documentos.
-- =====================================================================

-- 1. Cadastro de autônomos -------------------------------------------------
create table public.autonomos (
  id                 uuid primary key default gen_random_uuid(),
  apelido            text not null unique,
  designacao         text,
  empresa            text,
  zona               text,
  creci_tipo         text,
  creci_status       text,
  superintendente_id uuid references public.autonomos (id) on delete set null,
  diretor_id         uuid references public.autonomos (id) on delete set null,
  diretor_geral_id   uuid references public.autonomos (id) on delete set null,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index autonomos_super_idx  on public.autonomos (superintendente_id);
create index autonomos_diretor_idx on public.autonomos (diretor_id);
create index autonomos_geral_idx  on public.autonomos (diretor_geral_id);
create trigger trg_autonomos_updated before update on public.autonomos
  for each row execute function public.set_updated_at();

alter table public.profiles add column autonomo_id uuid references public.autonomos (id) on delete set null;
create unique index profiles_autonomo_unico on public.profiles (autonomo_id) where autonomo_id is not null;

alter table public.pastas add column autonomo_id uuid references public.autonomos (id) on delete restrict;
create index pastas_autonomo_idx on public.pastas (autonomo_id);

-- 2. OCR nos documentos ----------------------------------------------------
alter table public.documentos
  add column ocr_status text check (ocr_status in ('processando', 'concluido', 'erro')),
  add column ocr_dados  jsonb,
  add column ocr_erro   text,
  add column ocr_em     timestamptz;

-- 3. Quem era 'diretor' (administrador até aqui) vira 'admin' ---------------
update public.profiles set perfil = 'admin' where perfil = 'diretor';

-- 4. Funções de autorização -------------------------------------------------
create or replace function public.meu_autonomo()
returns uuid
language sql stable security definer set search_path = ''
as $$ select autonomo_id from public.profiles where id = auth.uid() and ativo $$;

create or replace function public.eh_revisor()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.meu_perfil() in ('equipe_pastas', 'admin'), false) $$;

-- Vejo um autônomo se sou revisor, se sou ele, ou se estou acima dele.
create or replace function public.pode_ver_autonomo(p_autonomo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.meu_perfil() is not null and (
    public.eh_revisor()
    or (p_autonomo is not null and public.meu_autonomo() is not null and (
      p_autonomo = public.meu_autonomo()
      or exists (
        select 1 from public.autonomos a
        where a.id = p_autonomo
          and public.meu_autonomo() in (a.superintendente_id, a.diretor_id, a.diretor_geral_id)
      )
    ))
  )
$$;

-- Vejo uma pasta se a criei ou se posso ver o autônomo dono dela.
create or replace function public.pode_ver_pasta_de(p_criador uuid, p_autonomo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.meu_perfil() is not null
     and (p_criador = auth.uid() or public.pode_ver_autonomo(p_autonomo))
$$;

create or replace function public.pode_ver_pasta(p_pasta uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.pastas p
    where p.id = p_pasta and public.pode_ver_pasta_de(p.corretor_id, p.autonomo_id)
  )
$$;

create or replace function public.recalcular_todas_pastas()
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  if public.meu_perfil() is distinct from 'admin' and auth.uid() is not null then
    raise exception 'Apenas o Administrador pode recalcular todas as pastas';
  end if;
  for r in select id from public.pastas loop
    perform public.recalcular_pasta(r.id);
  end loop;
end;
$$;

create or replace function public.proteger_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null
     and public.meu_perfil() is distinct from 'admin'
     and (new.perfil, new.equipe_id, new.ativo, new.autonomo_id)
         is distinct from (old.perfil, old.equipe_id, old.ativo, old.autonomo_id) then
    raise exception 'Apenas o Administrador pode alterar perfil, vínculo ou acesso do usuário';
  end if;
  return new;
end;
$$;

-- Reenvio de arquivo descarta a leitura de OCR anterior.
create or replace function public.documento_validar()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.eh_revisor() then
    if new.status in ('aprovado', 'rejeitado') then
      raise exception 'Apenas Equipe Pastas ou Administrador podem aprovar/rejeitar documentos';
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
  if tg_op = 'UPDATE' and new.arquivo_path is distinct from old.arquivo_path then
    new.ocr_status := null; new.ocr_dados := null; new.ocr_erro := null; new.ocr_em := null;
  end if;
  return new;
end;
$$;

-- 5. Importação da planilha (só Admin) ---------------------------------------
-- p_linhas: [{apelido, designacao, empresa, zona, creci_tipo, creci_status, super, diretor, geral}]
create or replace function public.importar_autonomos(p_linhas jsonb, p_desativar_ausentes boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_total int; v_novos int; v_desativados int := 0;
begin
  if auth.uid() is not null and public.meu_perfil() is distinct from 'admin' then
    raise exception 'Apenas o Administrador pode importar autônomos';
  end if;

  create temporary table _imp on commit drop as
  select distinct on (apelido) *
  from (
    select upper(btrim(l ->> 'apelido')) as apelido,
           nullif(btrim(l ->> 'designacao'), '')   as designacao,
           nullif(btrim(l ->> 'empresa'), '')      as empresa,
           nullif(btrim(l ->> 'zona'), '')         as zona,
           nullif(btrim(l ->> 'creci_tipo'), '')   as creci_tipo,
           nullif(btrim(l ->> 'creci_status'), '') as creci_status,
           nullif(upper(btrim(l ->> 'super')), '')   as super,
           nullif(upper(btrim(l ->> 'diretor')), '') as diretor,
           nullif(upper(btrim(l ->> 'geral')), '')   as geral
    from jsonb_array_elements(p_linhas) l
  ) x
  where coalesce(apelido, '') <> '';

  select count(*) into v_total from _imp;
  select count(*) into v_novos from _imp i
   where not exists (select 1 from public.autonomos a where a.apelido = i.apelido);

  insert into public.autonomos (apelido, designacao, empresa, zona, creci_tipo, creci_status, ativo)
  select apelido, designacao, empresa, zona, creci_tipo, creci_status, true from _imp
  on conflict (apelido) do update
    set designacao = excluded.designacao, empresa = excluded.empresa, zona = excluded.zona,
        creci_tipo = excluded.creci_tipo, creci_status = excluded.creci_status, ativo = true;

  update public.autonomos a
  set superintendente_id = (select s.id from public.autonomos s where s.apelido = i.super   and s.id <> a.id),
      diretor_id         = (select d.id from public.autonomos d where d.apelido = i.diretor and d.id <> a.id),
      diretor_geral_id   = (select g.id from public.autonomos g where g.apelido = i.geral   and g.id <> a.id)
  from _imp i
  where a.apelido = i.apelido;

  if p_desativar_ausentes then
    update public.autonomos a set ativo = false
    where a.ativo and not exists (select 1 from _imp i where i.apelido = a.apelido);
    get diagnostics v_desativados = row_count;
  end if;

  return jsonb_build_object('total', v_total, 'novos', v_novos,
                            'atualizados', v_total - v_novos, 'desativados', v_desativados);
end;
$$;

-- 6. Fila: mostra o apelido do autônomo e do superintendente -----------------
drop view public.fila_prioridade;
create view public.fila_prioridade
with (security_invoker = true) as
select
  row_number() over (order by p.percentual desc, p.data_entrega asc, p.created_at asc) as posicao,
  p.id as pasta_id,
  p.cliente_id,
  c.nome as cliente_nome,
  p.empreendimento_id,
  e.nome as empreendimento_nome,
  p.autonomo_id,
  a.apelido as autonomo_apelido,
  s.apelido as superintendente_apelido,
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
left join public.autonomos a  on a.id = p.autonomo_id
left join public.autonomos s  on s.id = a.superintendente_id
where p.status <> 'cadastro';

-- 7. RLS ---------------------------------------------------------------------
alter table public.autonomos enable row level security;
create policy autonomos_select on public.autonomos for select to authenticated using (true);
create policy autonomos_admin  on public.autonomos for all to authenticated
  using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');

drop policy equipes_diretor         on public.equipes;
drop policy tipos_documento_diretor on public.tipos_documento;
drop policy configuracoes_diretor   on public.configuracoes;
drop policy empreendimentos_gestao  on public.empreendimentos;
create policy equipes_admin         on public.equipes         for all to authenticated
  using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');
create policy tipos_documento_admin on public.tipos_documento for all to authenticated
  using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');
create policy configuracoes_admin   on public.configuracoes   for all to authenticated
  using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');
create policy empreendimentos_gestao on public.empreendimentos for all to authenticated
  using (public.eh_revisor()) with check (public.eh_revisor());

drop policy profiles_select         on public.profiles;
drop policy profiles_update_diretor on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.eh_revisor());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.meu_perfil() = 'admin') with check (public.meu_perfil() = 'admin');

drop policy pastas_select on public.pastas;
drop policy pastas_insert on public.pastas;
drop policy pastas_update on public.pastas;
drop policy pastas_delete on public.pastas;
create policy pastas_select on public.pastas for select to authenticated
  using (public.pode_ver_pasta_de(corretor_id, autonomo_id));
create policy pastas_insert on public.pastas for insert to authenticated
  with check (corretor_id = auth.uid() and autonomo_id is not null and public.pode_ver_autonomo(autonomo_id));
create policy pastas_update on public.pastas for update to authenticated
  using (public.pode_ver_pasta_de(corretor_id, autonomo_id))
  with check (autonomo_id is not null and public.pode_ver_autonomo(autonomo_id));
create policy pastas_delete on public.pastas for delete to authenticated
  using (public.meu_perfil() = 'admin');

revoke insert, update on public.pastas from authenticated, anon;
grant insert (cliente_id, empreendimento_id, autonomo_id, unidade, data_entrega, observacoes)
  on public.pastas to authenticated;
grant update (autonomo_id, unidade, data_entrega, observacoes) on public.pastas to authenticated;

drop policy clientes_select on public.clientes;
drop policy clientes_insert on public.clientes;
drop policy clientes_update on public.clientes;
drop policy clientes_delete on public.clientes;
create policy clientes_select on public.clientes for select to authenticated using (
  public.meu_perfil() is not null and (
    corretor_id = auth.uid() or public.eh_revisor()
    or exists (select 1 from public.pastas p where p.cliente_id = clientes.id)  -- pastas já filtradas por RLS
  )
);
create policy clientes_insert on public.clientes for insert to authenticated
  with check (public.meu_perfil() is not null and corretor_id = auth.uid());
create policy clientes_update on public.clientes for update to authenticated
  using (public.meu_perfil() is not null and (corretor_id = auth.uid() or public.eh_revisor()))
  with check (public.meu_perfil() is not null and (corretor_id = auth.uid() or public.eh_revisor()));
create policy clientes_delete on public.clientes for delete to authenticated
  using (public.meu_perfil() = 'admin');

-- Documentos: usuários só escrevem arquivo/status; OCR é gravado pela Edge Function.
revoke insert, update on public.documentos from authenticated, anon;
grant insert (pasta_id, tipo_documento_id, status, arquivo_path) on public.documentos to authenticated;
grant update (pasta_id, tipo_documento_id, status, arquivo_path, motivo_rejeicao) on public.documentos to authenticated;

-- 8. Execução de funções -------------------------------------------------------
drop function public.pode_ver_corretor(uuid);
revoke all on function public.meu_autonomo()                  from public, anon;
revoke all on function public.pode_ver_autonomo(uuid)         from public, anon;
revoke all on function public.pode_ver_pasta_de(uuid, uuid)   from public, anon;
revoke all on function public.importar_autonomos(jsonb, boolean) from public, anon;
grant execute on function public.meu_autonomo(), public.pode_ver_autonomo(uuid),
  public.pode_ver_pasta_de(uuid, uuid), public.importar_autonomos(jsonb, boolean) to authenticated;
