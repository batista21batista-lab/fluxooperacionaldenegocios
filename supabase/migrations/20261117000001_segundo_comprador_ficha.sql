-- Pastas de casal (2º comprador) e ficha cadastral no catálogo.
--
-- Regras:
--  * A pasta pode ter 2º comprador (pastas.segundo_comprador).
--  * Cada tipo de documento diz se também é exigido do 2º comprador (tipos_documento.exige_segundo_comprador).
--  * Cada documento pertence a um titular (documentos.titular): comprador_1 ou comprador_2.
--  * Pontuação: cada exigência (tipo × titular) vale o peso do tipo. Numa pasta de casal, um tipo exigido dos dois
--    conta duas vezes no máximo e precisa estar aprovado para os dois para a pasta ficar Completa.

-- 1. Catálogo -----------------------------------------------------------------
alter table public.tipos_documento
  add column exige_segundo_comprador boolean not null default false;

update public.tipos_documento set exige_segundo_comprador = true
where nome in ('RG ou CNH', 'CPF', 'Comprovante de renda', 'Carteira de trabalho');

insert into public.tipos_documento (nome, descricao, peso, obrigatorio, ordem)
values ('Ficha cadastral', 'Ficha da Lopes preenchida e assinada (vale para os dois compradores)', 10, true, 0)
on conflict (nome) do nothing;

-- 2. Pasta ----------------------------------------------------------------------
alter table public.pastas add column segundo_comprador boolean not null default false;
grant insert (segundo_comprador), update (segundo_comprador) on public.pastas to authenticated;

-- 3. Documentos -----------------------------------------------------------------
alter table public.documentos
  add column titular text not null default 'comprador_1'
  constraint documentos_titular_valido check (titular in ('comprador_1', 'comprador_2'));

alter table public.documentos drop constraint documentos_pasta_id_tipo_documento_id_key;
alter table public.documentos
  add constraint documentos_pasta_tipo_titular_key unique (pasta_id, tipo_documento_id, titular);

grant insert (titular), update (titular) on public.documentos to authenticated;

-- Mesma validação de antes + o titular precisa fazer sentido para a pasta e o tipo.
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

  if new.titular = 'comprador_2' and (tg_op = 'INSERT' or new.titular is distinct from old.titular) then
    if not exists (select 1 from public.pastas p where p.id = new.pasta_id and p.segundo_comprador) then
      raise exception 'Esta pasta não tem 2º comprador';
    end if;
    if not exists (select 1 from public.tipos_documento t where t.id = new.tipo_documento_id and t.exige_segundo_comprador) then
      raise exception 'Este documento não é pedido do 2º comprador';
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

-- 4. Pontuação por exigência (tipo × titular) ----------------------------------------
create or replace function public.recalcular_pasta(p_pasta uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_segundo boolean;
  v_pontos  int;
  v_max     int;
  v_pend    int;
  v_pct     numeric(5, 2);
begin
  select segundo_comprador into v_segundo from public.pastas where id = p_pasta;
  if not found then return; end if;

  with exigencias as (
    select t.id, t.peso, t.obrigatorio, tit.titular
    from public.tipos_documento t
    cross join (values ('comprador_1'), ('comprador_2')) as tit (titular)
    where t.ativo
      and (tit.titular = 'comprador_1' or (v_segundo and t.exige_segundo_comprador))
  ), situacao as (
    select e.*, exists (
      select 1 from public.documentos d
      where d.pasta_id = p_pasta and d.tipo_documento_id = e.id and d.titular = e.titular and d.status = 'aprovado'
    ) as aprovado
    from exigencias e
  )
  select coalesce(sum(peso), 0),
         coalesce(sum(peso) filter (where aprovado), 0),
         count(*) filter (where obrigatorio and not aprovado)
  into v_max, v_pontos, v_pend
  from situacao;

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
revoke all on function public.recalcular_pasta(uuid) from public, anon, authenticated;

-- Marcar/desmarcar o 2º comprador muda as exigências: recalcula a pasta.
create or replace function public.pasta_recalcular_comprador()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.recalcular_pasta(new.id);
  return null;
end;
$$;
revoke all on function public.pasta_recalcular_comprador() from public, anon, authenticated;

create trigger trg_pastas_segundo_comprador after update of segundo_comprador on public.pastas
  for each row when (old.segundo_comprador is distinct from new.segundo_comprador)
  execute function public.pasta_recalcular_comprador();

-- A ficha entrou no catálogo: reaplica a regra em todas as pastas.
do $$
declare r record;
begin
  for r in select id from public.pastas loop
    perform public.recalcular_pasta(r.id);
  end loop;
end;
$$;
