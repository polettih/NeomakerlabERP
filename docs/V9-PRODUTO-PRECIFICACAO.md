# V9 — Precificação dentro do cadastro de produto

- Removida a opção Precificação do menu lateral.
- `/precificacao` redireciona para `/produtos` para compatibilidade com links antigos.
- O botão `+ Novo produto` abre o cadastro completo.
- O cadastro inclui dados do produto, até 8 fotos, materiais, tempos, energia, depreciação, mão de obra, perdas, margem, comissão e resumo.
- A mão de obra usa `organization_settings.labor_hour_rate`.
- Ao salvar, o produto, fotos, precificação e materiais são gravados.
- A precificação continua sendo armazenada em `product_pricing` e os valores de custo/preço são atualizados no produto.
- Nenhuma migration nova é necessária.
