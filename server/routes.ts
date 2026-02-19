import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import {
  insertCategorySchema,
  insertSubcategorySchema,
  insertBankAccountSchema,
  insertBeneficiarySchema,
  insertTransactionSchema,
  insertPayableSchema,
  categories,
  subcategories,
  bankAccounts,
  beneficiaries,
  transactions,
  payables,
  categorizationRules,
  budgetItems,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { db } from "./storage";
import { sql } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage() });

function parseAmount(value: unknown): string {
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string") {
    const num = parseFloat(value.replace(",", "."));
    return isNaN(num) ? "0" : num.toFixed(2);
  }
  return "0";
}

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : parseInt(String(value));
  return isNaN(num) ? null : num;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await storage.seedData();

  app.get("/api/download/sqlite-version", (req, res) => {
    const zipPath = path.join(process.env.HOME || "/home/runner", "personal-finance-sqlite.zip");
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ message: "Arquivo ZIP nao encontrado. Gere o pacote primeiro." });
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=personal-finance-sqlite.zip");
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
  });

  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const refMonth = req.query.refMonth as string | undefined;
      const stats = await storage.getDashboardStats(refMonth);
      
      // Se não temos saldo do extrato em memória, tentar ler do arquivo
      if (stats.saldoExtrato === null) {
        const attachedDir = path.join(process.cwd(), "attached_assets");
        if (fs.existsSync(attachedDir)) {
          const files = fs.readdirSync(attachedDir);
          const extratoFile = files.find(f => f.toLowerCase().includes("extrato") && f.endsWith(".xls"));
          if (extratoFile) {
            try {
              const buffer = fs.readFileSync(path.join(attachedDir, extratoFile));
              const workbook = XLSX.read(buffer, { type: "buffer" });
              const sheet = workbook.Sheets[workbook.SheetNames[0]];
              const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
              
              // Procurar último "SALDO TOTAL DISPONÍVEL" antes de "lançamentos futuros"
              let lastSaldo: number | null = null;
              let foundFutureLancamentos = false;
              
              for (let r = range.s.r; r <= range.e.r; r++) {
                const cellB = sheet["B" + (r + 1)];
                const cellE = sheet["E" + (r + 1)];
                const desc = cellB?.v?.toString() || "";
                
                if (desc.toLowerCase().includes("lançamentos futuros") || desc.toLowerCase().includes("lancamentos futuros")) {
                  foundFutureLancamentos = true;
                  break;
                }
                
                if (desc.includes("SALDO TOTAL DISPON") && cellE && typeof cellE.v === "number") {
                  lastSaldo = cellE.v;
                }
              }
              
              if (lastSaldo !== null) {
                stats.saldoExtrato = lastSaldo;
                await storage.setSaldoExtrato(lastSaldo);
              }
            } catch (e) {
              console.error("Error reading extrato balance:", e);
            }
          }
        }
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      res.status(500).json({ error: "Failed to get dashboard stats" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error getting categories:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const parsed = insertCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const category = await storage.createCategory(parsed.data);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.updateCategory(id, req.body);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  app.get("/api/subcategories", async (req, res) => {
    try {
      const subcategories = await storage.getSubcategories();
      res.json(subcategories);
    } catch (error) {
      console.error("Error getting subcategories:", error);
      res.status(500).json({ error: "Failed to get subcategories" });
    }
  });

  app.post("/api/subcategories", async (req, res) => {
    try {
      const data = {
        ...req.body,
        categoryId: parseOptionalInt(req.body.categoryId),
      };
      const parsed = insertSubcategorySchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const subcategory = await storage.createSubcategory(parsed.data);
      res.json(subcategory);
    } catch (error) {
      console.error("Error creating subcategory:", error);
      res.status(500).json({ error: "Failed to create subcategory" });
    }
  });

  app.patch("/api/subcategories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.updateSubcategory(id, req.body);
      if (!subcategory) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      res.json(subcategory);
    } catch (error) {
      console.error("Error updating subcategory:", error);
      res.status(500).json({ error: "Failed to update subcategory" });
    }
  });

  app.delete("/api/subcategories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSubcategory(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      res.status(500).json({ error: "Failed to delete subcategory" });
    }
  });

  app.get("/api/bank-accounts", async (req, res) => {
    try {
      const accounts = await storage.getBankAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Error getting bank accounts:", error);
      res.status(500).json({ error: "Failed to get bank accounts" });
    }
  });

  app.post("/api/bank-accounts", async (req, res) => {
    try {
      const data = {
        ...req.body,
        balance: parseAmount(req.body.balance),
      };
      const parsed = insertBankAccountSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const account = await storage.createBankAccount(parsed.data);
      res.json(account);
    } catch (error) {
      console.error("Error creating bank account:", error);
      res.status(500).json({ error: "Failed to create bank account" });
    }
  });

  app.patch("/api/bank-accounts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const account = await storage.updateBankAccount(id, req.body);
      if (!account) {
        return res.status(404).json({ error: "Bank account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error updating bank account:", error);
      res.status(500).json({ error: "Failed to update bank account" });
    }
  });

  app.delete("/api/bank-accounts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBankAccount(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bank account:", error);
      res.status(500).json({ error: "Failed to delete bank account" });
    }
  });

  // Beneficiaries routes
  app.get("/api/beneficiaries", async (req, res) => {
    try {
      const beneficiaries = await storage.getBeneficiaries();
      res.json(beneficiaries);
    } catch (error) {
      console.error("Error getting beneficiaries:", error);
      res.status(500).json({ error: "Failed to get beneficiaries" });
    }
  });

  app.get("/api/beneficiaries/default", async (req, res) => {
    try {
      const beneficiary = await storage.getDefaultBeneficiary();
      res.json(beneficiary || null);
    } catch (error) {
      console.error("Error getting default beneficiary:", error);
      res.status(500).json({ error: "Failed to get default beneficiary" });
    }
  });

  app.post("/api/beneficiaries", async (req, res) => {
    try {
      const parsed = insertBeneficiarySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const beneficiary = await storage.createBeneficiary(parsed.data);
      res.json(beneficiary);
    } catch (error) {
      console.error("Error creating beneficiary:", error);
      res.status(500).json({ error: "Failed to create beneficiary" });
    }
  });

  app.patch("/api/beneficiaries/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const beneficiary = await storage.updateBeneficiary(id, req.body);
      if (!beneficiary) {
        return res.status(404).json({ error: "Beneficiary not found" });
      }
      res.json(beneficiary);
    } catch (error) {
      console.error("Error updating beneficiary:", error);
      res.status(500).json({ error: "Failed to update beneficiary" });
    }
  });

  app.delete("/api/beneficiaries/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBeneficiary(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting beneficiary:", error);
      res.status(500).json({ error: "Failed to delete beneficiary" });
    }
  });

  app.post("/api/beneficiaries/:id/set-default", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.setDefaultBeneficiary(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting default beneficiary:", error);
      res.status(500).json({ error: "Failed to set default beneficiary" });
    }
  });

  app.post("/api/beneficiaries/set-default-for-existing", async (req, res) => {
    try {
      await storage.setDefaultBeneficiaryForExisting();
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting default beneficiary:", error);
      res.status(500).json({ error: "Failed to set default beneficiary" });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error getting transactions:", error);
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  app.get("/api/transactions/uncategorized", async (req, res) => {
    try {
      const transactions = await storage.getUncategorizedTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error getting uncategorized transactions:", error);
      res.status(500).json({ error: "Failed to get uncategorized transactions" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const recurringMonths = req.body.recurringMonths ? parseInt(req.body.recurringMonths) : null;
      const data = {
        ...req.body,
        amount: parseAmount(req.body.amount),
        categoryId: parseOptionalInt(req.body.categoryId),
        subcategoryId: parseOptionalInt(req.body.subcategoryId),
        bankAccountId: parseOptionalInt(req.body.bankAccountId),
        recurringMonths: null, // Don't store in individual transactions
      };
      const parsed = insertTransactionSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }

      // If recurring with months specified, create multiple transactions
      if (parsed.data.isRecurring && recurringMonths && recurringMonths > 1) {
        const recurringGroupId = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const baseDate = new Date(parsed.data.date);
        const createdTransactions = [];

        for (let i = 0; i < recurringMonths; i++) {
          const transactionDate = new Date(baseDate);
          transactionDate.setMonth(transactionDate.getMonth() + i);
          
          const transactionData = {
            ...parsed.data,
            date: transactionDate.toISOString().split("T")[0],
            recurringGroupId,
            recurringMonths,
            // First month is "realizada" if original status is, rest are "prevista"
            status: i === 0 ? parsed.data.status : "prevista" as const,
          };
          
          const transaction = await storage.createTransaction(transactionData);
          createdTransactions.push(transaction);
        }

        res.json(createdTransactions[0]); // Return first transaction
      } else {
        const transaction = await storage.createTransaction(parsed.data);
        res.json(transaction);
      }
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.updateTransaction(id, req.body);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  app.patch("/api/transactions/:id/categorize", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { categoryId, subcategoryId } = req.body;
      const transaction = await storage.categorizeTransaction(id, categoryId, subcategoryId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      // Auto-sync budget items if transaction has installments
      if (transaction.installmentGroupId) {
        await storage.syncBudgetItemsForGroup(transaction.installmentGroupId, {
          categoryId: transaction.categoryId,
          subcategoryId: transaction.subcategoryId,
          beneficiaryId: transaction.beneficiaryId,
        });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Error categorizing transaction:", error);
      res.status(500).json({ error: "Failed to categorize transaction" });
    }
  });

  app.post("/api/transactions/fraud-group", async (req, res) => {
    try {
      const { installmentGroupId, isFraudSuspect } = req.body;
      if (!installmentGroupId) {
        return res.status(400).json({ error: "installmentGroupId is required" });
      }
      const updated = await storage.updateFraudByGroup(installmentGroupId, isFraudSuspect);
      res.json({ updated });
    } catch (error) {
      console.error("Error updating fraud by group:", error);
      res.status(500).json({ error: "Failed to update fraud status" });
    }
  });

  app.post("/api/transactions/categorize-batch", async (req, res) => {
    try {
      const { items } = req.body;
      await storage.categorizeBatch(items);
      
      // Auto-sync budget items for any transactions with installments
      for (const item of items) {
        const transaction = await storage.getTransaction(item.id);
        if (transaction?.installmentGroupId) {
          await storage.syncBudgetItemsForGroup(transaction.installmentGroupId, {
            categoryId: transaction.categoryId,
            subcategoryId: transaction.subcategoryId,
            beneficiaryId: transaction.beneficiaryId,
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error categorizing batch:", error);
      res.status(500).json({ error: "Failed to categorize batch" });
    }
  });

  app.post("/api/transactions/update-beneficiary-batch", async (req, res) => {
    try {
      const { ids, beneficiaryId } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      for (const id of ids) {
        await storage.updateTransaction(id, { beneficiaryId: beneficiaryId || null });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating beneficiary batch:", error);
      res.status(500).json({ error: "Failed to update beneficiary batch" });
    }
  });

  app.post("/api/transactions/update-short-title-batch", async (req, res) => {
    try {
      const { ids, shortTitle } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      if (typeof shortTitle !== "string") {
        return res.status(400).json({ error: "shortTitle is required" });
      }
      for (const id of ids) {
        await storage.updateTransaction(id, { shortTitle: shortTitle || null });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating short title batch:", error);
      res.status(500).json({ error: "Failed to update short title batch" });
    }
  });

  app.post("/api/transactions/delete-batch", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      await storage.deleteTransactionsByIds(ids);
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
      console.error("Error batch deleting transactions:", error);
      res.status(500).json({ error: "Failed to batch delete transactions" });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTransaction(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  app.get("/api/payables", async (req, res) => {
    try {
      const payables = await storage.getPayables();
      res.json(payables);
    } catch (error) {
      console.error("Error getting payables:", error);
      res.status(500).json({ error: "Failed to get payables" });
    }
  });

  app.post("/api/payables", async (req, res) => {
    try {
      const data = {
        ...req.body,
        amount: parseAmount(req.body.amount),
        categoryId: parseOptionalInt(req.body.categoryId),
        subcategoryId: parseOptionalInt(req.body.subcategoryId),
        totalInstallments: parseOptionalInt(req.body.totalInstallments),
      };
      const parsed = insertPayableSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).message });
      }
      const payable = await storage.createPayable(parsed.data);
      res.json(payable);
    } catch (error) {
      console.error("Error creating payable:", error);
      res.status(500).json({ error: "Failed to create payable" });
    }
  });

  app.patch("/api/payables/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const payable = await storage.updatePayable(id, req.body);
      if (!payable) {
        return res.status(404).json({ error: "Payable not found" });
      }
      res.json(payable);
    } catch (error) {
      console.error("Error updating payable:", error);
      res.status(500).json({ error: "Failed to update payable" });
    }
  });

  app.patch("/api/payables/:id/pay", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const payable = await storage.markPayableAsPaid(id);
      if (!payable) {
        return res.status(404).json({ error: "Payable not found" });
      }
      res.json(payable);
    } catch (error) {
      console.error("Error marking payable as paid:", error);
      res.status(500).json({ error: "Failed to mark payable as paid" });
    }
  });

  app.delete("/api/payables/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePayable(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting payable:", error);
      res.status(500).json({ error: "Failed to delete payable" });
    }
  });

  app.get("/api/categorization-rules", async (req, res) => {
    try {
      const rules = await storage.getCategorizationRules();
      res.json(rules);
    } catch (error) {
      console.error("Error getting rules:", error);
      res.status(500).json({ error: "Failed to get rules" });
    }
  });

  app.post("/api/categorization-rules", async (req, res) => {
    try {
      const data = {
        ...req.body,
        categoryId: parseOptionalInt(req.body.categoryId),
        subcategoryId: parseOptionalInt(req.body.subcategoryId),
      };
      const rule = await storage.createCategorizationRule(data);
      res.json(rule);
    } catch (error) {
      console.error("Error creating rule:", error);
      res.status(500).json({ error: "Failed to create rule" });
    }
  });

  app.delete("/api/categorization-rules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategorizationRule(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rule:", error);
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });

  // Budget Items (Planejamento)
  app.get("/api/transactions/aggregates-by-month", async (req, res) => {
    try {
      const monthsParam = req.query.months as string;
      if (!monthsParam) {
        return res.status(400).json({ error: "months parameter required (comma-separated YYYY-MM)" });
      }
      const months = monthsParam.split(",").map(m => m.trim());
      const result = await storage.getTransactionAggregatesByMonth(months);
      res.json(result);
    } catch (error) {
      console.error("Error getting transaction aggregates:", error);
      res.status(500).json({ error: "Failed to get transaction aggregates" });
    }
  });

  app.get("/api/budget-items", async (req, res) => {
    try {
      const items = await storage.getBudgetItems();
      res.json(items);
    } catch (error) {
      console.error("Error getting budget items:", error);
      res.status(500).json({ error: "Failed to get budget items" });
    }
  });

  app.post("/api/budget-items", async (req, res) => {
    try {
      const data = {
        ...req.body,
        categoryId: parseOptionalInt(req.body.categoryId),
        subcategoryId: parseOptionalInt(req.body.subcategoryId),
        beneficiaryId: parseOptionalInt(req.body.beneficiaryId),
      };
      const item = await storage.createBudgetItem(data);
      res.json(item);
    } catch (error) {
      console.error("Error creating budget item:", error);
      res.status(500).json({ error: "Failed to create budget item" });
    }
  });

  app.post("/api/budget-items/batch", async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items must be an array" });
      }
      const processedItems = items.map((item: any) => ({
        ...item,
        categoryId: parseOptionalInt(item.categoryId),
        subcategoryId: parseOptionalInt(item.subcategoryId),
        beneficiaryId: parseOptionalInt(item.beneficiaryId),
      }));
      const created = await storage.createBudgetItems(processedItems);
      res.json(created);
    } catch (error) {
      console.error("Error creating budget items batch:", error);
      res.status(500).json({ error: "Failed to create budget items" });
    }
  });

  app.patch("/api/budget-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const syncFutureMonths = req.body.syncFutureMonths === true;
      const { syncFutureMonths: _, ...bodyData } = req.body;
      const data = {
        ...bodyData,
        categoryId: parseOptionalInt(bodyData.categoryId),
        subcategoryId: parseOptionalInt(bodyData.subcategoryId),
        beneficiaryId: parseOptionalInt(bodyData.beneficiaryId),
      };
      const item = await storage.updateBudgetItem(id, data);
      
      let syncedCount = 0;
      if (syncFutureMonths && item && item.recurringGroupId) {
        const syncFields: any = {};
        if (data.description !== undefined) syncFields.description = data.description;
        if (data.shortTitle !== undefined) syncFields.shortTitle = data.shortTitle;
        if (data.type !== undefined) syncFields.type = data.type;
        if (data.categoryId !== undefined) syncFields.categoryId = data.categoryId;
        if (data.subcategoryId !== undefined) syncFields.subcategoryId = data.subcategoryId;
        if (data.beneficiaryId !== undefined) syncFields.beneficiaryId = data.beneficiaryId;
        if (data.amount !== undefined) syncFields.amount = data.amount;
        if (data.notes !== undefined) syncFields.notes = data.notes;
        
        if (Object.keys(syncFields).length > 0) {
          syncedCount = await storage.syncRecurringBudgetItems(item, syncFields);
        }
      }
      
      res.json({ ...item, syncedCount });
    } catch (error) {
      console.error("Error updating budget item:", error);
      res.status(500).json({ error: "Failed to update budget item" });
    }
  });

  app.delete("/api/budget-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBudgetItem(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting budget item:", error);
      res.status(500).json({ error: "Failed to delete budget item" });
    }
  });

  app.post("/api/budget-items/categorize-batch", async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items array is required" });
      }
      for (const item of items) {
        await storage.updateBudgetItem(item.id, {
          categoryId: item.categoryId || null,
          subcategoryId: item.subcategoryId || null,
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error categorizing budget items batch:", error);
      res.status(500).json({ error: "Failed to categorize budget items batch" });
    }
  });

  app.post("/api/budget-items/update-short-title-batch", async (req, res) => {
    try {
      const schema = z.object({
        ids: z.array(z.number()).min(1),
        shortTitle: z.string(),
      });
      const parsed = schema.parse(req.body);
      for (const id of parsed.ids) {
        await storage.updateBudgetItem(id, { shortTitle: parsed.shortTitle || null });
      }
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating budget item short title batch:", error);
      res.status(500).json({ error: "Failed to update short title batch" });
    }
  });

  app.post("/api/budget-items/delete-batch", async (req, res) => {
    try {
      const schema = z.object({
        ids: z.array(z.number()).min(1),
      });
      const parsed = schema.parse(req.body);
      await storage.deleteBudgetItemsByIds(parsed.ids);
      res.json({ success: true, deleted: parsed.ids.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error batch deleting budget items:", error);
      res.status(500).json({ error: "Failed to batch delete budget items" });
    }
  });

  app.post("/api/budget-items/update-beneficiary-batch", async (req, res) => {
    try {
      const { ids, beneficiaryId } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      for (const id of ids) {
        await storage.updateBudgetItem(id, { beneficiaryId: beneficiaryId || null });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating budget item beneficiary batch:", error);
      res.status(500).json({ error: "Failed to update budget item beneficiary batch" });
    }
  });

  app.post("/api/budget-items/sync-installments", async (req, res) => {
    try {
      const count = await storage.syncInstallmentsToBudget();
      res.json({ synced: count, message: `${count} parcelamentos sincronizados` });
    } catch (error) {
      console.error("Error syncing installments:", error);
      res.status(500).json({ error: "Failed to sync installments" });
    }
  });

  app.get("/api/budget-items/suggestions", async (req, res) => {
    try {
      const categoryId = parseOptionalInt(req.query.categoryId);
      const subcategoryId = parseOptionalInt(req.query.subcategoryId);
      const suggestions = await storage.getHistoricalSuggestions(categoryId ?? undefined, subcategoryId ?? undefined);
      res.json(suggestions);
    } catch (error) {
      console.error("Error getting suggestions:", error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });

  app.get("/api/budget-items/autocomplete", async (req, res) => {
    try {
      const type = req.query.type as "receita" | "despesa";
      const searchText = (req.query.search as string) || "";
      if (!type || !["receita", "despesa"].includes(type)) {
        return res.status(400).json({ error: "Invalid type parameter" });
      }
      if (searchText.length < 1) {
        return res.json([]);
      }
      const suggestions = await storage.getAutocompleteSuggestions(type, searchText);
      res.json(suggestions);
    } catch (error) {
      console.error("Error getting autocomplete suggestions:", error);
      res.status(500).json({ error: "Failed to get autocomplete suggestions" });
    }
  });

  app.post("/api/import/excel", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileName = req.file.originalname.toLowerCase();
      const isCSV = fileName.endsWith('.csv');
      
      let data: any[][];
      
      if (isCSV) {
        const csvContent = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
        data = csvContent.split('\n').filter(line => line.trim()).map(line => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (const char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          return values;
        });
      } else {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      }

      const importType = req.body.type || "extrato";
      
      // Parâmetros de mapeamento de colunas (podem vir do frontend)
      let dateCol = req.body.dateCol !== undefined ? parseInt(req.body.dateCol) : -1;
      let descCol = req.body.descCol !== undefined ? parseInt(req.body.descCol) : -1;
      let amountCol = req.body.amountCol !== undefined ? parseInt(req.body.amountCol) : -1;
      let startRow = req.body.startRow !== undefined ? parseInt(req.body.startRow) : -1;
      
      // Detecção automática de colunas e linha inicial
      function detectColumns(data: any[][]): { dateCol: number; descCol: number; amountCol: number; startRow: number } {
        for (let i = 0; i < Math.min(data.length, 20); i++) {
          const row = data[i];
          if (!row) continue;
          const rowStr = row.map(c => String(c || '').toLowerCase().trim());
          const dataIdx = rowStr.findIndex(c => c === 'data' || c.includes('data'));
          const descIdx = rowStr.findIndex(c => c.includes('lan') || c.includes('descr') || c.includes('historico'));
          const valorIdx = rowStr.findIndex(c => c.includes('valor') && !c.includes('saldo'));
          if (dataIdx >= 0 && descIdx >= 0 && valorIdx >= 0) {
            return { dateCol: dataIdx, descCol: descIdx, amountCol: valorIdx, startRow: i + 1 };
          }
        }
        for (let i = 0; i < Math.min(data.length, 20); i++) {
          const row = data[i];
          if (!row || row.length < 3) continue;
          let hasDate = false, dateColGuess = -1, amountColGuess = -1;
          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (!hasDate) {
              if (typeof cell === 'number' && cell > 40000 && cell < 50000) { hasDate = true; dateColGuess = j; }
              else if (typeof cell === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(cell.trim())) { hasDate = true; dateColGuess = j; }
            }
            if (typeof cell === 'number' && cell !== 0 && Math.abs(cell) < 1000000) { amountColGuess = j; }
            else if (typeof cell === 'string') {
              const parsed = parseFloat(cell.replace('.', '').replace(',', '.').replace(/[^\d.-]/g, ''));
              if (!isNaN(parsed) && parsed !== 0 && Math.abs(parsed) < 1000000) { amountColGuess = j; }
            }
          }
          if (hasDate && dateColGuess >= 0 && amountColGuess >= 0) {
            const descColGuess = dateColGuess + 1;
            if (descColGuess < amountColGuess) return { dateCol: dateColGuess, descCol: descColGuess, amountCol: amountColGuess, startRow: i };
          }
        }
        return { dateCol: 0, descCol: 1, amountCol: 2, startRow: 1 };
      }
      
      if (dateCol < 0 || descCol < 0 || amountCol < 0 || startRow < 0) {
        const detected = detectColumns(data);
        if (dateCol < 0) dateCol = detected.dateCol;
        if (descCol < 0) descCol = detected.descCol;
        if (amountCol < 0) amountCol = detected.amountCol;
        if (startRow < 0) startRow = detected.startRow;
      }
      
      // Buscar beneficiário padrão
      const defaultBeneficiary = await storage.getDefaultBeneficiary();
      const defaultBeneficiaryId = defaultBeneficiary?.id || null;
      
      // Buscar ou criar contas de pagamento corretas
      const bankAccounts = await storage.getBankAccounts();
      let bankAccountId: number;
      
      if (importType === "cartao") {
        // Cartão de crédito
        let cartaoAccount = bankAccounts.find(a => a.name === "Cartão Itaú Personnalite");
        if (!cartaoAccount) {
          cartaoAccount = await storage.createBankAccount({
            name: "Cartão Itaú Personnalite",
            type: "credit_card",
            balance: "0",
            active: true,
          });
        }
        bankAccountId = cartaoAccount.id;
      } else {
        // Extrato = Débito
        let debitoAccount = bankAccounts.find(a => a.name === "Débito");
        if (!debitoAccount) {
          debitoAccount = await storage.createBankAccount({
            name: "Débito",
            type: "checking",
            balance: "0",
            active: true,
          });
        }
        bankAccountId = debitoAccount.id;
      }

      let imported = 0;
      const errors: string[] = [];

      function parseInstallment(desc: string): { current: number | null; total: number | null; cleanDesc: string } {
        const patterns = [
          /(\d{2})\/(\d{2})$/,
          /\s+(\d{2})\/(\d{2})$/,
        ];
        for (const pattern of patterns) {
          const match = desc.match(pattern);
          if (match) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);
            if (current <= total && total <= 24) {
              return { 
                current, 
                total, 
                cleanDesc: desc.replace(pattern, '').trim() 
              };
            }
          }
        }
        return { current: null, total: null, cleanDesc: desc };
      }

      function generateShortTitle(desc: string): string {
        let title = desc
          .replace(/\*+/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/\d{2}\/\d{2}$/, '')
          .trim();
        
        const knownPrefixes = ['MP ', 'PIX ', 'TED ', 'DOC ', 'PAG ', 'DL ', 'EC '];
        for (const prefix of knownPrefixes) {
          if (title.toUpperCase().startsWith(prefix)) {
            title = title.substring(prefix.length);
            break;
          }
        }
        
        if (title.length > 50) {
          title = title.substring(0, 47) + '...';
        }
        
        return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
      }

      function isRefundByPattern(desc: string): boolean {
        const refundPatterns = ['ESTORNO', 'DEVOLUCAO', 'REVERSAL'];
        return refundPatterns.some(p => desc.toUpperCase().includes(p));
      }
      
      function shouldSkipTransaction(desc: string): boolean {
        const skipPatterns = ['PAGAMENTO EFETUADO', 'SALDO TOTAL', 'SALDO ANTERIOR', 'SALDO DISPONIVEL', 'SALDO DISPONÍVEL'];
        return skipPatterns.some(p => desc.toUpperCase().includes(p));
      }
      
      function isFutureSectionHeader(desc: string): boolean {
        const futureHeaders = [
          'SAÍDAS FUTURAS', 'SAIDAS FUTURAS', 
          'ENTRADAS FUTURAS', 
          'LANÇAMENTOS FUTUROS', 'LANCAMENTOS FUTUROS'
        ];
        const descUpper = desc.toUpperCase().trim();
        return futureHeaders.some(h => descUpper.includes(h));
      }

      let inFutureSection = false;
      let lastValidDate: Date | null = null;
      
      for (let i = startRow; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length <= Math.max(dateCol, descCol, amountCol)) continue;

        try {
          let dateValue = row[dateCol];
          let description = String(row[descCol] || "").trim();
          let amountValue = row[amountCol];

          if (!description) {
            errors.push(`Linha ${i + 1}: Descricao vazia`);
            continue;
          }
          
          // Aplicar regra de seção futura apenas para extratos, não faturas de cartão
          if (importType !== "cartao") {
            if (isFutureSectionHeader(description)) {
              inFutureSection = true;
              continue;
            }
            
            if (inFutureSection) {
              continue;
            }
          }
          
          if (shouldSkipTransaction(description)) {
            continue;
          }

          let date: Date;
          if (typeof dateValue === "number") {
            date = new Date((dateValue - 25569) * 86400 * 1000);
          } else if (typeof dateValue === "string") {
            if (dateValue.includes('-')) {
              date = new Date(dateValue);
            } else {
              const parts = dateValue.split("/");
              if (parts.length === 3) {
                date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              } else {
                date = new Date(dateValue);
              }
            }
          } else {
            errors.push(`Linha ${i + 1}: Data invalida`);
            continue;
          }

          if (isNaN(date.getTime())) {
            errors.push(`Linha ${i + 1}: Data invalida`);
            continue;
          }
          
          // Para extratos (não cartão): detectar lançamentos futuros por salto de data
          // Se a data pular mais de 30 dias para frente, é uma seção futura
          if (importType !== "cartao" && !inFutureSection) {
            if (lastValidDate) {
              const daysDiff = Math.floor((date.getTime() - lastValidDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysDiff > 30) {
                console.log(`[Validate] Detected future section at row ${i}: date jumped from ${lastValidDate.toISOString().split('T')[0]} to ${date.toISOString().split('T')[0]} (${daysDiff} days)`);
                inFutureSection = true;
                continue;
              }
            }
            lastValidDate = date;
          }

          let amount = typeof amountValue === "number" 
            ? amountValue 
            : parseFloat(String(amountValue).replace(",", ".").replace(/[^\d.-]/g, ""));

          if (isNaN(amount)) {
            errors.push(`Linha ${i + 1}: Valor invalido`);
            continue;
          }

          let type: "receita" | "despesa";
          let isRefund = false;
          
          if (importType === "cartao") {
            // Fatura de cartão: positivo = despesa, negativo = estorno/receita
            if (amount < 0) {
              isRefund = true;
              type = "receita";
            } else {
              type = "despesa";
            }
          } else {
            // Extrato bancário: negativo = despesa (saída), positivo = receita (entrada)
            if (amount < 0) {
              type = "despesa";
              isRefund = false;
            } else {
              type = "receita";
              isRefund = false;
            }
          }
          amount = Math.abs(amount);

          const { current: installmentCurrent, total: installmentTotal, cleanDesc } = parseInstallment(description);
          const shortTitle = generateShortTitle(cleanDesc);
          const matchingRule = await storage.findMatchingRule(description);

          const transactionDateStr = date.toISOString().split("T")[0];
          let paymentDateStr = transactionDateStr;
          
          // Para cartão, calcular data de vencimento da fatura (dia 9 do mês seguinte)
          if (importType === "cartao") {
            const txDay = date.getDate();
            let baseMonth: number;
            let baseYear: number;
            if (txDay <= 2) {
              baseMonth = date.getMonth();
              baseYear = date.getFullYear();
            } else {
              baseMonth = date.getMonth() + 1;
              baseYear = date.getFullYear();
            }
            const installmentOffset = installmentCurrent ? (installmentCurrent - 1) : 0;
            const paymentDate = new Date(baseYear, baseMonth + installmentOffset, 9);
            paymentDateStr = paymentDate.toISOString().split("T")[0];
          }
          
          await storage.createTransaction({
            description: cleanDesc,
            originalDescription: description,
            shortTitle,
            amount: amount.toFixed(2),
            type: importType === "cartao" ? "despesa" : type,
            status: "realizada",
            date: transactionDateStr,
            transactionDate: transactionDateStr,
            paymentDate: paymentDateStr,
            bankAccountId,
            beneficiaryId: defaultBeneficiaryId,
            categoryId: matchingRule?.categoryId || null,
            subcategoryId: matchingRule?.subcategoryId || null,
            needsCategorization: !matchingRule,
            isRefund,
            installmentCurrent,
            installmentTotal,
            importedFrom: req.file.originalname,
            importedFromRow: i + 1,
            source: importType === "cartao" ? "cartao" : "conta_corrente",
          });

          imported++;
        } catch (err) {
          errors.push(`Linha ${i + 1}: Erro ao processar`);
        }
      }

      res.json({
        success: errors.length === 0,
        imported,
        errors,
      });
    } catch (error) {
      console.error("Error importing Excel:", error);
      res.status(500).json({ error: "Failed to import Excel file" });
    }
  });

  // Preview endpoint - processa arquivo mas não insere no banco
  app.post("/api/import/preview", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileName = req.file.originalname.toLowerCase();
      const isCSV = fileName.endsWith('.csv');
      
      let data: any[][];
      
      if (isCSV) {
        const csvContent = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
        data = csvContent.split('\n').filter(line => line.trim()).map(line => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (const char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          return values;
        });
      } else {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      }

      const importType = req.body.type || "extrato";
      
      // Parâmetros de mapeamento de colunas (podem vir do frontend)
      let dateCol = req.body.dateCol !== undefined ? parseInt(req.body.dateCol) : -1;
      let descCol = req.body.descCol !== undefined ? parseInt(req.body.descCol) : -1;
      let amountCol = req.body.amountCol !== undefined ? parseInt(req.body.amountCol) : -1;
      let startRow = req.body.startRow !== undefined ? parseInt(req.body.startRow) : -1;
      
      // Detecção automática de colunas e linha inicial
      function detectColumns(data: any[][]): { dateCol: number; descCol: number; amountCol: number; startRow: number } {
        // Procurar linha de cabeçalho
        for (let i = 0; i < Math.min(data.length, 20); i++) {
          const row = data[i];
          if (!row) continue;
          
          const rowStr = row.map(c => String(c || '').toLowerCase().trim());
          
          // Procurar cabeçalho com "data", "lançamento/lancamento", "valor"
          const dataIdx = rowStr.findIndex(c => c === 'data' || c.includes('data'));
          const descIdx = rowStr.findIndex(c => c.includes('lan') || c.includes('descr') || c.includes('historico'));
          const valorIdx = rowStr.findIndex(c => c.includes('valor') && !c.includes('saldo'));
          
          if (dataIdx >= 0 && descIdx >= 0 && valorIdx >= 0) {
            return { dateCol: dataIdx, descCol: descIdx, amountCol: valorIdx, startRow: i + 1 };
          }
        }
        
        // Fallback: tentar detectar pela estrutura dos dados
        for (let i = 0; i < Math.min(data.length, 20); i++) {
          const row = data[i];
          if (!row || row.length < 3) continue;
          
          // Procurar primeira linha com data válida
          let hasDate = false;
          let dateColGuess = -1;
          let amountColGuess = -1;
          
          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            // Verificar se é data (número Excel ou string dd/mm/yyyy)
            if (!hasDate) {
              if (typeof cell === 'number' && cell > 40000 && cell < 50000) {
                hasDate = true;
                dateColGuess = j;
              } else if (typeof cell === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(cell.trim())) {
                hasDate = true;
                dateColGuess = j;
              }
            }
            // Verificar se é valor numérico (pode ser negativo)
            if (typeof cell === 'number' && cell !== 0 && Math.abs(cell) < 1000000) {
              amountColGuess = j;
            } else if (typeof cell === 'string') {
              const parsed = parseFloat(cell.replace('.', '').replace(',', '.').replace(/[^\d.-]/g, ''));
              if (!isNaN(parsed) && parsed !== 0 && Math.abs(parsed) < 1000000) {
                amountColGuess = j;
              }
            }
          }
          
          if (hasDate && dateColGuess >= 0 && amountColGuess >= 0) {
            // Descrição geralmente está entre data e valor
            const descColGuess = dateColGuess + 1;
            if (descColGuess < amountColGuess) {
              return { dateCol: dateColGuess, descCol: descColGuess, amountCol: amountColGuess, startRow: i };
            }
          }
        }
        
        // Fallback padrão: colunas 0, 1, 2 começando na linha 1
        return { dateCol: 0, descCol: 1, amountCol: 2, startRow: 1 };
      }
      
      // Se não foram passados parâmetros, detectar automaticamente
      if (dateCol < 0 || descCol < 0 || amountCol < 0 || startRow < 0) {
        const detected = detectColumns(data);
        if (dateCol < 0) dateCol = detected.dateCol;
        if (descCol < 0) descCol = detected.descCol;
        if (amountCol < 0) amountCol = detected.amountCol;
        if (startRow < 0) startRow = detected.startRow;
      }
      
      // Debug: Log primeiras linhas para diagnóstico
      console.log(`[Import Debug] File: ${file.originalname}, Type: ${importType}`);
      console.log(`[Import Debug] Detected: dateCol=${dateCol}, descCol=${descCol}, amountCol=${amountCol}, startRow=${startRow}`);
      if (data.length > startRow) {
        console.log(`[Import Debug] Sample row ${startRow}:`, JSON.stringify(data[startRow]));
        if (data.length > startRow + 1) {
          console.log(`[Import Debug] Sample row ${startRow + 1}:`, JSON.stringify(data[startRow + 1]));
        }
      }
      
      const transactions: Array<{
        date: string;
        description: string;
        shortTitle: string;
        amount: string;
        type: string;
        isRefund: boolean;
        installmentCurrent: number | null;
        installmentTotal: number | null;
        categoryName: string | null;
        subcategoryName: string | null;
        hasRule: boolean;
      }> = [];
      const errors: string[] = [];
      
      // Informações de detecção para o frontend
      const columnMapping = { dateCol, descCol, amountCol, startRow };

      function parseInstallment(desc: string): { current: number | null; total: number | null; cleanDesc: string } {
        const patterns = [/(\d{2})\/(\d{2})$/, /\s+(\d{2})\/(\d{2})$/];
        for (const pattern of patterns) {
          const match = desc.match(pattern);
          if (match) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);
            if (current <= total && total <= 24) {
              return { current, total, cleanDesc: desc.replace(pattern, '').trim() };
            }
          }
        }
        return { current: null, total: null, cleanDesc: desc };
      }

      function generateShortTitle(desc: string): string {
        let title = desc.replace(/\*+/g, ' ').replace(/\s+/g, ' ').replace(/\d{2}\/\d{2}$/, '').trim();
        const knownPrefixes = ['MP ', 'PIX ', 'TED ', 'DOC ', 'PAG ', 'DL ', 'EC '];
        for (const prefix of knownPrefixes) {
          if (title.toUpperCase().startsWith(prefix)) {
            title = title.substring(prefix.length);
            break;
          }
        }
        if (title.length > 50) title = title.substring(0, 47) + '...';
        return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
      }

      function isRefundTransaction(desc: string, amount: number): boolean {
        if (amount < 0) return true;
        const refundPatterns = ['ESTORNO', 'DEVOLUCAO', 'REVERSAL'];
        return refundPatterns.some(p => desc.toUpperCase().includes(p));
      }
      
      function shouldSkipTransaction(desc: string): boolean {
        const skipPatterns = ['PAGAMENTO EFETUADO', 'SALDO TOTAL', 'SALDO ANTERIOR', 'SALDO DISPONIVEL', 'SALDO DISPONÍVEL'];
        return skipPatterns.some(p => desc.toUpperCase().includes(p));
      }
      
      function isFutureSectionHeader(desc: string): boolean {
        const futureHeaders = [
          'SAÍDAS FUTURAS', 'SAIDAS FUTURAS', 
          'ENTRADAS FUTURAS', 
          'LANÇAMENTOS FUTUROS', 'LANCAMENTOS FUTUROS'
        ];
        const descUpper = desc.toUpperCase().trim();
        return futureHeaders.some(h => descUpper.includes(h));
      }

      const categories = await storage.getCategories();
      const subcategories = await storage.getSubcategories();
      const isCartaoImport = importType === "cartao";
      
      let inFutureSection = false;
      let lastValidDate: Date | null = null;

      for (let i = startRow; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length <= Math.max(dateCol, descCol, amountCol)) continue;

        try {
          let dateValue = row[dateCol];
          let description = String(row[descCol] || "").trim();
          let amountValue = row[amountCol];

          // Ignorar cabeçalhos de seção do extrato Itaú (apenas para extratos, não faturas)
          if (!isCartaoImport) {
            const sectionHeaders = ["LANÇAMENTOS", "LANCAMENTOS"];
            const descUpper = description.toUpperCase().trim();
            if (sectionHeaders.some(h => descUpper === h)) continue;
            
            // Detectar início de seção futura e parar de importar (apenas para extratos)
            if (isFutureSectionHeader(description)) {
              inFutureSection = true;
              continue;
            }
            
            if (inFutureSection) continue;
          }

          if (!description) continue; // Linha sem descrição - pular
          
          if (shouldSkipTransaction(description)) continue;

          let date: Date;
          if (typeof dateValue === "number") {
            date = new Date((dateValue - 25569) * 86400 * 1000);
          } else if (typeof dateValue === "string" && dateValue.trim()) {
            if (dateValue.includes('-')) {
              date = new Date(dateValue);
            } else {
              const parts = dateValue.split("/");
              if (parts.length === 3) {
                date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              } else {
                date = new Date(dateValue);
              }
            }
          } else {
            continue; // Sem data válida - pular
          }

          if (isNaN(date.getTime())) continue;
          
          // Para extratos (não cartão): detectar lançamentos futuros por salto de data
          // Se a data pular mais de 30 dias para frente, é uma seção futura
          if (!isCartaoImport && !inFutureSection) {
            if (lastValidDate) {
              const daysDiff = Math.floor((date.getTime() - lastValidDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysDiff > 30) {
                console.log(`[Import] Detected future section at row ${i}: date jumped from ${lastValidDate.toISOString().split('T')[0]} to ${date.toISOString().split('T')[0]} (${daysDiff} days)`);
                inFutureSection = true;
                continue;
              }
            }
            lastValidDate = date;
          }

          let amount: number;
          if (typeof amountValue === "number") {
            amount = amountValue;
          } else if (amountValue !== null && amountValue !== undefined && String(amountValue).trim() !== '') {
            // Formato brasileiro: 1.234,56 (ponto milhar, vírgula decimal)
            let strValue = String(amountValue);
            strValue = strValue.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
            amount = parseFloat(strValue);
          } else {
            continue; // Valor vazio - pular
          }

          if (isNaN(amount) || amount === 0) continue;

          let isRefund = false;
          let type: string;
          
          if (isCartaoImport) {
            // Cartão: positivo = despesa, negativo = estorno
            if (amount < 0) {
              isRefund = true;
              type = "receita";
            } else {
              type = "despesa";
            }
          } else {
            // Extrato: negativo = despesa, positivo = receita
            if (amount < 0) {
              type = "despesa";
            } else {
              type = "receita";
            }
          }
          amount = Math.abs(amount);

          const { current: installmentCurrent, total: installmentTotal, cleanDesc } = parseInstallment(description);
          const shortTitle = generateShortTitle(cleanDesc);
          const matchingRule = await storage.findMatchingRule(description);

          const categoryName = matchingRule?.categoryId 
            ? categories.find(c => c.id === matchingRule.categoryId)?.name || null 
            : null;
          const subcategoryName = matchingRule?.subcategoryId 
            ? subcategories.find(s => s.id === matchingRule.subcategoryId)?.name || null 
            : null;

          transactions.push({
            date: date.toISOString().split("T")[0],
            description: cleanDesc,
            shortTitle,
            amount: amount.toFixed(2),
            type,
            isRefund,
            installmentCurrent,
            installmentTotal,
            categoryName,
            subcategoryName,
            hasRule: !!matchingRule,
          });
        } catch (err) {
          errors.push(`Linha ${i + 1}: Erro ao processar`);
        }
      }

      // Calcular resumo
      const summary = {
        totalTransactions: transactions.length,
        totalReceitas: transactions.filter(t => t.type === "receita").reduce((sum, t) => sum + parseFloat(t.amount), 0),
        totalDespesas: transactions.filter(t => t.type === "despesa").reduce((sum, t) => sum + parseFloat(t.amount), 0),
        withCategory: transactions.filter(t => t.hasRule).length,
        withoutCategory: transactions.filter(t => !t.hasRule).length,
        withInstallments: transactions.filter(t => t.installmentTotal !== null).length,
        refunds: transactions.filter(t => t.isRefund).length,
      };

      res.json({
        success: errors.length === 0,
        transactions,
        summary,
        errors,
        columnMapping,
      });
    } catch (error) {
      console.error("Error previewing import:", error);
      res.status(500).json({ error: "Failed to preview import" });
    }
  });

  app.get("/api/import/template", (req, res) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Data", "Descricao", "Valor"],
      ["01/01/2024", "Exemplo Receita", "1000.00"],
      ["02/01/2024", "Exemplo Despesa", "-50.00"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Extrato");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Disposition", "attachment; filename=modelo_extrato.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  });

  app.post("/api/import/load-attached-files", async (req, res) => {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "This endpoint is only available in development mode" });
      }
      
      const attachedDir = path.join(process.cwd(), "attached_assets");
      if (!fs.existsSync(attachedDir)) {
        return res.status(404).json({ error: "No attached_assets directory found" });
      }

      const files = fs.readdirSync(attachedDir);
      let totalImported = 0;
      const results: { file: string; imported: number; errors: string[] }[] = [];

      function parseInstallment(desc: string): { current: number | null; total: number | null; cleanDesc: string } {
        const patterns = [/(\d{2})\/(\d{2})$/, /\s+(\d{2})\/(\d{2})$/];
        for (const pattern of patterns) {
          const match = desc.match(pattern);
          if (match) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);
            if (current <= total && total <= 24) {
              return { current, total, cleanDesc: desc.replace(pattern, "").trim() };
            }
          }
        }
        return { current: null, total: null, cleanDesc: desc };
      }

      function generateShortTitle(desc: string): string {
        let title = desc.replace(/\*+/g, " ").replace(/\s+/g, " ").replace(/\d{2}\/\d{2}$/, "").trim();
        const knownPrefixes = ["MP ", "PIX ", "TED ", "DOC ", "PAG ", "DL ", "EC "];
        for (const prefix of knownPrefixes) {
          if (title.toUpperCase().startsWith(prefix)) {
            title = title.substring(prefix.length);
            break;
          }
        }
        if (title.length > 50) title = title.substring(0, 47) + "...";
        return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
      }

      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Feriados nacionais brasileiros fixos (MM-DD)
      const fixedHolidays = [
        "01-01", // Ano Novo
        "04-21", // Tiradentes
        "05-01", // Dia do Trabalho
        "09-07", // Independencia
        "10-12", // Nossa Senhora Aparecida
        "11-02", // Finados
        "11-15", // Proclamacao da Republica
        "12-25", // Natal
      ];
      
      // Funcao para verificar se e dia util (nao e fim de semana nem feriado)
      function isBusinessDay(date: Date): boolean {
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return false; // Fim de semana
        
        const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (fixedHolidays.includes(monthDay)) return false; // Feriado fixo
        
        return true;
      }
      
      // Funcao para obter proximo dia util
      function getNextBusinessDay(date: Date): Date {
        const result = new Date(date);
        while (!isBusinessDay(result)) {
          result.setDate(result.getDate() + 1);
        }
        return result;
      }
      
      function extractBillMonth(filename: string): { month: string; billDate: Date; isPast: boolean } | null {
        const match = filename.match(/fatura-(\d{4})(\d{2})(\d{2})/);
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]);
          // Vencimento dia 9, ajustado para proximo dia util se necessario
          const dueDate = new Date(year, month - 1, 9);
          const billDate = getNextBusinessDay(dueDate);
          const isPast = billDate < today;
          return { month: `${year}-${String(month).padStart(2, '0')}`, billDate, isPast };
        }
        return null;
      }

      // Buscar ou criar contas de pagamento
      const allAccounts = await storage.getBankAccounts();
      
      let cartaoCreditoAccount = allAccounts.find(a => a.name === "Cartão Itaú Personnalite");
      if (!cartaoCreditoAccount) {
        cartaoCreditoAccount = await storage.createBankAccount({
          name: "Cartão Itaú Personnalite",
          type: "credit_card",
          balance: "0",
          active: true,
        });
      }
      
      let debitoAccount = allAccounts.find(a => a.name === "Débito");
      if (!debitoAccount) {
        debitoAccount = await storage.createBankAccount({
          name: "Débito",
          type: "checking",
          balance: "0",
          active: true,
        });
      }

      for (const file of files) {
        if (!file.endsWith(".csv") && !file.endsWith(".xls") && !file.endsWith(".xlsx")) continue;

        const filePath = path.join(attachedDir, file);
        const isCSV = file.endsWith(".csv");
        const isCartao = file.toLowerCase().includes("fatura");
        const isExtrato = file.toLowerCase().includes("extrato");
        const billInfo = isCartao ? extractBillMonth(file) : null;
        
        // Definir conta de pagamento com base no tipo de importação
        const bankAccountId = isCartao ? cartaoCreditoAccount.id : debitoAccount.id;
        
        let imported = 0;
        const errors: string[] = [];
        let faturaTotal = 0; // Total da fatura (despesas - estornos)

        let data: any[][];

        if (isCSV) {
          const csvContent = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
          data = csvContent.split("\n").filter(line => line.trim()).map(line => {
            const values: string[] = [];
            let current = "";
            let inQuotes = false;
            for (const char of line) {
              if (char === '"') inQuotes = !inQuotes;
              else if (char === "," && !inQuotes) {
                values.push(current.trim());
                current = "";
              } else current += char;
            }
            values.push(current.trim());
            return values;
          });
        } else {
          const buffer = fs.readFileSync(filePath);
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          
          // Extrair saldo do extrato da célula E104
          if (isExtrato && sheet["E104"]) {
            const saldoValue = sheet["E104"].v;
            if (typeof saldoValue === "number") {
              await storage.setSaldoExtrato(saldoValue);
              console.log(`Saldo do extrato extraído: R$ ${saldoValue.toFixed(2)}`);
            }
          }
        }

        let startRow = 1;
        let dateCol = 0;
        let descCol = 1;
        let amountCol = 2;

        if (isExtrato && !isCSV) {
          for (let i = 0; i < Math.min(15, data.length); i++) {
            const row = data[i];
            if (row && row[0] === "data" && String(row[1]).toLowerCase().includes("lançamento")) {
              startRow = i + 2;
              dateCol = 0;
              descCol = 1;
              amountCol = 3;
              break;
            }
          }
        }

        const debugInfo: string[] = [];
        
        for (let i = startRow; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) {
            debugInfo.push(`Linha ${i + 1}: Linha vazia ou muito curta`);
            continue;
          }

          try {
            let dateValue = row[dateCol];
            let description = String(row[descCol] || "").trim();
            let amountValue = row[amountCol];
            
            // Debug: mostrar o que está lendo de cada coluna
            const rawAmountStr = amountValue !== undefined && amountValue !== null ? String(amountValue) : 'VAZIO';
            
            const skipPatterns = ["SALDO ANTERIOR", "SALDO TOTAL", "SDO CTA/APL", "S A L D O", "SALDO DISPONÍVEL", "SALDO DISPONIVEL", "SALDO TOTAL DISPONÍVEL"];
            if (skipPatterns.some(p => description.toUpperCase().includes(p))) continue;
            
            // Ignorar cabeçalhos de seção do extrato Itaú
            const sectionHeaders = ["LANÇAMENTOS", "LANCAMENTOS", "LANÇAMENTOS FUTUROS", "LANCAMENTOS FUTUROS", "SAÍDAS FUTURAS", "SAIDAS FUTURAS", "ENTRADAS FUTURAS"];
            const descUpper = description.toUpperCase().trim();
            if (sectionHeaders.some(h => descUpper === h)) continue;

            if (!description) {
              // Linha sem descrição - verificar se tem dados na linha inteira
              const rowHasData = row.some((cell: unknown) => cell !== null && cell !== undefined && String(cell).trim() !== '');
              if (!rowHasData) continue;
              // Se tem dados mas não descrição, registrar para debug
              errors.push(`Linha ${i + 1}: Linha com dados mas sem descricao - ignorada`);
              continue;
            }

            let date: Date;
            if (typeof dateValue === "number") {
              date = new Date((dateValue - 25569) * 86400 * 1000);
            } else if (typeof dateValue === "string" && dateValue.trim()) {
              if (dateValue.includes("-")) date = new Date(dateValue);
              else {
                const parts = dateValue.split("/");
                if (parts.length === 3) {
                  date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                } else date = new Date(dateValue);
              }
            } else {
              // Sem data - pode ser linha de totais ou separador
              continue;
            }

            if (isNaN(date.getTime())) {
              errors.push(`Linha ${i + 1}: Data invalida "${dateValue}" - ignorada`);
              continue;
            }

            let amount: number;
            if (typeof amountValue === "number") {
              amount = amountValue;
              debugInfo.push(`Linha ${i + 1}: "${description.substring(0, 30)}" | Valor numerico: ${amountValue} → amount=${amount}`);
            } else if (amountValue !== null && amountValue !== undefined && String(amountValue).trim() !== '') {
              // Formato brasileiro: 1.234,56 (ponto milhar, vírgula decimal)
              // Primeiro remove pontos de milhar, depois troca vírgula por ponto
              let strValue = String(amountValue);
              const originalStr = strValue;
              strValue = strValue.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
              amount = parseFloat(strValue);
              debugInfo.push(`Linha ${i + 1}: "${description.substring(0, 30)}" | Valor string: "${originalStr}" → "${strValue}" → amount=${amount}`);
            } else {
              // Valor vazio - pode ser linha informativa
              debugInfo.push(`Linha ${i + 1}: "${description.substring(0, 30)}" | Valor VAZIO - ignorada`);
              continue;
            }

            if (isNaN(amount) || amount === 0) {
              debugInfo.push(`Linha ${i + 1}: "${description.substring(0, 30)}" | amount=${amount} (NaN ou zero) - ignorada`);
              continue;
            }

            let type: "receita" | "despesa";
            let isRefund = false;
            
            if (isCartao) {
              if (amount < 0) {
                isRefund = true;
                type = "receita";
              } else {
                type = "despesa";
              }
            } else {
              if (amount < 0) {
                type = "despesa";
                isRefund = false;
              } else {
                type = "receita";
                isRefund = false;
              }
            }
            amount = Math.abs(amount);

            const { current: installmentCurrent, total: installmentTotal, cleanDesc } = parseInstallment(description);
            const shortTitle = generateShortTitle(cleanDesc);
            const matchingRule = await storage.findMatchingRule(description);

            let status: "prevista" | "realizada" = "realizada";
            let isFutureTransaction = false;
            
            if (isCartao && billInfo) {
              status = billInfo.isPast ? "realizada" : "prevista";
            } else if (isExtrato) {
              const skipFuture = description.toUpperCase().includes("LANCAMENTOS FUTUROS") || 
                                 description.toUpperCase().includes("SAIDAS FUTURAS");
              if (skipFuture) continue;
              
              if (date > today) {
                status = "prevista";
                isFutureTransaction = true;
              }
            }

            const installmentGroupId = installmentCurrent && installmentTotal 
              ? `${cleanDesc.toLowerCase().replace(/\s+/g, '_').substring(0, 30)}_${installmentTotal}x`
              : null;

            // Detectar pagamentos de cartão de crédito no extrato bancário
            const cardPaymentPatterns = [
              "CARTAO PERSONNALITE",
              "ITAU BLACK",
              "FATURA CARTAO",
              "PAG CARTAO",
              "PAGAMENTO CARTAO",
              "CARTAO DE CREDITO",
            ];
            const isCardPaymentByPattern = !isCartao && cardPaymentPatterns.some(
              p => description.toUpperCase().includes(p)
            );
            
            // Para pagamentos de cartão, determinar qual fatura corresponde
            // Vencimento dia 9: pagamento entre dia 5 e 15 pertence ao mês atual
            let cardBillMonthForPayment: string | null = null;
            if (isCardPaymentByPattern && type === "despesa") {
              const txDay = date.getDate();
              const txMonth = date.getMonth();
              const txYear = date.getFullYear();
              
              // Se pagamento entre dia 5 e 15, pertence ao mês atual
              // Se antes do dia 5, pode ser pagamento atrasado do mês anterior
              // Se depois do dia 15, pode ser adiantado do próximo mês
              if (txDay >= 5 && txDay <= 15) {
                cardBillMonthForPayment = `${txYear}-${String(txMonth + 1).padStart(2, '0')}`;
              } else if (txDay < 5) {
                // Pode ser do mês anterior (pagamento atrasado)
                const prevMonth = txMonth === 0 ? 12 : txMonth;
                const prevYear = txMonth === 0 ? txYear - 1 : txYear;
                cardBillMonthForPayment = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
              } else {
                // Dia > 15, provavelmente do mês atual
                cardBillMonthForPayment = `${txYear}-${String(txMonth + 1).padStart(2, '0')}`;
              }
            }
            
            const isCardBillPayment = isCardPaymentByPattern;
            
            const transactionDateStr = date.toISOString().split("T")[0];
            let paymentDateStr = transactionDateStr;
            
            if (isCartao && billInfo?.month) {
              const [billYear, billMonth] = billInfo.month.split("-").map(Number);
              const installmentOffset = installmentCurrent ? (installmentCurrent - 1) : 0;
              const offsetDate = new Date(billYear, billMonth - 1 + installmentOffset, 9);
              let paymentDay = offsetDate.getDate();
              const dayOfWeek = offsetDate.getDay();
              if (dayOfWeek === 0) paymentDay = 10;
              else if (dayOfWeek === 6) paymentDay = 11;
              const finalYear = offsetDate.getFullYear();
              const finalMonth = offsetDate.getMonth() + 1;
              paymentDateStr = `${finalYear}-${String(finalMonth).padStart(2, '0')}-${String(paymentDay).padStart(2, '0')}`;
            }

            await storage.createTransaction({
              description: cleanDesc,
              originalDescription: description,
              shortTitle,
              amount: amount.toFixed(2),
              type,
              status,
              date: transactionDateStr,
              transactionDate: transactionDateStr,
              paymentDate: paymentDateStr,
              bankAccountId,
              categoryId: matchingRule?.categoryId || null,
              subcategoryId: matchingRule?.subcategoryId || null,
              needsCategorization: !matchingRule && !isCardBillPayment,
              isRefund,
              isCardBillPayment,
              installmentCurrent,
              installmentTotal,
              installmentGroupId,
              cardBillMonth: isCardBillPayment ? cardBillMonthForPayment : (billInfo?.month || null),
              importedFrom: file,
              importedFromRow: i + 1,
              source: isCartao ? "cartao" : "conta_corrente",
            });

            // Acumular total da fatura (despesas positivas, estornos negativos)
            if (isCartao) {
              if (type === "despesa") {
                faturaTotal += amount;
              } else if (isRefund) {
                faturaTotal -= amount;
              }
            }

            imported++;
          } catch (err) {
            errors.push(`Linha ${i + 1}: Erro ao processar`);
          }
        }

        // Se é fatura de cartão, criar transação de pagamento na conta débito
        if (isCartao && faturaTotal > 0 && billInfo) {
          const paymentDate = billInfo.billDate; // Data de vencimento (dia 9, ajustado para dia util)
          const paymentStatus = billInfo.isPast ? "realizada" : "prevista";
          
          // Verificar se já existe transação de pagamento para esta fatura
          const existingPayment = await storage.findTransactionByDescription(
            `Pagamento Fatura ${billInfo.month}`,
            paymentDate.toISOString().split("T")[0]
          );
          
          if (!existingPayment) {
            const paymentDateStr = paymentDate.toISOString().split("T")[0];
            await storage.createTransaction({
              description: `Pagamento Fatura ${billInfo.month}`,
              originalDescription: `Pagamento Fatura Cartão de Crédito - ${billInfo.month}`,
              shortTitle: `Pgto Fatura ${billInfo.month.substring(5)}`,
              amount: faturaTotal.toFixed(2),
              type: "despesa",
              status: paymentStatus,
              date: paymentDateStr,
              transactionDate: paymentDateStr,
              paymentDate: paymentDateStr,
              bankAccountId: debitoAccount.id,
              categoryId: null,
              subcategoryId: null,
              needsCategorization: false,
              isRefund: false,
              isCardBillPayment: true,
              installmentCurrent: null,
              installmentTotal: null,
              installmentGroupId: null,
              cardBillMonth: billInfo.month,
              importedFrom: file,
              source: "conta_corrente",
            });
            imported++;
          }
        }

        results.push({ file, imported, errors });
        totalImported += imported;
      }

      res.json({ success: true, totalImported, results });
    } catch (error) {
      console.error("Error loading attached files:", error);
      res.status(500).json({ error: "Failed to load attached files" });
    }
  });

  // Maintenance routes
  app.get("/api/maintenance/duplicates", async (req, res) => {
    try {
      const duplicates = await storage.findDuplicateTransactions();
      res.json(duplicates);
    } catch (error) {
      console.error("Error finding duplicates:", error);
      res.status(500).json({ error: "Failed to find duplicates" });
    }
  });

  app.get("/api/maintenance/wrong-sign", async (req, res) => {
    try {
      const wrongSign = await storage.findWrongSignTransactions();
      res.json(wrongSign);
    } catch (error) {
      console.error("Error finding wrong sign transactions:", error);
      res.status(500).json({ error: "Failed to find wrong sign transactions" });
    }
  });

  app.post("/api/maintenance/consolidate", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs array required" });
      }
      await storage.deleteTransactionsByIds(ids);
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
      console.error("Error consolidating duplicates:", error);
      res.status(500).json({ error: "Failed to consolidate duplicates" });
    }
  });

  app.post("/api/maintenance/fix-sign", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs array required" });
      }
      await storage.flipTransactionType(ids);
      res.json({ success: true, updated: ids.length });
    } catch (error) {
      console.error("Error fixing signs:", error);
      res.status(500).json({ error: "Failed to fix signs" });
    }
  });

  app.post("/api/maintenance/transactions-by-ids", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs array required" });
      }
      const transactions = await storage.getTransactionsByIds(ids);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions by ids:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.get("/api/import/pendencies", async (req, res) => {
    try {
      const allTransactions = await storage.getTransactions();
      const today = new Date();

      const monthsWithExtrato = new Set<string>();
      const monthsWithFatura = new Set<string>();
      const monthsWithBillPayment = new Set<string>();
      const allMonths = new Set<string>();

      allTransactions.forEach(t => {
        const date = new Date(t.date);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (t.source === 'conta_corrente' && !t.isCardBillPayment) {
          monthsWithExtrato.add(monthStr);
          allMonths.add(monthStr);
        }
        if (t.source === 'cartao' && !t.isCardBillPayment) {
          const billMonth = t.cardBillMonth || monthStr;
          monthsWithFatura.add(billMonth);
          allMonths.add(billMonth);
        }
        if (t.isCardBillPayment) {
          monthsWithBillPayment.add(monthStr);
          allMonths.add(monthStr);
        }
        if (t.source === 'manual') {
          allMonths.add(monthStr);
        }
      });

      const extratoCountByMonth = new Map<string, number>();
      const faturaCountByMonth = new Map<string, number>();
      const extratoTotalByMonth = new Map<string, number>();
      const faturaTotalByMonth = new Map<string, number>();

      allTransactions.forEach(t => {
        const date = new Date(t.date);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (t.source === 'conta_corrente' && !t.isCardBillPayment) {
          extratoCountByMonth.set(monthStr, (extratoCountByMonth.get(monthStr) || 0) + 1);
          const amt = parseFloat(String(t.amount));
          const current = extratoTotalByMonth.get(monthStr) || 0;
          extratoTotalByMonth.set(monthStr, current + (t.type === 'receita' ? amt : -amt));
        }
        if (t.source === 'cartao' && !t.isCardBillPayment) {
          const billMonth = t.cardBillMonth || monthStr;
          faturaCountByMonth.set(billMonth, (faturaCountByMonth.get(billMonth) || 0) + 1);
          const amt = parseFloat(String(t.amount));
          faturaTotalByMonth.set(billMonth, (faturaTotalByMonth.get(billMonth) || 0) + (t.type === 'despesa' ? amt : -amt));
        }
      });

      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      allMonths.add(currentMonthStr);

      const sortedMonths = Array.from(allMonths).sort();

      const pendencies = sortedMonths.map(month => {
        const hasExtrato = monthsWithExtrato.has(month);
        const hasFatura = monthsWithFatura.has(month);
        const hasBillPayment = monthsWithBillPayment.has(month);

        const isFuture = month > currentMonthStr;

        return {
          month,
          hasExtrato,
          hasFatura,
          hasBillPayment,
          extratoCount: extratoCountByMonth.get(month) || 0,
          faturaCount: faturaCountByMonth.get(month) || 0,
          extratoNet: Math.round((extratoTotalByMonth.get(month) || 0) * 100) / 100,
          faturaTotal: Math.round((faturaTotalByMonth.get(month) || 0) * 100) / 100,
          isFuture,
          pendingExtrato: !hasExtrato && !isFuture,
          pendingFatura: !hasFatura && hasBillPayment && !isFuture,
        };
      });

      res.json(pendencies);
    } catch (error) {
      console.error("Error checking import pendencies:", error);
      res.status(500).json({ error: "Failed to check import pendencies" });
    }
  });

  // ==================== Admin / Database Management ====================

  app.get("/api/admin/export", async (_req, res) => {
    try {
      const data = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        tables: {
          categories: await db.select().from(categories),
          subcategories: await db.select().from(subcategories),
          bankAccounts: await db.select().from(bankAccounts),
          beneficiaries: await db.select().from(beneficiaries),
          transactions: await db.select().from(transactions),
          payables: await db.select().from(payables),
          categorizationRules: await db.select().from(categorizationRules),
          budgetItems: await db.select().from(budgetItems),
        },
      };

      const counts = {
        categories: data.tables.categories.length,
        subcategories: data.tables.subcategories.length,
        bankAccounts: data.tables.bankAccounts.length,
        beneficiaries: data.tables.beneficiaries.length,
        transactions: data.tables.transactions.length,
        payables: data.tables.payables.length,
        categorizationRules: data.tables.categorizationRules.length,
        budgetItems: data.tables.budgetItems.length,
      };
      (data as any).counts = counts;

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=personal-finance-backup-${new Date().toISOString().split("T")[0]}.json`);
      res.json(data);
    } catch (error) {
      console.error("Error exporting database:", error);
      res.status(500).json({ error: "Failed to export database" });
    }
  });

  app.get("/api/admin/stats", async (_req, res) => {
    try {
      const stats = {
        categories: (await db.select({ count: sql<number>`count(*)` }).from(categories))[0].count,
        subcategories: (await db.select({ count: sql<number>`count(*)` }).from(subcategories))[0].count,
        bankAccounts: (await db.select({ count: sql<number>`count(*)` }).from(bankAccounts))[0].count,
        beneficiaries: (await db.select({ count: sql<number>`count(*)` }).from(beneficiaries))[0].count,
        transactions: (await db.select({ count: sql<number>`count(*)` }).from(transactions))[0].count,
        payables: (await db.select({ count: sql<number>`count(*)` }).from(payables))[0].count,
        categorizationRules: (await db.select({ count: sql<number>`count(*)` }).from(categorizationRules))[0].count,
        budgetItems: (await db.select({ count: sql<number>`count(*)` }).from(budgetItems))[0].count,
      };
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.post("/api/admin/reset", async (_req, res) => {
    try {
      await db.delete(budgetItems);
      await db.delete(payables);
      await db.delete(transactions);
      await db.delete(categorizationRules);
      await db.delete(subcategories);
      await db.delete(categories);
      await db.delete(beneficiaries);
      await db.delete(bankAccounts);

      await db.execute(sql`ALTER SEQUENCE categories_id_seq RESTART WITH 1`);
      await db.execute(sql`ALTER SEQUENCE subcategories_id_seq RESTART WITH 1`);
      await db.execute(sql`ALTER SEQUENCE bank_accounts_id_seq RESTART WITH 1`);
      await db.execute(sql`ALTER SEQUENCE beneficiaries_id_seq RESTART WITH 1`);
      await db.execute(sql`ALTER SEQUENCE transactions_id_seq RESTART WITH 1`);
      await db.execute(sql`ALTER SEQUENCE payables_id_seq RESTART WITH 1`);
      await db.execute(sql`ALTER SEQUENCE categorization_rules_id_seq RESTART WITH 1`);
      await db.execute(sql`ALTER SEQUENCE budget_items_id_seq RESTART WITH 1`);

      res.json({ success: true, message: "Database reset successfully" });
    } catch (error) {
      console.error("Error resetting database:", error);
      res.status(500).json({ error: "Failed to reset database" });
    }
  });

  app.post("/api/admin/delete-table", async (req, res) => {
    try {
      const { table } = req.body;
      if (!table) {
        return res.status(400).json({ error: "Table name is required" });
      }

      const tableMap: Record<string, any> = {
        budgetItems,
        payables,
        transactions,
        categorizationRules,
        subcategories,
        categories,
        beneficiaries,
        bankAccounts,
      };

      const dependencyOrder: Record<string, string[]> = {
        categories: ["budgetItems", "payables", "transactions", "subcategories"],
        subcategories: ["budgetItems", "payables", "transactions"],
        bankAccounts: ["transactions"],
        beneficiaries: ["budgetItems", "payables", "transactions"],
      };

      const tableObj = tableMap[table];
      if (!tableObj) {
        return res.status(400).json({ error: `Invalid table: ${table}` });
      }

      const deps = dependencyOrder[table] || [];
      const deletedTables: string[] = [];

      for (const dep of deps) {
        if (tableMap[dep]) {
          await db.delete(tableMap[dep]);
          const seqName = dep.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
          try {
            await db.execute(sql.raw(`ALTER SEQUENCE ${seqName}_id_seq RESTART WITH 1`));
          } catch {}
          deletedTables.push(dep);
        }
      }

      await db.delete(tableObj);
      const seqName = table.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
      try {
        await db.execute(sql.raw(`ALTER SEQUENCE ${seqName}_id_seq RESTART WITH 1`));
      } catch {}
      deletedTables.push(table);

      res.json({ success: true, deletedTables });
    } catch (error) {
      console.error("Error deleting table:", error);
      res.status(500).json({ error: "Failed to delete table" });
    }
  });

  app.post("/api/admin/import", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const content = req.file.buffer.toString("utf-8");
      const data = JSON.parse(content);

      if (!data.tables) {
        return res.status(400).json({ error: "Invalid backup file format" });
      }

      const t = data.tables;
      const imported: Record<string, number> = {};
      const now = new Date().toISOString();

      if (t.categories?.length) {
        for (const row of t.categories) {
          await db.execute(sql`INSERT INTO categories (id, name, type, color, icon, active, created_at) OVERRIDING SYSTEM VALUE VALUES (${row.id}, ${row.name}, ${row.type}, ${row.color}, ${row.icon}, ${row.active}, ${row.createdAt || now}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, color = EXCLUDED.color, icon = EXCLUDED.icon, active = EXCLUDED.active`);
        }
        const maxId = Math.max(...t.categories.map((r: any) => r.id));
        await db.execute(sql`SELECT setval('categories_id_seq', ${sql.raw(String(maxId))}, true)`);
        imported.categories = t.categories.length;
      }

      if (t.subcategories?.length) {
        for (const row of t.subcategories) {
          await db.execute(sql`INSERT INTO subcategories (id, name, category_id, active, created_at) OVERRIDING SYSTEM VALUE VALUES (${row.id}, ${row.name}, ${row.categoryId}, ${row.active}, ${row.createdAt || now}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, active = EXCLUDED.active`);
        }
        const maxId = Math.max(...t.subcategories.map((r: any) => r.id));
        await db.execute(sql`SELECT setval('subcategories_id_seq', ${sql.raw(String(maxId))}, true)`);
        imported.subcategories = t.subcategories.length;
      }

      if (t.bankAccounts?.length) {
        for (const row of t.bankAccounts) {
          await db.execute(sql`INSERT INTO bank_accounts (id, name, bank_name, account_type, balance, active, created_at) OVERRIDING SYSTEM VALUE VALUES (${row.id}, ${row.name}, ${row.bankName}, ${row.accountType}, ${row.balance}, ${row.active}, ${row.createdAt || now}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, bank_name = EXCLUDED.bank_name, account_type = EXCLUDED.account_type, balance = EXCLUDED.balance, active = EXCLUDED.active`);
        }
        const maxId = Math.max(...t.bankAccounts.map((r: any) => r.id));
        await db.execute(sql`SELECT setval('bank_accounts_id_seq', ${sql.raw(String(maxId))}, true)`);
        imported.bankAccounts = t.bankAccounts.length;
      }

      if (t.beneficiaries?.length) {
        for (const row of t.beneficiaries) {
          await db.execute(sql`INSERT INTO beneficiaries (id, name, active, is_default, created_at) OVERRIDING SYSTEM VALUE VALUES (${row.id}, ${row.name}, ${row.active}, ${row.isDefault}, ${row.createdAt || now}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active, is_default = EXCLUDED.is_default`);
        }
        const maxId = Math.max(...t.beneficiaries.map((r: any) => r.id));
        await db.execute(sql`SELECT setval('beneficiaries_id_seq', ${sql.raw(String(maxId))}, true)`);
        imported.beneficiaries = t.beneficiaries.length;
      }

      if (t.categorizationRules?.length) {
        for (const row of t.categorizationRules) {
          await db.execute(sql`INSERT INTO categorization_rules (id, pattern, category_id, subcategory_id, active, created_at) OVERRIDING SYSTEM VALUE VALUES (${row.id}, ${row.pattern}, ${row.categoryId}, ${row.subcategoryId}, ${row.active}, ${row.createdAt || now}) ON CONFLICT (id) DO UPDATE SET pattern = EXCLUDED.pattern, category_id = EXCLUDED.category_id, subcategory_id = EXCLUDED.subcategory_id, active = EXCLUDED.active`);
        }
        const maxId = Math.max(...t.categorizationRules.map((r: any) => r.id));
        await db.execute(sql`SELECT setval('categorization_rules_id_seq', ${sql.raw(String(maxId))}, true)`);
        imported.categorizationRules = t.categorizationRules.length;
      }

      if (t.transactions?.length) {
        for (const row of t.transactions) {
          await db.execute(sql`INSERT INTO transactions (id, description, original_description, short_title, amount, type, status, date, transaction_date, payment_date, category_id, subcategory_id, bank_account_id, beneficiary_id, notes, imported_from, imported_from_row, source, needs_categorization, is_recurring, recurring_months, recurring_group_id, is_refund, is_fraud_suspect, is_card_bill_payment, installment_current, installment_total, installment_group_id, card_bill_month, card_type, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (${row.id}, ${row.description}, ${row.originalDescription}, ${row.shortTitle}, ${row.amount}, ${row.type}, ${row.status}, ${row.date}, ${row.transactionDate}, ${row.paymentDate}, ${row.categoryId}, ${row.subcategoryId}, ${row.bankAccountId}, ${row.beneficiaryId}, ${row.notes || null}, ${row.importedFrom}, ${row.importedFromRow}, ${row.source}, ${row.needsCategorization}, ${row.isRecurring}, ${row.recurringMonths || null}, ${row.recurringGroupId || null}, ${row.isRefund}, ${row.isFraudSuspect || false}, ${row.isCardBillPayment}, ${row.installmentCurrent}, ${row.installmentTotal}, ${row.installmentGroupId}, ${row.cardBillMonth}, ${row.cardType || null}, ${row.createdAt || now}, ${row.updatedAt || now}) ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, original_description = EXCLUDED.original_description, short_title = EXCLUDED.short_title, amount = EXCLUDED.amount, type = EXCLUDED.type, status = EXCLUDED.status, date = EXCLUDED.date, transaction_date = EXCLUDED.transaction_date, payment_date = EXCLUDED.payment_date, category_id = EXCLUDED.category_id, subcategory_id = EXCLUDED.subcategory_id, bank_account_id = EXCLUDED.bank_account_id, beneficiary_id = EXCLUDED.beneficiary_id, notes = EXCLUDED.notes, imported_from = EXCLUDED.imported_from, imported_from_row = EXCLUDED.imported_from_row, source = EXCLUDED.source, needs_categorization = EXCLUDED.needs_categorization, is_recurring = EXCLUDED.is_recurring, recurring_months = EXCLUDED.recurring_months, recurring_group_id = EXCLUDED.recurring_group_id, is_refund = EXCLUDED.is_refund, is_fraud_suspect = EXCLUDED.is_fraud_suspect, is_card_bill_payment = EXCLUDED.is_card_bill_payment, installment_current = EXCLUDED.installment_current, installment_total = EXCLUDED.installment_total, installment_group_id = EXCLUDED.installment_group_id, card_bill_month = EXCLUDED.card_bill_month, card_type = EXCLUDED.card_type, updated_at = EXCLUDED.updated_at`);
        }
        const maxId = Math.max(...t.transactions.map((r: any) => r.id));
        await db.execute(sql`SELECT setval('transactions_id_seq', ${sql.raw(String(maxId))}, true)`);
        imported.transactions = t.transactions.length;
      }

      if (t.payables?.length) {
        for (const row of t.payables) {
          await db.execute(sql`INSERT INTO payables (id, description, amount, due_date, status, category_id, subcategory_id, is_installment, installment_number, total_installments, parent_payable_id, notes, paid_at, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (${row.id}, ${row.description}, ${row.amount}, ${row.dueDate}, ${row.status}, ${row.categoryId}, ${row.subcategoryId}, ${row.isInstallment}, ${row.installmentNumber}, ${row.totalInstallments}, ${row.parentPayableId}, ${row.notes}, ${row.paidAt}, ${row.createdAt || now}, ${row.updatedAt || now}) ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, amount = EXCLUDED.amount, due_date = EXCLUDED.due_date, status = EXCLUDED.status, category_id = EXCLUDED.category_id, subcategory_id = EXCLUDED.subcategory_id, is_installment = EXCLUDED.is_installment, installment_number = EXCLUDED.installment_number, total_installments = EXCLUDED.total_installments, parent_payable_id = EXCLUDED.parent_payable_id, notes = EXCLUDED.notes, paid_at = EXCLUDED.paid_at, updated_at = EXCLUDED.updated_at`);
        }
        const maxId = Math.max(...t.payables.map((r: any) => r.id));
        await db.execute(sql`SELECT setval('payables_id_seq', ${sql.raw(String(maxId))}, true)`);
        imported.payables = t.payables.length;
      }

      if (t.budgetItems?.length) {
        for (const row of t.budgetItems) {
          await db.execute(sql`INSERT INTO budget_items (id, description, short_title, type, category_id, subcategory_id, beneficiary_id, year_month, amount, transaction_date, bill_due_date, is_recurring, recurring_group_id, is_from_installment, installment_group_id, installment_current, installment_total, source, notes, active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (${row.id}, ${row.description}, ${row.shortTitle}, ${row.type}, ${row.categoryId}, ${row.subcategoryId}, ${row.beneficiaryId}, ${row.yearMonth}, ${row.amount}, ${row.transactionDate}, ${row.billDueDate}, ${row.isRecurring}, ${row.recurringGroupId || null}, ${row.isFromInstallment}, ${row.installmentGroupId}, ${row.installmentCurrent}, ${row.installmentTotal}, ${row.source || 'manual'}, ${row.notes || null}, ${row.active !== undefined ? row.active : true}, ${row.createdAt || now}, ${row.updatedAt || now}) ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, short_title = EXCLUDED.short_title, type = EXCLUDED.type, category_id = EXCLUDED.category_id, subcategory_id = EXCLUDED.subcategory_id, beneficiary_id = EXCLUDED.beneficiary_id, year_month = EXCLUDED.year_month, amount = EXCLUDED.amount, transaction_date = EXCLUDED.transaction_date, bill_due_date = EXCLUDED.bill_due_date, is_recurring = EXCLUDED.is_recurring, recurring_group_id = EXCLUDED.recurring_group_id, is_from_installment = EXCLUDED.is_from_installment, installment_group_id = EXCLUDED.installment_group_id, installment_current = EXCLUDED.installment_current, installment_total = EXCLUDED.installment_total, source = EXCLUDED.source, notes = EXCLUDED.notes, active = EXCLUDED.active, updated_at = EXCLUDED.updated_at`);
        }
        const maxId = Math.max(...t.budgetItems.map((r: any) => r.id));
        await db.execute(sql`SELECT setval('budget_items_id_seq', ${sql.raw(String(maxId))}, true)`);
        imported.budgetItems = t.budgetItems.length;
      }

      res.json({ success: true, imported });
    } catch (error) {
      console.error("Error importing database:", error);
      res.status(500).json({ error: "Failed to import database: " + (error as Error).message });
    }
  });

  return httpServer;
}
