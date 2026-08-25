create table if not exists public.painting_recipe_templates(
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 category text not null default 'Geral',
 description text not null,
 colors text[] not null default '{}',
 dilution text,
 finish text,
 notes text,
 created_at timestamptz not null default now()
);

create table if not exists public.painting_recipes(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null,
 category text not null default 'Geral',
 description text,
 colors text[] not null default '{}',
 dilution text,
 finish text,
 notes text,
 product_id uuid references public.products(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists painting_recipes_org_idx on public.painting_recipes(organization_id);
create index if not exists painting_recipes_product_idx on public.painting_recipes(product_id);

alter table public.painting_recipe_templates enable row level security;
alter table public.painting_recipes enable row level security;

drop policy if exists painting_recipe_templates_read on public.painting_recipe_templates;
create policy painting_recipe_templates_read on public.painting_recipe_templates for select to authenticated using (true);

drop policy if exists painting_recipes_access on public.painting_recipes;
create policy painting_recipes_access on public.painting_recipes for all using (organization_id in (select public.get_my_organization_ids())) with check (organization_id in (select public.get_my_organization_ids()));

insert into public.painting_recipe_templates(name,category,description,colors,dilution,finish,notes) values
('Pele clara','Pele','Base inicial para pele clara. Ajuste a proporção conforme a marca da tinta e a referência.','{"Branco","Ocre/amarelo","Vermelho queimado","Marrom claro"}','Começar com tinta levemente diluída; ajustar para aerógrafo ou pincel.','Acetinado','Use camadas finas. Para sombra, acrescente marrom avermelhado à base.'),
('Pele média','Pele','Base inicial para pele média/neutra.','{"Ocre","Branco","Vermelho queimado","Marrom"}','Diluição leve, conforme a técnica.','Acetinado','Faça a sombra adicionando marrom avermelhado; luz adicionando branco e ocre.'),
('Pele escura','Pele','Base inicial para pele escura quente.','{"Marrom","Ocre","Vermelho queimado","Laranja queimado","Branco"}','Diluição leve, conforme a técnica.','Acetinado','Evite escurecer apenas com preto; use marrom/vinho para preservar a temperatura.'),
('Vermelho vivo','Cores','Vermelho intenso para roupas e detalhes.','{"Vermelho","Pequena quantidade de magenta"}','20–30% de diluente como ponto de partida para aerógrafo.','Acetinado','Sombra: vermelho + vinho. Luz: vermelho + pequena quantidade de laranja/creme.'),
('Vermelho vinho','Cores','Vermelho profundo para sombras e tecidos.','{"Vermelho","Vinho/magenta","Pequena quantidade de marrom"}','20–30% de diluente para aerógrafo.','Fosco/acetinado','Aplique em veladuras para construir profundidade.'),
('Preto suave','Cores','Preto que preserva volume sem ficar chapado.','{"Preto","Azul escuro","Marrom escuro"}','Diluição leve.','Fosco','Use azul ou marrom em pequenas quantidades para variar o preto.'),
('Branco sombreado','Cores','Branco com volume para tecidos e peças claras.','{"Branco","Cinza claro","Ocre muito pequeno"}','Diluição leve.','Fosco','Sombra: cinza frio ou quente. Luz final: branco quase puro.'),
('Azul vivo','Cores','Azul saturado para roupas e acessórios.','{"Azul","Ciano","Pequena quantidade de magenta"}','20–30% para aerógrafo.','Acetinado','Sombra: azul + violeta/preto. Luz: azul + branco.'),
('Azul escuro','Cores','Azul profundo para sombras e tecidos.','{"Azul","Violeta","Preto em pequena quantidade"}','Diluição leve.','Fosco','Prefira violeta antes de adicionar muito preto.'),
('Metal prata','Metal','Base para metal prateado.','{"Prata metálica","Cinza escuro","Preto"}','Diluição conforme a tinta metálica; evite excesso de diluente.','Metálico','Faça sombra com cinza/preto e realce com prata quase pura.'),
('Metal ouro','Metal','Base para ouro envelhecido.','{"Ouro metálico","Ocre","Marrom"}','Diluição conforme a tinta metálica.','Metálico','Sombra com marrom translúcido; realce com ouro claro.'),
('Metal bronze','Metal','Bronze para armas e acessórios.','{"Bronze metálico","Marrom","Ocre"}','Diluição conforme a tinta metálica.','Metálico','Realce com bronze claro ou pequena quantidade de prata.'),
('Cabelo loiro','Cabelo','Base quente para cabelo loiro.','{"Ocre","Amarelo queimado","Branco","Marrom claro"}','Diluição leve.','Fosco','Sombra com marrom ocre; luz com amarelo claro + branco.'),
('Cabelo castanho','Cabelo','Base para cabelo castanho.','{"Marrom médio","Ocre","Vermelho queimado"}','Diluição leve.','Fosco','Luzes com ocre + branco; sombras com marrom escuro.'),
('Cabelo preto','Cabelo','Preto com variação de temperatura.','{"Preto","Azul escuro","Violeta"}','Diluição leve.','Fosco','Reserve o preto puro para as sombras mais profundas.'),
('Couro','Materiais','Base para couro marrom.','{"Marrom","Ocre","Vermelho queimado","Preto"}','Diluição leve.','Acetinado','Realce as bordas com ocre claro e reduza o brilho com verniz fosco se necessário.'),
('Jeans','Materiais','Azul para tecido jeans.','{"Azul médio","Azul claro","Cinza","Branco"}','Diluição leve.','Fosco','Use cinza claro e branco nas áreas de desgaste.'),
('Sombra para vermelho','Sombras','Mistura para aprofundar vermelho sem apagar a cor.','{"Vermelho base","Vinho/magenta","Marrom avermelhado"}','Usar mais diluída para veladura.','Fosco','Evite preto puro; aplique em camadas finas.'),
('Sombra para azul','Sombras','Mistura para aprofundar azul.','{"Azul base","Violeta","Azul escuro"}','Usar mais diluída para veladura.','Fosco','Aplique gradualmente para preservar a saturação.'),
('Sombra para pele','Sombras','Mistura inicial para sombras de pele.','{"Cor da pele base","Ocre","Vermelho queimado","Marrom avermelhado"}','Veladura fina.','Acetinado','Concentre em reentrâncias e regiões de contato; evite criar uma linha dura.'),
('Luz para pele','Luzes','Mistura para pontos de luz de pele.','{"Cor da pele base","Branco","Ocre claro"}','Pouca diluição para pincel; mais diluída para aerógrafo.','Acetinado','Aplique nas áreas mais expostas e finalize os pontos máximos com mistura mais clara.')
on conflict (name) do nothing;
