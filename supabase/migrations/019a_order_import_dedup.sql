-- V49: importação de relatórios de vendas (Shopee, TikTok Shop).
-- A coluna external_order_id já existia no schema desde o início, mas nunca
-- tinha sido usada. Agora ela guarda o número do pedido do marketplace, e
-- este índice único impede reimportar o mesmo pedido duas vezes (ex.: se o
-- lojista subir o mesmo relatório, ou períodos de relatório que se sobrepõem).
create unique index if not exists orders_org_external_id_uidx
  on public.orders(organization_id, external_order_id)
  where external_order_id is not null;
