# NeoMaker ERP V9 — mão de obra corrigida

## Banco

A tabela `organization_settings` já foi criada pela SQL executada no Supabase.

**Não execute uma nova migration para esta correção.**

A tabela usada é:

- `organization_id`
- `labor_hour_rate`
- `created_at`
- `updated_at`

O sistema obtém a organização do usuário logado através de `requireUser()` e consulta `organization_settings` usando essa organização. Ele não depende de `product_pricing.organization_id`.

## Como funciona

### Financeiro → Mão de obra

Defina o valor que você cobra por hora. Exemplo:

`R$ 30,00 / hora`

### Precificação

No produto informe somente:

- horas de pintura;
- horas de acabamento.

O sistema utiliza automaticamente o valor/hora salvo em `organization_settings`.

Exemplo:

- 12 h de pintura
- 2 h de acabamento
- R$ 30/h

Mão de obra = `14 × 30 = R$ 420,00`.

Ao salvar a precificação, o valor calculado (`labor_cost`) fica gravado em `product_pricing`. Assim pedidos que já possuem seu custo calculado não são recalculados apenas porque o valor/hora atual mudou.

## Deploy

1. Substitua os arquivos do repositório GitHub pelos arquivos desta V9.
2. Faça commit.
3. Aguarde a Vercel iniciar o deploy.
4. Não execute SQL novamente.
