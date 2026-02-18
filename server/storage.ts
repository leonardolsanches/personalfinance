import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, and, sql, isNull, or, inArray, asc, not } from "drizzle-orm";
import pkg from "pg";
const { Pool } = pkg;
import {
  categories,
  subcategories,
  bankAccounts,
  beneficiaries,
  transactions,
  payables,
  categorizationRules,
  budgetItems,
  type InsertCategory,
  type Category,
  type InsertSubcategory,
  type Subcategory,
  type InsertBankAccount,
  type BankAccount,
  type InsertBeneficiary,
  type Beneficiary,
  type InsertTransaction,
  type Transaction,
  type InsertPayable,
  type Payable,
  type InsertCategorizationRule,
  type CategorizationRule,
  type InsertBudgetItem,
  type BudgetItem,
} from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;

  getSubcategories(): Promise<Subcategory[]>;
  getSubcategory(id: number): Promise<Subcategory | undefined>;
  createSubcategory(data: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: number, data: Partial<InsertSubcategory>): Promise<Subcategory | undefined>;
  deleteSubcategory(id: number): Promise<void>;

  getBankAccounts(): Promise<BankAccount[]>;
  getBankAccount(id: number): Promise<BankAccount | undefined>;
  createBankAccount(data: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: number, data: Partial<InsertBankAccount>): Promise<BankAccount | undefined>;
  deleteBankAccount(id: number): Promise<void>;

  getBeneficiaries(): Promise<Beneficiary[]>;
  getBeneficiary(id: number): Promise<Beneficiary | undefined>;
  getDefaultBeneficiary(): Promise<Beneficiary | undefined>;
  createBeneficiary(data: InsertBeneficiary): Promise<Beneficiary>;
  updateBeneficiary(id: number, data: Partial<InsertBeneficiary>): Promise<Beneficiary | undefined>;
  deleteBeneficiary(id: number): Promise<void>;
  setDefaultBeneficiary(id: number): Promise<void>;
  setDefaultBeneficiaryForExisting(): Promise<void>;

  getTransactions(): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  getUncategorizedTransactions(): Promise<Transaction[]>;
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, data: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: number): Promise<void>;
  categorizeTransaction(id: number, categoryId: number, subcategoryId?: number): Promise<Transaction | undefined>;
  categorizeBatch(items: { id: number; categoryId: number; subcategoryId?: number }[]): Promise<void>;
  updateFraudByGroup(installmentGroupId: string, isFraudSuspect: boolean): Promise<number>;
  findTransactionByDescription(description: string, date: string): Promise<Transaction | undefined>;

  getPayables(): Promise<Payable[]>;
  getPayable(id: number): Promise<Payable | undefined>;
  createPayable(data: InsertPayable): Promise<Payable>;
  updatePayable(id: number, data: Partial<InsertPayable>): Promise<Payable | undefined>;
  deletePayable(id: number): Promise<void>;
  markPayableAsPaid(id: number): Promise<Payable | undefined>;

  getDashboardStats(refMonth?: string): Promise<{
    totalReceitas: number;
    totalDespesas: number;
    saldo: number;
    saldoAnterior: number;
    saldoAcumulado: number;
    saldoExtrato: number | null;
    contasPendentes: number;
    contasVencidas: number;
    receitasPrevistas: number;
    receitasRealizadas: number;
    despesasPrevistas: number;
    despesasRealizadas: number;
    transacoesPorMes: { month: string; receitas: number; despesas: number }[];
    despesasPorCategoria: { name: string; value: number; color: string }[];
    despesasPorCategoriaPorMes: { month: string; [key: string]: number | string }[];
    categoryColors: { [key: string]: string };
    refMonth: string;
  }>;

  getTransactionAggregatesByMonth(months: string[]): Promise<{ month: string; receitas: number; despesas: number; despesasPorCategoria: { categoryId: number; total: number }[] }[]>;

  setSaldoExtrato(saldo: number): Promise<void>;
  getSaldoExtrato(): Promise<number | null>;

  getCategorizationRules(): Promise<CategorizationRule[]>;
  createCategorizationRule(data: InsertCategorizationRule): Promise<CategorizationRule>;
  updateCategorizationRule(id: number, data: Partial<InsertCategorizationRule>): Promise<CategorizationRule | undefined>;
  deleteCategorizationRule(id: number): Promise<void>;
  findMatchingRule(description: string): Promise<{ categoryId: number; subcategoryId?: number } | null>;

  getBudgetItems(): Promise<BudgetItem[]>;
  getBudgetItem(id: number): Promise<BudgetItem | undefined>;
  createBudgetItem(data: InsertBudgetItem): Promise<BudgetItem>;
  createBudgetItems(items: InsertBudgetItem[]): Promise<BudgetItem[]>;
  updateBudgetItem(id: number, data: Partial<InsertBudgetItem>): Promise<BudgetItem | undefined>;
  deleteBudgetItem(id: number): Promise<void>;
  deleteBudgetItemsByIds(ids: number[]): Promise<void>;
  syncInstallmentsToBudget(): Promise<number>;
  syncBudgetItemsForGroup(installmentGroupId: string, data: { categoryId: number | null; subcategoryId: number | null; beneficiaryId: number | null }): Promise<void>;
  getHistoricalSuggestions(categoryId?: number, subcategoryId?: number): Promise<{ description: string; amount: number; count: number }[]>;
  getAutocompleteSuggestions(type: "receita" | "despesa", searchText: string): Promise<{ shortTitle: string; amount: string; categoryId: number | null; subcategoryId: number | null; count: number }[]>;

  findDuplicateTransactions(): Promise<{ date: string; description: string; amount: string; type: string; count: number; ids: number[]; sources: string[]; importedFromList: string[] }[]>;
  findWrongSignTransactions(): Promise<Transaction[]>;
  deleteTransactionsByIds(ids: number[]): Promise<void>;
  flipTransactionType(ids: number[]): Promise<void>;
  getTransactionsByIds(ids: number[]): Promise<Transaction[]>;

  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private saldoExtrato: number | null = null;

  async setSaldoExtrato(saldo: number): Promise<void> {
    this.saldoExtrato = saldo;
  }

  async getSaldoExtrato(): Promise<number | null> {
    return this.saldoExtrato;
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(data).returning();
    return result[0];
  }

  async updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const result = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return result[0];
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getSubcategories(): Promise<Subcategory[]> {
    return await db.select().from(subcategories).orderBy(subcategories.name);
  }

  async getSubcategory(id: number): Promise<Subcategory | undefined> {
    const result = await db.select().from(subcategories).where(eq(subcategories.id, id));
    return result[0];
  }

  async createSubcategory(data: InsertSubcategory): Promise<Subcategory> {
    const result = await db.insert(subcategories).values(data).returning();
    return result[0];
  }

  async updateSubcategory(id: number, data: Partial<InsertSubcategory>): Promise<Subcategory | undefined> {
    const result = await db.update(subcategories).set(data).where(eq(subcategories.id, id)).returning();
    return result[0];
  }

  async deleteSubcategory(id: number): Promise<void> {
    await db.delete(subcategories).where(eq(subcategories.id, id));
  }

  async getBankAccounts(): Promise<BankAccount[]> {
    return await db.select().from(bankAccounts).orderBy(bankAccounts.name);
  }

  async getBankAccount(id: number): Promise<BankAccount | undefined> {
    const result = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id));
    return result[0];
  }

  async createBankAccount(data: InsertBankAccount): Promise<BankAccount> {
    const result = await db.insert(bankAccounts).values(data).returning();
    return result[0];
  }

  async updateBankAccount(id: number, data: Partial<InsertBankAccount>): Promise<BankAccount | undefined> {
    const result = await db.update(bankAccounts).set(data).where(eq(bankAccounts.id, id)).returning();
    return result[0];
  }

  async deleteBankAccount(id: number): Promise<void> {
    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  }

  async getBeneficiaries(): Promise<Beneficiary[]> {
    return await db.select().from(beneficiaries).orderBy(beneficiaries.name);
  }

  async getBeneficiary(id: number): Promise<Beneficiary | undefined> {
    const result = await db.select().from(beneficiaries).where(eq(beneficiaries.id, id));
    return result[0];
  }

  async getDefaultBeneficiary(): Promise<Beneficiary | undefined> {
    const result = await db.select().from(beneficiaries).where(eq(beneficiaries.isDefault, true));
    return result[0];
  }

  async createBeneficiary(data: InsertBeneficiary): Promise<Beneficiary> {
    if (data.isDefault) {
      await db.update(beneficiaries).set({ isDefault: false });
    }
    const result = await db.insert(beneficiaries).values(data).returning();
    return result[0];
  }

  async updateBeneficiary(id: number, data: Partial<InsertBeneficiary>): Promise<Beneficiary | undefined> {
    if (data.isDefault) {
      await db.update(beneficiaries).set({ isDefault: false });
    }
    const result = await db.update(beneficiaries)
      .set(data)
      .where(eq(beneficiaries.id, id))
      .returning();
    return result[0];
  }

  async deleteBeneficiary(id: number): Promise<void> {
    await db.update(transactions).set({ beneficiaryId: null }).where(eq(transactions.beneficiaryId, id));
    await db.delete(beneficiaries).where(eq(beneficiaries.id, id));
  }

  async setDefaultBeneficiary(id: number): Promise<void> {
    await db.update(beneficiaries).set({ isDefault: false }).where(eq(beneficiaries.isDefault, true));
    await db.update(beneficiaries).set({ isDefault: true }).where(eq(beneficiaries.id, id));
  }

  async setDefaultBeneficiaryForExisting(): Promise<void> {
    const defaultBeneficiary = await this.getDefaultBeneficiary();
    if (defaultBeneficiary) {
      await db.update(transactions)
        .set({ beneficiaryId: defaultBeneficiary.id })
        .where(isNull(transactions.beneficiaryId));
    }
  }

  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.date));
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id));
    return result[0];
  }

  async getUncategorizedTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(
        or(
          eq(transactions.needsCategorization, true),
          isNull(transactions.categoryId)
        )
      )
      .orderBy(desc(transactions.date));
  }

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const cleanedData = {
      ...data,
      transactionDate: data.transactionDate || data.date || null,
      paymentDate: data.paymentDate || data.date || null,
    };
    const result = await db.insert(transactions).values(cleanedData).returning();
    return result[0];
  }

  async updateTransaction(id: number, data: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const cleanedData = {
      ...data,
      updatedAt: new Date(),
      transactionDate: data.transactionDate === undefined ? undefined : (data.transactionDate || null),
      paymentDate: data.paymentDate === undefined ? undefined : (data.paymentDate || null),
    };
    const result = await db.update(transactions)
      .set(cleanedData)
      .where(eq(transactions.id, id))
      .returning();
    return result[0];
  }

  async deleteTransaction(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async categorizeTransaction(id: number, categoryId: number, subcategoryId?: number): Promise<Transaction | undefined> {
    const result = await db.update(transactions)
      .set({
        categoryId,
        subcategoryId: subcategoryId || null,
        needsCategorization: false,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();
    return result[0];
  }

  async categorizeBatch(items: { id: number; categoryId: number; subcategoryId?: number }[]): Promise<void> {
    for (const item of items) {
      await this.categorizeTransaction(item.id, item.categoryId, item.subcategoryId);
    }
  }

  async updateFraudByGroup(installmentGroupId: string, isFraudSuspect: boolean): Promise<number> {
    const result = await db
      .update(transactions)
      .set({ isFraudSuspect })
      .where(eq(transactions.installmentGroupId, installmentGroupId))
      .returning();
    return result.length;
  }

  async findTransactionByDescription(description: string, date: string): Promise<Transaction | undefined> {
    const result = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.description, description),
          eq(transactions.date, date)
        )
      );
    return result[0];
  }

  async getPayables(): Promise<Payable[]> {
    return await db.select().from(payables).orderBy(payables.dueDate);
  }

  async getPayable(id: number): Promise<Payable | undefined> {
    const result = await db.select().from(payables).where(eq(payables.id, id));
    return result[0];
  }

  async createPayable(data: InsertPayable): Promise<Payable> {
    if (data.isInstallment && data.totalInstallments && data.totalInstallments > 1) {
      const installments: Payable[] = [];
      const baseAmount = parseFloat(String(data.amount)) / data.totalInstallments;
      const baseDate = new Date(data.dueDate);

      for (let i = 0; i < data.totalInstallments; i++) {
        const installmentDate = new Date(baseDate);
        installmentDate.setMonth(installmentDate.getMonth() + i);

        const installmentData = {
          ...data,
          amount: baseAmount.toFixed(2),
          dueDate: installmentDate.toISOString().split("T")[0],
          installmentNumber: i + 1,
          description: `${data.description} (${i + 1}/${data.totalInstallments})`,
        };

        const result = await db.insert(payables).values(installmentData).returning();
        installments.push(result[0]);
      }
      return installments[0];
    }

    const result = await db.insert(payables).values(data).returning();
    return result[0];
  }

  async updatePayable(id: number, data: Partial<InsertPayable>): Promise<Payable | undefined> {
    const result = await db.update(payables)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payables.id, id))
      .returning();
    return result[0];
  }

  async deletePayable(id: number): Promise<void> {
    await db.delete(payables).where(eq(payables.id, id));
  }

  async markPayableAsPaid(id: number): Promise<Payable | undefined> {
    const result = await db.update(payables)
      .set({
        status: "pago",
        paidAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
      })
      .where(eq(payables.id, id))
      .returning();
    return result[0];
  }

  async getDashboardStats(refMonth?: string) {
    const allTransactions = await db.select().from(transactions);
    const allPayables = await db.select().from(payables);
    const allCategories = await db.select().from(categories);

    const today = new Date();
    
    // Parse refMonth (YYYY-MM) ou usar mês atual
    let refYear: number, refMonthIndex: number;
    if (refMonth && /^\d{4}-\d{2}$/.test(refMonth)) {
      const parts = refMonth.split('-');
      refYear = parseInt(parts[0]);
      refMonthIndex = parseInt(parts[1]) - 1;
    } else {
      refYear = today.getFullYear();
      refMonthIndex = today.getMonth();
    }
    
    const currentMonth = refMonthIndex;
    const currentYear = refYear;
    
    // cardBillMonth = mês em que a fatura é paga (mesmo mês)
    // Ex: cardBillMonth = 2026-02 → fatura paga em 09/02/2026
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    // Identificar pagamentos de cartão sem fatura detalhada importada
    // Ex: PERSONNALITE tem pagamento no extrato mas nenhuma fatura CSV importada
    // Esses pagamentos devem ser tratados como despesa normal
    const cardBillPayments = allTransactions.filter(t => t.isCardBillPayment);
    const faturaTransactions = allTransactions.filter(t => t.source === 'cartao' && !t.isCardBillPayment);
    const monthsWithFatura = new Set(faturaTransactions.map(t => t.cardBillMonth).filter(Boolean));
    
    const shouldExcludeBillPayment = (t: typeof allTransactions[0]) => {
      if (!t.isCardBillPayment) return false;
      const paymentDate = new Date(t.date);
      const paymentMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      const hasFaturaForMonth = monthsWithFatura.has(paymentMonth);
      if (!hasFaturaForMonth) return false;
      const faturaTotal = faturaTransactions
        .filter(f => f.cardBillMonth === paymentMonth)
        .reduce((sum, f) => {
          const amt = parseFloat(String(f.amount));
          return sum + (f.type === 'despesa' ? amt : -amt);
        }, 0);
      const billPaymentsForMonth = cardBillPayments
        .filter(bp => {
          const d = new Date(bp.date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === paymentMonth;
        });
      if (billPaymentsForMonth.length <= 1) return hasFaturaForMonth;
      const totalBillPayments = billPaymentsForMonth.reduce((sum, bp) => sum + parseFloat(String(bp.amount)), 0);
      const diff = totalBillPayments - faturaTotal;
      if (Math.abs(diff) < 1) return true;
      if (Math.abs(parseFloat(String(t.amount)) - diff) < 1) return false;
      return true;
    };

    const getCompetenciaMonth = (t: typeof allTransactions[0]): string => {
      if (t.paymentDate) {
        const d = new Date(t.paymentDate);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (t.source === "cartao" && t.cardBillMonth) return t.cardBillMonth;
      const d = new Date(t.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const currentMonthTransactions = allTransactions.filter(t => {
      return getCompetenciaMonth(t) === currentMonthStr;
    });

    const realizedTransactions = currentMonthTransactions.filter(t => t.status === "realizada");
    const plannedTransactions = currentMonthTransactions.filter(t => t.status === "prevista");

    const receitasRealizadas = realizedTransactions
      .filter((t) => t.type === "receita")
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);

    const receitasPrevistas = plannedTransactions
      .filter((t) => t.type === "receita")
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);

    const despesasRealizadas = realizedTransactions
      .filter((t) => t.type === "despesa" && !shouldExcludeBillPayment(t))
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);

    const despesasPrevistas = plannedTransactions
      .filter((t) => t.type === "despesa" && !shouldExcludeBillPayment(t))
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);

    const totalReceitas = receitasRealizadas + receitasPrevistas;
    const totalDespesas = despesasRealizadas + despesasPrevistas;

    const saldo = totalReceitas - totalDespesas;

    const previousMonthTransactions = allTransactions.filter(t => {
      if (t.source === 'cartao' && !t.isCardBillPayment) return false;
      if (t.source === 'cartao' && t.isCardBillPayment) {
        const date = new Date(t.date);
        const tYear = date.getFullYear();
        const tMonth = date.getMonth();
        return tYear < currentYear || (tYear === currentYear && tMonth < currentMonth);
      }
      const date = new Date(t.date);
      const tYear = date.getFullYear();
      const tMonth = date.getMonth();
      return tYear < currentYear || (tYear === currentYear && tMonth < currentMonth);
    });

    const saldoAnterior = previousMonthTransactions
      .reduce((sum, t) => {
        const amt = parseFloat(String(t.amount));
        return sum + (t.type === 'receita' ? amt : -amt);
      }, 0);

    const saldoAcumulado = saldoAnterior + saldo;

    const contasPendentes = allPayables.filter((p) => p.status !== "pago").length;
    const contasVencidas = allPayables.filter((p) => {
      if (p.status === "pago") return false;
      return new Date(p.dueDate) < today;
    }).length;

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    // Gerar janela de 12 meses: 6 meses antes + mês de referência + 5 meses depois
    const chartMonths: { label: string; monthIndex: number; year: number }[] = [];
    for (let offset = -6; offset <= 5; offset++) {
      let m = currentMonth + offset;
      let y = currentYear;
      while (m < 0) { m += 12; y--; }
      while (m > 11) { m -= 12; y++; }
      const label = y !== currentYear ? `${monthNames[m]}/${y}` : monthNames[m];
      chartMonths.push({ label, monthIndex: m, year: y });
    }
    
    const transacoesPorMes = chartMonths.map(({ label, monthIndex, year }) => {
      const targetMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const monthTransactions = allTransactions.filter((t) => {
        return getCompetenciaMonth(t) === targetMonth;
      });

      return {
        month: label,
        receitas: monthTransactions
          .filter((t) => t.type === "receita" && !shouldExcludeBillPayment(t))
          .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0),
        despesas: monthTransactions
          .filter((t) => t.type === "despesa" && !shouldExcludeBillPayment(t))
          .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0),
      };
    });

    // Despesas por categoria do mês atual (para o gráfico de rosca)
    const despesasPorCategoria: { name: string; value: number; color: string }[] = [];
    const expensesByCategory = new Map<number, number>();

    currentMonthTransactions
      .filter((t) => t.type === "despesa" && t.categoryId && !shouldExcludeBillPayment(t))
      .forEach((t) => {
        const current = expensesByCategory.get(t.categoryId!) || 0;
        expensesByCategory.set(t.categoryId!, current + parseFloat(String(t.amount)));
      });

    expensesByCategory.forEach((value, categoryId) => {
      const category = allCategories.find((c) => c.id === categoryId);
      if (category) {
        despesasPorCategoria.push({
          name: category.name,
          value,
          color: category.color || "#3B82F6",
        });
      }
    });

    despesasPorCategoria.sort((a, b) => b.value - a.value);

    // Despesas por categoria por mês (para o gráfico de linhas)
    // Usa a mesma janela de 12 meses do gráfico de barras
    const despesaCategories = allCategories.filter(c => c.type === "despesa");
    
    const despesasPorCategoriaPorMes = chartMonths.map(({ label, monthIndex, year }) => {
      const todayMonth = today.getMonth();
      const todayYear = today.getFullYear();
      const isFuture = year > todayYear || (year === todayYear && monthIndex > todayMonth);
      
      const monthData: { month: string; [key: string]: number | string } = { 
        month: label,
        isFuture: isFuture ? 1 : 0,
      };
      
      const targetMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      
      despesaCategories.forEach(category => {
        const categoryExpenses = allTransactions
          .filter((t) => {
            if (t.type !== "despesa" || shouldExcludeBillPayment(t) || t.categoryId !== category.id) return false;
            return getCompetenciaMonth(t) === targetMonth;
          })
          .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
        
        if (categoryExpenses > 0) {
          monthData[category.name] = categoryExpenses;
        }
      });

      const uncategorizedExpenses = allTransactions
        .filter((t) => {
          if (t.type !== "despesa" || shouldExcludeBillPayment(t)) return false;
          if (t.categoryId && despesaCategories.some(c => c.id === t.categoryId)) return false;
          return getCompetenciaMonth(t) === targetMonth;
        })
        .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
      
      if (uncategorizedExpenses > 0) {
        monthData["Sem Categoria"] = uncategorizedExpenses;
      }
      
      return monthData;
    });

    // Cores das categorias para o gráfico de linhas
    const categoryColors: { [key: string]: string } = {};
    despesaCategories.forEach(cat => {
      categoryColors[cat.name] = cat.color || "#3B82F6";
    });
    
    const hasUncategorized = despesasPorCategoriaPorMes.some(m => typeof m["Sem Categoria"] === 'number');
    if (hasUncategorized) {
      categoryColors["Sem Categoria"] = "#9CA3AF";
    }
    
    // Índice do mês de referência na janela (sempre posição 6 = centro)
    const currentMonthIndex = 6;
    
    // Retornar refMonth para o frontend
    return {
      totalReceitas,
      totalDespesas,
      saldo,
      saldoAnterior,
      saldoAcumulado,
      saldoExtrato: this.saldoExtrato,
      contasPendentes,
      contasVencidas,
      receitasPrevistas,
      receitasRealizadas,
      despesasPrevistas,
      despesasRealizadas,
      transacoesPorMes,
      despesasPorCategoria,
      despesasPorCategoriaPorMes,
      categoryColors,
      currentMonthIndex,
      refMonth: currentMonthStr,
    };
  }

  async getTransactionAggregatesByMonth(months: string[]) {
    const allTransactions = await db.select().from(transactions);
    
    const cardBillPayments = allTransactions.filter(t => t.isCardBillPayment);
    const faturaTransactions = allTransactions.filter(t => t.source === 'cartao' && !t.isCardBillPayment);
    const monthsWithFatura = new Set(faturaTransactions.map(t => t.cardBillMonth).filter(Boolean));
    
    const shouldExcludeBillPayment = (t: typeof allTransactions[0]) => {
      if (!t.isCardBillPayment) return false;
      const paymentDate = new Date(t.date);
      const paymentMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      const hasFaturaForMonth = monthsWithFatura.has(paymentMonth);
      if (!hasFaturaForMonth) return false;
      const faturaTotal = faturaTransactions
        .filter(f => f.cardBillMonth === paymentMonth)
        .reduce((sum, f) => {
          const amt = parseFloat(String(f.amount));
          return sum + (f.type === 'despesa' ? amt : -amt);
        }, 0);
      const billPaymentsForMonth = cardBillPayments
        .filter(bp => {
          const d = new Date(bp.date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === paymentMonth;
        });
      if (billPaymentsForMonth.length <= 1) return hasFaturaForMonth;
      const totalBillPayments = billPaymentsForMonth.reduce((sum, bp) => sum + parseFloat(String(bp.amount)), 0);
      const diff = totalBillPayments - faturaTotal;
      if (Math.abs(diff) < 1) return true;
      if (Math.abs(parseFloat(String(t.amount)) - diff) < 1) return false;
      return true;
    };
    
    return months.map((targetMonth) => {
      const [yearStr, monthStr] = targetMonth.split('-');
      const year = parseInt(yearStr);
      const monthIndex = parseInt(monthStr) - 1;
      
      const monthTransactions = allTransactions.filter((t) => {
        if (t.source === "cartao" && t.cardBillMonth) {
          return t.cardBillMonth === targetMonth;
        } else {
          const date = new Date(t.date);
          return date.getMonth() === monthIndex && date.getFullYear() === year;
        }
      });
      
      const receitas = monthTransactions
        .filter(t => t.type === "receita" && !shouldExcludeBillPayment(t))
        .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
      
      const despesas = monthTransactions
        .filter(t => t.type === "despesa" && !shouldExcludeBillPayment(t))
        .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
      
      const catTotals = new Map<number, number>();
      monthTransactions
        .filter(t => t.type === "despesa" && !shouldExcludeBillPayment(t) && t.categoryId)
        .forEach(t => {
          catTotals.set(t.categoryId!, (catTotals.get(t.categoryId!) || 0) + parseFloat(String(t.amount)));
        });
      
      return {
        month: targetMonth,
        receitas,
        despesas,
        despesasPorCategoria: Array.from(catTotals.entries()).map(([categoryId, total]) => ({ categoryId, total })),
      };
    });
  }

  async getCategorizationRules(): Promise<CategorizationRule[]> {
    return await db.select().from(categorizationRules).where(eq(categorizationRules.active, true));
  }

  async createCategorizationRule(data: InsertCategorizationRule): Promise<CategorizationRule> {
    const result = await db.insert(categorizationRules).values(data).returning();
    return result[0];
  }

  async updateCategorizationRule(id: number, data: Partial<InsertCategorizationRule>): Promise<CategorizationRule | undefined> {
    const result = await db.update(categorizationRules).set(data).where(eq(categorizationRules.id, id)).returning();
    return result[0];
  }

  async deleteCategorizationRule(id: number): Promise<void> {
    await db.delete(categorizationRules).where(eq(categorizationRules.id, id));
  }

  async findMatchingRule(description: string): Promise<{ categoryId: number; subcategoryId?: number } | null> {
    const rules = await this.getCategorizationRules();
    const lowerDesc = description.toLowerCase();
    
    for (const rule of rules) {
      const pattern = rule.pattern.toLowerCase();
      if (lowerDesc.includes(pattern)) {
        return {
          categoryId: rule.categoryId,
          subcategoryId: rule.subcategoryId || undefined,
        };
      }
    }
    return null;
  }

  async seedData(): Promise<void> {
    const existingCategories = await db.select().from(categories);
    if (existingCategories.length > 0) return;

    const categoryData: InsertCategory[] = [
      { name: "Salario", type: "receita", color: "#10B981" },
      { name: "Freelance", type: "receita", color: "#06B6D4" },
      { name: "Investimentos", type: "receita", color: "#8B5CF6" },
      { name: "Alimentacao", type: "despesa", color: "#F59E0B" },
      { name: "Transporte", type: "despesa", color: "#EF4444" },
      { name: "Moradia", type: "despesa", color: "#3B82F6" },
      { name: "Saude", type: "despesa", color: "#EC4899" },
      { name: "Lazer", type: "despesa", color: "#84CC16" },
      { name: "Educacao", type: "despesa", color: "#6366F1" },
      { name: "Outros", type: "despesa", color: "#9CA3AF" },
    ];

    const createdCategories = await db.insert(categories).values(categoryData).returning();

    const alimentacaoCat = createdCategories.find((c) => c.name === "Alimentacao");
    const transporteCat = createdCategories.find((c) => c.name === "Transporte");
    const moradiaCat = createdCategories.find((c) => c.name === "Moradia");
    const lazerCat = createdCategories.find((c) => c.name === "Lazer");

    if (alimentacaoCat && transporteCat && moradiaCat && lazerCat) {
      const subcategoryData: InsertSubcategory[] = [
        { name: "Supermercado", categoryId: alimentacaoCat.id },
        { name: "Restaurantes", categoryId: alimentacaoCat.id },
        { name: "Delivery", categoryId: alimentacaoCat.id },
        { name: "Combustivel", categoryId: transporteCat.id },
        { name: "Uber/99", categoryId: transporteCat.id },
        { name: "Transporte Publico", categoryId: transporteCat.id },
        { name: "Aluguel", categoryId: moradiaCat.id },
        { name: "Condominio", categoryId: moradiaCat.id },
        { name: "Energia", categoryId: moradiaCat.id },
        { name: "Internet", categoryId: moradiaCat.id },
        { name: "Cinema", categoryId: lazerCat.id },
        { name: "Streaming", categoryId: lazerCat.id },
      ];

      await db.insert(subcategories).values(subcategoryData);
    }

    const bankAccountData: InsertBankAccount[] = [
      { name: "Conta Principal", bankName: "Nubank", accountType: "corrente", balance: "5000.00" },
      { name: "Cartao Nubank", bankName: "Nubank", accountType: "cartao", balance: "0" },
      { name: "Poupanca", bankName: "Caixa Economica", accountType: "poupanca", balance: "10000.00" },
    ];

    const createdAccounts = await db.insert(bankAccounts).values(bankAccountData).returning();

    // Create beneficiaries with Leonardo as default
    const beneficiaryData: InsertBeneficiary[] = [
      { name: "Leonardo", isDefault: true },
      { name: "Theo", isDefault: false },
      { name: "Thaiane", isDefault: false },
      { name: "Motorhome", isDefault: false },
    ];

    await db.insert(beneficiaries).values(beneficiaryData);

    const salarioCat = createdCategories.find((c) => c.name === "Salario");
    const nubank = createdAccounts.find((a) => a.name === "Conta Principal");

    if (salarioCat && alimentacaoCat && transporteCat && moradiaCat && nubank) {
      const today = new Date();
      const transactionData: InsertTransaction[] = [
        {
          description: "Salario Janeiro",
          amount: "8500.00",
          type: "receita",
          status: "realizada",
          date: new Date(today.getFullYear(), 0, 5).toISOString().split("T")[0],
          categoryId: salarioCat.id,
          bankAccountId: nubank.id,
        },
        {
          description: "Salario Fevereiro",
          amount: "8500.00",
          type: "receita",
          status: "realizada",
          date: new Date(today.getFullYear(), 1, 5).toISOString().split("T")[0],
          categoryId: salarioCat.id,
          bankAccountId: nubank.id,
        },
        {
          description: "Supermercado Extra",
          amount: "450.00",
          type: "despesa",
          status: "realizada",
          date: new Date(today.getFullYear(), 0, 10).toISOString().split("T")[0],
          categoryId: alimentacaoCat.id,
          bankAccountId: nubank.id,
        },
        {
          description: "Uber mensal",
          amount: "280.00",
          type: "despesa",
          status: "realizada",
          date: new Date(today.getFullYear(), 0, 15).toISOString().split("T")[0],
          categoryId: transporteCat.id,
          bankAccountId: nubank.id,
        },
        {
          description: "Aluguel Janeiro",
          amount: "2500.00",
          type: "despesa",
          status: "realizada",
          date: new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0],
          categoryId: moradiaCat.id,
          bankAccountId: nubank.id,
        },
        {
          description: "Supermercado Carrefour",
          amount: "520.00",
          type: "despesa",
          status: "realizada",
          date: new Date(today.getFullYear(), 1, 12).toISOString().split("T")[0],
          categoryId: alimentacaoCat.id,
          bankAccountId: nubank.id,
        },
        {
          description: "Aluguel Fevereiro",
          amount: "2500.00",
          type: "despesa",
          status: "realizada",
          date: new Date(today.getFullYear(), 1, 1).toISOString().split("T")[0],
          categoryId: moradiaCat.id,
          bankAccountId: nubank.id,
        },
      ];

      await db.insert(transactions).values(transactionData);

      const payableData: InsertPayable[] = [
        {
          description: "Aluguel Marco",
          amount: "2500.00",
          dueDate: new Date(today.getFullYear(), 2, 5).toISOString().split("T")[0],
          status: "pendente",
          categoryId: moradiaCat.id,
        },
        {
          description: "Internet",
          amount: "120.00",
          dueDate: new Date(today.getFullYear(), today.getMonth(), 15).toISOString().split("T")[0],
          status: "pendente",
          categoryId: moradiaCat.id,
        },
        {
          description: "Energia Eletrica",
          amount: "180.00",
          dueDate: new Date(today.getFullYear(), today.getMonth(), 20).toISOString().split("T")[0],
          status: "pendente",
          categoryId: moradiaCat.id,
        },
      ];

      await db.insert(payables).values(payableData);

      const categorizationRulesData: InsertCategorizationRule[] = [
        { pattern: "UBER", categoryId: transporteCat.id },
        { pattern: "99 APP", categoryId: transporteCat.id },
        { pattern: "SHELL", categoryId: transporteCat.id },
        { pattern: "POSTO", categoryId: transporteCat.id },
        { pattern: "MERCADO", categoryId: alimentacaoCat.id },
        { pattern: "SUPERMERCADO", categoryId: alimentacaoCat.id },
        { pattern: "EXTRA", categoryId: alimentacaoCat.id },
        { pattern: "CARREFOUR", categoryId: alimentacaoCat.id },
        { pattern: "IFOOD", categoryId: alimentacaoCat.id },
        { pattern: "RAPPI", categoryId: alimentacaoCat.id },
        { pattern: "ALUGUEL", categoryId: moradiaCat.id },
        { pattern: "CONDOMINIO", categoryId: moradiaCat.id },
        { pattern: "NETFLIX", categoryId: lazerCat.id },
        { pattern: "SPOTIFY", categoryId: lazerCat.id },
        { pattern: "AMAZON PRIME", categoryId: lazerCat.id },
      ];

      await db.insert(categorizationRules).values(categorizationRulesData);
    }
  }

  async getBudgetItems(): Promise<BudgetItem[]> {
    return await db.select().from(budgetItems).where(eq(budgetItems.active, true)).orderBy(budgetItems.yearMonth, budgetItems.description);
  }

  async getBudgetItem(id: number): Promise<BudgetItem | undefined> {
    const result = await db.select().from(budgetItems).where(eq(budgetItems.id, id));
    return result[0];
  }

  async createBudgetItem(data: InsertBudgetItem): Promise<BudgetItem> {
    const result = await db.insert(budgetItems).values(data).returning();
    return result[0];
  }

  async createBudgetItems(items: InsertBudgetItem[]): Promise<BudgetItem[]> {
    if (items.length === 0) return [];
    const result = await db.insert(budgetItems).values(items).returning();
    return result;
  }

  async updateBudgetItem(id: number, data: Partial<InsertBudgetItem>): Promise<BudgetItem | undefined> {
    const result = await db
      .update(budgetItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(budgetItems.id, id))
      .returning();
    return result[0];
  }

  async deleteBudgetItem(id: number): Promise<void> {
    await db.update(budgetItems).set({ active: false }).where(eq(budgetItems.id, id));
  }

  async syncRecurringBudgetItems(
    sourceItem: BudgetItem,
    syncFields: Partial<InsertBudgetItem>
  ): Promise<number> {
    if (!sourceItem.recurringGroupId) return 0;
    const result = await db
      .update(budgetItems)
      .set({ ...syncFields, updatedAt: new Date() })
      .where(
        and(
          eq(budgetItems.recurringGroupId, sourceItem.recurringGroupId),
          eq(budgetItems.active, true),
          sql`${budgetItems.yearMonth} > ${sourceItem.yearMonth}`
        )
      )
      .returning();
    return result.length;
  }

  async getBudgetItemsByRecurringGroup(recurringGroupId: string): Promise<BudgetItem[]> {
    return db
      .select()
      .from(budgetItems)
      .where(
        and(
          eq(budgetItems.recurringGroupId, recurringGroupId),
          eq(budgetItems.active, true)
        )
      )
      .orderBy(budgetItems.yearMonth);
  }

  async syncInstallmentsToBudget(): Promise<number> {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    // Get all installments with their group info
    const allInstallments = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.source, "cartao"),
          sql`${transactions.installmentTotal} IS NOT NULL`,
          eq(transactions.type, "despesa"),
          eq(transactions.isRefund, false),
          eq(transactions.isFraudSuspect, false)
        )
      )
      .orderBy(sql`${transactions.cardBillMonth} DESC`);

    // Group by installmentGroupId - keep the most recent by cardBillMonth for structure,
    // but use the most recently updated one for description/shortTitle
    const installmentGroups = new Map<string, typeof allInstallments[0]>();
    const mostRecentlyUpdated = new Map<string, typeof allInstallments[0]>();
    
    for (const t of allInstallments) {
      if (!t.installmentGroupId) continue;
      
      // Keep track of most recent by cardBillMonth (for structure)
      if (!installmentGroups.has(t.installmentGroupId)) {
        installmentGroups.set(t.installmentGroupId, t);
      }
      
      // Keep track of most recently updated (for description/shortTitle)
      // Robust comparison: prefer transactions with updatedAt set, and compare dates
      const existing = mostRecentlyUpdated.get(t.installmentGroupId);
      if (!existing) {
        mostRecentlyUpdated.set(t.installmentGroupId, t);
      } else {
        // If current has updatedAt and existing doesn't, prefer current
        if (t.updatedAt && !existing.updatedAt) {
          mostRecentlyUpdated.set(t.installmentGroupId, t);
        } 
        // If both have updatedAt, compare them
        else if (t.updatedAt && existing.updatedAt && t.updatedAt > existing.updatedAt) {
          mostRecentlyUpdated.set(t.installmentGroupId, t);
        }
        // If neither has updatedAt, fall back to cardBillMonth (most recent first, already sorted)
      }
    }

    let count = 0;
    
    // Helper to add months to a yearMonth string
    const addMonths = (yearMonth: string, months: number): string => {
      const [year, month] = yearMonth.split("-").map(Number);
      const date = new Date(year, month - 1 + months, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    };

    for (const [groupId, t] of installmentGroups) {
      if (!t.cardBillMonth || !t.installmentCurrent || !t.installmentTotal) continue;
      
      // Get the most recently updated transaction for this group (for description/shortTitle)
      const updated = mostRecentlyUpdated.get(groupId) || t;
      
      // Calculate how many future installments are remaining
      const remaining = t.installmentTotal - t.installmentCurrent;
      
      // Create budget items for current and all future installments
      for (let i = 0; i <= remaining; i++) {
        const targetMonth = addMonths(t.cardBillMonth, i);
        const installmentNumber = t.installmentCurrent + i;
        
        // Skip if month is in the past
        if (targetMonth < currentYearMonth) continue;
        
        // Check if budget item already exists
        const existing = await db
          .select()
          .from(budgetItems)
          .where(
            and(
              eq(budgetItems.installmentGroupId, groupId),
              eq(budgetItems.yearMonth, targetMonth),
              eq(budgetItems.active, true)
            )
          );

        // Calculate bill due date (day 9 of the target month, adjusted for weekends)
        const [targetYear, targetMonthNum] = targetMonth.split("-").map(Number);
        let billDueDate = new Date(targetYear, targetMonthNum - 1, 9);
        const dayOfWeek = billDueDate.getDay();
        if (dayOfWeek === 0) billDueDate.setDate(10); // Sunday -> Monday
        if (dayOfWeek === 6) billDueDate.setDate(11); // Saturday -> Monday
        const billDueDateStr = billDueDate.toISOString().split("T")[0];

        // Use description/shortTitle/category from the most recently updated transaction
        if (existing.length === 0) {
          await db.insert(budgetItems).values({
            description: updated.description,
            shortTitle: updated.shortTitle,
            type: "despesa",
            categoryId: updated.categoryId,
            subcategoryId: updated.subcategoryId,
            beneficiaryId: updated.beneficiaryId,
            yearMonth: targetMonth,
            amount: t.amount,
            transactionDate: t.date,
            billDueDate: billDueDateStr,
            isRecurring: false,
            isFromInstallment: true,
            installmentGroupId: groupId,
            installmentCurrent: installmentNumber,
            installmentTotal: t.installmentTotal,
            source: "cartao",
          });
          count++;
        } else {
          // Update existing budget item with latest transaction data (using most recently updated for description)
          await db.update(budgetItems)
            .set({
              description: updated.description,
              shortTitle: updated.shortTitle,
              categoryId: updated.categoryId,
              subcategoryId: updated.subcategoryId,
              beneficiaryId: updated.beneficiaryId,
              amount: t.amount,
              transactionDate: t.date,
              billDueDate: billDueDateStr,
              updatedAt: new Date(),
            })
            .where(eq(budgetItems.id, existing[0].id));
        }
      }
      
      // Also update ALL existing budget items for this group (including past months) with latest description/shortTitle
      // First update description/category for all items
      await db.update(budgetItems)
        .set({
          description: updated.description,
          shortTitle: updated.shortTitle,
          categoryId: updated.categoryId,
          subcategoryId: updated.subcategoryId,
          beneficiaryId: updated.beneficiaryId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(budgetItems.installmentGroupId, groupId),
            eq(budgetItems.active, true)
          )
        );

      // Fix any budget items in this group that have missing dates
      const itemsWithMissingDates = await db
        .select()
        .from(budgetItems)
        .where(
          and(
            eq(budgetItems.installmentGroupId, groupId),
            eq(budgetItems.active, true),
            or(
              sql`${budgetItems.transactionDate} IS NULL`,
              sql`${budgetItems.billDueDate} IS NULL`
            )
          )
        );

      for (const item of itemsWithMissingDates) {
        // Calculate billDueDate from yearMonth (day 9, adjusted for weekends)
        const [ym_year, ym_month] = item.yearMonth.split("-").map(Number);
        let itemBillDue = new Date(ym_year, ym_month - 1, 9);
        const dow = itemBillDue.getDay();
        if (dow === 0) itemBillDue.setDate(10);
        if (dow === 6) itemBillDue.setDate(11);
        const itemBillDueStr = itemBillDue.toISOString().split("T")[0];

        // Find matching transaction for this installment to get the original transaction date
        const matchingTx = allInstallments.find(
          tx => tx.installmentGroupId === groupId && tx.cardBillMonth === item.yearMonth
        );
        const txDate = matchingTx?.date || t.date;

        await db.update(budgetItems)
          .set({
            transactionDate: item.transactionDate || txDate,
            billDueDate: item.billDueDate || itemBillDueStr,
            updatedAt: new Date(),
          })
          .where(eq(budgetItems.id, item.id));
      }
    }
    return count;
  }

  async syncBudgetItemsForGroup(
    installmentGroupId: string,
    data: { categoryId: number | null; subcategoryId: number | null; beneficiaryId: number | null }
  ): Promise<void> {
    await db.update(budgetItems)
      .set({
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        beneficiaryId: data.beneficiaryId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(budgetItems.installmentGroupId, installmentGroupId),
          eq(budgetItems.active, true)
        )
      );
  }

  async getHistoricalSuggestions(categoryId?: number, subcategoryId?: number): Promise<{ description: string; amount: number; count: number }[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateStr = sixMonthsAgo.toISOString().split("T")[0];

    let query = db
      .select({
        description: transactions.shortTitle,
        amount: sql<number>`AVG(CAST(${transactions.amount} AS NUMERIC))`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.date} >= ${dateStr}`,
          eq(transactions.status, "realizada"),
          eq(transactions.isCardBillPayment, false),
          categoryId ? eq(transactions.categoryId, categoryId) : sql`1=1`,
          subcategoryId ? eq(transactions.subcategoryId, subcategoryId) : sql`1=1`
        )
      )
      .groupBy(transactions.shortTitle)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(20);

    const results = await query;
    return results
      .filter((r) => r.description)
      .map((r) => ({
        description: r.description || "",
        amount: Number(r.amount),
        count: Number(r.count),
      }));
  }

  async getAutocompleteSuggestions(type: "receita" | "despesa", searchText: string): Promise<{ shortTitle: string; amount: string; categoryId: number | null; subcategoryId: number | null; count: number }[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateStr = sixMonthsAgo.toISOString().split("T")[0];
    const searchPattern = `%${searchText.toLowerCase()}%`;

    const results = await db
      .select({
        shortTitle: sql<string>`COALESCE(${transactions.shortTitle}, ${transactions.description})`,
        amount: sql<string>`ROUND(AVG(CAST(${transactions.amount} AS NUMERIC)), 2)::text`,
        categoryId: sql<number | null>`MODE() WITHIN GROUP (ORDER BY ${transactions.categoryId})`,
        subcategoryId: sql<number | null>`MODE() WITHIN GROUP (ORDER BY ${transactions.subcategoryId})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.date} >= ${dateStr}`,
          eq(transactions.type, type),
          eq(transactions.status, "realizada"),
          eq(transactions.isCardBillPayment, false),
          sql`(LOWER(COALESCE(${transactions.shortTitle}, ${transactions.description})) LIKE ${searchPattern})`
        )
      )
      .groupBy(sql`COALESCE(${transactions.shortTitle}, ${transactions.description})`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    return results
      .filter((r) => r.shortTitle)
      .map((r) => ({
        shortTitle: r.shortTitle || "",
        amount: r.amount || "0",
        categoryId: r.categoryId,
        subcategoryId: r.subcategoryId,
        count: Number(r.count),
      }));
  }

  async findDuplicateTransactions(): Promise<{ date: string; description: string; amount: string; type: string; count: number; ids: number[]; sources: string[]; importedFromList: string[] }[]> {
    // Agrupar por date, description, amount, type E installment_current para não confundir parcelas diferentes
    // Também excluir transações que fazem parte de parcelamentos (têm installment_total > 1) com installment_current diferentes
    const results = await db.execute(sql`
      SELECT 
        date::text as date, 
        description, 
        amount::text as amount, 
        type,
        COUNT(*)::int as count,
        ARRAY_AGG(id ORDER BY id) as ids,
        ARRAY_AGG(DISTINCT COALESCE(source, 'manual')) as sources,
        ARRAY_AGG(DISTINCT imported_from) FILTER (WHERE imported_from IS NOT NULL) as imported_from_list
      FROM transactions 
      GROUP BY date, description, amount, type, COALESCE(installment_current, 0)
      HAVING COUNT(*) > 1
      ORDER BY date DESC, COUNT(*) DESC
      LIMIT 100
    `);
    
    return (results.rows as any[]).map(row => ({
      date: row.date,
      description: row.description,
      amount: row.amount,
      type: row.type,
      count: row.count,
      ids: Array.isArray(row.ids) ? row.ids : [],
      sources: Array.isArray(row.sources) ? row.sources : [],
      importedFromList: Array.isArray(row.imported_from_list) ? row.imported_from_list : [],
    }));
  }

  async findWrongSignTransactions(): Promise<Transaction[]> {
    const receitaCategories = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.type, "receita"));
    const receitaCategoryIds = receitaCategories.map(c => c.id);
    
    const results = await db
      .select()
      .from(transactions)
      .where(
        and(
          or(
            eq(transactions.source, "cartao"),
            eq(transactions.source, "conta_corrente")
          ),
          eq(transactions.type, "receita"),
          eq(transactions.isRefund, false),
          or(
            isNull(transactions.categoryId),
            receitaCategoryIds.length > 0 
              ? not(inArray(transactions.categoryId, receitaCategoryIds))
              : sql`true`
          )
        )
      )
      .orderBy(desc(transactions.date))
      .limit(500);
    return results;
  }

  async deleteTransactionsByIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(transactions).where(inArray(transactions.id, ids));
  }

  async deleteBudgetItemsByIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(budgetItems).where(inArray(budgetItems.id, ids));
  }

  async flipTransactionType(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.update(transactions)
      .set({ 
        type: sql`CASE WHEN type = 'receita' THEN 'despesa' ELSE 'receita' END`,
        updatedAt: new Date()
      })
      .where(inArray(transactions.id, ids));
  }

  async getTransactionsByIds(ids: number[]): Promise<Transaction[]> {
    if (ids.length === 0) return [];
    const results = await db
      .select()
      .from(transactions)
      .where(inArray(transactions.id, ids))
      .orderBy(asc(transactions.id));
    return results;
  }
}

export const storage = new DatabaseStorage();
