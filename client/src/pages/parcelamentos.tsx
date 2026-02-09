import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
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
import { CreditCard, Building2, PenLine, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Transaction, Category, Subcategory, BankAccount, Beneficiary } from "@shared/schema";
import { PageHeader } from "@/components/page-header";

type SortColumn = "description" | "category" | "installmentValue" | "paidCount" | "pendingCount" | "installmentTotal" | "progressPercent" | "pendingValue" | "totalValue";
type SortDirection = "asc" | "desc";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface InstallmentGroup {
  key: string;
  description: string;
  shortTitle: string | null;
  originalDescription: string | null;
  categoryId: number | null;
  subcategoryId: number | null;
  bankAccountId: number | null;
  beneficiaryId: number | null;
  source: string | null;
  installmentTotal: number;
  installments: Transaction[];
  paidCount: number;
  pendingCount: number;
  installmentValue: number;
  totalValue: number;
  paidValue: number;
  pendingValue: number;
  progressPercent: number;
}

export default function Parcelamentos() {
  const { toast } = useToast();
  const [sortColumn, setSortColumn] = useState<SortColumn>("pendingValue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [bulkShortTitle, setBulkShortTitle] = useState("");
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState<string>("");

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState<string>("all");
  const [filterBankAccountId, setFilterBankAccountId] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterTransactionDateFrom, setFilterTransactionDateFrom] = useState<string>("");
  const [filterTransactionDateTo, setFilterTransactionDateTo] = useState<string>("");
  const [filterPaymentDateFrom, setFilterPaymentDateFrom] = useState<string>("");
  const [filterPaymentDateTo, setFilterPaymentDateTo] = useState<string>("");

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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const installmentGroups: InstallmentGroup[] = useMemo(() => {
    const groups: InstallmentGroup[] = [];
    const groupedByInstallmentId = new Map<string, Transaction[]>();

    transactions
      .filter((t) => !t.isCardBillPayment)
      .forEach((t) => {
        if (t.installmentTotal && t.installmentTotal > 1) {
          const groupKey = t.installmentGroupId || `${t.description}-${t.installmentTotal}`;
          if (!groupedByInstallmentId.has(groupKey)) {
            groupedByInstallmentId.set(groupKey, []);
          }
          groupedByInstallmentId.get(groupKey)!.push(t);
        }
      });

    groupedByInstallmentId.forEach((installments, key) => {
      const first = installments[0];
      const installmentTotal = first.installmentTotal!;
      const paidInstallments = installments.filter((i) => i.status === "realizada");
      const pendingInstallments = installments.filter((i) => i.status === "prevista");
      
      if (pendingInstallments.length > 0) {
        const installmentValue = Math.abs(parseFloat(first.amount));
        const paidCount = paidInstallments.length;
        const pendingCount = installmentTotal - paidCount;
        const paidValue = paidCount * installmentValue;
        const pendingValue = pendingCount * installmentValue;
        const totalValue = installmentTotal * installmentValue;
        const progressPercent = Math.round((paidCount / installmentTotal) * 100);

        groups.push({
          key,
          description: first.description,
          shortTitle: first.shortTitle,
          originalDescription: first.originalDescription,
          categoryId: first.categoryId,
          subcategoryId: first.subcategoryId,
          bankAccountId: first.bankAccountId,
          beneficiaryId: first.beneficiaryId,
          source: first.source,
          installmentTotal,
          installments: installments.sort((a, b) => (a.installmentCurrent || 0) - (b.installmentCurrent || 0)),
          paidCount,
          pendingCount,
          installmentValue,
          totalValue,
          paidValue,
          pendingValue,
          progressPercent,
        });
      }
    });

    return groups;
  }, [transactions]);

  const getCategoryNameForGroup = (categoryId: number | null) => {
    if (!categoryId) return "";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "";
  };

  // Apply filters
  const filteredGroups = useMemo(() => {
    return installmentGroups.filter((group) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesDescription = group.description.toLowerCase().includes(term);
        const matchesShortTitle = group.shortTitle?.toLowerCase().includes(term) || false;
        const matchesOriginal = group.originalDescription?.toLowerCase().includes(term) || false;
        const amountStr = Math.abs(group.installmentValue).toFixed(2);
        const amountFormatted = amountStr.replace(".", ",");
        const matchesAmount = amountStr.includes(searchTerm) || amountFormatted.includes(searchTerm);
        if (!matchesDescription && !matchesShortTitle && !matchesOriginal && !matchesAmount) {
          return false;
        }
      }

      // Category filter
      if (filterCategoryId !== "all" && group.categoryId !== parseInt(filterCategoryId)) {
        return false;
      }

      // Subcategory filter
      if (filterSubcategoryId !== "all" && group.subcategoryId !== parseInt(filterSubcategoryId)) {
        return false;
      }

      // Beneficiary filter
      if (filterBeneficiaryId !== "all" && group.beneficiaryId !== parseInt(filterBeneficiaryId)) {
        return false;
      }

      // Bank account filter
      if (filterBankAccountId !== "all" && group.bankAccountId !== parseInt(filterBankAccountId)) {
        return false;
      }

      // Source filter
      if (filterSource !== "all" && group.source !== filterSource) {
        return false;
      }

      // Transaction date filter (check if any installment matches)
      if (filterTransactionDateFrom || filterTransactionDateTo) {
        const hasMatchingTransactionDate = group.installments.some((t) => {
          if (!t.transactionDate) return false;
          if (filterTransactionDateFrom && t.transactionDate < filterTransactionDateFrom) return false;
          if (filterTransactionDateTo && t.transactionDate > filterTransactionDateTo) return false;
          return true;
        });
        if (!hasMatchingTransactionDate) return false;
      }

      // Payment date filter (check if any installment matches)
      if (filterPaymentDateFrom || filterPaymentDateTo) {
        const hasMatchingPaymentDate = group.installments.some((t) => {
          if (!t.paymentDate) return false;
          if (filterPaymentDateFrom && t.paymentDate < filterPaymentDateFrom) return false;
          if (filterPaymentDateTo && t.paymentDate > filterPaymentDateTo) return false;
          return true;
        });
        if (!hasMatchingPaymentDate) return false;
      }

      return true;
    });
  }, [installmentGroups, searchTerm, filterCategoryId, filterSubcategoryId, filterBeneficiaryId, filterBankAccountId, filterSource, filterTransactionDateFrom, filterTransactionDateTo, filterPaymentDateFrom, filterPaymentDateTo]);

  const hasActiveFilters = searchTerm || filterCategoryId !== "all" || filterSubcategoryId !== "all" || filterBeneficiaryId !== "all" || filterBankAccountId !== "all" || filterSource !== "all" || filterTransactionDateFrom || filterTransactionDateTo || filterPaymentDateFrom || filterPaymentDateTo;

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCategoryId("all");
    setFilterSubcategoryId("all");
    setFilterBeneficiaryId("all");
    setFilterBankAccountId("all");
    setFilterSource("all");
    setFilterTransactionDateFrom("");
    setFilterTransactionDateTo("");
    setFilterPaymentDateFrom("");
    setFilterPaymentDateTo("");
    setSelectedGroups(new Set());
  };

  // Available subcategories based on selected category filter
  const filterSubcategoriesOptions = filterCategoryId !== "all"
    ? subcategories.filter((s) => s.categoryId === parseInt(filterCategoryId))
    : subcategories;

  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case "description":
          aVal = (a.shortTitle || a.description).toLowerCase();
          bVal = (b.shortTitle || b.description).toLowerCase();
          break;
        case "category":
          aVal = getCategoryNameForGroup(a.categoryId).toLowerCase();
          bVal = getCategoryNameForGroup(b.categoryId).toLowerCase();
          break;
        case "installmentValue":
          aVal = a.installmentValue;
          bVal = b.installmentValue;
          break;
        case "paidCount":
          aVal = a.paidCount;
          bVal = b.paidCount;
          break;
        case "pendingCount":
          aVal = a.pendingCount;
          bVal = b.pendingCount;
          break;
        case "installmentTotal":
          aVal = a.installmentTotal;
          bVal = b.installmentTotal;
          break;
        case "progressPercent":
          aVal = a.progressPercent;
          bVal = b.progressPercent;
          break;
        case "pendingValue":
          aVal = a.pendingValue;
          bVal = b.pendingValue;
          break;
        case "totalValue":
          aVal = a.totalValue;
          bVal = b.totalValue;
          break;
        default:
          aVal = a.pendingValue;
          bVal = b.pendingValue;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredGroups, sortColumn, sortDirection, categories]);

  // Totals based on filtered groups
  const totalPending = filteredGroups.reduce((sum, g) => sum + g.pendingValue, 0);
  const totalAll = filteredGroups.reduce((sum, g) => sum + g.totalValue, 0);

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return null;
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || null;
  };

  const getSubcategoryName = (subcategoryId: number | null) => {
    if (!subcategoryId) return null;
    const subcategory = subcategories.find((s) => s.id === subcategoryId);
    return subcategory?.name || null;
  };

  const getCategoryColor = (categoryId: number | null) => {
    if (!categoryId) return "#6b7280";
    const category = categories.find((c) => c.id === categoryId);
    return category?.color || "#6b7280";
  };

  const getBankAccountName = (bankAccountId: number | null) => {
    if (!bankAccountId) return null;
    const account = bankAccounts.find((a) => a.id === bankAccountId);
    return account?.name || null;
  };

  const getSourceIcon = (source: string | null) => {
    if (source === "cartao") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Cartao de Credito</TooltipContent>
        </Tooltip>
      );
    }
    if (source === "conta_corrente") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Conta Corrente</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">
            <PenLine className="w-3.5 h-3.5 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Manual</TooltipContent>
      </Tooltip>
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = new Set(sortedGroups.map((g) => g.key));
      setSelectedGroups(allKeys);
    } else {
      setSelectedGroups(new Set());
    }
  };

  const toggleSelectOne = (key: string, checked: boolean) => {
    const newSet = new Set(selectedGroups);
    if (checked) {
      newSet.add(key);
    } else {
      newSet.delete(key);
    }
    setSelectedGroups(newSet);
  };

  const getSelectedTransactionIds = (): number[] => {
    const ids: number[] = [];
    selectedGroups.forEach((key) => {
      const group = installmentGroups.find((g) => g.key === key);
      if (group) {
        group.installments.forEach((t) => ids.push(t.id));
      }
    });
    return ids;
  };

  const updateShortTitleBatchMutation = useMutation({
    mutationFn: async ({ ids, shortTitle }: { ids: number[]; shortTitle: string }) => {
      return apiRequest("POST", "/api/transactions/update-short-title-batch", { ids, shortTitle });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setBulkShortTitle("");
      setSelectedGroups(new Set());
      toast({
        title: "Titulo breve atualizado",
        description: "Todas as transações selecionadas foram atualizadas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Ocorreu um erro ao atualizar o titulo breve.",
        variant: "destructive",
      });
    },
  });

  const categorizeBatchMutation = useMutation({
    mutationFn: async ({ items }: { items: { id: number; categoryId: number | null; subcategoryId: number | null }[] }) => {
      return apiRequest("POST", "/api/transactions/categorize-batch", { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setBulkCategoryId("");
      setBulkSubcategoryId("");
      setSelectedGroups(new Set());
      toast({
        title: "Categoria atualizada",
        description: "Todas as transações selecionadas foram categorizadas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao categorizar",
        description: error.message || "Ocorreu um erro ao categorizar as transações.",
        variant: "destructive",
      });
    },
  });

  const handleBulkShortTitleUpdate = () => {
    const ids = getSelectedTransactionIds();
    if (ids.length === 0 || !bulkShortTitle.trim()) return;
    updateShortTitleBatchMutation.mutate({ ids, shortTitle: bulkShortTitle.trim() });
  };

  const handleBulkCategorize = () => {
    const ids = getSelectedTransactionIds();
    if (ids.length === 0 || !bulkCategoryId) return;
    
    const categoryIdNum = parseInt(bulkCategoryId);
    const subcategoryIdNum = bulkSubcategoryId ? parseInt(bulkSubcategoryId) : null;
    
    const items = ids.map((id) => ({
      id,
      categoryId: categoryIdNum,
      subcategoryId: subcategoryIdNum,
    }));
    
    categorizeBatchMutation.mutate({ items });
  };

  const filteredSubcategories = bulkCategoryId 
    ? subcategories.filter((s) => s.categoryId === parseInt(bulkCategoryId))
    : [];

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Visao Parcelado" />
        <div className="px-4 py-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Visao Parcelado" />
      <div className="px-4 py-3 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Valor Pendente</p>
                <p className="text-lg font-bold text-destructive" data-testid="text-pending-value">{formatCurrency(totalPending)}</p>
                <p className="text-xs text-muted-foreground">Total a pagar</p>
              </div>
              <div className="p-2 rounded-lg bg-muted text-destructive">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold" data-testid="text-total-value">{formatCurrency(totalAll)}</p>
                <p className="text-xs text-muted-foreground">Soma de todas as parcelas</p>
              </div>
              <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Parcelamentos</p>
                <p className="text-lg font-bold" data-testid="text-groups-count">
                  {filteredGroups.length}
                  {hasActiveFilters && <span className="text-sm font-normal text-muted-foreground"> / {installmentGroups.length}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{hasActiveFilters ? "Filtrados / Total" : "Em andamento"}</p>
              </div>
              <Badge variant="secondary">{filteredGroups.length}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 flex-wrap mb-3">
            <div className="flex flex-col gap-1 w-[120px]">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={filterCategoryId} onValueChange={(v) => { setFilterCategoryId(v); setFilterSubcategoryId("all"); }}>
                <SelectTrigger data-testid="select-filter-category" className="w-[110px] h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.filter(c => c.type === "despesa").map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Subcategoria</Label>
              <Select value={filterSubcategoryId} onValueChange={setFilterSubcategoryId} disabled={filterCategoryId === "all"}>
                <SelectTrigger data-testid="select-filter-subcategory" className="w-[110px] h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {filterSubcategoriesOptions.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id.toString()}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Beneficiario</Label>
              <Select value={filterBeneficiaryId} onValueChange={setFilterBeneficiaryId}>
                <SelectTrigger data-testid="select-filter-beneficiary" className="w-[100px] h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {beneficiaries.map((ben) => (
                    <SelectItem key={ben.id} value={ben.id.toString()}>
                      {ben.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Pgto</Label>
              <Select value={filterBankAccountId} onValueChange={setFilterBankAccountId}>
                <SelectTrigger data-testid="select-filter-bank-account" className="w-[100px] h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Origem</Label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger data-testid="select-filter-source" className="w-[90px] h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="cartao">Cartao</SelectItem>
                  <SelectItem value="conta_corrente">Cta Cte</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 self-end"
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                Limpar
              </Button>
            )}
          </div>

          {selectedGroups.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-md">
              <Badge variant="secondary" data-testid="text-selected-count">
                {selectedGroups.size} selecionados
              </Badge>
              
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Titulo breve..."
                  value={bulkShortTitle}
                  onChange={(e) => setBulkShortTitle(e.target.value)}
                  className="w-[180px]"
                  data-testid="input-bulk-short-title"
                />
                <Button
                  size="sm"
                  onClick={handleBulkShortTitleUpdate}
                  disabled={updateShortTitleBatchMutation.isPending || !bulkShortTitle.trim()}
                  data-testid="button-apply-bulk-short-title"
                >
                  Aplicar Titulo
                </Button>
              </div>

              <div className="h-6 w-px bg-border mx-1" />

              <div className="flex items-center gap-2">
                <Select value={bulkCategoryId} onValueChange={(v) => { setBulkCategoryId(v); setBulkSubcategoryId(""); }}>
                  <SelectTrigger className="w-[150px]" data-testid="select-bulk-category">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === "despesa").map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={bulkSubcategoryId} 
                  onValueChange={setBulkSubcategoryId}
                  disabled={!bulkCategoryId}
                >
                  <SelectTrigger className="w-[150px]" data-testid="select-bulk-subcategory">
                    <SelectValue placeholder="Subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id.toString()}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  onClick={handleBulkCategorize}
                  disabled={categorizeBatchMutation.isPending || !bulkCategoryId}
                  data-testid="button-apply-bulk-category"
                >
                  Aplicar Categoria
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedGroups(new Set())}
                data-testid="button-clear-selection"
              >
                Limpar Selecao
              </Button>
            </div>
          )}

          {installmentGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum parcelamento em andamento</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <Table className="text-sm table-fixed w-full">
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "44px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "50px" }} />
                  <col style={{ width: "55px" }} />
                  <col style={{ width: "40px" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "85px" }} />
                  <col style={{ width: "85px" }} />
                </colgroup>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead className="py-1.5">
                      <Checkbox
                        checked={sortedGroups.length > 0 && sortedGroups.every((g) => selectedGroups.has(g.key))}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead 
                      className="py-1.5 cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("description")}
                      data-testid="header-description"
                    >
                      <div className="flex items-center">
                        Descricao
                        {getSortIcon("description")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="py-1.5 cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("category")}
                      data-testid="header-category"
                    >
                      <div className="flex items-center">
                        Categoria
                        {getSortIcon("category")}
                      </div>
                    </TableHead>
                    <TableHead className="py-1.5">Orig.</TableHead>
                    <TableHead className="py-1.5">Pgto</TableHead>
                    <TableHead 
                      className="py-1.5 text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("installmentValue")}
                      data-testid="header-installment-value"
                    >
                      <div className="flex items-center justify-end">
                        Parcela
                        {getSortIcon("installmentValue")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="py-1.5 text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("paidCount")}
                      data-testid="header-paid-count"
                    >
                      <div className="flex items-center justify-center">
                        Pagas
                        {getSortIcon("paidCount")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="py-1.5 text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("pendingCount")}
                      data-testid="header-pending-count"
                    >
                      <div className="flex items-center justify-center">
                        Pend.
                        {getSortIcon("pendingCount")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="py-1.5 text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("installmentTotal")}
                      data-testid="header-total-count"
                    >
                      <div className="flex items-center justify-center">
                        Tt
                        {getSortIcon("installmentTotal")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="py-1.5 text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("progressPercent")}
                      data-testid="header-progress"
                    >
                      <div className="flex items-center justify-center">
                        Evolucao
                        {getSortIcon("progressPercent")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="py-1.5 text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("pendingValue")}
                      data-testid="header-pending-value"
                    >
                      <div className="flex items-center justify-end">
                        Vl Pend.
                        {getSortIcon("pendingValue")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="py-1.5 text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("totalValue")}
                      data-testid="header-total-value"
                    >
                      <div className="flex items-center justify-end">
                        Vl Total
                        {getSortIcon("totalValue")}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedGroups.map((group) => {
                    const categoryName = getCategoryName(group.categoryId);
                    const subcategoryName = getSubcategoryName(group.subcategoryId);
                    const categoryColor = getCategoryColor(group.categoryId);
                    const bankAccountName = getBankAccountName(group.bankAccountId);

                    return (
                      <TableRow key={group.key} className="h-10">
                        <TableCell className="py-1.5">
                          <Checkbox
                            checked={selectedGroups.has(group.key)}
                            onCheckedChange={(checked) => toggleSelectOne(group.key, !!checked)}
                            data-testid={`checkbox-row-${group.key}`}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 overflow-hidden">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-xs truncate block">
                                {group.shortTitle || group.description.substring(0, 30)}
                                {group.description.length > 30 && !group.shortTitle && "..."}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{group.originalDescription || group.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-1.5 overflow-hidden">
                          {(() => {
                            const cat = categories.find((c) => c.id === group.categoryId);
                            return cat ? (
                              <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} />
                            ) : <span className="text-xs text-muted-foreground">-</span>;
                          })()}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {getSourceIcon(group.source)}
                        </TableCell>
                        <TableCell className="py-1.5 overflow-hidden truncate">
                          <span className="text-xs">{bankAccountName || "-"}</span>
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <span className="text-xs font-medium">
                            {formatCurrency(group.installmentValue)}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <Badge variant="secondary" className="text-xs">
                            {group.paidCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <Badge variant="outline" className="text-xs">
                            {group.pendingCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <span className="text-xs font-medium">{group.installmentTotal}</span>
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full" 
                                style={{ width: `${group.progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{group.progressPercent}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <span className="text-xs font-medium text-destructive">
                            {formatCurrency(group.pendingValue)}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <span className="text-xs font-medium">
                            {formatCurrency(group.totalValue)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell className="py-2" />
                    <TableCell className="py-2" colSpan={4}>
                      <span className="text-xs font-semibold">TOTAL{hasActiveFilters ? " (filtrado)" : ""}</span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs font-semibold text-destructive cursor-help">
                            {formatCurrency(filteredGroups.reduce((sum, g) => sum + g.installmentValue, 0))}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Valor comprometido por mês</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <span className="text-xs">{filteredGroups.reduce((sum, g) => sum + g.paidCount, 0)}</span>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <span className="text-xs">{filteredGroups.reduce((sum, g) => sum + g.pendingCount, 0)}</span>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <span className="text-xs">{filteredGroups.reduce((sum, g) => sum + g.installmentTotal, 0)}</span>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <span className="text-xs">-</span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="text-xs font-semibold text-destructive">
                        {formatCurrency(totalPending)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="text-xs font-semibold">
                        {formatCurrency(totalAll)}
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
