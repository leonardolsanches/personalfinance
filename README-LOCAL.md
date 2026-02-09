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
3. Criar o banco de dados:
   ```
   npx drizzle-kit push
   ```
4. Iniciar o app:
   ```
   npm run dev
   ```

O app vai rodar em http://localhost:5000

## Banco de dados
- O banco SQLite fica em `data/finance.db`
- Para mudar o caminho, defina a variavel de ambiente `SQLITE_DB_PATH`
- Para resetar, delete o arquivo `data/finance.db` e execute `npx drizzle-kit push` novamente

## Importar dados do Replit
1. No app do Replit, va em Administracao > Exportar Dados (baixar JSON)
2. No app local, va em Administracao > Importar Dados (carregar o JSON)
