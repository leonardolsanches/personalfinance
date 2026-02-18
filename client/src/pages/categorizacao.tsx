import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { filterCardBillPayments } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tags, Check, ChevronRight, ChevronLeft, AlertCircle, Search, CheckSquare, ChevronUp, ChevronDown, CreditCard, Building2, PenLine, Plus, TrendingUp, TrendingDown, ArrowUpDown, Pencil, Trash2, X, LineChart as LineChartIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Transaction, Category, Subcategory, BankAccount, Beneficiary, BudgetItem } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { useColumnWidths } from "@/hooks/use-column-widths";
import { ResizeHandle } from "@/components/resize-handle";

function formatCurrency(value: number | string) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

function formatDate(date: string) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

function getCompetenciaMonth(t: { paymentDate?: string | null; source?: string | null; cardBillMonth?: string | null; date: string }): string {
  if (t.paymentDate) {
    const d = new Date(t.paymentDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (t.source === "cartao" && t.cardBillMonth) return t.cardBillMonth;
  const d = new Date(t.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function ymToLabel(ym: string): string {
  const [y, mo] = ym.split("-");
  return `${MONTH_NAMES_SHORT[parseInt(mo) - 1]}/${y.slice(2)}`;
}

export default function Categorizacao() {
  const { toast } = useToast();
  const [selectedCategories, setSelectedCategories] = useState<Record<number, { categoryId: string; subcategoryId: string }>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<"date" | "description" | "amount" | "type" | "status" | "source" | "subcategory">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);
  const [dataSource, setDataSource] = useState<"transacoes" | "planejamento">("transacoes");
  const [chartMode, setChartMode] = useState<"receita_despesa" | "planejado_realizado">("receita_despesa");
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "prevista" | "realizada">("all");
  const [filterSource, setFilterSource] = useState<"all" | "manual" | "cartao" | "conta_corrente">("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState<string>("all");
  const [filterBankAccountId, setFilterBankAccountId] = useState<string>("all");
  const currentYM = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentYM);
  const handleMonthChange = (month: string | null) => {
    setSelectedMonth(month);
    setCurrentPage(1);
  };
  const itemsPerPage = 10;

  const defaultColWidths = { checkbox: 32, data: 65, dtPgto: 65, descricao: 0, orig: 44, tipo: 44, status: 50, valor: 85, categoria: 120, subcategoria: 120, pgto: 70, acao: 80 };
  const { colWidths, handleResizeStart } = useColumnWidths("categorizacao", defaultColWidths);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [subcategoryModalOpen, setSubcategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"receita" | "despesa">("despesa");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [modalCategoryId, setModalCategoryId] = useState("");

  const { data: uncategorizedTransactions = [], isLoading: uncategorizedLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/uncategorized"],
  });

  const { data: allTransactions = [], isLoading: allLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: allBudgetItems = [], isLoading: budgetItemsLoading } = useQuery<BudgetItem[]>({
    queryKey: ["/api/budget-items"],
  });

  const rawTransactions = showAll ? allTransactions : uncategorizedTransactions;
  const transactions = filterCardBillPayments(rawTransactions, allTransactions);
  const transactionsLoading = dataSource === "transacoes" ? (showAll ? allLoading : uncategorizedLoading) : false;

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const { data: beneficiaries = [] } = useQuery<Beneficiary[]>({
    queryKey: ["/api/beneficiaries"],
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({ shortTitle: "", amount: "", type: "despesa" as "receita" | "despesa", date: "" });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/uncategorized"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Transacao excluida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir transacao", variant: "destructive" });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/transactions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/uncategorized"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Transacao atualizada com sucesso!" });
      setEditDialogOpen(false);
      setEditingTransaction(null);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar transacao", variant: "destructive" });
    },
  });

  const handleEditTransaction = (t: Transaction) => {
    setEditingTransaction(t);
    setEditForm({
      shortTitle: t.shortTitle || t.description,
      amount: String(t.amount),
      type: t.type as "receita" | "despesa",
      date: t.date,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingTransaction) return;
    updateTransactionMutation.mutate({
      id: editingTransaction.id,
      data: {
        shortTitle: editForm.shortTitle,
        amount: editForm.amount,
        type: editForm.type,
        date: editForm.date,
      },
    });
  };

  const categorizeMutation = useMutation({
    mutationFn: async ({ id, categoryId, subcategoryId }: { id: number; categoryId: number; subcategoryId?: number }) => {
      return apiRequest("PATCH", `/api/transactions/${id}/categorize`, {
        categoryId,
        subcategoryId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/uncategorized"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Transacao categorizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao categorizar transacao", variant: "destructive" });
    },
  });

  const categorizeAllMutation = useMutation({
    mutationFn: async (items: { id: number; categoryId: number; subcategoryId?: number }[]) => {
      return apiRequest("POST", "/api/transactions/categorize-batch", { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/uncategorized"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Transacoes categorizadas com sucesso!" });
      setSelectedCategories({});
    },
    onError: () => {
      toast({ title: "Erro ao categorizar transacoes", variant: "destructive" });
    },
  });

  const categorizeBudgetBatchMutation = useMutation({
    mutationFn: async (items: { id: number; categoryId: number; subcategoryId?: number }[]) => {
      return apiRequest("POST", "/api/budget-items/categorize-batch", { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: "Itens de planejamento categorizados com sucesso!" });
      setSelectedCategories({});
    },
    onError: () => {
      toast({ title: "Erro ao categorizar itens de planejamento", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; color: string }) => {
      return apiRequest("POST", "/api/categories", data);
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      const newCategory = await response.json();
      setBulkCategoryId(String(newCategory.id));
      toast({ title: "Categoria criada com sucesso!" });
      setCategoryModalOpen(false);
      setNewCategoryName("");
    },
    onError: () => {
      toast({ title: "Erro ao criar categoria", variant: "destructive" });
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: async (data: { name: string; categoryId: number }) => {
      return apiRequest("POST", "/api/subcategories", data);
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      const newSubcategory = await response.json();
      setBulkSubcategoryId(String(newSubcategory.id));
      toast({ title: "Subcategoria criada com sucesso!" });
      setSubcategoryModalOpen(false);
      setNewSubcategoryName("");
    },
    onError: () => {
      toast({ title: "Erro ao criar subcategoria", variant: "destructive" });
    },
  });

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast({ title: "Nome da categoria e obrigatorio", variant: "destructive" });
      return;
    }
    createCategoryMutation.mutate({
      name: newCategoryName.trim(),
      type: newCategoryType,
      color: newCategoryColor,
    });
  };

  const handleCreateSubcategory = () => {
    if (!newSubcategoryName.trim()) {
      toast({ title: "Nome da subcategoria e obrigatorio", variant: "destructive" });
      return;
    }
    if (!modalCategoryId) {
      toast({ title: "Selecione uma categoria primeiro", variant: "destructive" });
      return;
    }
    createSubcategoryMutation.mutate({
      name: newSubcategoryName.trim(),
      categoryId: Number(modalCategoryId),
    });
  };

  const handleCategoryChange = (transactionId: number, categoryId: string) => {
    const subs = subcategories.filter((s) => s.categoryId === Number(categoryId) && s.active);
    const autoSubcategoryId = subs.length === 1 ? String(subs[0].id) : "";
    setSelectedCategories((prev) => ({
      ...prev,
      [transactionId]: { categoryId, subcategoryId: autoSubcategoryId },
    }));
  };

  const handleSubcategoryChange = (transactionId: number, subcategoryId: string) => {
    setSelectedCategories((prev) => ({
      ...prev,
      [transactionId]: { ...prev[transactionId], subcategoryId },
    }));
  };

  const handleCategorize = (itemId: number) => {
    const selection = selectedCategories[itemId];
    if (!selection?.categoryId) {
      toast({ title: "Selecione uma categoria", variant: "destructive" });
      return;
    }
    if (dataSource === "planejamento") {
      categorizeBudgetBatchMutation.mutate([{
        id: itemId,
        categoryId: Number(selection.categoryId),
        subcategoryId: selection.subcategoryId ? Number(selection.subcategoryId) : undefined,
      }]);
    } else {
      categorizeMutation.mutate({
        id: itemId,
        categoryId: Number(selection.categoryId),
        subcategoryId: selection.subcategoryId ? Number(selection.subcategoryId) : undefined,
      });
    }
  };

  const handleCategorizeAll = () => {
    const items = Object.entries(selectedCategories)
      .filter(([_, selection]) => selection.categoryId)
      .map(([id, selection]) => ({
        id: Number(id),
        categoryId: Number(selection.categoryId),
        subcategoryId: selection.subcategoryId ? Number(selection.subcategoryId) : undefined,
      }));

    if (items.length === 0) {
      toast({ title: "Selecione categorias para os itens", variant: "destructive" });
      return;
    }

    const mutation = dataSource === "planejamento" ? categorizeBudgetBatchMutation : categorizeAllMutation;
    mutation.mutate(items);
  };

  const getFilteredCategories = (type: string) => {
    return categories.filter((c) => c.active);
  };

  const getFilteredSubcategories = (categoryId: string) => {
    return subcategories.filter((s) => s.categoryId === Number(categoryId) && s.active);
  };

  // Ordenação
  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const SortableHeader = ({ column, children, resizeCol }: { column: typeof sortColumn; children: React.ReactNode; resizeCol?: string }) => (
    <TableHead 
      className="relative cursor-pointer select-none py-1"
      onClick={() => handleSort(column)}
      data-testid={`header-sort-${column}`}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column ? (
          sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : null}
      </div>
      {resizeCol && <ResizeHandle col={resizeCol} onResizeStart={handleResizeStart} />}
    </TableHead>
  );

  type UnifiedItem = {
    id: number;
    date: string;
    paymentDate: string | null;
    description: string;
    shortTitle: string | null;
    originalDescription: string | null;
    type: string;
    status: string;
    source: string | null;
    amount: string | number;
    categoryId: number | null;
    subcategoryId: number | null;
    beneficiaryId: number | null;
    bankAccountId: number | null;
    itemSource: "transaction" | "budget";
  };

  const budgetItemsForView: BudgetItem[] = (() => {
    if (dataSource !== "planejamento") return [];
    if (showAll) return allBudgetItems;
    return allBudgetItems.filter(b => !b.categoryId);
  })();

  const unifiedItems: UnifiedItem[] = dataSource === "transacoes"
    ? transactions.map(t => ({
        id: t.id,
        date: t.date,
        paymentDate: t.paymentDate,
        description: t.description,
        shortTitle: t.shortTitle,
        originalDescription: t.originalDescription,
        type: t.type,
        status: t.status,
        source: t.source,
        amount: t.amount,
        categoryId: t.categoryId,
        subcategoryId: t.subcategoryId,
        beneficiaryId: t.beneficiaryId,
        bankAccountId: t.bankAccountId,
        itemSource: "transaction" as const,
      }))
    : budgetItemsForView.map(b => ({
        id: b.id,
        date: b.transactionDate || `${b.yearMonth}-01`,
        paymentDate: b.billDueDate,
        description: b.description,
        shortTitle: b.shortTitle,
        originalDescription: null,
        type: b.type,
        status: "prevista",
        source: b.source,
        amount: b.amount,
        categoryId: b.categoryId,
        subcategoryId: b.subcategoryId,
        beneficiaryId: b.beneficiaryId,
        bankAccountId: null,
        itemSource: "budget" as const,
      }));

  const filteredTransactions = unifiedItems
    .filter((t) => {
      if (selectedMonth) {
        const txDate = t.date.substring(0, 7);
        if (txDate !== selectedMonth) return false;
      }
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterSource !== "all" && t.source !== filterSource) return false;
      if (filterCategoryId !== "all") {
        if (filterCategoryId === "empty" ? t.categoryId : t.categoryId !== Number(filterCategoryId)) return false;
      }
      if (filterSubcategoryId !== "all") {
        if (filterSubcategoryId === "empty" ? t.subcategoryId : t.subcategoryId !== Number(filterSubcategoryId)) return false;
      }
      if (filterBeneficiaryId !== "all") {
        if (filterBeneficiaryId === "empty" ? t.beneficiaryId : t.beneficiaryId !== Number(filterBeneficiaryId)) return false;
      }
      if (filterBankAccountId !== "all" && String(t.bankAccountId) !== filterBankAccountId) return false;
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        t.description.toLowerCase().includes(search) ||
        (t.originalDescription && t.originalDescription.toLowerCase().includes(search)) ||
        (t.shortTitle && t.shortTitle.toLowerCase().includes(search))
      );
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case "date":
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case "description":
          aVal = (a.shortTitle || a.description).toLowerCase();
          bVal = (b.shortTitle || b.description).toLowerCase();
          break;
        case "amount":
          const aAmount = typeof a.amount === 'string' ? parseFloat(a.amount) : a.amount;
          const bAmount = typeof b.amount === 'string' ? parseFloat(b.amount) : b.amount;
          aVal = a.type === "receita" ? aAmount : -aAmount;
          bVal = b.type === "receita" ? bAmount : -bAmount;
          break;
        case "type":
          aVal = a.type;
          bVal = b.type;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "source":
          aVal = a.source || "";
          bVal = b.source || "";
          break;
        case "subcategory":
          aVal = (subcategories.find(s => s.id === a.subcategoryId)?.name || "").toLowerCase();
          bVal = (subcategories.find(s => s.id === b.subcategoryId)?.name || "").toLowerCase();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  // Paginação
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Helper para nome da conta bancária
  const getBankAccountName = (bankAccountId: number | null) => {
    if (!bankAccountId) return "-";
    const account = bankAccounts.find((a) => a.id === bankAccountId);
    return account?.name || "-";
  };

  // Helper para ícone de origem
  const getSourceIcon = (source: string | null) => {
    switch (source) {
      case "cartao":
        return <CreditCard className="w-3 h-3" />;
      case "conta_corrente":
        return <Building2 className="w-3 h-3" />;
      default:
        return <PenLine className="w-3 h-3" />;
    }
  };

  const getSourceLabel = (source: string | null) => {
    switch (source) {
      case "cartao":
        return "Cartao";
      case "conta_corrente":
        return "Conta Corrente";
      default:
        return "Manual";
    }
  };

  const filteredTotals = filteredTransactions.reduce(
    (acc, t) => {
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
      if (t.type === "receita") acc.receitas += Math.abs(amount);
      else acc.despesas += Math.abs(amount);
      return acc;
    },
    { receitas: 0, despesas: 0 }
  );
  const filteredSaldo = filteredTotals.receitas - filteredTotals.despesas;

  const chartWindowMonths = useMemo(() => {
    if (!selectedMonth) return [];
    const [refY, refM] = selectedMonth.split("-").map(Number);
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(refY, refM - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }, [selectedMonth]);

  const allTxFiltered = useMemo(() => filterCardBillPayments(allTransactions, allTransactions), [allTransactions]);

  const globalChartData = useMemo(() => {
    if (chartWindowMonths.length === 0) return [];
    const monthSet = new Set(chartWindowMonths);
    const monthly = new Map<string, { receitas: number; despesas: number; recPlan: number; despPlan: number }>();
    for (const ym of chartWindowMonths) {
      monthly.set(ym, { receitas: 0, despesas: 0, recPlan: 0, despPlan: 0 });
    }

    for (const t of allTxFiltered) {
      const ym = getCompetenciaMonth(t);
      if (!monthSet.has(ym)) continue;
      const amount = Math.abs(typeof t.amount === "string" ? parseFloat(t.amount) : t.amount);
      const entry = monthly.get(ym)!;
      if (t.type === "receita") entry.receitas += amount;
      else entry.despesas += amount;
    }

    for (const b of allBudgetItems) {
      if (!b.active) continue;
      const ym = b.yearMonth;
      if (!monthSet.has(ym)) continue;
      const amount = Math.abs(typeof b.amount === "string" ? parseFloat(b.amount) : Number(b.amount));
      const entry = monthly.get(ym)!;
      if (b.type === "receita") entry.recPlan += amount;
      else entry.despPlan += amount;
    }

    return chartWindowMonths.map(ym => {
      const d = monthly.get(ym)!;
      return {
        month: ymToLabel(ym),
        receitas: Math.round(d.receitas * 100) / 100,
        despesas: Math.round(d.despesas * 100) / 100,
        saldo: Math.round((d.receitas - d.despesas) * 100) / 100,
        receitaPlan: Math.round(d.recPlan * 100) / 100,
        despesaPlan: Math.round(d.despPlan * 100) / 100,
        saldoPlan: Math.round((d.recPlan - d.despPlan) * 100) / 100,
      };
    });
  }, [allTxFiltered, allBudgetItems, chartWindowMonths]);

  const perCategoryCharts = useMemo(() => {
    if (chartWindowMonths.length === 0) return [];
    const monthSet = new Set(chartWindowMonths);
    const catMonthly = new Map<number, Map<string, { receitas: number; despesas: number; recPlan: number; despPlan: number }>>();

    for (const t of allTxFiltered) {
      if (!t.categoryId) continue;
      const ym = getCompetenciaMonth(t);
      if (!monthSet.has(ym)) continue;
      if (!catMonthly.has(t.categoryId)) {
        const m = new Map<string, { receitas: number; despesas: number; recPlan: number; despPlan: number }>();
        for (const ym2 of chartWindowMonths) m.set(ym2, { receitas: 0, despesas: 0, recPlan: 0, despPlan: 0 });
        catMonthly.set(t.categoryId, m);
      }
      const amount = Math.abs(typeof t.amount === "string" ? parseFloat(t.amount) : t.amount);
      const entry = catMonthly.get(t.categoryId)!.get(ym)!;
      if (t.type === "receita") entry.receitas += amount;
      else entry.despesas += amount;
    }

    for (const b of allBudgetItems) {
      if (!b.active || !b.categoryId) continue;
      const ym = b.yearMonth;
      if (!monthSet.has(ym)) continue;
      if (!catMonthly.has(b.categoryId)) {
        const m = new Map<string, { receitas: number; despesas: number; recPlan: number; despPlan: number }>();
        for (const ym2 of chartWindowMonths) m.set(ym2, { receitas: 0, despesas: 0, recPlan: 0, despPlan: 0 });
        catMonthly.set(b.categoryId, m);
      }
      const amount = Math.abs(typeof b.amount === "string" ? parseFloat(b.amount) : Number(b.amount));
      const entry = catMonthly.get(b.categoryId)!.get(ym)!;
      if (b.type === "receita") entry.recPlan += amount;
      else entry.despPlan += amount;
    }

    return Array.from(catMonthly.entries())
      .map(([catId, monthMap]) => {
        const cat = categories.find(c => c.id === catId);
        if (!cat) return null;
        const data = chartWindowMonths.map(ym => {
          const d = monthMap.get(ym)!;
          return {
            month: ymToLabel(ym),
            receitas: Math.round(d.receitas * 100) / 100,
            despesas: Math.round(d.despesas * 100) / 100,
            receitaPlan: Math.round(d.recPlan * 100) / 100,
            despesaPlan: Math.round(d.despPlan * 100) / 100,
          };
        });
        const hasData = data.some(d => d.receitas > 0 || d.despesas > 0 || d.receitaPlan > 0 || d.despesaPlan > 0);
        if (!hasData) return null;
        return { catId, catName: cat.name, catColor: cat.color || "#3B82F6", data };
      })
      .filter(Boolean)
      .sort((a, b) => a!.catName.localeCompare(b!.catName)) as { catId: number; catName: string; catColor: string; data: any[] }[];
  }, [allTxFiltered, allBudgetItems, categories, chartWindowMonths]);

  const formatK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);

  const pendingCount = unifiedItems.length;
  const filteredCount = filteredTransactions.length;
  const selectedCount = Object.values(selectedCategories).filter((s) => s.categoryId).length;
  
  // Calcular selecionados apenas entre os filtrados (TODOS os filtrados, não apenas os paginados)
  const filteredIds = new Set(filteredTransactions.map((t) => t.id));
  const filteredSelectedIds = new Set(Array.from(selectedIds).filter((id) => filteredIds.has(id)));
  const checkedCount = filteredSelectedIds.size;
  const allFilteredSelected = filteredCount > 0 && filteredSelectedIds.size === filteredCount;

  // Selecionar/Deselecionar todos os filtrados
  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselecionar apenas os filtrados
      const newSelected = new Set(selectedIds);
      filteredTransactions.forEach((t) => newSelected.delete(t.id));
      setSelectedIds(newSelected);
    } else {
      // Adicionar todos os filtrados à seleção
      const newSelected = new Set(selectedIds);
      filteredTransactions.forEach((t) => newSelected.add(t.id));
      setSelectedIds(newSelected);
    }
  };

  const handleToggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkCategorize = () => {
    if (!bulkCategoryId) {
      toast({ title: "Selecione uma categoria", variant: "destructive" });
      return;
    }
    if (filteredSelectedIds.size === 0) {
      toast({ title: "Selecione itens para categorizar", variant: "destructive" });
      return;
    }

    const items = Array.from(filteredSelectedIds).map((id) => ({
      id,
      categoryId: Number(bulkCategoryId),
      subcategoryId: bulkSubcategoryId ? Number(bulkSubcategoryId) : undefined,
    }));

    const mutation = dataSource === "planejamento" ? categorizeBudgetBatchMutation : categorizeAllMutation;
    mutation.mutate(items, {
      onSuccess: () => {
        const newSelected = new Set(selectedIds);
        items.forEach((item) => newSelected.delete(item.id));
        setSelectedIds(newSelected);
        setBulkCategoryId("");
        setBulkSubcategoryId("");
      },
    });
  };

  const bulkTransactionType = selectedIds.size > 0
    ? unifiedItems.find((t) => selectedIds.has(t.id))?.type || "despesa"
    : "despesa";
  const bulkCategories = getFilteredCategories(bulkTransactionType);
  const bulkSubcategories = getFilteredSubcategories(bulkCategoryId);

  const isLoading = dataSource === "transacoes" ? transactionsLoading : budgetItemsLoading;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Categorizar" selectedMonth={selectedMonth} onMonthChange={handleMonthChange} />
        <div className="px-4 py-3 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Categorizar" selectedMonth={selectedMonth} onMonthChange={handleMonthChange}>
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Visao</label>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as any); setCurrentPage(1); }}>
            <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ambos</SelectItem>
              <SelectItem value="realizada">Realizado</SelectItem>
              <SelectItem value="prevista">Planejado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Tipo</label>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v as any); setCurrentPage(1); }}>
            <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="receita">Receitas</SelectItem>
              <SelectItem value="despesa">Despesas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Origem</label>
          <Select value={filterSource} onValueChange={(v) => { setFilterSource(v as any); setCurrentPage(1); }}>
            <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="cartao">Cartao</SelectItem>
              <SelectItem value="conta_corrente">Cta Corrente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Categoria</label>
          <Select value={filterCategoryId} onValueChange={(v) => { setFilterCategoryId(v); setFilterSubcategoryId("all"); setCurrentPage(1); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="filter-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="empty">Vazio</SelectItem>
              {categories.filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Subcategoria</label>
          <Select value={filterSubcategoryId} onValueChange={(v) => { setFilterSubcategoryId(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-subcategory">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="empty">Vazio</SelectItem>
              {subcategories.filter(s => s.active && (filterCategoryId === "all" || filterCategoryId === "empty" || s.categoryId === Number(filterCategoryId))).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={showAll ? "default" : "outline"}
          size="sm"
          onClick={() => { setShowAll(!showAll); setCurrentPage(1); setSelectedIds(new Set()); setSelectedCategories({}); }}
          data-testid="button-toggle-show-all"
        >
          {showAll ? "Todas" : "Pendentes"}
        </Button>
      </PageHeader>
      <div className="px-4 py-3 space-y-3">

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              <span className="text-xs font-medium">Receitas</span>
            </div>
            <span className="text-lg font-bold text-success" data-testid="text-total-receitas">{formatCurrency(filteredTotals.receitas)}</span>
            <span className="text-xs text-muted-foreground ml-1">({filteredTransactions.filter(t => t.type === 'receita').length})</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-medium">Despesas</span>
            </div>
            <span className="text-lg font-bold text-destructive" data-testid="text-total-despesas">{formatCurrency(filteredTotals.despesas)}</span>
            <span className="text-xs text-muted-foreground ml-1">({filteredTransactions.filter(t => t.type === 'despesa').length})</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">Saldo</span>
            </div>
            <span className={`text-lg font-bold ${filteredSaldo >= 0 ? "text-success" : "text-destructive"}`} data-testid="text-saldo">{formatCurrency(filteredSaldo)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Transacoes</span>
            </div>
            <span className="text-lg font-bold" data-testid="text-count">{filteredCount}</span>
            <span className="text-xs text-muted-foreground ml-1">de {pendingCount}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <LineChartIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Evolucao Mensal (12 meses)</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={chartMode === "receita_despesa" ? "default" : "outline"}
                size="sm"
                className="text-[10px]"
                onClick={() => setChartMode("receita_despesa")}
                data-testid="button-chart-receita-despesa"
              >
                Receita vs Despesa
              </Button>
              <Button
                variant={chartMode === "planejado_realizado" ? "default" : "outline"}
                size="sm"
                className="text-[10px]"
                onClick={() => setChartMode("planejado_realizado")}
                data-testid="button-chart-planejado-realizado"
              >
                Planejado vs Realizado
              </Button>
            </div>
          </div>
          {globalChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={globalChartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatK} stroke="hsl(var(--muted-foreground))" width={45} />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '11px' }}
                />
                {chartMode === "receita_despesa" ? (
                  <>
                    <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
                  </>
                ) : (
                  <>
                    <Line type="monotone" dataKey="receitas" name="Receita Real." stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="despesas" name="Despesa Real." stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="receitaPlan" name="Receita Plan." stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="despesaPlan" name="Despesa Plan." stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
          )}
        </CardContent>
      </Card>

      {perCategoryCharts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <LineChartIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Graficos por Categoria (12 meses)</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {perCategoryCharts.map(chart => (
              <Card key={chart.catId}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: chart.catColor }} />
                    <span className="text-xs font-medium truncate" data-testid={`text-cat-chart-title-${chart.catId}`}>{chart.catName}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chart.data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="month" tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 8 }} tickFormatter={formatK} stroke="hsl(var(--muted-foreground))" width={35} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '10px' }}
                      />
                      {chartMode === "receita_despesa" ? (
                        <>
                          <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#10B981" strokeWidth={1.5} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#EF4444" strokeWidth={1.5} dot={{ r: 2 }} />
                        </>
                      ) : (
                        <>
                          <Line type="monotone" dataKey="receitas" name="Receita Real." stroke="#10B981" strokeWidth={1.5} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="despesas" name="Despesa Real." stroke="#EF4444" strokeWidth={1.5} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="receitaPlan" name="Receita Plan." stroke="#10B981" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 1.5 }} />
                          <Line type="monotone" dataKey="despesaPlan" name="Despesa Plan." stroke="#EF4444" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 1.5 }} />
                        </>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3 h-3" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-7 h-8 text-xs w-[100px]"
                  data-testid="input-search-categorization"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Beneficiario</Label>
              <Select value={filterBeneficiaryId} onValueChange={(v) => { setFilterBeneficiaryId(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-beneficiary">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="empty">Vazio</SelectItem>
                  {beneficiaries.filter(b => b.active).map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Pgto</Label>
              <Select value={filterBankAccountId} onValueChange={(v) => { setFilterBankAccountId(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[90px] h-8 text-xs" data-testid="filter-bank-account">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {bankAccounts.filter(a => a.active).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(filterBeneficiaryId !== "all" || filterBankAccountId !== "all") && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFilterBeneficiaryId("all"); setFilterBankAccountId("all"); setCurrentPage(1); }} data-testid="button-clear-filters">
                <X className="w-3 h-3 mr-0.5" />
                Limpar
              </Button>
            )}
            {checkedCount > 0 && (
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <Badge variant="secondary">
                  <CheckSquare className="w-3 h-3 mr-1" />
                  {checkedCount} sel.
                </Badge>
                <div className="flex gap-1">
                  <Select value={bulkCategoryId} onValueChange={(v) => { setBulkCategoryId(v); setBulkSubcategoryId(""); const subs = subcategories.filter(s => s.categoryId === Number(v) && s.active); if (subs.length === 1) setBulkSubcategoryId(String(subs[0].id)); }}>
                    <SelectTrigger className="w-[130px] h-8 text-xs shrink-0" data-testid="select-bulk-category">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkCategories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || "#3B82F6" }} />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setCategoryModalOpen(true)}
                    data-testid="button-add-bulk-category"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Select value={bulkSubcategoryId} onValueChange={setBulkSubcategoryId} disabled={!bulkCategoryId || bulkSubcategories.length === 0}>
                    <SelectTrigger className="w-[130px] h-8 text-xs shrink-0" data-testid="select-bulk-subcategory">
                      <SelectValue placeholder="Subcategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkSubcategories.map((sub) => (
                        <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => { setModalCategoryId(bulkCategoryId); setSubcategoryModalOpen(true); }}
                    disabled={!bulkCategoryId}
                    data-testid="button-add-bulk-subcategory"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={handleBulkCategorize}
                  disabled={categorizeAllMutation.isPending || categorizeBudgetBatchMutation.isPending || checkedCount === 0 || !bulkCategoryId}
                  data-testid="button-bulk-categorize"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Aplicar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tags className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{searchTerm ? "Nenhum item encontrado" : (showAll ? "Nenhum item encontrado para este periodo" : (dataSource === "planejamento" ? "Nenhum item de planejamento pendente de categorizacao" : "Nenhuma transacao pendente de categorizacao"))}</p>
              <p className="text-sm">{searchTerm ? "Tente outro termo de busca" : (showAll ? "Altere os filtros ou o mes de referencia" : "Clique em 'Todas' para ver itens ja categorizados")}</p>
            </div>
          ) : (
            <>
            <div className="overflow-hidden">
              <Table className="text-sm table-fixed w-full">
                <colgroup>
                  <col style={{ width: colWidths.checkbox + "px" }} />
                  <col style={{ width: colWidths.data + "px" }} />
                  <col style={{ width: colWidths.dtPgto + "px" }} />
                  <col style={colWidths.descricao ? { width: colWidths.descricao + "px" } : undefined} />
                  <col style={{ width: colWidths.orig + "px" }} />
                  <col style={{ width: colWidths.tipo + "px" }} />
                  <col style={{ width: colWidths.status + "px" }} />
                  <col style={{ width: colWidths.valor + "px" }} />
                  <col style={{ width: colWidths.categoria + "px" }} />
                  <col style={{ width: colWidths.subcategoria + "px" }} />
                  <col style={{ width: colWidths.pgto + "px" }} />
                  <col style={{ width: colWidths.acao + "px" }} />
                </colgroup>
                <TableHeader>
                  <TableRow className="h-7">
                    <TableHead className="py-1">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <SortableHeader column="date" resizeCol="data">Data</SortableHeader>
                    <TableHead className="relative py-1">Dt.Pgto<ResizeHandle col="dtPgto" onResizeStart={handleResizeStart} /></TableHead>
                    <SortableHeader column="description" resizeCol="descricao">Descricao</SortableHeader>
                    <SortableHeader column="source" resizeCol="orig">Orig.</SortableHeader>
                    <SortableHeader column="type" resizeCol="tipo">Tipo</SortableHeader>
                    <SortableHeader column="status" resizeCol="status">Visao</SortableHeader>
                    <TableHead 
                      className="relative text-right cursor-pointer select-none py-1"
                      onClick={() => handleSort("amount")}
                      data-testid="header-sort-amount"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Valor
                        {sortColumn === "amount" ? (
                          sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        ) : null}
                      </div>
                      <ResizeHandle col="valor" onResizeStart={handleResizeStart} />
                    </TableHead>
                    <TableHead className="relative py-1">Categoria<ResizeHandle col="categoria" onResizeStart={handleResizeStart} /></TableHead>
                    <SortableHeader column="subcategory" resizeCol="subcategoria">Subcateg.</SortableHeader>
                    <TableHead className="relative py-1">Pgto<ResizeHandle col="pgto" onResizeStart={handleResizeStart} /></TableHead>
                    <TableHead className="relative py-1">Acao<ResizeHandle col="acao" onResizeStart={handleResizeStart} /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((transaction) => {
                    const defaultSelection = {
                      categoryId: transaction.categoryId ? String(transaction.categoryId) : "",
                      subcategoryId: transaction.subcategoryId ? String(transaction.subcategoryId) : "",
                    };
                    const selection = selectedCategories[transaction.id] || defaultSelection;
                    const filteredCats = getFilteredCategories(transaction.type);
                    const filteredSubs = getFilteredSubcategories(selection.categoryId);

                    return (
                      <TableRow key={transaction.id} data-testid={`row-uncategorized-${transaction.id}`} className="h-8 text-xs">
                        <TableCell className="py-0.5">
                          <Checkbox
                            checked={selectedIds.has(transaction.id)}
                            onCheckedChange={() => handleToggleSelect(transaction.id)}
                            data-testid={`checkbox-select-${transaction.id}`}
                          />
                        </TableCell>
                        <TableCell className="py-0.5 whitespace-nowrap">{formatDate(transaction.date)}</TableCell>
                        <TableCell className="py-0.5 whitespace-nowrap text-xs">{transaction.paymentDate ? formatDate(transaction.paymentDate) : "-"}</TableCell>
                        <TableCell className="py-0.5 font-medium overflow-hidden truncate">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">{transaction.shortTitle || transaction.description}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-[300px]">{transaction.originalDescription || transaction.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">{getSourceIcon(transaction.source)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{getSourceLabel(transaction.source)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-0.5">
                          <Badge variant={transaction.type === "receita" ? "default" : "secondary"}>
                            {transaction.type === "receita" ? "R" : "D"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-0.5">
                          <Badge variant={transaction.status === "realizada" ? "default" : "outline"}>
                            {transaction.status === "realizada" ? "Real" : "Plan"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`py-0.5 text-right font-medium whitespace-nowrap ${transaction.type === "receita" ? "text-success" : "text-destructive"}`}>
                          {transaction.type === "receita" ? "+" : "-"}{formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell className="py-0.5 overflow-hidden">
                          <Select
                            value={selection.categoryId}
                            onValueChange={(v) => handleCategoryChange(transaction.id, v)}
                          >
                            <SelectTrigger className="w-full text-xs" data-testid={`select-category-${transaction.id}`}>
                              <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredCats.map((cat) => (
                                <SelectItem key={cat.id} value={String(cat.id)}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: cat.color || "#3B82F6" }}
                                    />
                                    <span className="truncate">{cat.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-0.5 overflow-hidden">
                          <Select
                            value={selection.subcategoryId}
                            onValueChange={(v) => handleSubcategoryChange(transaction.id, v)}
                            disabled={!selection.categoryId || filteredSubs.length === 0}
                          >
                            <SelectTrigger className="w-full text-xs" data-testid={`select-subcategory-${transaction.id}`}>
                              <SelectValue placeholder="Subcateg." />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredSubs.map((sub) => (
                                <SelectItem key={sub.id} value={String(sub.id)}>
                                  {sub.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-0.5 whitespace-nowrap text-xs truncate overflow-hidden">
                          {getBankAccountName(transaction.bankAccountId)}
                        </TableCell>
                        <TableCell className="py-0.5">
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleCategorize(transaction.id)}
                              disabled={!selection.categoryId || categorizeMutation.isPending || categorizeBudgetBatchMutation.isPending}
                              data-testid={`button-categorize-${transaction.id}`}
                            >
                              <Check className="w-3.5 h-3.5 text-success" />
                            </Button>
                            {transaction.itemSource === "transaction" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    const orig = transactions.find(t => t.id === transaction.id);
                                    if (orig) handleEditTransaction(orig);
                                  }}
                                  data-testid={`button-edit-${transaction.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => { if (confirm("Excluir esta transacao?")) deleteTransactionMutation.mutate(transaction.id); }}
                                  data-testid={`button-delete-${transaction.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="h-7 bg-muted/50 font-medium">
                    <TableCell className="py-0.5"></TableCell>
                    <TableCell colSpan={2} className="py-0.5 text-xs">
                      {filteredTransactions.length} {dataSource === "planejamento" ? "item(ns)" : "transacao(oes)"}
                    </TableCell>
                    <TableCell colSpan={5} className="py-0.5"></TableCell>
                    <TableCell className="py-0.5 text-right text-xs whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-success">+{formatCurrency(filteredTotals.receitas)}</span>
                        <span className="text-destructive">-{formatCurrency(filteredTotals.despesas)}</span>
                        <span className={filteredSaldo >= 0 ? "text-success" : "text-destructive"}>={formatCurrency(filteredSaldo)}</span>
                      </div>
                    </TableCell>
                    <TableCell colSpan={3} className="py-0.5"></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            
            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredCount)} de {filteredCount} registros
                  {checkedCount > 0 && ` (${checkedCount} selecionados de ${filteredCount} filtrados)`}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nome da categoria"
                data-testid="input-new-category-name"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newCategoryType} onValueChange={(v: "receita" | "despesa") => setNewCategoryType(v)}>
                <SelectTrigger data-testid="select-new-category-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  className="w-16 cursor-pointer"
                  data-testid="input-new-category-color"
                />
                <span className="text-sm text-muted-foreground">{newCategoryColor}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCategoryModalOpen(false)} data-testid="button-cancel-category">
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
                data-testid="button-save-category"
              >
                {createCategoryMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={subcategoryModalOpen} onOpenChange={setSubcategoryModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Subcategoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Categoria</Label>
              <Input
                value={categories.find(c => c.id === Number(modalCategoryId))?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                placeholder="Nome da subcategoria"
                data-testid="input-new-subcategory-name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSubcategoryModalOpen(false)} data-testid="button-cancel-subcategory">
                Cancelar
              </Button>
              <Button
                onClick={handleCreateSubcategory}
                disabled={createSubcategoryMutation.isPending}
                data-testid="button-save-subcategory"
              >
                {createSubcategoryMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Transacao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descricao</Label>
              <Input
                value={editForm.shortTitle}
                onChange={(e) => setEditForm({ ...editForm, shortTitle: e.target.value })}
                data-testid="input-edit-short-title"
              />
            </div>
            <div>
              <Label>Valor</Label>
              <Input
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                type="number"
                step="0.01"
                data-testid="input-edit-amount"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={editForm.type} onValueChange={(v: "receita" | "despesa") => setEditForm({ ...editForm, type: v })}>
                <SelectTrigger data-testid="select-edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                type="date"
                data-testid="input-edit-date"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateTransactionMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateTransactionMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
