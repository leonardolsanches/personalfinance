import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CalendarDays,
  Search,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  CreditCard,
  Repeat,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  GripVertical,
} from "lucide-react";
import type { BudgetItem, Category, Subcategory, Beneficiary, InsertCategory, InsertSubcategory } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { CategoryIcon } from "@/components/category-icon";

function formatCurrency(value: number | string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

function formatDate(date: string | null) {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatYearMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  return `${MONTH_NAMES_SHORT[parseInt(month) - 1]}/${year}`;
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const startYear = now.getFullYear() - 1;
  const endYear = now.getFullYear() + 1;
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const value = `${y}-${String(m).padStart(2, "0")}`;
      const label = `${MONTH_NAMES_SHORT[m - 1]}/${y}`;
      options.push({ value, label });
    }
  }
  return options;
}

type SortColumn = "yearMonth" | "shortTitle" | "type" | "amount" | "categoryId" | "transactionDate" | "billDueDate";
type SortDirection = "asc" | "desc";

export default function ConsultaPlanejamento() {
  const { toast } = useToast();
  const [filterSearch, setFilterSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState<string>("all");
  const [filterYearMonthFrom, setFilterYearMonthFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterYearMonthTo, setFilterYearMonthTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterIsRecurring, setFilterIsRecurring] = useState<"all" | "yes" | "no">("all");
  const [filterIsFromInstallment, setFilterIsFromInstallment] = useState<"all" | "yes" | "no">("all");

  const currentYM = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentYM);
  const handleMonthChange = (month: string | null) => {
    setSelectedMonth(month);
    if (month) {
      setFilterYearMonthFrom(month);
      setFilterYearMonthTo(month);
    } else {
      setFilterYearMonthFrom("");
      setFilterYearMonthTo("");
    }
    setCurrentPage(1);
  };
  
  const [sortColumn, setSortColumn] = useState<SortColumn>("yearMonth");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    description: "",
    shortTitle: "",
    type: "despesa" as "receita" | "despesa",
    categoryId: null as number | null,
    subcategoryId: null as number | null,
    beneficiaryId: null as number | null,
    amount: "",
    yearMonth: "",
    transactionDate: "",
    billDueDate: "",
    isRecurring: false,
    notes: "",
  });

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  const defaultColWidths = { mes: 70, descricao: 0, tipo: 55, categoria: 36, subcategoria: 80, dataTrans: 80, vencFatura: 80, valor: 90, acoes: 60 };
  const [colWidths, setColWidths] = useState(defaultColWidths);
  const resizingCol = useRef<{ col: string; startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[col as keyof typeof colWidths] || 80;
    resizingCol.current = { col, startX, startW };
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const delta = ev.clientX - resizingCol.current.startX;
      const newW = Math.max(30, resizingCol.current.startW + delta);
      setColWidths(prev => ({ ...prev, [resizingCol.current!.col]: newW }));
    };
    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [colWidths]);

  const ResizeHandle = useCallback(({ col }: { col: string }) => (
    <span
      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
      onMouseDown={(e) => handleResizeStart(col, e)}
      data-testid={`resize-${col}`}
    >
      <GripVertical className="w-2.5 h-2.5 text-muted-foreground/50" />
    </span>
  ), [handleResizeStart]);

  const { data: budgetItems = [], isLoading } = useQuery<BudgetItem[]>({
    queryKey: ["/api/budget-items"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const { data: beneficiaries = [] } = useQuery<Beneficiary[]>({
    queryKey: ["/api/beneficiaries"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/budget-items/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      setEditDialogOpen(false);
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: "Item atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/budget-items/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: "Item removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: InsertCategory) => {
      const res = await apiRequest("POST", "/api/categories", data);
      return res.json();
    },
    onSuccess: (newCategory: Category) => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryDialogOpen(false);
      setNewCategoryName("");
      setNewCategoryColor("#3b82f6");
      setEditFormData(prev => ({ ...prev, categoryId: newCategory.id, subcategoryId: null }));
      toast({ title: "Categoria criada" });
    },
    onError: () => {
      toast({ title: "Erro ao criar categoria", variant: "destructive" });
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: async (data: InsertSubcategory) => {
      const res = await apiRequest("POST", "/api/subcategories", data);
      return res.json();
    },
    onSuccess: (newSubcategory: Subcategory) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      setSubcategoryDialogOpen(false);
      setNewSubcategoryName("");
      setEditFormData(prev => ({ ...prev, subcategoryId: newSubcategory.id }));
      toast({ title: "Subcategoria criada" });
    },
    onError: () => {
      toast({ title: "Erro ao criar subcategoria", variant: "destructive" });
    },
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const handleEdit = (item: BudgetItem) => {
    setEditingItem(item);
    setEditFormData({
      description: item.description,
      shortTitle: item.shortTitle || "",
      type: item.type as "receita" | "despesa",
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      beneficiaryId: item.beneficiaryId,
      amount: item.amount,
      yearMonth: item.yearMonth,
      transactionDate: item.transactionDate || "",
      billDueDate: item.billDueDate || "",
      isRecurring: item.isRecurring || false,
      notes: item.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    updateMutation.mutate({
      id: editingItem.id,
      data: {
        description: editFormData.description,
        shortTitle: editFormData.shortTitle || null,
        type: editFormData.type,
        categoryId: editFormData.categoryId,
        subcategoryId: editFormData.subcategoryId,
        beneficiaryId: editFormData.beneficiaryId,
        amount: editFormData.amount,
        yearMonth: editFormData.yearMonth,
        transactionDate: editFormData.transactionDate || null,
        billDueDate: editFormData.billDueDate || null,
        isRecurring: editFormData.isRecurring,
        notes: editFormData.notes,
      },
    });
  };

  const clearFilters = () => {
    setFilterSearch("");
    setFilterType("all");
    setFilterCategoryId("all");
    setFilterSubcategoryId("all");
    setFilterBeneficiaryId("all");
    setFilterYearMonthFrom(currentYM);
    setFilterYearMonthTo(currentYM);
    setFilterIsRecurring("all");
    setFilterIsFromInstallment("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = filterSearch || filterType !== "all" || filterCategoryId !== "all" ||
    filterSubcategoryId !== "all" || filterBeneficiaryId !== "all" ||
    filterYearMonthFrom !== currentYM || filterYearMonthTo !== currentYM ||
    filterIsRecurring !== "all" || filterIsFromInstallment !== "all";

  const filteredItems = useMemo(() => {
    return budgetItems.filter((item) => {
      if (selectedMonth && item.yearMonth !== selectedMonth) return false;
      if (filterSearch) {
        const search = filterSearch.toLowerCase();
        const matchesSearch = item.description.toLowerCase().includes(search) ||
          (item.shortTitle && item.shortTitle.toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }
      if (filterType !== "all" && item.type !== filterType) return false;
      if (filterCategoryId !== "all" && item.categoryId !== parseInt(filterCategoryId)) return false;
      if (filterSubcategoryId !== "all" && item.subcategoryId !== parseInt(filterSubcategoryId)) return false;
      if (filterBeneficiaryId !== "all" && item.beneficiaryId !== parseInt(filterBeneficiaryId)) return false;
      if (filterYearMonthFrom && item.yearMonth < filterYearMonthFrom) return false;
      if (filterYearMonthTo && item.yearMonth > filterYearMonthTo) return false;
      if (filterIsRecurring === "yes" && !item.isRecurring) return false;
      if (filterIsRecurring === "no" && item.isRecurring) return false;
      if (filterIsFromInstallment === "yes" && !item.isFromInstallment) return false;
      if (filterIsFromInstallment === "no" && item.isFromInstallment) return false;
      return true;
    });
  }, [budgetItems, selectedMonth, filterSearch, filterType, filterCategoryId, filterSubcategoryId, filterBeneficiaryId,
    filterYearMonthFrom, filterYearMonthTo, filterIsRecurring, filterIsFromInstallment]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case "yearMonth":
          aVal = a.yearMonth;
          bVal = b.yearMonth;
          break;
        case "shortTitle":
          aVal = (a.shortTitle || a.description).toLowerCase();
          bVal = (b.shortTitle || b.description).toLowerCase();
          break;
        case "type":
          aVal = a.type;
          bVal = b.type;
          break;
        case "amount":
          aVal = parseFloat(a.amount);
          bVal = parseFloat(b.amount);
          break;
        case "categoryId":
          aVal = categories.find(c => c.id === a.categoryId)?.name || "";
          bVal = categories.find(c => c.id === b.categoryId)?.name || "";
          break;
        case "transactionDate":
          aVal = a.transactionDate || "";
          bVal = b.transactionDate || "";
          break;
        case "billDueDate":
          aVal = a.billDueDate || "";
          bVal = b.billDueDate || "";
          break;
        default:
          aVal = a.yearMonth;
          bVal = b.yearMonth;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortColumn, sortDirection, categories]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totals = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    for (const item of filteredItems) {
      const amount = parseFloat(item.amount);
      if (item.type === "receita") {
        receitas += amount;
      } else {
        despesas += amount;
      }
    }
    return { receitas, despesas, saldo: receitas - despesas };
  }, [filteredItems]);

  const filteredCategories = categories.filter(c => c.type === editFormData.type && c.active);
  const filteredSubcategories = subcategories.filter(s => s.categoryId === editFormData.categoryId);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortDirection === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Planejar" selectedMonth={selectedMonth} onMonthChange={handleMonthChange} />
        <div className="px-4 py-3 space-y-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Planejar" selectedMonth={selectedMonth} onMonthChange={handleMonthChange}>
        <Badge variant="secondary">{filteredItems.length} itens</Badge>
      </PageHeader>
      <div className="px-4 py-3 space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-2 px-3">
            <div className="text-xs text-muted-foreground">Total Receitas</div>
            <div className="text-lg font-bold text-success flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {formatCurrency(totals.receitas)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-2 px-3">
            <div className="text-xs text-muted-foreground">Total Despesas</div>
            <div className="text-lg font-bold text-destructive flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              {formatCurrency(totals.despesas)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-2 px-3">
            <div className="text-xs text-muted-foreground">Saldo Previsto</div>
            <div className={`text-lg font-bold ${totals.saldo >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(totals.saldo)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-2 px-3">
            <div className="text-xs text-muted-foreground">Itens Filtrados</div>
            <div className="text-lg font-bold">{filteredItems.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="px-3 py-2">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                value={filterSearch}
                onChange={(e) => { setFilterSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar..."
                className="pl-7 h-8 w-[100px] text-xs"
                data-testid="filter-search"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={filterType} onValueChange={(v) => { setFilterType(v as any); setCurrentPage(1); }}>
              <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={filterCategoryId} onValueChange={(v) => { setFilterCategoryId(v); setFilterSubcategoryId("all"); setCurrentPage(1); }}>
              <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="filter-category">
                <SelectValue placeholder="Categ." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.filter(c => c.active).map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Subcategoria</Label>
            <Select value={filterSubcategoryId} onValueChange={(v) => { setFilterSubcategoryId(v); setCurrentPage(1); }} disabled={filterCategoryId === "all"}>
              <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-subcategory">
                <SelectValue placeholder="Subcateg." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {subcategories.filter(s => filterCategoryId === "all" || s.categoryId === parseInt(filterCategoryId)).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Beneficiario</Label>
            <Select value={filterBeneficiaryId} onValueChange={(v) => { setFilterBeneficiaryId(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-beneficiary">
                <SelectValue placeholder="Benefic." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {beneficiaries.filter(b => b.active).map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Recorrente</Label>
            <Select value={filterIsRecurring} onValueChange={(v) => { setFilterIsRecurring(v as any); setCurrentPage(1); }}>
              <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="filter-recurring">
                <SelectValue placeholder="Recor." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Sim</SelectItem>
                <SelectItem value="no">Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Parcelamento</Label>
            <Select value={filterIsFromInstallment} onValueChange={(v) => { setFilterIsFromInstallment(v as any); setCurrentPage(1); }}>
              <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="filter-installment">
                <SelectValue placeholder="Parc." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Sim</SelectItem>
                <SelectItem value="no">Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Mes de</Label>
            <Select value={filterYearMonthFrom || "all"} onValueChange={(v) => { setFilterYearMonthFrom(v === "all" ? "" : v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[110px] h-8 text-xs" data-testid="filter-yearmonth-from">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {generateMonthOptions().map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Mes ate</Label>
            <Select value={filterYearMonthTo || "all"} onValueChange={(v) => { setFilterYearMonthTo(v === "all" ? "" : v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[110px] h-8 text-xs" data-testid="filter-yearmonth-to">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {generateMonthOptions().map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="w-3 h-3 mr-0.5" />
              Limpar
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-hidden">
          <Table className="text-xs table-fixed w-full">
            <colgroup>
              <col style={{ width: colWidths.mes }} />
              <col />
              <col style={{ width: colWidths.tipo }} />
              <col style={{ width: colWidths.categoria }} />
              <col style={{ width: colWidths.subcategoria }} />
              <col style={{ width: colWidths.dataTrans }} />
              <col style={{ width: colWidths.vencFatura }} />
              <col style={{ width: colWidths.valor }} />
              <col style={{ width: colWidths.acoes }} />
            </colgroup>
            <TableHeader>
              <TableRow className="h-7">
                <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("yearMonth")}>
                  <div className="flex items-center">Mes<SortIcon column="yearMonth" /></div>
                  <ResizeHandle col="mes" />
                </TableHead>
                <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("shortTitle")}>
                  <div className="flex items-center">Descricao<SortIcon column="shortTitle" /></div>
                </TableHead>
                <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("type")}>
                  <div className="flex items-center">Tipo<SortIcon column="type" /></div>
                  <ResizeHandle col="tipo" />
                </TableHead>
                <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("categoryId")}>
                  <div className="flex items-center">Cat.<SortIcon column="categoryId" /></div>
                  <ResizeHandle col="categoria" />
                </TableHead>
                <TableHead className="py-1 text-xs relative">
                  Subcateg.
                  <ResizeHandle col="subcategoria" />
                </TableHead>
                <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("transactionDate")}>
                  <div className="flex items-center">Dt.Trans.<SortIcon column="transactionDate" /></div>
                  <ResizeHandle col="dataTrans" />
                </TableHead>
                <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("billDueDate")}>
                  <div className="flex items-center">Venc.Fat.<SortIcon column="billDueDate" /></div>
                  <ResizeHandle col="vencFatura" />
                </TableHead>
                <TableHead className="py-1 text-xs cursor-pointer text-right relative" onClick={() => handleSort("amount")}>
                  <div className="flex items-center justify-end">Valor<SortIcon column="amount" /></div>
                  <ResizeHandle col="valor" />
                </TableHead>
                <TableHead className="py-1 text-xs relative">
                  Acoes
                  <ResizeHandle col="acoes" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground text-xs">
                    Nenhum item encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item) => {
                  const category = categories.find(c => c.id === item.categoryId);
                  const subcategory = subcategories.find(s => s.id === item.subcategoryId);
                  return (
                    <TableRow key={item.id} className="h-8" data-testid={`row-item-${item.id}`}>
                      <TableCell className="py-0.5 text-xs truncate overflow-hidden">{formatYearMonth(item.yearMonth)}</TableCell>
                      <TableCell className="py-0.5 overflow-hidden">
                        <div className="flex items-center gap-1">
                          {item.isFromInstallment && (
                            <Tooltip>
                              <TooltipTrigger><CreditCard className="w-3 h-3 text-muted-foreground shrink-0" /></TooltipTrigger>
                              <TooltipContent>Parcelamento de cartao</TooltipContent>
                            </Tooltip>
                          )}
                          {item.isRecurring && (
                            <Tooltip>
                              <TooltipTrigger><Repeat className="w-3 h-3 text-muted-foreground shrink-0" /></TooltipTrigger>
                              <TooltipContent>Item recorrente</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger className="truncate text-xs font-medium">{item.shortTitle || item.description}</TooltipTrigger>
                            <TooltipContent>{item.description}</TooltipContent>
                          </Tooltip>
                          {item.installmentCurrent && item.installmentTotal && (
                            <span className="text-[10px] text-muted-foreground shrink-0">{item.installmentCurrent}/{item.installmentTotal}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-0.5">
                        <Badge variant={item.type === "receita" ? "default" : "secondary"} className="text-[10px] px-1 py-0">
                          {item.type === "receita" ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-0.5 overflow-hidden">
                        {category ? (
                          <CategoryIcon iconName={category.icon} color={category.color} categoryName={category.name} size="sm" />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-0.5 text-xs text-muted-foreground truncate overflow-hidden">
                        {subcategory?.name || "-"}
                      </TableCell>
                      <TableCell className="py-0.5 text-xs truncate overflow-hidden">{formatDate(item.transactionDate)}</TableCell>
                      <TableCell className="py-0.5 text-xs truncate overflow-hidden">{formatDate(item.billDueDate)}</TableCell>
                      <TableCell className={`py-0.5 text-right font-medium text-xs whitespace-nowrap ${item.type === "receita" ? "text-success" : "text-destructive"}`}>
                        {item.type === "receita" ? "+" : "-"}{formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="py-0.5">
                        <div className="flex items-center gap-0">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(item)} data-testid={`button-edit-${item.id}`}>
                            <Pencil className="w-3 h-3 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => { if (confirm("Excluir este item?")) deleteMutation.mutate(item.id); }}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="h-7 bg-muted/50 font-medium">
                <TableCell colSpan={2} className="py-0.5 text-xs">
                  {paginatedItems.length} de {filteredItems.length} item(ns)
                </TableCell>
                <TableCell colSpan={5} className="py-0.5"></TableCell>
                <TableCell className="py-0.5 text-right text-xs whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-success">+{formatCurrency(totals.receitas)}</span>
                    <span className="text-destructive">-{formatCurrency(totals.despesas)}</span>
                    <span className={totals.saldo >= 0 ? "text-success" : "text-destructive"}>={formatCurrency(totals.saldo)}</span>
                  </div>
                </TableCell>
                <TableCell className="py-0.5"></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, sortedItems.length)} de {sortedItems.length}
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
            <span className="text-sm">Pagina {currentPage} de {totalPages}</span>
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Item de Planejamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descricao Breve</Label>
              <Input
                value={editFormData.shortTitle}
                onChange={(e) => setEditFormData({ ...editFormData, shortTitle: e.target.value })}
                placeholder="Titulo curto..."
                data-testid="edit-input-short-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao Completa</Label>
              <Input
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Descricao detalhada..."
                data-testid="edit-input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={editFormData.type}
                  onValueChange={(v) => setEditFormData({ ...editFormData, type: v as any, categoryId: null, subcategoryId: null })}
                >
                  <SelectTrigger data-testid="edit-select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                  data-testid="edit-input-amount"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mes (YYYY-MM)</Label>
              <Input
                type="month"
                value={editFormData.yearMonth}
                onChange={(e) => setEditFormData({ ...editFormData, yearMonth: e.target.value })}
                data-testid="edit-input-yearmonth"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Transacao</Label>
                <Input
                  type="date"
                  value={editFormData.transactionDate}
                  onChange={(e) => setEditFormData({ ...editFormData, transactionDate: e.target.value })}
                  data-testid="edit-input-transaction-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento Fatura</Label>
                <Input
                  type="date"
                  value={editFormData.billDueDate}
                  onChange={(e) => setEditFormData({ ...editFormData, billDueDate: e.target.value })}
                  data-testid="edit-input-bill-due-date"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <div className="flex gap-1">
                  <Select
                    value={editFormData.categoryId?.toString() || "none"}
                    onValueChange={(v) => setEditFormData({ ...editFormData, categoryId: v === "none" ? null : parseInt(v), subcategoryId: null })}
                  >
                    <SelectTrigger data-testid="edit-select-category" className="flex-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {filteredCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCategoryDialogOpen(true)}
                    data-testid="edit-button-add-category"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <div className="flex gap-1">
                  <Select
                    value={editFormData.subcategoryId?.toString() || "none"}
                    onValueChange={(v) => setEditFormData({ ...editFormData, subcategoryId: v === "none" ? null : parseInt(v) })}
                    disabled={!editFormData.categoryId}
                  >
                    <SelectTrigger data-testid="edit-select-subcategory" className="flex-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {filteredSubcategories.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSubcategoryDialogOpen(true)}
                    disabled={!editFormData.categoryId}
                    data-testid="edit-button-add-subcategory"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Beneficiario</Label>
              <Select
                value={editFormData.beneficiaryId?.toString() || "none"}
                onValueChange={(v) => setEditFormData({ ...editFormData, beneficiaryId: v === "none" ? null : parseInt(v) })}
              >
                <SelectTrigger data-testid="edit-select-beneficiary">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {beneficiaries.filter(b => b.active).map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-recurring"
                checked={editFormData.isRecurring}
                onCheckedChange={(c) => setEditFormData({ ...editFormData, isRecurring: !!c })}
                data-testid="edit-checkbox-recurring"
              />
              <Label htmlFor="edit-recurring">Recorrente</Label>
            </div>
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Adicione observacoes..."
                className="resize-none"
                rows={2}
                data-testid="edit-input-notes"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid="edit-button-save">
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Categoria ({editFormData.type === "receita" ? "Receita" : "Despesa"})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Categoria</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: Alimentacao, Transporte..."
                data-testid="new-category-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                  data-testid="new-category-color"
                />
                <Input value={newCategoryColor} onChange={(e) => setNewCategoryColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (!newCategoryName.trim()) {
                    toast({ title: "Informe o nome da categoria", variant: "destructive" });
                    return;
                  }
                  createCategoryMutation.mutate({ name: newCategoryName.trim(), type: editFormData.type, color: newCategoryColor, active: true });
                }}
                disabled={createCategoryMutation.isPending}
                data-testid="save-new-category"
              >
                Criar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={subcategoryDialogOpen} onOpenChange={setSubcategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Subcategoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria pai</Label>
              <p className="text-sm text-muted-foreground">
                {categories.find(c => c.id === editFormData.categoryId)?.name || "Nenhuma selecionada"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome da Subcategoria</Label>
              <Input
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                placeholder="Ex: Restaurante, Uber..."
                data-testid="new-subcategory-name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSubcategoryDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (!newSubcategoryName.trim()) {
                    toast({ title: "Informe o nome da subcategoria", variant: "destructive" });
                    return;
                  }
                  if (!editFormData.categoryId) {
                    toast({ title: "Selecione uma categoria primeiro", variant: "destructive" });
                    return;
                  }
                  createSubcategoryMutation.mutate({ name: newSubcategoryName.trim(), categoryId: editFormData.categoryId });
                }}
                disabled={createSubcategoryMutation.isPending}
                data-testid="save-new-subcategory"
              >
                Criar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
