# V10 — Produto, máquinas e estoque

## O que mudou
- FDM e resina agora são opções dentro do cadastro/edição do produto.
- Cada opção exige impressora, horas e material previamente cadastrado.
- O custo do material usa o custo médio do estoque, calculado pelas compras.
- Para materiais cadastrados em kg, o produto informa consumo em gramas e o sistema converte para kg na baixa do estoque.
- Energia usa a potência da impressora cadastrada e a tarifa de energia da organização.
- Depreciação usa valor de aquisição / vida útil em horas da impressora cadastrada.
- Comissão do marketplace não pertence ao produto; é calculada no pedido.
- A edição altera a configuração atual do produto. Pedidos já lançados mantêm `order_items.unit_price` e `order_items.unit_cost`.
- Foi criada a aba exclusiva `Impressoras` para cadastro/edição/desativação de FDM e resina.

## Supabase
Execute apenas a migration nova se as migrations anteriores já estiverem aplicadas:

`supabase/migrations/010_product_printing_config.sql`

A migration 009 também foi corrigida no repositório para não conter a tentativa inválida de acessar `product_pricing.organization_id`.
