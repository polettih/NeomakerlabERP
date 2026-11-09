# Migrations

Rode no **SQL Editor do Supabase**, na ordem alfabética dos nomes. Todas são idempotentes
(`if not exists` / `create or replace`), então rodar uma segunda vez não causa dano.

Os números repetidos (016, 018, 019) foram diferenciados com sufixo `a`/`b` — a ordem
`016a → 016b`, `018a → 018b`, `019a → 019b` é a mesma em que foram aplicadas.

Instalação nova: rode todas, de `001` até a última. Instalação existente: rode só as
posteriores à última que você já aplicou.
