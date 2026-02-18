import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transactionTypeEnum = pgEnum('transaction_type', ['receita', 'despesa']);
export const transactionStatusEnum = pgEnum('transaction_status', ['prevista', 'realizada']);
export const payableStatusEnum = pgEnum('payable_status', ['pendente', 'pago', 'vencido']);
export const transactionSourceEnum = pgEnum('transaction_source', ['manual', 'cartao', 'conta_corrente']);

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  icon: varchar("icon", { length: 50 }),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subcategories = pgTable("subcategories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  bankName: varchar("bank_name", { length: 100 }),
  accountType: varchar("account_type", { length: 50 }),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const beneficiaries = pgTable("beneficiaries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  active: boolean("active").default(true),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  description: varchar("description", { length: 255 }).notNull(),
  originalDescription: varchar("original_description", { length: 255 }),
  shortTitle: varchar("short_title", { length: 100 }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  status: transactionStatusEnum("status").notNull().default("prevista"),
  date: date("date").notNull(),
  transactionDate: date("transaction_date"),
  paymentDate: date("payment_date"),
  categoryId: integer("category_id").references(() => categories.id),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  bankAccountId: integer("bank_account_id").references(() => bankAccounts.id),
  beneficiaryId: integer("beneficiary_id").references(() => beneficiaries.id),
  notes: text("notes"),
  importedFrom: varchar("imported_from", { length: 100 }),
  importedFromRow: integer("imported_from_row"),
  source: transactionSourceEnum("source").default("manual"),
  needsCategorization: boolean("needs_categorization").default(false),
  isRecurring: boolean("is_recurring").default(false),
  recurringMonths: integer("recurring_months"),
  recurringGroupId: varchar("recurring_group_id", { length: 50 }),
  isRefund: boolean("is_refund").default(false),
  isFraudSuspect: boolean("is_fraud_suspect").default(false),
  isCardBillPayment: boolean("is_card_bill_payment").default(false),
  installmentCurrent: integer("installment_current"),
  installmentTotal: integer("installment_total"),
  installmentGroupId: varchar("installment_group_id", { length: 50 }),
  cardBillMonth: varchar("card_bill_month", { length: 7 }),
  cardType: varchar("card_type", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const payables = pgTable("payables", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  description: varchar("description", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  status: payableStatusEnum("status").notNull().default("pendente"),
  categoryId: integer("category_id").references(() => categories.id),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  isInstallment: boolean("is_installment").default(false),
  installmentNumber: integer("installment_number"),
  totalInstallments: integer("total_installments"),
  parentPayableId: integer("parent_payable_id"),
  notes: text("notes"),
  paidAt: date("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const categorizationRules = pgTable("categorization_rules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  pattern: varchar("pattern", { length: 255 }).notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const budgetItems = pgTable("budget_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  description: varchar("description", { length: 255 }).notNull(),
  shortTitle: varchar("short_title", { length: 100 }),
  type: transactionTypeEnum("type").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  beneficiaryId: integer("beneficiary_id").references(() => beneficiaries.id),
  yearMonth: varchar("year_month", { length: 7 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  transactionDate: varchar("transaction_date", { length: 10 }),
  billDueDate: varchar("bill_due_date", { length: 10 }),
  isRecurring: boolean("is_recurring").default(false),
  recurringGroupId: varchar("recurring_group_id", { length: 50 }),
  isFromInstallment: boolean("is_from_installment").default(false),
  installmentGroupId: varchar("installment_group_id", { length: 50 }),
  installmentCurrent: integer("installment_current"),
  installmentTotal: integer("installment_total"),
  source: varchar("source", { length: 50 }).default("manual"),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
