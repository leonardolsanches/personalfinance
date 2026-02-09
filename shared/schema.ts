import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  color: text("color").default("#3B82F6"),
  icon: text("icon"),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const subcategories = sqliteTable("subcategories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const bankAccounts = sqliteTable("bank_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  bankName: text("bank_name"),
  accountType: text("account_type"),
  balance: text("balance").default("0"),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const beneficiaries = sqliteTable("beneficiaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).default(true),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  originalDescription: text("original_description"),
  shortTitle: text("short_title"),
  amount: text("amount").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("prevista"),
  date: text("date").notNull(),
  transactionDate: text("transaction_date"),
  paymentDate: text("payment_date"),
  categoryId: integer("category_id").references(() => categories.id),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  bankAccountId: integer("bank_account_id").references(() => bankAccounts.id),
  beneficiaryId: integer("beneficiary_id").references(() => beneficiaries.id),
  notes: text("notes"),
  importedFrom: text("imported_from"),
  importedFromRow: integer("imported_from_row"),
  source: text("source").default("manual"),
  needsCategorization: integer("needs_categorization", { mode: "boolean" }).default(false),
  isRecurring: integer("is_recurring", { mode: "boolean" }).default(false),
  recurringMonths: integer("recurring_months"),
  recurringGroupId: text("recurring_group_id"),
  isRefund: integer("is_refund", { mode: "boolean" }).default(false),
  isFraudSuspect: integer("is_fraud_suspect", { mode: "boolean" }).default(false),
  isCardBillPayment: integer("is_card_bill_payment", { mode: "boolean" }).default(false),
  installmentCurrent: integer("installment_current"),
  installmentTotal: integer("installment_total"),
  installmentGroupId: text("installment_group_id"),
  cardBillMonth: text("card_bill_month"),
  cardType: text("card_type"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const payables = sqliteTable("payables", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  amount: text("amount").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("pendente"),
  categoryId: integer("category_id").references(() => categories.id),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  isInstallment: integer("is_installment", { mode: "boolean" }).default(false),
  installmentNumber: integer("installment_number"),
  totalInstallments: integer("total_installments"),
  parentPayableId: integer("parent_payable_id"),
  notes: text("notes"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const categorizationRules = sqliteTable("categorization_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pattern: text("pattern").notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const budgetItems = sqliteTable("budget_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  shortTitle: text("short_title"),
  type: text("type").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  beneficiaryId: integer("beneficiary_id").references(() => beneficiaries.id),
  yearMonth: text("year_month").notNull(),
  amount: text("amount").notNull(),
  transactionDate: text("transaction_date"),
  billDueDate: text("bill_due_date"),
  isRecurring: integer("is_recurring", { mode: "boolean" }).default(false),
  isFromInstallment: integer("is_from_installment", { mode: "boolean" }).default(false),
  installmentGroupId: text("installment_group_id"),
  installmentCurrent: integer("installment_current"),
  installmentTotal: integer("installment_total"),
  source: text("source").default("manual"),
  notes: text("notes"),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertSubcategorySchema = createInsertSchema(subcategories).omit({ id: true, createdAt: true });
export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true, createdAt: true });
export const insertBeneficiarySchema = createInsertSchema(beneficiaries).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPayableSchema = createInsertSchema(payables).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCategorizationRuleSchema = createInsertSchema(categorizationRules).omit({ id: true, createdAt: true });
export const insertBudgetItemSchema = createInsertSchema(budgetItems).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type Subcategory = typeof subcategories.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBeneficiary = z.infer<typeof insertBeneficiarySchema>;
export type Beneficiary = typeof beneficiaries.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertPayable = z.infer<typeof insertPayableSchema>;
export type Payable = typeof payables.$inferSelect;
export type InsertCategorizationRule = z.infer<typeof insertCategorizationRuleSchema>;
export type CategorizationRule = typeof categorizationRules.$inferSelect;
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;
export type BudgetItem = typeof budgetItems.$inferSelect;
