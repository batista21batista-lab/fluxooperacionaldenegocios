-- Funções de gatilho: nunca devem ser chamadas via API
revoke all on function public.documento_recalcular()      from public, anon, authenticated;
revoke all on function public.documento_validar()         from public, anon, authenticated;
revoke all on function public.handle_new_user()           from public, anon, authenticated;
revoke all on function public.pasta_apos_inserir()        from public, anon, authenticated;
revoke all on function public.pasta_registrar_historico() from public, anon, authenticated;
revoke all on function public.proteger_profile()          from public, anon, authenticated;

-- Auxiliares de RLS: só usuários logados (as policies são avaliadas com o papel do chamador)
revoke all on function public.meu_perfil()               from public, anon;
revoke all on function public.minha_equipe()             from public, anon;
revoke all on function public.eh_revisor()               from public, anon;
revoke all on function public.pode_ver_corretor(uuid)    from public, anon;
revoke all on function public.pode_ver_pasta(uuid)       from public, anon;
grant execute on function public.meu_perfil(), public.minha_equipe(), public.eh_revisor(),
  public.pode_ver_corretor(uuid), public.pode_ver_pasta(uuid) to authenticated;
