# NeoMaker ERP V12 — data de venda e data de conclusão

- O cadastro de pedido agora permite informar a **data da venda**.
- Ao cadastrar uma venda antiga, use a data real da venda.
- O status inicial pode ser escolhido no cadastro.
- Se o status for **Finalizado**, o sistema permite/incentiva informar a **data de conclusão**.
- `completed_at` é usado para o evento de conclusão no calendário.
- Pedidos finalizados antigos usam `delivered_at` como valor inicial de `completed_at`.
- No calendário, pedidos finalizados aparecem na data de conclusão; os demais continuam usando a data prevista.
- Pedidos finalizados podem ser arrastados no calendário e a data de conclusão é atualizada.

## Supabase
Execute somente `supabase/migrations/011_order_completion_date.sql` depois das migrations anteriores já aplicadas.
