# Personal Finance - Versao Local (SQLite)

## Requisitos
- Node.js 18+ 
- npm

## Como executar

1. Extrair o ZIP
2. Instalar dependencias:
   ```
   npm install
   ```
3. Iniciar o app:
   ```
   npm run dev
   ```

O banco de dados SQLite e as tabelas sao criados automaticamente ao iniciar o app.
O app vai rodar em http://localhost:5000

## Deploy no Render

Para deploy no Render, configure:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `NODE_ENV=production node dist/index.js`
- **Environment Variable**: `SQLITE_DB_PATH=/var/data/finance.db`
- **Persistent Disk**: Monte um disco em `/var/data` para que o banco nao seja perdido entre deploys

## Banco de dados
- O banco SQLite fica em `data/finance.db` (local) ou no caminho definido por `SQLITE_DB_PATH`
- As tabelas sao criadas automaticamente na primeira execucao (nao precisa rodar migrations)
- Para resetar, delete o arquivo do banco e reinicie o app

## Importar dados do Replit
1. No app do Replit, va em Administracao > Exportar Dados (baixar JSON)
2. No app local, va em Administracao > Importar Dados (carregar o JSON)
