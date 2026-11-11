-- Dados iniciais: parâmetros de classificação e catálogo de documentos.
-- Os pesos/cortes são pontos de partida — o Diretor pode ajustá-los depois
-- (e rodar select public.recalcular_todas_pastas() para reaplicar).

insert into public.configuracoes (chave, valor, descricao) values
  ('ouro_min',  90, 'Percentual mínimo da pontuação máxima para classificação Ouro'),
  ('prata_min', 60, 'Percentual mínimo da pontuação máxima para classificação Prata (abaixo = Bronze)');

insert into public.tipos_documento (nome, descricao, peso, obrigatorio, ordem) values
  ('RG ou CNH',                  'Documento de identificação com foto (frente e verso)',         10, true,  1),
  ('CPF',                        'Cadastro de Pessoa Física (se não constar no RG/CNH)',         10, true,  2),
  ('Comprovante de residência',  'Emitido nos últimos 90 dias',                                  10, true,  3),
  ('Certidão de estado civil',   'Nascimento, casamento, divórcio ou óbito do cônjuge',          10, true,  4),
  ('Comprovante de renda',       'Holerites dos 3 últimos meses ou pró-labore/DECORE',           20, true,  5),
  ('Carteira de trabalho',       'Páginas de identificação e contratos (digital aceita)',        10, true,  6),
  ('Imposto de Renda',           'Última declaração completa com recibo de entrega',             10, false, 7),
  ('Extrato do FGTS',            'Necessário se o FGTS compuser a entrada/financiamento',        10, false, 8),
  ('Extratos bancários',         'Últimos 3 meses (autônomos e comissionados)',                  10, false, 9);
