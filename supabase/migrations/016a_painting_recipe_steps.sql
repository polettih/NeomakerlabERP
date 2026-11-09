-- V31: receitas de pintura viram um passo a passo de verdade.
-- Antes, a receita era só "descrição livre + lista de cores soltas" — não dava
-- pra seguir enquanto pinta. Agora cada receita tem uma lista ORDENADA de
-- passos, cada um com técnica, tinta/cor e uma nota opcional.
--
-- Formato de cada item do jsonb `steps`:
--   { "technique": "Base" | "Camada" | "Wash" | "Drybrush" | "Luz" | "Sombra" | "Detalhe" | "Verniz",
--     "paint": "nome da tinta/cor",
--     "note": "observação opcional" }
--
-- Campos antigos (description, colors, dilution, finish, notes) continuam
-- existindo — nenhuma receita antiga quebra. Quem não usar os novos passos
-- simplesmente vê a receita como era antes.

alter table public.painting_recipes
  add column if not exists steps jsonb not null default '[]';

alter table public.painting_recipe_templates
  add column if not exists steps jsonb not null default '[]';

comment on column public.painting_recipes.steps is
  'Passo a passo ordenado: [{technique, paint, note}]. Ver migration 016 para o formato.';
