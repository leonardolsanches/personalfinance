import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, TrendingUp, TrendingDown, ArrowUpDown, RotateCcw, CreditCard, Building2, ChevronUp, ChevronDown, PenLine, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { exportToExcel } from "@/lib/exportExcel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Transaction, Category, Subcategory, BankAccount, Beneficiary } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/page-header";

const transactionFormSchema = z.object({
  description: z.string().min(1, "Descricao e obrigatoria"),
  shortTitle: z.string().optional(),
  amount: z.string().min(1, "Valor e obrigatorio"),
  type: z.enum(["receita", "despesa"]),
  status: z.enum(["prevista", "realizada"]),
  date: z.string().min(1, "Data e obrigatoria"),
  transactionDate: z.string().optional(),
  paymentDate: z.string().optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  bankAccountId: z.string().optional(),
  notes: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringMonths: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

function formatCurrency(value: number | string) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR');
}

export default function Transacoes() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "prevista" | "realizada">("all");
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
  const [sortColumn, setSortColumn] = useState<"date" | "description" | "amount" | "type" | "status" | "category" | "subcategory" | "beneficiary" | "installmentCurrent" | "installmentTotal">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estados para seleção e edição em massa
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkShortTitle, setBulkShortTitle] = useState("");

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [subcategoryModalOpen, setSubcategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

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

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: "",
      shortTitle: "",
      amount: "",
      type: "despesa",
      status: "prevista",
      date: new Date().toISOString().split("T")[0],
      transactionDate: "",
      paymentDate: "",
      categoryId: "",
      subcategoryId: "",
      bankAccountId: "",
      notes: "",
      isRecurring: false,
      recurringMonths: "",
    },
  });

  const selectedType = form.watch("type");
  const selectedCategoryId = form.watch("categoryId");

  const filteredCategories = categories.filter((c) => c.type === selectedType && c.active);
  const filteredSubcategories = subcategories.filter(
    (s) => s.categoryId === Number(selectedCategoryId) && s.active
  );

  useEffect(() => {
    if (selectedCategoryId && filteredSubcategories.length === 1) {
      form.setValue("subcategoryId", String(filteredSubcategories[0].id));
    } else if (selectedCategoryId && filteredSubcategories.length !== 1) {
      form.setValue("subcategoryId", "");
    } else if (!selectedCategoryId) {
      form.setValue("subcategoryId", "");
    }
  }, [selectedCategoryId, filteredSubcategories]);

  const createMutation = useMutation({
    mutationFn: async (data: TransactionFormValues) => {
      return apiRequest("POST", "/api/transactions", {
        ...data,
        amount: data.amount,
        categoryId: data.categoryId ? Number(data.categoryId) : null,
        subcategoryId: data.subcategoryId ? Number(data.subcategoryId) : null,
        bankAccountId: data.bankAccountId ? Number(data.bankAccountId) : null,
        shortTitle: data.shortTitle || null,
        isRecurring: data.isRecurring || false,
        recurringMonths: data.recurringMonths ? Number(data.recurringMonths) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Transacao criada com sucesso!" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar transacao", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TransactionFormValues }) => {
      return apiRequest("PATCH", `/api/transactions/${id}`, {
        ...data,
        amount: data.amount,
        categoryId: data.categoryId ? Number(data.categoryId) : null,
        subcategoryId: data.subcategoryId ? Number(data.subcategoryId) : null,
        bankAccountId: data.bankAccountId ? Number(data.bankAccountId) : null,
        shortTitle: data.shortTitle || null,
        isRecurring: data.isRecurring || false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Transacao atualizada com sucesso!" });
      setDialogOpen(false);
      setEditingTransaction(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar transacao", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Transacao excluida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir transacao", variant: "destructive" });
    },
  });

  const updateShortTitleBatchMutation = useMutation({
    mutationFn: async ({ ids, shortTitle }: { ids: number[]; shortTitle: string }) => {
      return apiRequest("POST", "/api/transactions/update-short-title-batch", { ids, shortTitle });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Titulo breve atualizado com sucesso!" });
      setSelectedIds(new Set());
      setBulkShortTitle("");
    },
    onError: () => {
      toast({ title: "Erro ao atualizar titulo breve", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; color: string }) => {
      return apiRequest("POST", "/api/categories", data);
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      const newCategory = await response.json();
      form.setValue("categoryId", String(newCategory.id));
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
      form.setValue("subcategoryId", String(newSubcategory.id));
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
      type: selectedType || "despesa",
      color: newCategoryColor,
    });
  };

  const handleCreateSubcategory = () => {
    if (!newSubcategoryName.trim()) {
      toast({ title: "Nome da subcategoria e obrigatorio", variant: "destructive" });
      return;
    }
    if (!selectedCategoryId) {
      toast({ title: "Selecione uma categoria primeiro", variant: "destructive" });
      return;
    }
    createSubcategoryMutation.mutate({
      name: newSubcategoryName.trim(),
      categoryId: Number(selectedCategoryId),
    });
  };

  const handleOpenDialog = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      form.reset({
        description: transaction.description,
        shortTitle: transaction.shortTitle || "",
        amount: String(transaction.amount),
        type: transaction.type,
        status: transaction.status,
        date: transaction.date,
        transactionDate: transaction.transactionDate || "",
        paymentDate: transaction.paymentDate || "",
        categoryId: transaction.categoryId ? String(transaction.categoryId) : "",
        subcategoryId: transaction.subcategoryId ? String(transaction.subcategoryId) : "",
        bankAccountId: transaction.bankAccountId ? String(transaction.bankAccountId) : "",
        notes: transaction.notes || "",
        isRecurring: transaction.isRecurring || false,
      });
    } else {
      setEditingTransaction(null);
      form.reset();
    }
    setDialogOpen(true);
  };

  const onSubmit = (data: TransactionFormValues) => {
    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortHeader = ({ column, children }: { column: typeof sortColumn; children: React.ReactNode }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(column)}
      data-testid={`sort-${column}`}
    >
      {children}
      {sortColumn === column ? (
        sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );

  const getSourceBadge = (source: string | null) => {
    if (source === "cartao") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs">
              <CreditCard className="w-3 h-3" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Cartao de Credito</TooltipContent>
        </Tooltip>
      );
    }
    if (source === "conta_corrente") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs">
              <Building2 className="w-3 h-3" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Conta Corrente</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs">
            <PenLine className="w-3 h-3" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Manual</TooltipContent>
      </Tooltip>
    );
  };

  const filteredTransactions = transactions
    .filter((t) => !t.isCardBillPayment)
    .filter((t) => {
      const searchLower = searchTerm.toLowerCase();
      const amountStr = Math.abs(Number(t.amount)).toFixed(2);
      const amountFormatted = amountStr.replace(".", ",");
      const matchesSearch = t.description.toLowerCase().includes(searchLower) ||
        (t.shortTitle?.toLowerCase().includes(searchLower)) ||
        (t.originalDescription?.toLowerCase().includes(searchLower)) ||
        amountStr.includes(searchTerm) ||
        amountFormatted.includes(searchTerm);
      const matchesType = filterType === "all" || t.type === filterType;
      const matchesStatus = filterStatus === "all" || t.status === filterStatus;
      const matchesCategory = filterCategoryId === "all" || (filterCategoryId === "empty" ? !t.categoryId : t.categoryId === Number(filterCategoryId));
      const matchesSubcategory = filterSubcategoryId === "all" || (filterSubcategoryId === "empty" ? !t.subcategoryId : t.subcategoryId === Number(filterSubcategoryId));
      const matchesBeneficiary = filterBeneficiaryId === "all" || (filterBeneficiaryId === "empty" ? !t.beneficiaryId : t.beneficiaryId === Number(filterBeneficiaryId));
      const matchesBankAccount = filterBankAccountId === "all" || t.bankAccountId === Number(filterBankAccountId);
      const matchesMonth = !selectedMonth || (t.transactionDate || t.date).startsWith(selectedMonth);
      
      return matchesSearch && matchesType && matchesStatus && matchesCategory && matchesSubcategory && matchesBeneficiary && matchesBankAccount && matchesMonth;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "date":
          comparison = new Date(a.transactionDate || a.date).getTime() - new Date(b.transactionDate || b.date).getTime();
          break;
        case "description":
          comparison = (a.shortTitle || a.description).localeCompare(b.shortTitle || b.description);
          break;
        case "amount":
          // Considerar o sinal baseado no tipo: despesa = negativo, receita = positivo
          const aValue = parseFloat(String(a.amount)) * (a.type === "despesa" ? -1 : 1);
          const bValue = parseFloat(String(b.amount)) * (b.type === "despesa" ? -1 : 1);
          comparison = aValue - bValue;
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "category":
          const catA = categories.find((c) => c.id === a.categoryId)?.name || "";
          const catB = categories.find((c) => c.id === b.categoryId)?.name || "";
          comparison = catA.localeCompare(catB);
          break;
        case "subcategory":
          const subA = subcategories.find((s) => s.id === a.subcategoryId)?.name || "";
          const subB = subcategories.find((s) => s.id === b.subcategoryId)?.name || "";
          comparison = subA.localeCompare(subB);
          break;
        case "beneficiary":
          const benA = beneficiaries.find((ben) => ben.id === a.beneficiaryId)?.name || "";
          const benB = beneficiaries.find((ben) => ben.id === b.beneficiaryId)?.name || "";
          comparison = benA.localeCompare(benB);
          break;
        case "installmentCurrent":
          comparison = (a.installmentCurrent || 1) - (b.installmentCurrent || 1);
          break;
        case "installmentTotal":
          comparison = (a.installmentTotal || 1) - (b.installmentTotal || 1);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  // Paginação
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Cálculo de totais filtrados
  const filteredTotals = filteredTransactions.reduce(
    (acc, t) => {
      const amount = parseFloat(t.amount);
      if (t.type === "receita") {
        acc.receitas += amount;
      } else {
        acc.despesas += amount;
      }
      return acc;
    },
    { receitas: 0, despesas: 0 }
  );
  const filteredSaldo = filteredTotals.receitas - filteredTotals.despesas;

  // Funções de seleção
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredTransactions.map((t) => t.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkShortTitleUpdate = () => {
    if (selectedIds.size === 0) {
      toast({ title: "Selecione pelo menos uma transacao", variant: "destructive" });
      return;
    }
    if (!bulkShortTitle.trim()) {
      toast({ title: "Digite um titulo breve", variant: "destructive" });
      return;
    }
    updateShortTitleBatchMutation.mutate({
      ids: Array.from(selectedIds),
      shortTitle: bulkShortTitle.trim(),
    });
  };

  const getCategory = (categoryId: number | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId) || null;
  };

  const getCategoryName = (categoryId: number | null) => {
    return getCategory(categoryId)?.name || "-";
  };

  const getSubcategoryName = (subcategoryId: number | null) => {
    if (!subcategoryId) return "-";
    const subcategory = subcategories.find((s) => s.id === subcategoryId);
    return subcategory?.name || "-";
  };

  const getBeneficiaryName = (beneficiaryId: number | null) => {
    if (!beneficiaryId) return "-";
    const beneficiary = beneficiaries.find((b) => b.id === beneficiaryId);
    return beneficiary?.name || "-";
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Realizar" subtitle="Gerencie suas receitas e despesas" />
        <div className="px-4 py-3 space-y-6">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Realizar" subtitle="Gerencie suas receitas e despesas" selectedMonth={selectedMonth} onMonthChange={handleMonthChange}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const exportData = filteredTransactions.map((tx: Transaction) => ({
              Data: formatDate(tx.date),
              Descricao: tx.description || '',
              TituloBreve: tx.shortTitle || '',
              Tipo: tx.type === "receita" ? "Receita" : "Despesa",
              Status: tx.status === "prevista" ? "Prevista" : "Realizada",
              Valor: tx.type === "despesa" ? -Math.abs(parseFloat(tx.amount)) : Math.abs(parseFloat(tx.amount)),
              Categoria: categories.find(c => c.id === tx.categoryId)?.name || '',
              Subcategoria: subcategories.find(s => s.id === tx.subcategoryId)?.name || '',
              Beneficiario: beneficiaries.find(b => b.id === tx.beneficiaryId)?.name || '',
              ContaBancaria: bankAccounts.find(a => a.id === tx.bankAccountId)?.name || '',
              DataTransacao: tx.transactionDate ? formatDate(tx.transactionDate) : '',
              DataPagamento: tx.paymentDate ? formatDate(tx.paymentDate) : '',
              Parcela: tx.installmentCurrent ? `${tx.installmentCurrent}/${tx.installmentTotal}` : '',
              Recorrente: tx.isRecurring ? "Sim" : "Nao",
            }));
            exportToExcel(exportData, `realizacao_${new Date().toISOString().split('T')[0]}`, 'Realizacao');
            toast({ title: "Exportado!", description: `${exportData.length} transacoes exportadas para Excel.` });
          }}
          data-testid="button-export-transactions"
        >
          <FileDown className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-new-transaction">
              <Plus className="w-4 h-4 mr-2" />
              Nova Transacao
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? "Editar Transacao" : "Nova Transacao"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descricao</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Salario, Conta de luz..." {...field} data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shortTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titulo Breve (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Titulo resumido para exibicao..." {...field} data-testid="input-short-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0,00" {...field} data-testid="input-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="transactionDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Transacao</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-transaction-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Pagamento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-payment-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-type">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="receita">Receita</SelectItem>
                            <SelectItem value="despesa">Despesa</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="prevista">Prevista</SelectItem>
                            <SelectItem value="realizada">Realizada</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <div className="flex gap-1">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-category" className="flex-1">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredCategories.map((cat) => (
                                <SelectItem key={cat.id} value={String(cat.id)}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setCategoryModalOpen(true)}
                            disabled={!selectedType}
                            data-testid="button-add-category"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subcategoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategoria</FormLabel>
                        <div className="flex gap-1">
                          <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCategoryId}>
                            <FormControl>
                              <SelectTrigger data-testid="select-subcategory" className="flex-1">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredSubcategories.map((sub) => (
                                <SelectItem key={sub.id} value={String(sub.id)}>
                                  {sub.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setSubcategoryModalOpen(true)}
                            disabled={!selectedCategoryId}
                            data-testid="button-add-subcategory"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bank-account">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bankAccounts.filter(b => b.active).map((acc) => (
                            <SelectItem key={acc.id} value={String(acc.id)}>
                              {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observacoes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Observacoes opcionais..." {...field} data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-recurring"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Transacao recorrente</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("isRecurring") && (
                  <FormField
                    control={form.control}
                    name="recurringMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repetir por quantos meses?</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="60"
                            placeholder="Ex: 12"
                            data-testid="input-recurring-months"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Sera criada uma transacao para cada mes a partir da data inicial
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-transaction"
                  >
                    {editingTransaction ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
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
            <span className="text-lg font-bold" data-testid="text-count">{filteredTransactions.length}</span>
            <span className="text-xs text-muted-foreground ml-1">de {transactions.filter(t => !t.isCardBillPayment).length}</span>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-3">
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
                  data-testid="input-search"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v as any); setCurrentPage(1); }}>
                <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="filter-type">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="receita">Receitas</SelectItem>
                  <SelectItem value="despesa">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as any); setCurrentPage(1); }}>
                <SelectTrigger className="w-[90px] h-8 text-xs" data-testid="filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="prevista">Previstas</SelectItem>
                  <SelectItem value="realizada">Realizadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={filterCategoryId} onValueChange={(v) => { setFilterCategoryId(v); setFilterSubcategoryId("all"); setCurrentPage(1); }}>
                <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="filter-category">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="empty">Vazio</SelectItem>
                  {categories.filter(c => c.active).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.type === "receita" ? "rec." : "desp."})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Subcategoria</Label>
              <Select value={filterSubcategoryId} onValueChange={(v) => { setFilterSubcategoryId(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-subcategory">
                  <SelectValue placeholder="Todas" />
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
            {(filterCategoryId !== "all" || filterSubcategoryId !== "all" || filterBeneficiaryId !== "all" || filterBankAccountId !== "all") && (
              <Button variant="ghost" size="sm" className="self-end" onClick={() => { setFilterCategoryId("all"); setFilterSubcategoryId("all"); setFilterBeneficiaryId("all"); setFilterBankAccountId("all"); setCurrentPage(1); }}>
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowUpDown className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma transacao encontrada</p>
              <p className="text-sm">Clique em "Nova Transacao" para comecar</p>
            </div>
          ) : (
            <>
            {/* Barra de ações em massa */}
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-md">
                <Badge variant="secondary">
                  {selectedIds.size} selecionadas
                </Badge>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Titulo breve..."
                    value={bulkShortTitle}
                    onChange={(e) => setBulkShortTitle(e.target.value)}
                    className="w-[200px]"
                    data-testid="input-bulk-short-title"
                  />
                  <Button
                    onClick={handleBulkShortTitleUpdate}
                    disabled={updateShortTitleBatchMutation.isPending || !bulkShortTitle.trim()}
                    data-testid="button-apply-bulk-short-title"
                  >
                    Aplicar Titulo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setSelectedIds(new Set()); setBulkShortTitle(""); }}
                    data-testid="button-clear-selection"
                  >
                    Limpar Selecao
                  </Button>
                </div>
              </div>
            )}
            <div className="overflow-hidden">
              <Table className="text-sm table-fixed w-full">
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "72px" }} />
                  <col style={{ width: "72px" }} />
                  <col />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "44px" }} />
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "50px" }} />
                  <col style={{ width: "50px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "60px" }} />
                </colgroup>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead className="py-1.5">
                      <Checkbox
                        checked={filteredTransactions.length > 0 && filteredTransactions.every((t) => selectedIds.has(t.id))}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="py-1.5">
                      <SortHeader column="date">Dt. Trans.</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5">Dt. Pgto.</TableHead>
                    <TableHead className="py-1.5">
                      <SortHeader column="description">Descricao</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5">
                      <SortHeader column="category">Categoria</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5">
                      <SortHeader column="subcategory">Subcateg.</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5">
                      <SortHeader column="beneficiary">Benefic.</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5">Orig.</TableHead>
                    <TableHead className="py-1.5">
                      <SortHeader column="installmentCurrent">Pc</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5">
                      <SortHeader column="installmentTotal">Tt</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5">
                      <SortHeader column="type">Tipo</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5">
                      <SortHeader column="status">Status</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5 text-right">
                      <SortHeader column="amount">Valor</SortHeader>
                    </TableHead>
                    <TableHead className="py-1.5">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="h-10" data-testid={`row-transaction-${transaction.id}`}>
                      <TableCell className="py-1.5">
                        <Checkbox
                          checked={selectedIds.has(transaction.id)}
                          onCheckedChange={(checked) => toggleSelectOne(transaction.id, !!checked)}
                          data-testid={`checkbox-select-${transaction.id}`}
                        />
                      </TableCell>
                      <TableCell className="py-1.5 text-xs whitespace-nowrap">{transaction.transactionDate ? formatDate(transaction.transactionDate) : formatDate(transaction.date)}</TableCell>
                      <TableCell className="py-1.5 text-xs whitespace-nowrap">{transaction.paymentDate ? formatDate(transaction.paymentDate) : formatDate(transaction.date)}</TableCell>
                      <TableCell className="py-1.5 overflow-hidden">
                        <div className="flex items-center gap-1 min-w-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-medium text-sm truncate cursor-default">
                                {transaction.shortTitle || transaction.description}
                              </span>
                            </TooltipTrigger>
                            {transaction.originalDescription && transaction.originalDescription !== (transaction.shortTitle || transaction.description) && (
                              <TooltipContent>
                                <p className="max-w-[300px] text-xs">{transaction.originalDescription}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                          {transaction.isRefund && (
                            <Badge variant="outline" className="text-xs bg-success/10 text-success shrink-0">
                              <RotateCcw className="w-2.5 h-2.5" />
                            </Badge>
                          )}
                          {transaction.isRecurring && (
                            <Badge variant="outline" className="text-xs shrink-0">R</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 overflow-hidden">
                        {(() => {
                          const cat = getCategory(transaction.categoryId);
                          return cat ? (
                            <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} />
                          ) : <span className="text-xs text-muted-foreground">-</span>;
                        })()}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground truncate overflow-hidden">
                        {getSubcategoryName(transaction.subcategoryId)}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground truncate overflow-hidden">
                        {getBeneficiaryName(transaction.beneficiaryId)}
                      </TableCell>
                      <TableCell className="py-1.5">
                        {getSourceBadge(transaction.source)}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-center">
                        {transaction.installmentCurrent || 1}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-center">
                        {transaction.installmentTotal || 1}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant={transaction.type === "receita" ? "default" : "secondary"} className="text-xs">
                          {transaction.type === "receita" ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant={transaction.status === "realizada" ? "default" : "outline"} className="text-xs">
                          {transaction.status === "realizada" ? "Real" : "Prev"}
                        </Badge>
                      </TableCell>
                      <TableCell className={`py-1.5 text-right font-medium text-sm whitespace-nowrap ${transaction.type === "receita" ? "text-success" : "text-destructive"}`}>
                        {transaction.type === "receita" ? "+" : "-"}{formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleOpenDialog(transaction)}
                            data-testid={`button-edit-${transaction.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteMutation.mutate(transaction.id)}
                            data-testid={`button-delete-${transaction.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="h-9 bg-muted/50 font-medium">
                    <TableCell colSpan={3} className="py-1.5 text-xs">
                      {filteredTransactions.length} transacao(oes)
                    </TableCell>
                    <TableCell colSpan={9} className="py-1.5"></TableCell>
                    <TableCell className="py-1.5 text-right text-xs whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-success">+{formatCurrency(filteredTotals.receitas)}</span>
                        <span className="text-destructive">-{formatCurrency(filteredTotals.despesas)}</span>
                        <span className={filteredSaldo >= 0 ? "text-success" : "text-destructive"}>={formatCurrency(filteredSaldo)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5"></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} de {filteredTransactions.length} registros
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
                value={categories.find(c => c.id === Number(selectedCategoryId))?.name || ""}
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
      </div>
    </div>
  );
}
