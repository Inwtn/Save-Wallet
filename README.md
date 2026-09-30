# Save Wallet

Controle financeiro pessoal estático hospedado no Vercel, com autenticação e banco PostgreSQL no Supabase.

## Preparar o Supabase

1. Crie um projeto no Supabase.
2. Abra `supabase/migrations/202609290001_finance_tables.sql`, copie todo o conteudo e cole no Supabase SQL Editor. Nao cole o caminho do arquivo como SQL.
3. Depois abra `supabase/migrations/202609290002_recurring_expenses.sql` e execute o conteudo tambem, para criar o planejamento mensal.
4. Em Authentication > Providers, habilite e-mail e senha. Mantenha a confirmacao de e-mail ligada para producao.
5. Em Authentication > URL Configuration, defina a URL do site Vercel como Site URL e Redirect URL.
6. Em Project Settings > API Keys, copie a Project URL e a chave publishable (sb_publishable_...). Nunca use a chave secret/service_role neste app.

## Publicar no Vercel

1. Importe o repositório e defina `Save Wallet` como Root Directory.
2. Em **Settings → Environment Variables**, configure `SUPABASE_URL` com a Project URL e `SUPABASE_PUBLISHABLE_KEY` com a chave publicável.
3. Faça um novo deploy. `/api/config` entrega essas duas configurações públicas ao navegador sem incluí-las no repositório.
4. No Supabase, revise **Security Advisor** e confirme que as todas as tabelas estão com RLS habilitado.

O frontend usa apenas uma chave publicável. As tabelas têm permissões somente para usuários autenticados e políticas que comparam `user_id` com `auth.uid()`; o banco repete a verificação em leitura, criação, alteração e exclusão.

As transações e o orçamento antigos, se existirem no armazenamento local do navegador, não são enviados automaticamente ao banco. Isso evita misturar dados locais de pessoas diferentes no mesmo computador.

## Desenvolvimento local

Use Vercel CLI (`vercel dev`) com as mesmas variáveis de ambiente do projeto. Abrir `index.html` diretamente como `file://` não ativa a função `/api/config` nem a autenticação.
