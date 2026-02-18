# Personal Finance - Sistema de Controle Financeiro Pessoal

## Overview

Personal Finance is a personal financial management system built for tracking income, expenses, bank accounts, and bills. The application provides a dashboard with financial insights, transaction management, categorization tools, and Excel import capabilities for bank statements.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode support)
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful JSON API endpoints under `/api/*`
- **File Uploads**: Multer for handling Excel file imports
- **Excel Processing**: XLSX library for parsing bank statements

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit with `db:push` command

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: esbuild bundles server code, Vite builds client to `dist/public`
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared code

### Key Data Models
- **Categories**: Income/expense categories with color coding
- **Subcategories**: Nested under categories for detailed classification
- **Bank Accounts**: Track multiple accounts with balances
- **Transactions**: Financial records with:
  - type (receita/despesa)
  - status (prevista/realizada) - UI displays as "Realizado/Planejado" (Visao filter)
  - source (manual/cartao/conta_corrente) - identifies origin of transaction
  - shortTitle - editable short name, originalDescription preserved
  - installmentCurrent/installmentTotal - for installment tracking
  - isRefund - for refund/estorno transactions
  - isRecurring - for recurring transactions
- **Payables**: Bills and scheduled payments with due dates and installment support
- **Categorization Rules**: Auto-categorization patterns for imported transactions
- **Budget Items**: Planning entries for financial forecasting with:
  - yearMonth - target month in YYYY-MM format
  - type (receita/despesa), amount, category/subcategory/beneficiary
  - transactionDate - original transaction date (always populated for installments)
  - billDueDate - bill payment due date (day 9 of target month, adjusted for weekends)
  - isRecurring - for recurring monthly items
  - isFromInstallment - auto-synced from card installments
  - installmentGroupId/installmentCurrent/installmentTotal - for divided payments

### Installment Payment Date Calculation
- For credit card installments during import, payment date = base_payment_date + (installmentCurrent - 1) months
- Base payment date: if transaction day <= 2, same month day 9; if > 2, next month day 9
- This ensures each installment maps to the correct billing month

### Standardized Table Interface
All 5 transaction-based pages (extrato, faturas, transacoes, consulta-planejamento, planejamento) share:
- **Identical columns** in order: Dt.Trans., Venc.Fat., Descricao, Tipo, Visao, Origem, Cat., Subcateg., Valor, Acoes
- **Identical filters**: Buscar, Tipo, Visao, Categoria, Subcategoria
- **Standard colWidths**: dtTrans: 72, vencFat: 72, descricao: flex, tipo: 44, status: 55, orig: 44, categoria: 90, subcategoria: 90, valor: 90, acoes: 60
- transacoes.tsx has an extra checkbox column for batch operations
- Budget pages (consulta-planejamento, planejamento) always show "Plan" badge in Visao column

### Application Pages
- Dashboard with financial summaries and charts
  - Separate sections for "Planejamento (Previsto)" and "Realizacao (Efetivo)"
  - Saldo Acumulado = Saldo Anterior + Resultado Mes (avoids double-counting card transactions)
  - Saldo Anterior uses only conta_corrente + manual + card bill payment transactions (not individual card items)
  - Saldo Extrato extracted from bank statement (XLS cell E104)
  - Import pendencies indicator linking to Pendencias de Importacao page
- Transactions list with CRUD operations
  - Filters for type (receita/despesa) and status (prevista/realizada)
  - Sortable columns
- Faturas Cartao (Credit Card Bills) - Monthly bill view with:
  - Bill totals per month (despesas only, excluding estornos)
  - Fraud marking capability
  - Summary cards (Realizado, Previsto, Total Faturas, Fraudes)
- Bills payable (Contas a Pagar) management
- Category and subcategory management
- Bank account management
- Transaction categorization workflow for uncategorized transactions
- Excel import for bank statements with automatic categorization (supports Itau XLS extrato and CSV faturas)
- Categorization rules management (Regras Auto) for configuring auto-categorization patterns
- Visao Planejado (Budget View) - Detailed list view with:
  - Sortable columns: Mes, Descricao, Tipo, Cat., Subcateg., Origem, Dt.Trans., Venc.Fat., Valor
  - Origem column: badges showing Manual (pencil), Import (upload), or Parc. (credit card) with installment info
  - Comprehensive filters, pagination, inline edit/delete
- Planejar (Budget Planning) - Quarterly calendar view with:
  - Monthly cards showing budget items with receitas/despesas totals
  - CRUD operations for budget items (add, edit, delete)
  - Standardized columns: Dt.Trans., Venc.Fat., Descricao, Tipo, Visao, Origem, Cat., Subcateg., Valor, Acoes
  - Origem column: icon-only with tooltip (Manual/Import/Parcelamento)
  - Automatic sync of card installments (parcelamentos)
  - Historical suggestions based on past 6 months of transactions
  - **Dynamic autocomplete**: While typing in "Descricao Breve" field, suggestions appear based on transaction history (filtered by type receita/despesa and matching text), showing category and average amount. Selecting a suggestion fills in description, amount, category, and subcategory automatically.
  - Recurring item support (repeat for N months)
  - Amount division across multiple months
  - Date filtering by transaction date and bill due date
- Media Mensal por Categoria - Statistical analysis page with:
  - Monthly averages per category excluding outliers (IQR method)
  - Peak/valley identification with transaction detail drill-down
  - Trimmed vs raw average comparison with percentage difference
  - Bar chart visualization with outlier highlighting per category
  - Categories with <4 months flagged as insufficient data
  - Summary cards: estimated receitas, despesas, saldo, outlier count
  - Export to Excel
- Beneficiar - Beneficiary management page with 2 tabs:
  - Cadastro: CRUD for beneficiaries (name, active status, default)
  - Visao Geral: Combined single-page flow with:
    - Summary cards (Receitas, Despesas, Saldo, Transacoes)
    - BeneficiaryCharts: stacked bar chart (12 months window with prev/next navigation) + 3 monthly donut charts per quarter showing category distribution (with quarter navigation)
    - Charts combine data from transactions (realizado, past months) and budget items (planejado, future months)
    - Attribution table with filters and bulk beneficiary assignment below charts
- Categorizar - Categorization page supporting both Transacoes and Planejamento data sources
  - Toggle between data sources, bulk and single categorization
  - Charts section with toggle between "Receita vs Despesa" and "Planejado vs Realizado" views
  - Global line chart showing monthly evolution (12-month window based on competencia month)
  - Individual per-category line charts in 2-column grid, each with category name title and color dot
  - Charts use competencia month (bill due date) for data grouping
- Pendencias de Importacao - Monthly import status grid showing:
  - Extrato and Fatura import status per month (Importado/Pendente/N/A)
  - Transaction counts and totals per import type
  - Bill payment status tracking
  - Link to import page for quick action

- Administracao - Database management page with:
  - Database stats (record counts per table)
  - Export: downloads all data as JSON backup file
  - Import: loads JSON backup file, replacing all existing data (preserves IDs)
  - Reset: clears all tables for starting fresh with another user's data
  - API: GET /api/admin/stats, GET /api/admin/export, POST /api/admin/import, POST /api/admin/reset

### Import Formats Supported
- **Itau Extrato Conta Corrente (XLS)**: Bank statement with columns data, lancamento, ag./origem, valor (R$)
  - Negative values = despesas, Positive values = receitas
  - Source set to "conta_corrente"
- **Itau Fatura Cartao (CSV)**: Credit card statement with columns data, lancamento, valor
  - Positive values = despesas, Negative values = estornos (receita)
  - Parcelamentos detected via pattern XX/XX at end of description
  - Source set to "cartao"

### Transaction Table Features
- Sortable columns: Data, Descricao, Tipo, Status, Valor (click header to sort)
- Origin badges: Credit card icon, Bank icon, or Pencil icon (manual)
- Compact rows for maximum data density on desktop (py-1.5 padding, text-xs)
- Tooltips for full original descriptions
- Comprehensive filters: Type, Status, Category, Subcategory, Beneficiary, Bank Account, Date Range
- "Limpar Filtros" button to clear active category/subcategory/beneficiary/bank account/date filters
- Pagination with 10 items per page and navigation controls

### Automatic Categorization
The system includes automatic categorization during Excel import:
- Rules are configured via the "Regras Auto" page in settings
- Each rule has a pattern (text to match) and target category/subcategory
- During import, transaction descriptions are matched against rules
- Matching transactions are automatically categorized
- Non-matching transactions are marked for manual categorization
- Seed data includes 15 common rules (UBER, MERCADO, IFOOD, NETFLIX, etc.)

## External Dependencies

- **PostgreSQL Database**: Required, connection via `DATABASE_URL` environment variable
- **Replit-specific plugins**: 
  - `@replit/vite-plugin-runtime-error-modal` for error display
  - `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` for development