# NeoMaker ERP V16

## Arquivos alterados
- `components/inventory-manager.tsx`
- `components/machine-manager.tsx`
- `components/sidebar.tsx`
- `app/api/materials/route.ts`
- `app/api/machines/route.ts`
- `app/(app)/impressoras/page.tsx`
- `app/(app)/financeiro/page.tsx`
- `app/(app)/gastos-e-compras/page.tsx`
- `supabase/migrations/013_v16_financial_inventory_machines.sql`

## Supabase
Execute **somente** `supabase/migrations/013_v16_financial_inventory_machines.sql` depois das migrations anteriores.

A migration:
- integra compras de impressoras/maquinários ao ledger `expenses`;
- adiciona data de aquisição;
- permite categoria `Maquinário`;
- preserva histórico de equipamentos desativados;
- cria índices para relatórios financeiros.

## GitHub/Vercel
Substitua os arquivos mantendo os caminhos, faça commit/push e aguarde o Vercel iniciar o build.

## Observação
Não faça `DELETE` físico de materiais/equipamentos. A interface usa desativação para preservar custos e histórico de pedidos já registrados.
