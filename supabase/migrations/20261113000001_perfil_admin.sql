-- Em migration separada: um valor novo de enum só pode ser usado depois do commit.
alter type public.perfil_acesso add value if not exists 'admin';
