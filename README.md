# NeoMaker ERP — Cloud V1

Sistema web para gestão de pedidos, clientes, produtos, produção e financeiro.

## Objetivo

Esta versão foi preparada para o fluxo:

**GitHub → Vercel → Supabase**

Depois da publicação, o uso diário acontece apenas pelo navegador. Não é necessário instalar Node.js, VS Code, Docker ou Supabase CLI no computador que usa o ERP.

## Stack

- Next.js 16 / React 19 / TypeScript
- Supabase Auth + PostgreSQL + Row Level Security
- Vercel para hospedagem
- PWA para instalação como aplicativo no navegador

## O que já existe

- Login e cadastro
- Criação automática da organização no primeiro cadastro
- Canais padrão: Shopee, TikTok Shop, Instagram e Venda direta
- Dashboard
- Clientes
- Produtos
- Pedidos
- Geração automática da ordem de produção
- Fila de produção
- Financeiro
- Despesas
- RLS por organização
- PWA
- Estrutura pronta para futuras integrações de marketplaces

## Publicação sem terminal

### 1. GitHub

Crie um repositório vazio chamado `neomaker-erp`.

Envie os arquivos deste projeto para o repositório.

Se você não quiser usar VS Code, o GitHub permite enviar os arquivos pela interface web em **Add file → Upload files**.

### 2. Supabase

Crie um projeto no Supabase.

No projeto, abra **SQL Editor** e execute o conteúdo de:

`supabase/migrations/001_initial_schema.sql`

Isso cria todas as tabelas, relacionamentos, triggers e políticas RLS.

Depois copie:

- Project URL
- Publishable key

### 3. Vercel

Entre na Vercel e escolha **Add New → Project**.

Selecione o repositório `neomaker-erp`.

A Vercel detecta Next.js automaticamente.

Em **Environment Variables**, cadastre:

`NEXT_PUBLIC_SUPABASE_URL`

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Depois clique em **Deploy**.

### 4. Supabase Auth

No Supabase, configure a URL do site publicado em:

Authentication → URL Configuration

Use como Site URL o endereço fornecido pela Vercel, por exemplo:

`https://neomaker-erp.vercel.app`

Também adicione o domínio em Redirect URLs se necessário.

### 5. Primeiro acesso

Abra o endereço da Vercel e clique em **Criar conta**.

O banco cria automaticamente:

- organização
- usuário como owner
- Shopee
- TikTok Shop
- Instagram
- Venda direta

## Atualizações

Depois de publicado, qualquer atualização enviada ao GitHub pode disparar novo deploy automático na Vercel.

## Importante

Nunca publique `.env.local`, service-role keys ou senhas do banco no GitHub.

O frontend usa somente a Publishable key. As políticas RLS protegem os dados por organização.

## Estrutura

```text
app/
  (app)/
    dashboard/
    clientes/
    produtos/
    pedidos/
    producao/
    financeiro/
    configuracoes/
  api/
  login/
  signup/

components/
lib/
supabase/
  migrations/
public/
```

## Próxima evolução

A próxima versão deve adicionar:

- cadastro de máquinas
- materiais (resina/filamento)
- consumo real por impressão
- custo de energia
- custo de mão de obra
- cálculo automático de margem
- estoque
- anexos e fotos
- etapas detalhadas de pintura/acabamento
- integração Shopee
- integração TikTok Shop
- notificações
- relatórios
