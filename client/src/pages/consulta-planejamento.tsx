import { useState, useMemo } from "react";
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
  DialogFooter,
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
  AlertTriangle,
  Pencil,
  PenLine,
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
  Upload,
} from "lucide-react";
import type { BudgetItem, Category, Subcategory, Beneficiary, InsertCategory, InsertSubcategory } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { CategoryIcon } from "@/components/category-icon";
import { useColumnWidths } from "@/hooks/use-column-widths";
import { ResizeHandle } from "@/components/resize-handle";

function formatCurrency(value: number | string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

function formatBRLInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits);
  const reais = Math.floor(num / 100);
  const cents = num % 100;
  const reaisStr = reais.toLocaleString("pt-BR");
  return `${reaisStr},${String(cents).padStart(2, "0")}`;
}

function parseBRLInput(formatted: string): string {
  if (!formatted) return "";
  const clean = formatted.replace(/\./g, "").replace(",", ".");
  return clean;
}

function formatDate(date: string | null) {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

function formatDateBR(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function parseDateBR(brDate: string): string {
  if (!brDate) return "";
  const clean = brDate.replace(/[^0-9/]/g, "");
  const parts = clean.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d && m && y && y.length === 4) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function formatDateInputBR(value: string, prevValue: string): string {
  let val = value.replace(/[^0-9/]/g, "");
  const digits = val.replace(/\//g, "");
  if (digits.length <= 2) {
    if (digits.length === 2 && !val.includes("/") && !prevValue.endsWith("/")) {
      val = digits + "/";
    }
  } else if (digits.length <= 4) {
    val = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length === 4 && val.split("/").length === 2 && !prevValue.endsWith("/")) {
      val = val + "/";
    }
  } else {
    val = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
  }
  if (val.length > 10) val = val.slice(0, 10);
  return val;
}

function calcBillDueDate(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  let date = new Date(y, m - 1, 9);
  const dow = date.getDay();
  if (dow === 0) date.setDate(10);
  else if (dow === 6) date.setDate(11);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

type SortColumn = "yearMonth" | "shortTitle" | "type" | "amount" | "categoryId" | "subcategoryId" | "beneficiaryId" | "transactionDate" | "billDueDate" | "source";
type SortDirection = "asc" | "desc";

export default function ConsultaPlanejamento() {
  const { toast } = useToast();
  const [filterSearch, setFilterSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "prevista" | "realizada">("prevista");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");

  const currentYM = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentYM);
  const handleMonthChange = (month: string | null) => {
    setSelectedMonth(month);
    setCurrentPage(1);
  };
  
  const [sortColumn, setSortColumn] = useState<SortColumn>("yearMonth");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
    amountDisplay: "",
    yearMonth: "",
    transactionDate: "",
    transactionDateDisplay: "",
    billDueDate: "",
    billDueDateDisplay: "",
    isRecurring: false,
    notes: "",
  });
  const [repeatMode, setRepeatMode] = useState<"none" | "count" | "until">("count");
  const [repeatCount, setRepeatCount] = useState(12);
  const [repeatUntilMonth, setRepeatUntilMonth] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkShortTitle, setBulkShortTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  const defaultColWidths = { checkbox: 36, dtTrans: 72, vencFat: 72, descricao: 0, tipo: 44, status: 55, orig: 44, categoria: 90, subcategoria: 90, valor: 90, acoes: 60 };
  const { colWidths, handleResizeStart } = useColumnWidths("consulta-planejamento", defaultColWidths);

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

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/budget-items", data);
      return res.json();
    },
    onSuccess: () => {
      setEditDialogOpen(false);
      setEditingItem(null);
      setRepeatMode("count");
      setRepeatCount(12);
      setRepeatUntilMonth("");
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: "Item criado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar item", variant: "destructive" });
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await apiRequest("POST", "/api/budget-items/batch", { items });
      return res.json();
    },
    onSuccess: (_data, items) => {
      setEditDialogOpen(false);
      setEditingItem(null);
      setRepeatMode("count");
      setRepeatCount(12);
      setRepeatUntilMonth("");
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: `${items.length} itens criados com sucesso` });
    },
    onError: () => {
      toast({ title: "Erro ao criar itens", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/budget-items/${id}`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setEditDialogOpen(false);
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      const syncedCount = data?.syncedCount || 0;
      if (syncedCount > 0) {
        toast({ title: `Item atualizado e ${syncedCount} mes(es) futuro(s) sincronizado(s)` });
      } else {
        toast({ title: "Item atualizado" });
      }
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

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return apiRequest("POST", "/api/budget-items/delete-batch", { ids });
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: `${ids.length} itens excluidos` });
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    },
    onError: () => {
      toast({ title: "Erro ao excluir itens", variant: "destructive" });
    },
  });

  const updateShortTitleBatchMutation = useMutation({
    mutationFn: async ({ ids, shortTitle }: { ids: number[]; shortTitle: string }) => {
      return apiRequest("POST", "/api/budget-items/update-short-title-batch", { ids, shortTitle });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: "Titulo breve atualizado com sucesso!" });
      setSelectedIds(new Set());
      setBulkShortTitle("");
    },
    onError: () => {
      toast({ title: "Erro ao atualizar titulo breve", variant: "destructive" });
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

  const addMonths = (ym: string, n: number): string => {
    const [y, m] = ym.split("-").map(Number);
    const totalMonths = y * 12 + (m - 1) + n;
    const newY = Math.floor(totalMonths / 12);
    const newM = (totalMonths % 12) + 1;
    return `${newY}-${String(newM).padStart(2, "0")}`;
  };

  const getRepeatMonthCount = (): number => {
    if (repeatMode === "count") return repeatCount === 0 ? 60 : Math.max(1, repeatCount);
    if (repeatMode === "until" && repeatUntilMonth && editFormData.yearMonth) {
      const [sy, sm] = editFormData.yearMonth.split("-").map(Number);
      const parts = repeatUntilMonth.split("/");
      if (parts.length === 2) {
        const em = parseInt(parts[0]);
        const ey = parseInt(parts[1]);
        if (!isNaN(em) && !isNaN(ey)) {
          const diff = (ey * 12 + em) - (sy * 12 + sm) + 1;
          return Math.max(1, diff);
        }
      }
      return 1;
    }
    return 1;
  };

  const handleNew = () => {
    setEditingItem(null);
    const now = new Date();
    const ym = selectedMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayBR = formatDateBR(todayISO);
    setEditFormData({
      description: "",
      shortTitle: "",
      type: "despesa",
      categoryId: null,
      subcategoryId: null,
      beneficiaryId: null,
      amount: "",
      amountDisplay: "",
      yearMonth: ym,
      transactionDate: todayISO,
      transactionDateDisplay: todayBR,
      billDueDate: "",
      billDueDateDisplay: "",
      isRecurring: false,
      notes: "",
    });
    setRepeatMode("count");
    setRepeatCount(12);
    setRepeatUntilMonth("");
    setEditDialogOpen(true);
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
      amountDisplay: item.amount ? formatBRLInput(Math.round(Math.abs(parseFloat(item.amount)) * 100).toString()) : "",
      yearMonth: item.yearMonth,
      transactionDate: item.transactionDate || "",
      transactionDateDisplay: formatDateBR(item.transactionDate || ""),
      billDueDate: item.billDueDate || "",
      billDueDateDisplay: formatDateBR(item.billDueDate || ""),
      isRecurring: item.isRecurring || false,
      notes: item.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editFormData.description.trim()) {
      toast({ title: "Descricao e obrigatoria", variant: "destructive" });
      return;
    }
    if (!editFormData.amount || editFormData.amount === "0") {
      toast({ title: "Valor e obrigatorio", variant: "destructive" });
      return;
    }
    if (!editFormData.yearMonth) {
      toast({ title: "Mes e obrigatorio", variant: "destructive" });
      return;
    }

    if (!editingItem && repeatMode === "until") {
      if (!repeatUntilMonth) {
        toast({ title: "Preencha a data 'Repetir ate' no formato MM/AAAA", variant: "destructive" });
        return;
      }
      const parts = repeatUntilMonth.split("/");
      if (parts.length !== 2) {
        toast({ title: "Data 'Repetir ate' invalida. Use formato MM/AAAA", variant: "destructive" });
        return;
      }
      const um = parseInt(parts[0]);
      const uy = parseInt(parts[1]);
      if (isNaN(um) || isNaN(uy) || um < 1 || um > 12 || uy < 2020) {
        toast({ title: "Data 'Repetir ate' invalida. Use formato MM/AAAA", variant: "destructive" });
        return;
      }
      const [sy, sm] = editFormData.yearMonth.split("-").map(Number);
      const diff = (uy - sy) * 12 + (um - sm) + 1;
      if (diff < 1) {
        toast({ title: "Data 'Repetir ate' deve ser posterior ao mes selecionado", variant: "destructive" });
        return;
      }
    }

    const monthCount = editingItem ? 1 : (repeatMode === "none" ? 60 : (repeatMode === "count" && repeatCount === 0 ? 60 : getRepeatMonthCount()));
    const baseDesc = editFormData.shortTitle || editFormData.description;

    const payload = {
      description: (editFormData.isRecurring && monthCount > 1) ? `${baseDesc} #RECORRENCIA 001` : editFormData.description,
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
    };

    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: { ...payload, syncFutureMonths: editFormData.isRecurring },
      });
    } else {
      if (monthCount > 1) {
        const items = [];
        for (let i = 0; i < monthCount; i++) {
          const ym = addMonths(editFormData.yearMonth, i);
          items.push({
            ...payload,
            description: editFormData.isRecurring ? `${baseDesc} #RECORRENCIA ${String(i + 1).padStart(3, "0")}` : editFormData.description,
            yearMonth: ym,
            billDueDate: calcBillDueDate(ym),
            source: "manual",
            isRecurring: editFormData.isRecurring,
          });
        }
        createBatchMutation.mutate(items);
      } else {
        createMutation.mutate({
          ...payload,
          source: "manual",
        });
      }
    }
  };

  const clearFilters = () => {
    setFilterSearch("");
    setFilterType("all");
    setFilterStatus("prevista");
    setFilterSource("all");
    setFilterCategoryId("all");
    setFilterSubcategoryId("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = filterSearch || filterType !== "all" || filterStatus !== "prevista" || filterSource !== "all" || filterCategoryId !== "all" ||
    filterSubcategoryId !== "all";

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
      if (filterSource !== "all") {
        if (filterSource === "parcelamento") {
          if (!item.isFromInstallment) return false;
        } else if (filterSource === "import") {
          if (item.source !== "import" || item.isFromInstallment) return false;
        } else if (filterSource === "manual") {
          if (item.source !== "manual" || item.isFromInstallment) return false;
        }
      }
      if (filterCategoryId !== "all" && item.categoryId !== parseInt(filterCategoryId)) return false;
      if (filterSubcategoryId !== "all" && item.subcategoryId !== parseInt(filterSubcategoryId)) return false;
      return true;
    });
  }, [budgetItems, selectedMonth, filterSearch, filterType, filterSource, filterCategoryId, filterSubcategoryId]);

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
        case "subcategoryId":
          aVal = subcategories.find(s => s.id === a.subcategoryId)?.name || "";
          bVal = subcategories.find(s => s.id === b.subcategoryId)?.name || "";
          break;
        case "beneficiaryId":
          aVal = beneficiaries.find(b2 => b2.id === a.beneficiaryId)?.name || "";
          bVal = beneficiaries.find(b2 => b2.id === b.beneficiaryId)?.name || "";
          break;
        case "transactionDate":
          aVal = a.transactionDate || "";
          bVal = b.transactionDate || "";
          break;
        case "billDueDate":
          aVal = a.billDueDate || "";
          bVal = b.billDueDate || "";
          break;
        case "source":
          aVal = (a.isFromInstallment || a.source === "import") ? "import" : "manual";
          bVal = (b.isFromInstallment || b.source === "import") ? "import" : "manual";
          break;
        default:
          aVal = a.yearMonth;
          bVal = b.yearMonth;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortColumn, sortDirection, categories, subcategories, beneficiaries]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / itemsPerPage));
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

  const filteredCategories = categories.filter(c => c.active);
  const filteredSubcategories = subcategories.filter(s => s.categoryId === editFormData.categoryId);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredItems.map((t) => t.id));
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
      toast({ title: "Selecione pelo menos um item", variant: "destructive" });
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
        <Button onClick={handleNew} data-testid="button-new-budget-item">
          <Plus className="w-4 h-4 mr-2" />
          Novo Item
        </Button>
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

      <Card>
        <CardHeader className="pb-3">
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
              <Label className="text-xs text-muted-foreground">Visao</Label>
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as any); setCurrentPage(1); }}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-status">
                  <SelectValue placeholder="Visao" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ambos</SelectItem>
                  <SelectItem value="prevista">Planejado</SelectItem>
                  <SelectItem value="realizada">Realizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Orig.</Label>
              <Select value={filterSource} onValueChange={(v) => { setFilterSource(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-source">
                  <SelectValue placeholder="Orig." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="parcelamento">Parc.</SelectItem>
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
                  {categories.filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
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
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="self-end" onClick={clearFilters} data-testid="button-clear-filters">
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum item encontrado</p>
            </div>
          ) : (
            <>
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-md">
                <Badge variant="secondary">
                  {selectedIds.size} selecionado(s)
                </Badge>
                <Input
                  placeholder="Titulo breve..."
                  value={bulkShortTitle}
                  onChange={(e) => setBulkShortTitle(e.target.value)}
                  className="w-[200px]"
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
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={batchDeleteMutation.isPending}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Excluir Selecionados
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSelectedIds(new Set()); setBulkShortTitle(""); }}
                  data-testid="button-clear-selection"
                >
                  Limpar Selecao
                </Button>
              </div>
            )}
            <div className="overflow-hidden">
          <Table className="text-sm table-fixed w-full">
            <colgroup>
              <col style={{ width: colWidths.checkbox ? `${colWidths.checkbox}px` : undefined }} />
              <col style={{ width: colWidths.dtTrans ? `${colWidths.dtTrans}px` : undefined }} />
              <col style={{ width: colWidths.vencFat ? `${colWidths.vencFat}px` : undefined }} />
              <col style={colWidths.descricao ? { width: `${colWidths.descricao}px` } : undefined} />
              <col style={{ width: colWidths.tipo ? `${colWidths.tipo}px` : undefined }} />
              <col style={{ width: colWidths.status ? `${colWidths.status}px` : undefined }} />
              <col style={{ width: colWidths.orig ? `${colWidths.orig}px` : undefined }} />
              <col style={{ width: colWidths.categoria ? `${colWidths.categoria}px` : undefined }} />
              <col style={{ width: colWidths.subcategoria ? `${colWidths.subcategoria}px` : undefined }} />
              <col style={{ width: colWidths.valor ? `${colWidths.valor}px` : undefined }} />
              <col style={{ width: colWidths.acoes ? `${colWidths.acoes}px` : undefined }} />
            </colgroup>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead className="py-1.5">
                  <Checkbox
                    checked={filteredItems.length > 0 && filteredItems.every((t) => selectedIds.has(t.id))}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead className="py-1.5 cursor-pointer relative" onClick={() => handleSort("transactionDate")}>
                  <div className="flex items-center">Dt.Trans.<SortIcon column="transactionDate" /></div>
                  <ResizeHandle col="dtTrans" onResizeStart={handleResizeStart} />
                </TableHead>
                <TableHead className="py-1.5 cursor-pointer relative" onClick={() => handleSort("billDueDate")}>
                  <div className="flex items-center">Venc.Fat.<SortIcon column="billDueDate" /></div>
                  <ResizeHandle col="vencFat" onResizeStart={handleResizeStart} />
                </TableHead>
                <TableHead className="py-1.5 cursor-pointer relative" onClick={() => handleSort("shortTitle")}>
                  <div className="flex items-center">Descricao<SortIcon column="shortTitle" /></div>
                  <ResizeHandle col="descricao" onResizeStart={handleResizeStart} />
                </TableHead>
                <TableHead className="py-1.5 cursor-pointer relative" onClick={() => handleSort("type")}>
                  <div className="flex items-center">Tipo<SortIcon column="type" /></div>
                  <ResizeHandle col="tipo" onResizeStart={handleResizeStart} />
                </TableHead>
                <TableHead className="py-1.5 relative">
                  Visao
                  <ResizeHandle col="status" onResizeStart={handleResizeStart} />
                </TableHead>
                <TableHead className="py-1.5 cursor-pointer relative" onClick={() => handleSort("source")}>
                  <div className="flex items-center">Orig.<SortIcon column="source" /></div>
                  <ResizeHandle col="orig" onResizeStart={handleResizeStart} />
                </TableHead>
                <TableHead className="py-1.5 cursor-pointer relative" onClick={() => handleSort("categoryId")}>
                  <div className="flex items-center">Cat.<SortIcon column="categoryId" /></div>
                  <ResizeHandle col="categoria" onResizeStart={handleResizeStart} />
                </TableHead>
                <TableHead className="py-1.5 cursor-pointer relative" onClick={() => handleSort("subcategoryId")}>
                  <div className="flex items-center">Subcateg.<SortIcon column="subcategoryId" /></div>
                  <ResizeHandle col="subcategoria" onResizeStart={handleResizeStart} />
                </TableHead>
                <TableHead className="py-1.5 text-right cursor-pointer relative" onClick={() => handleSort("amount")}>
                  <div className="flex items-center justify-end">Valor<SortIcon column="amount" /></div>
                  <ResizeHandle col="valor" onResizeStart={handleResizeStart} />
                </TableHead>
                <TableHead className="py-1.5 relative">
                  Acoes
                  <ResizeHandle col="acoes" onResizeStart={handleResizeStart} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => {
                const category = categories.find(c => c.id === item.categoryId);
                const subcategory = subcategories.find(s => s.id === item.subcategoryId);
                return (
                  <TableRow key={item.id} className="h-10" data-testid={`row-item-${item.id}`}>
                    <TableCell className="py-1.5">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(checked) => toggleSelectOne(item.id, !!checked)}
                        data-testid={`checkbox-select-${item.id}`}
                      />
                    </TableCell>
                    <TableCell className="py-1.5 text-xs whitespace-nowrap">{formatDate(item.transactionDate)}</TableCell>
                    <TableCell className="py-1.5 text-xs whitespace-nowrap">{formatDate(item.billDueDate)}</TableCell>
                    <TableCell className="py-1.5 overflow-hidden">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-sm truncate block cursor-default">
                            {item.shortTitle || item.description}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{item.description}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className={`text-[10px] px-1 py-0 font-bold ${item.type === "receita" ? "border-green-600 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950" : "border-red-600 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950"}`}>
                        {item.type === "receita" ? "R" : "D"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950">
                        Plan
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">
                            {(item.isFromInstallment || item.source === "import") ? (
                              <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                            ) : (
                              <PenLine className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.isFromInstallment ? `Parcelamento${item.installmentCurrent && item.installmentTotal ? ` ${item.installmentCurrent}/${item.installmentTotal}` : ""}` : item.source === "import" ? "Importado" : "Manual"}
                          {item.isRecurring ? " (Recorrente)" : ""}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="py-1.5 overflow-hidden">
                      {category ? (
                        <CategoryIcon iconName={category.icon} color={category.color} categoryName={category.name} size="sm" />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground truncate overflow-hidden">
                      {subcategory?.name || "-"}
                    </TableCell>
                    <TableCell className={`py-1.5 text-right font-medium text-xs whitespace-nowrap ${item.type === "receita" ? "text-success" : "text-destructive"}`}>
                      {item.type === "receita" ? "+" : "-"}{formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell className="py-1.5">
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
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="h-7 bg-muted/50 font-medium">
                <TableCell className="py-0.5"></TableCell>
                <TableCell colSpan={2} className="py-0.5 text-xs">
                  Pag. {currentPage}/{totalPages} ({filteredItems.length} item(ns))
                </TableCell>
                <TableCell colSpan={6} className="py-0.5"></TableCell>
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
        </>
          )}
        </CardContent>
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
            <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"} - {editFormData.yearMonth ? formatYearMonth(editFormData.yearMonth) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descricao Breve</Label>
              <Input
                value={editFormData.shortTitle}
                onChange={(e) => setEditFormData({ ...editFormData, shortTitle: e.target.value, description: e.target.value })}
                placeholder="Titulo curto..."
                data-testid="edit-input-short-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao Completa (opcional)</Label>
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
                <Label>Valor (R$)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editFormData.amountDisplay}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const display = formatBRLInput(raw);
                    const amount = parseBRLInput(display);
                    setEditFormData({ ...editFormData, amountDisplay: display, amount });
                  }}
                  placeholder="0,00"
                  data-testid="edit-input-amount"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Transacao</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  value={editFormData.transactionDateDisplay}
                  onChange={(e) => {
                    const display = formatDateInputBR(e.target.value, editFormData.transactionDateDisplay);
                    const iso = parseDateBR(display);
                    setEditFormData({ ...editFormData, transactionDateDisplay: display, transactionDate: display === "" ? "" : (iso || editFormData.transactionDate) });
                  }}
                  data-testid="edit-input-transaction-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento Fatura</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  value={editFormData.billDueDateDisplay}
                  onChange={(e) => {
                    const display = formatDateInputBR(e.target.value, editFormData.billDueDateDisplay);
                    const iso = parseDateBR(display);
                    setEditFormData({ ...editFormData, billDueDateDisplay: display, billDueDate: display === "" ? "" : (iso || editFormData.billDueDate) });
                  }}
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
            {!editingItem && (
              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-xs font-medium">Repetir lancamento</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={repeatMode === "none" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRepeatMode("none")}
                    data-testid="repeat-none"
                  >
                    Indefinido
                  </Button>
                  <Button
                    type="button"
                    variant={repeatMode === "count" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRepeatMode("count")}
                    data-testid="repeat-count"
                  >
                    Repetir N vezes
                  </Button>
                  <Button
                    type="button"
                    variant={repeatMode === "until" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setRepeatMode("until");
                      if (!repeatUntilMonth && editFormData.yearMonth) {
                        const futureYM = addMonths(editFormData.yearMonth, 5);
                        const [fy, fm] = futureYM.split("-");
                        setRepeatUntilMonth(`${fm}/${fy}`);
                      }
                    }}
                    data-testid="repeat-until"
                  >
                    Repetir ate
                  </Button>
                </div>
                {repeatMode === "count" && (
                  <div className="space-y-1 mt-2">
                    <Label className="text-xs">Quantos meses? (0 = indefinido, 60 meses)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(Math.max(0, Math.min(60, parseInt(e.target.value) || 0)))}
                      className="w-20 h-8 text-xs"
                      data-testid="input-repeat-count"
                    />
                    <p className="text-xs text-muted-foreground">
                      {repeatCount === 0 ? "60 meses (indefinido)" : `${repeatCount} mes(es)`} a partir de {editFormData.yearMonth ? formatYearMonth(editFormData.yearMonth) : "mes selecionado"}
                    </p>
                  </div>
                )}
                {repeatMode === "until" && (() => {
                  let monthsDiff = 0;
                  if (repeatUntilMonth && editFormData.yearMonth) {
                    const parts = repeatUntilMonth.split("/");
                    if (parts.length === 2) {
                      const um = parseInt(parts[0]);
                      const uy = parseInt(parts[1]);
                      const [sy, sm] = editFormData.yearMonth.split("-").map(Number);
                      monthsDiff = (uy - sy) * 12 + (um - sm) + 1;
                    }
                  }
                  return (
                    <div className="flex items-center gap-2 mt-2">
                      <Label className="text-xs whitespace-nowrap">Repetir ate</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={7}
                        value={repeatUntilMonth}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9/]/g, "");
                          if (val.length === 2 && !val.includes("/") && !repeatUntilMonth.endsWith("/")) {
                            val = val + "/";
                          }
                          setRepeatUntilMonth(val);
                        }}
                        placeholder="MM/AAAA"
                        className="w-24 h-8 text-xs"
                        data-testid="input-repeat-until"
                      />
                      {monthsDiff > 0 && (
                        <span className="text-xs text-muted-foreground">({monthsDiff} meses)</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
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
              <Button onClick={handleSaveEdit} disabled={editingItem ? updateMutation.isPending : (createMutation.isPending || createBatchMutation.isPending)} data-testid="edit-button-save">
                {editingItem ? "Salvar" : (() => { const c = repeatMode === "none" ? 60 : (repeatMode === "count" && repeatCount === 0 ? 60 : getRepeatMonthCount()); return c > 1 ? `Criar ${c} itens` : "Criar"; })()}
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

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar Exclusao em Massa
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> itens selecionados? Esta acao nao pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} data-testid="button-cancel-bulk-delete">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => batchDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={batchDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              {batchDeleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
