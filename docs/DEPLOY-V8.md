# NeoMaker ERP V8 — estoque e precificação separada

## 1. Supabase
Execute **uma única vez**:

`supabase/migrations/007_inventory_materials_pricing.sql`

Não execute novamente as migrations 001–006.

A migration adiciona:
- materiais com categorias Ferramentas, Maquinários e Insumos;
- estoque e custo médio;
- compras;
- movimentações manuais;
- materiais por produto;
- máquinas/depreciação;
- consumo automático de materiais quando uma produção entra em `in_progress`;
- campos adicionais de precificação.

## 2. GitHub
Substitua os arquivos do projeto pelos arquivos da V8, mantendo todas as migrations 001–007.

Commit sugerido:
`feat: add inventory and separate pricing`

## 3. Vercel
O deploy será disparado pelo novo commit. Não altere as variáveis de ambiente.

## 4. Como usar
1. Cadastre os materiais em **Estoque** e escolha Ferramentas, Maquinários ou Insumos.
2. Registre compras para aumentar o estoque e recalcular o custo médio.
3. Em **Precificação**, escolha o produto e associe os materiais e quantidades por unidade.
4. Informe tempos de FDM, resina, pintura e acabamento, energia, depreciação, margem e comissão.
5. Salve: o preço sugerido e custo estimado do produto são atualizados.
6. Quando um pedido passar para **Produção**, o ERP cria a baixa automática dos materiais configurados para os itens do pedido. Se não houver estoque suficiente, a transição para produção será bloqueada.
7. Use **Gasto/consumo manual** em Estoque para registrar perdas, testes, manutenção ou outros consumos fora de pedidos.

## Importante
Ferramentas e maquinários podem ser cadastrados no catálogo de materiais, mas não são consumidos automaticamente apenas por estarem cadastrados. O consumo automático utiliza os materiais associados em **Precificação**.
