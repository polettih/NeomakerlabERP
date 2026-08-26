# V13 — Estoque e Gastos/Compras unificados

- Remove Estoque como item separado do menu; a rota antiga redireciona para Gastos e compras.
- Unifica cadastro de materiais, compras, baixas e estoque em Gastos e compras.
- Filamento: unidade obrigatória g.
- Resina: unidade obrigatória ml.
- Filamentos e resinas possuem cor e cor visual (HEX).
- Custo médio continua sendo calculado pelo valor efetivamente pago nas compras.
- O cadastro de produto passa a selecionar somente materiais do tipo Filamento para FDM e Resina para impressão em resina.
- A quantidade usada na precificação é g para filamento e ml para resina.
- Materiais existentes não são convertidos automaticamente para evitar alterar custos históricos.

## Supabase
Execute apenas:
`supabase/migrations/012_unified_inventory_material_types.sql`
