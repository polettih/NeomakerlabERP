-- Corrige a lista de categorias de máquina no banco para aceitar "Maquinário",
-- que é o valor que a tela de Impressoras/Maquinário sempre enviou. Antes disso,
-- o banco só aceitava 'Outra', então cadastrar ou editar uma máquina com a
-- categoria "Maquinário" falhava com um erro de restrição (check constraint).
alter table public.machines drop constraint if exists machines_category_check;
alter table public.machines
  add constraint machines_category_check
  check (category in ('Impressora FDM', 'Impressora Resina', 'Maquinário', 'Outra'));
