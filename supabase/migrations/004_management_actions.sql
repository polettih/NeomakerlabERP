-- V4: gestão de produtos, pedidos, canais e calendário
-- Não remove dados existentes. Adiciona apenas índices/políticas auxiliares.
create index if not exists orders_expected_date_idx on public.orders(expected_date);
create index if not exists sales_channels_active_idx on public.sales_channels(active);

-- Permite ao cliente atualizar o pedido já protegido pelo RLS existente.
-- O status history continua protegido pela política existente.
