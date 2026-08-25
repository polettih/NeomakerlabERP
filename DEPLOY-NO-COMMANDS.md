# Publicar sem comandos

## GitHub

1. Crie um repositório vazio.
2. Abra **Add file → Upload files**.
3. Envie os arquivos desta pasta.
4. Commit.

## Supabase

1. Crie o projeto.
2. Abra **SQL Editor**.
3. Abra `supabase/migrations/001_initial_schema.sql`.
4. Copie todo o SQL.
5. Cole no SQL Editor.
6. Execute.
7. Copie Project URL e Publishable key.

## Vercel

1. Crie uma conta.
2. **Add New → Project**.
3. Importe o repositório.
4. Em Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Deploy.

## Depois

Abra a URL da Vercel.

Você pode instalar o NeoMaker ERP como aplicativo pelo menu de instalação do navegador quando disponível.
