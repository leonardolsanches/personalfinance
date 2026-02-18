import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  CreditCard,
  Repeat,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Folder,
  FileDown,
  X,
  Search,
  ArrowUpDown,
  Pencil,
  PenLine,
  Upload,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { exportToExcel } from "@/lib/exportExcel";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, LabelList, BarChart, Bar } from "recharts";
import type { BudgetItem, Transaction, Category, Subcategory, Beneficiary, InsertCategory, InsertSubcategory } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { filterCardBillPayments } from "@/lib/utils";
import { useColumnWidths } from "@/hooks/use-column-widths";
import { ResizeHandle } from "@/components/resize-handle";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

function formatDate(date: string | null) {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

function formatCurrency(value: number | string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

function getMonthName(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`;
}

function getFullMonthName(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  const monthNames = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function calcBillDueDate(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 9);
  const dow = d.getDay();
  if (dow === 0) d.setDate(10);
  if (dow === 6) d.setDate(11);
  return d.toISOString().split("T")[0];
}

function generateMonths(startYear: number, startMonth: number, count: number): string[] {
  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  for (let i = 0; i < count; i++) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

function formatBRLInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = (cents / 100).toFixed(2);
  const [intPart, decPart] = reais.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted},${decPart}`;
}

function parseBRLInput(formatted: string): string {
  if (!formatted) return "";
  const clean = formatted.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? "" : num.toFixed(2);
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

interface BudgetItemFormData {
  description: string;
  shortTitle: string;
  type: "receita" | "despesa";
  categoryId: number | null;
  subcategoryId: number | null;
  beneficiaryId: number | null;
  amount: string;
  amountDisplay: string;
  transactionDate: string;
  billDueDate: string;
  transactionDateDisplay: string;
  billDueDateDisplay: string;
  isRecurring: boolean;
  repeatMonths: number;
  repeatMode: "none" | "count" | "until";
  repeatUntil: string;
  divideMonths: number;
  notes: string;
}

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const defaultFormData: BudgetItemFormData = {
  description: "",
  shortTitle: "",
  type: "despesa",
  categoryId: null,
  subcategoryId: null,
  beneficiaryId: null,
  amount: "",
  amountDisplay: "",
  transactionDate: getTodayString(),
  billDueDate: getTodayString(),
  transactionDateDisplay: formatDateBR(getTodayString()),
  billDueDateDisplay: formatDateBR(getTodayString()),
  isRecurring: false,
  repeatMonths: 12,
  repeatMode: "count",
  repeatUntil: "",
  divideMonths: 1,
  notes: "",
};

function getQuarterFromMonth(month: number): number {
  return Math.ceil(month / 3);
}

function getQuarterStartMonth(quarter: number): number {
  return (quarter - 1) * 3 + 1;
}

function getQuarterLabel(quarter: number, year: number): string {
  return `Q${quarter} ${year}`;
}

interface AutocompleteSuggestion {
  shortTitle: string;
  amount: string;
  categoryId: number | null;
  subcategoryId: number | null;
  count: number;
}

export default function Planejamento() {
  const { toast } = useToast();
  const now = new Date();
  const currentQuarter = getQuarterFromMonth(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [viewMode, setViewMode] = useState<"quarter" | "year" | "all">("quarter");
  const monthsScrollRef = useRef<HTMLDivElement>(null);
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentYearMonth);
  const handleMonthChange = (month: string | null) => {
    setSelectedMonth(month);
    setCurrentPage(1);
    if (month) {
      const [y, m] = month.split("-").map(Number);
      setSelectedYear(y);
      setSelectedQuarter(getQuarterFromMonth(m));
    }
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<BudgetItemFormData>(defaultFormData);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "prevista" | "realizada">("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAutocompleteSuggestions, setShowAutocompleteSuggestions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkShortTitle, setBulkShortTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  type PlanSortColumn = "transactionDate" | "billDueDate" | "yearMonth" | "shortTitle" | "categoryId" | "subcategoryId" | "beneficiaryId" | "type" | "source" | "amount";
  type PlanSortDirection = "asc" | "desc";
  const [sortColumn, setSortColumn] = useState<PlanSortColumn>("yearMonth");
  const [sortDirection, setSortDirection] = useState<PlanSortDirection>("asc");
  const handleSort = (column: PlanSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };
  const SortIcon = ({ column }: { column: PlanSortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortDirection === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };
  const [hiddenChartCategories, setHiddenChartCategories] = useState<Set<string>>(new Set());
  const [hiddenBarSeries, setHiddenBarSeries] = useState<Set<string>>(new Set());
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  const defaultColWidths = { checkbox: 36, dtTrans: 72, vencFat: 72, descricao: 0, tipo: 44, status: 55, orig: 44, categoria: 90, subcategoria: 90, valor: 90, acoes: 60 };
  const { colWidths, handleResizeStart } = useColumnWidths("planejamento", defaultColWidths);

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const { data: budgetItems = [], isLoading } = useQuery<BudgetItem[]>({
    queryKey: ["/api/budget-items"],
  });

  const { data: allTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    enabled: filterStatus === "realizada" || filterStatus === "all",
  });

  const visibleTransactions = useMemo(() => filterCardBillPayments(allTransactions), [allTransactions]);

  function getTxCompetenciaMonth(t: Transaction): string {
    if (t.paymentDate) {
      const d = new Date(t.paymentDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    if (t.source === "cartao" && t.cardBillMonth) return t.cardBillMonth;
    const dateStr = t.transactionDate || t.date;
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const filteredTransactions = useMemo(() => {
    if (filterStatus === "prevista") return [];
    return visibleTransactions.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterSource !== "all") {
        if (filterSource === "parcelamento") {
          if (!(t.installmentTotal && t.installmentTotal > 1)) return false;
        } else if (filterSource === "import") {
          if (t.source === "manual") return false;
        } else if (filterSource === "manual") {
          if (t.source !== "manual") return false;
        }
      }
      if (filterCategoryId !== "all") {
        if (filterCategoryId === "empty") { if (t.categoryId) return false; }
        else if (t.categoryId !== Number(filterCategoryId)) return false;
      }
      if (filterSubcategoryId !== "all") {
        if (filterSubcategoryId === "empty") { if (t.subcategoryId) return false; }
        else if (t.subcategoryId !== Number(filterSubcategoryId)) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchDesc = t.description?.toLowerCase().includes(term);
        const matchShort = t.shortTitle?.toLowerCase().includes(term);
        if (!matchDesc && !matchShort) return false;
      }
      return true;
    });
  }, [visibleTransactions, filterType, filterSource, filterCategoryId, filterSubcategoryId, searchTerm, filterStatus]);

  const filteredBudgetItems = useMemo(() => {
    if (filterStatus === "realizada") return [];
    return budgetItems.filter((item) => {
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
      if (filterCategoryId !== "all") {
        if (filterCategoryId === "empty") { if (item.categoryId) return false; }
        else if (item.categoryId !== Number(filterCategoryId)) return false;
      }
      if (filterSubcategoryId !== "all") {
        if (filterSubcategoryId === "empty") { if (item.subcategoryId) return false; }
        else if (item.subcategoryId !== Number(filterSubcategoryId)) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchDesc = item.description?.toLowerCase().includes(term);
        const matchShort = item.shortTitle?.toLowerCase().includes(term);
        if (!matchDesc && !matchShort) return false;
      }
      return true;
    });
  }, [budgetItems, filterType, filterSource, filterCategoryId, filterSubcategoryId, searchTerm, filterStatus]);

  const months = useMemo(() => {
    if (viewMode === "year") {
      return generateMonths(selectedYear, 1, 12);
    }
    if (viewMode === "all") {
      const allMonths = new Set<string>();
      for (const item of filteredBudgetItems) {
        allMonths.add(item.yearMonth);
      }
      for (const t of filteredTransactions) {
        allMonths.add(getTxCompetenciaMonth(t));
      }
      const sorted = Array.from(allMonths).sort();
      if (sorted.length === 0) {
        return generateMonths(selectedYear, 1, 12);
      }
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const [fy, fm] = first.split("-").map(Number);
      const [ly, lm] = last.split("-").map(Number);
      const count = (ly - fy) * 12 + (lm - fm) + 1;
      return generateMonths(fy, fm, count);
    }
    const startMonth = getQuarterStartMonth(selectedQuarter);
    return generateMonths(selectedYear, startMonth, 3);
  }, [selectedYear, selectedQuarter, viewMode, filteredBudgetItems, filteredTransactions]);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const { data: beneficiaries = [] } = useQuery<Beneficiary[]>({
    queryKey: ["/api/beneficiaries"],
  });

  const { data: suggestions = [] } = useQuery<{ description: string; amount: number; count: number }[]>({
    queryKey: ["/api/budget-items/suggestions", formData.categoryId, formData.subcategoryId],
    enabled: dialogOpen,
  });

  const { data: autocompleteSuggestions = [] } = useQuery<AutocompleteSuggestion[]>({
    queryKey: [`/api/budget-items/autocomplete?type=${formData.type}&search=${encodeURIComponent(formData.shortTitle)}`],
    enabled: dialogOpen && !editingItem && formData.shortTitle.length >= 1,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/budget-items/sync-installments");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: `${data.synced} parcelamentos sincronizados` });
    },
    onError: () => {
      toast({ title: "Erro ao sincronizar", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/budget-items/batch", { items: data });
      return res.json();
    },
    onSuccess: () => {
      setDialogOpen(false);
      setFormData(defaultFormData);
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: "Item(ns) adicionado(s) com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/budget-items/${id}`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setDialogOpen(false);
      setEditingItem(null);
      setFormData(defaultFormData);
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
      setFormData(prev => ({ ...prev, categoryId: newCategory.id, subcategoryId: null }));
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
      setFormData(prev => ({ ...prev, subcategoryId: newSubcategory.id }));
      toast({ title: "Subcategoria criada" });
    },
    onError: () => {
      toast({ title: "Erro ao criar subcategoria", variant: "destructive" });
    },
  });

  const handleNavigateQuarter = (direction: number) => {
    let newQuarter = selectedQuarter + direction;
    let newYear = selectedYear;
    if (newQuarter < 1) {
      newQuarter = 4;
      newYear--;
    } else if (newQuarter > 4) {
      newQuarter = 1;
      newYear++;
    }
    setSelectedQuarter(newQuarter);
    setSelectedYear(newYear);
    setViewMode("quarter");
  };

  // Group items by category for a given month
  const groupItemsByCategory = (items: BudgetItem[]) => {
    const groups = new Map<number | null, { category: Category | null; items: BudgetItem[]; total: number }>();
    
    for (const item of items) {
      const catId = item.categoryId;
      if (!groups.has(catId)) {
        const category = categories.find(c => c.id === catId) || null;
        groups.set(catId, { category, items: [], total: 0 });
      }
      const group = groups.get(catId)!;
      group.items.push(item);
      group.total += parseFloat(item.amount?.toString() || "0");
    }
    
    // Sort groups: with category first (alphabetically), then uncategorized
    return Array.from(groups.entries()).sort(([aId, aData], [bId, bData]) => {
      if (aId === null) return 1;
      if (bId === null) return -1;
      return (aData.category?.name || "").localeCompare(bData.category?.name || "");
    });
  };

  const getExpensesByCategory = (budgetList: BudgetItem[], txList?: Transaction[]) => {
    const groups = new Map<number | null, { name: string; value: number; color: string }>();

    const addToGroup = (catId: number | null, amount: number) => {
      if (!groups.has(catId)) {
        const category = categories.find(c => c.id === catId);
        groups.set(catId, {
          name: category?.name || "Sem categoria",
          value: 0,
          color: category?.color || "#888888"
        });
      }
      groups.get(catId)!.value += amount;
    };

    for (const item of budgetList.filter(i => i.type === "despesa")) {
      addToGroup(item.categoryId, parseFloat(item.amount?.toString() || "0"));
    }

    if (txList) {
      for (const t of txList.filter(tx => tx.type === "despesa")) {
        addToGroup(t.categoryId, Math.abs(parseFloat(String(t.amount))));
      }
    }
    
    return Array.from(groups.values())
      .filter(g => g.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  const handleSelectQuarter = (quarter: number) => {
    setSelectedQuarter(quarter);
  };

  const handleOpenDialog = (month: string) => {
    setSelectedMonth(month);
    setEditingItem(null);
    setFormData({
      ...defaultFormData,
      transactionDate: getTodayString(),
      billDueDate: getTodayString(),
      transactionDateDisplay: formatDateBR(getTodayString()),
      billDueDateDisplay: formatDateBR(getTodayString()),
    });
    setDialogOpen(true);
  };

  const handleEditItem = (item: BudgetItem) => {
    setEditingItem(item);
    setSelectedMonth(item.yearMonth);
    const amtNum = parseFloat(item.amount?.toString() || "0");
    const amtDisplay = amtNum ? formatBRLInput(Math.round(amtNum * 100).toString()) : "";
    setFormData({
      description: item.description,
      shortTitle: item.shortTitle || "",
      type: item.type as "receita" | "despesa",
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      beneficiaryId: item.beneficiaryId,
      amount: item.amount,
      amountDisplay: amtDisplay,
      transactionDate: item.transactionDate || "",
      transactionDateDisplay: formatDateBR(item.transactionDate || ""),
      billDueDate: item.billDueDate || "",
      billDueDateDisplay: formatDateBR(item.billDueDate || ""),
      isRecurring: false,
      repeatMonths: 0,
      repeatMode: "count",
      repeatUntil: "",
      divideMonths: 1,
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.description || !formData.amount || !selectedMonth) {
      toast({ title: "Preencha todos os campos obrigatorios", variant: "destructive" });
      return;
    }

    if (editingItem) {
      const updateData: any = {
        description: formData.isRecurring ? `${formData.shortTitle || formData.description} #RECORRENCIA 001` : formData.description,
        shortTitle: formData.shortTitle || null,
        type: formData.type,
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId,
        beneficiaryId: formData.beneficiaryId,
        amount: formData.amount,
        transactionDate: formData.transactionDate || null,
        billDueDate: formData.billDueDate || null,
        isRecurring: formData.isRecurring,
        notes: formData.notes,
      };

      if (editingItem.isRecurring && editingItem.recurringGroupId) {
        updateData.syncFutureMonths = true;
      }
      
      const effectiveRepeatMonths = (formData.isRecurring && (formData.repeatMode === "none" || formData.repeatMonths === 0)) ? 60 : formData.repeatMonths;
      if (formData.isRecurring && effectiveRepeatMonths > 0) {
        const recurringGroupId = editingItem.recurringGroupId || `BREC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        if (!editingItem.recurringGroupId) {
          updateData.recurringGroupId = recurringGroupId;
        }
        const additionalItems: any[] = [];
        let [year, month] = editingItem.yearMonth.split("-").map(Number);
        month++;
        if (month > 12) { month = 1; year++; }
        for (let i = 0; i < effectiveRepeatMonths; i++) {
          const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
          additionalItems.push({
            description: `${formData.shortTitle || formData.description} #RECORRENCIA ${String(i + 2).padStart(3, "0")}`,
            shortTitle: formData.shortTitle || null,
            type: formData.type,
            categoryId: formData.categoryId,
            subcategoryId: formData.subcategoryId,
            beneficiaryId: formData.beneficiaryId,
            yearMonth,
            amount: formData.amount,
            transactionDate: formData.transactionDate || null,
            billDueDate: calcBillDueDate(yearMonth),
            isRecurring: true,
            recurringGroupId,
            notes: formData.notes,
          });
          month++;
          if (month > 12) { month = 1; year++; }
        }
        setIsSaving(true);
        apiRequest("PATCH", `/api/budget-items/${editingItem.id}`, updateData)
          .then(() => apiRequest("POST", "/api/budget-items/batch", { items: additionalItems }))
          .then(() => {
            setDialogOpen(false);
            setEditingItem(null);
            setFormData(defaultFormData);
            queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
            toast({ title: `Item atualizado e ${additionalItems.length} copia(s) criada(s)` });
          })
          .catch(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
            toast({ title: "Erro ao salvar", variant: "destructive" });
          })
          .finally(() => setIsSaving(false));
      } else {
        updateMutation.mutate({ id: editingItem.id, data: updateData });
      }
    } else {
      const items: any[] = [];
      const baseAmount = parseFloat(formData.amount);
      let repeatCount = formData.repeatMonths;
      if (formData.isRecurring) {
        if (formData.repeatMode === "until" && formData.repeatUntil) {
          const parts = formData.repeatUntil.split("/");
          if (parts.length === 2) {
            const untilMonth = parseInt(parts[0]);
            const untilYear = parseInt(parts[1]);
            if (isNaN(untilMonth) || isNaN(untilYear) || untilMonth < 1 || untilMonth > 12 || untilYear < 2020) {
              toast({ title: "Data 'Repetir ate' invalida. Use formato MM/AAAA", variant: "destructive" });
              return;
            }
            const [startY, startM] = selectedMonth.split("-").map(Number);
            repeatCount = (untilYear - startY) * 12 + (untilMonth - startM) + 1;
            if (repeatCount < 1) {
              toast({ title: "Data 'Repetir ate' deve ser posterior ao mes selecionado", variant: "destructive" });
              return;
            }
          } else {
            toast({ title: "Preencha a data 'Repetir ate' no formato MM/AAAA", variant: "destructive" });
            return;
          }
        } else if (formData.repeatMode === "none" || formData.repeatMonths === 0) {
          repeatCount = 60;
        }
      }
      const monthsToCreate = formData.isRecurring
        ? repeatCount
        : formData.divideMonths > 1
          ? formData.divideMonths
          : 1;
      const amountPerMonth = formData.divideMonths > 1 ? baseAmount / formData.divideMonths : baseAmount;
      const recurringGroupId = formData.isRecurring ? `BREC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : null;

      let [year, month] = selectedMonth.split("-").map(Number);
      const baseTxDate = formData.transactionDate || getTodayString();
      for (let i = 0; i < monthsToCreate; i++) {
        const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
        const itemBillDueDate = (formData.isRecurring || formData.divideMonths > 1)
          ? calcBillDueDate(yearMonth)
          : (formData.billDueDate || null);
        let itemTxDate = baseTxDate;
        if ((formData.isRecurring || formData.divideMonths > 1) && i > 0) {
          const [txY, txM, txD] = baseTxDate.split("-").map(Number);
          const newDate = new Date(txY, txM - 1 + i, txD);
          itemTxDate = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
        }
        items.push({
          description: monthsToCreate > 1 ? `${formData.shortTitle || formData.description} #RECORRENCIA ${String(i + 1).padStart(3, "0")}` : formData.description,
          shortTitle: formData.shortTitle || null,
          type: formData.type,
          categoryId: formData.categoryId,
          subcategoryId: formData.subcategoryId,
          beneficiaryId: formData.beneficiaryId,
          yearMonth,
          amount: amountPerMonth.toFixed(2),
          transactionDate: itemTxDate,
          billDueDate: itemBillDueDate,
          isRecurring: formData.isRecurring,
          recurringGroupId,
          notes: formData.notes,
          installmentCurrent: formData.divideMonths > 1 ? i + 1 : null,
          installmentTotal: formData.divideMonths > 1 ? formData.divideMonths : null,
        });
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
      createMutation.mutate(items);
    }
  };

  const applySuggestion = (suggestion: { description: string; amount: number }) => {
    setFormData((prev) => ({
      ...prev,
      description: suggestion.description,
      amount: Math.abs(suggestion.amount).toFixed(2),
      amountDisplay: formatBRLInput(Math.round(Math.abs(suggestion.amount) * 100).toString()),
    }));
  };

  const applyAutocompleteSuggestion = (suggestion: AutocompleteSuggestion) => {
    const sugAmt = parseFloat(suggestion.amount || "0");
    setFormData((prev) => ({
      ...prev,
      shortTitle: suggestion.shortTitle,
      description: suggestion.shortTitle,
      amount: suggestion.amount,
      amountDisplay: sugAmt ? formatBRLInput(Math.round(Math.abs(sugAmt) * 100).toString()) : "",
      categoryId: suggestion.categoryId,
      subcategoryId: suggestion.subcategoryId,
    }));
    setShowAutocompleteSuggestions(false);
  };

  const hasActiveFilters = filterType !== "all" || filterSource !== "all" || filterCategoryId !== "all" || filterSubcategoryId !== "all" || searchTerm;

  const clearAllFilters = () => {
    setFilterType("all");
    setFilterSource("all");
    setFilterCategoryId("all");
    setFilterSubcategoryId("all");
    setSearchTerm("");
  };

  const transactionsByMonth = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filteredTransactions) {
      const m = getTxCompetenciaMonth(t);
      const list = map.get(m) || [];
      list.push(t);
      map.set(m, list);
    }
    return map;
  }, [filteredTransactions]);

  const itemsByMonth = useMemo(() => {
    const map = new Map<string, BudgetItem[]>();
    for (const item of filteredBudgetItems) {
      const list = map.get(item.yearMonth) || [];
      list.push(item);
      map.set(item.yearMonth, list);
    }
    return map;
  }, [filteredBudgetItems]);

  const monthTotals = useMemo(() => {
    const totals = new Map<string, { receitas: number; despesas: number; receitasReal: number; despesasReal: number }>();
    const allMonths = new Set(Array.from(itemsByMonth.keys()).concat(Array.from(transactionsByMonth.keys())));
    allMonths.forEach((month) => {
      let receitas = 0, despesas = 0, receitasReal = 0, despesasReal = 0;
      const budgetItems = itemsByMonth.get(month) || [];
      for (const item of budgetItems) {
        const amount = parseFloat(item.amount);
        if (item.type === "receita") receitas += amount;
        else despesas += amount;
      }
      const txItems = transactionsByMonth.get(month) || [];
      for (const t of txItems) {
        const amount = Math.abs(parseFloat(String(t.amount)));
        if (t.type === "receita") receitasReal += amount;
        else despesasReal += amount;
      }
      totals.set(month, { receitas, despesas, receitasReal, despesasReal });
    });
    return totals;
  }, [itemsByMonth, transactionsByMonth]);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  const quarterTotals = useMemo(() => {
    let receitas = 0, despesas = 0;
    months.forEach((m) => {
      const t = monthTotals.get(m);
      if (t) {
        if (filterStatus !== "realizada") {
          receitas += t.receitas;
          despesas += t.despesas;
        }
        if (filterStatus !== "prevista") {
          receitas += t.receitasReal;
          despesas += t.despesasReal;
        }
      }
    });
    return { receitas, despesas, saldo: receitas - despesas };
  }, [months, monthTotals, filterStatus]);

  const allQuarterItems = useMemo(() => {
    const items: BudgetItem[] = [];
    months.forEach((m) => {
      const monthItems = itemsByMonth.get(m) || [];
      items.push(...monthItems);
    });
    return items;
  }, [months, itemsByMonth]);

  const allQuarterTransactions = useMemo(() => {
    const txs: Transaction[] = [];
    months.forEach((m) => {
      const monthTx = transactionsByMonth.get(m) || [];
      txs.push(...monthTx);
    });
    return txs;
  }, [months, transactionsByMonth]);

  const totalItemCount = allQuarterItems.length + allQuarterTransactions.length;

  type UnifiedRow = {
    _kind: "budget" | "transaction";
    _id: string;
    id: number;
    transactionDate: string | null;
    billDueDate: string | null;
    yearMonth: string;
    shortTitle: string | null;
    description: string | null;
    type: string;
    status: string;
    source: string | null;
    categoryId: number | null;
    subcategoryId: number | null;
    beneficiaryId: number | null;
    amount: string;
    isFromInstallment: boolean;
    installmentCurrent: number | null;
    installmentTotal: number | null;
    isRecurring: boolean;
    original?: BudgetItem | Transaction;
  };

  const displayItems = useMemo(() => {
    const unified: UnifiedRow[] = [];

    let budgetFiltered = allQuarterItems as BudgetItem[];
    if (selectedCategoryFilter) {
      budgetFiltered = budgetFiltered.filter((item) => {
        const cat = categories.find(c => c.id === item.categoryId);
        return cat?.name === selectedCategoryFilter && item.type === "despesa";
      });
    }
    if (selectedMonth) {
      budgetFiltered = budgetFiltered.filter(item => item.yearMonth === selectedMonth);
    }
    if (hiddenChartCategories.size > 0) {
      budgetFiltered = budgetFiltered.filter(item => {
        const catName = item.categoryId ? (categories.find(c => c.id === item.categoryId)?.name || null) : null;
        if (!catName) return true;
        return !hiddenChartCategories.has(catName);
      });
    }
    for (const item of budgetFiltered) {
      unified.push({
        _kind: "budget",
        _id: `b_${item.id}`,
        id: item.id,
        transactionDate: item.transactionDate,
        billDueDate: item.billDueDate,
        yearMonth: item.yearMonth,
        shortTitle: item.shortTitle,
        description: item.description,
        type: item.type,
        status: "prevista",
        source: item.source || "manual",
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        beneficiaryId: item.beneficiaryId,
        amount: String(item.amount),
        isFromInstallment: item.isFromInstallment || false,
        installmentCurrent: item.installmentCurrent,
        installmentTotal: item.installmentTotal,
        isRecurring: item.isRecurring || false,
        original: item,
      });
    }

    let txFiltered = allQuarterTransactions as Transaction[];
    if (selectedCategoryFilter) {
      txFiltered = txFiltered.filter((t) => {
        const cat = categories.find(c => c.id === t.categoryId);
        return cat?.name === selectedCategoryFilter && t.type === "despesa";
      });
    }
    if (selectedMonth) {
      txFiltered = txFiltered.filter(t => getTxCompetenciaMonth(t) === selectedMonth);
    }
    if (hiddenChartCategories.size > 0) {
      txFiltered = txFiltered.filter(t => {
        const catName = t.categoryId ? (categories.find(c => c.id === t.categoryId)?.name || null) : null;
        if (!catName) return true;
        return !hiddenChartCategories.has(catName);
      });
    }
    for (const t of txFiltered) {
      unified.push({
        _kind: "transaction",
        _id: `t_${t.id}`,
        id: t.id,
        transactionDate: t.transactionDate || t.date,
        billDueDate: t.paymentDate || t.cardBillMonth || null,
        yearMonth: getTxCompetenciaMonth(t),
        shortTitle: t.shortTitle,
        description: t.description || t.originalDescription,
        type: t.type,
        status: t.status || "realizada",
        source: t.source || "manual",
        categoryId: t.categoryId,
        subcategoryId: t.subcategoryId,
        beneficiaryId: t.beneficiaryId,
        amount: String(Math.abs(parseFloat(String(t.amount)))),
        isFromInstallment: !!(t.installmentTotal && t.installmentTotal > 1),
        installmentCurrent: t.installmentCurrent,
        installmentTotal: t.installmentTotal,
        isRecurring: t.isRecurring || false,
        original: t,
      });
    }

    unified.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case "transactionDate":
          aVal = a.transactionDate || ""; bVal = b.transactionDate || ""; break;
        case "billDueDate":
          aVal = a.billDueDate || ""; bVal = b.billDueDate || ""; break;
        case "yearMonth":
          aVal = a.yearMonth; bVal = b.yearMonth; break;
        case "shortTitle":
          aVal = (a.shortTitle || a.description || "").toLowerCase();
          bVal = (b.shortTitle || b.description || "").toLowerCase(); break;
        case "categoryId":
          aVal = categories.find(c => c.id === a.categoryId)?.name || "";
          bVal = categories.find(c => c.id === b.categoryId)?.name || ""; break;
        case "subcategoryId":
          aVal = subcategories.find(s => s.id === a.subcategoryId)?.name || "";
          bVal = subcategories.find(s => s.id === b.subcategoryId)?.name || ""; break;
        case "beneficiaryId":
          aVal = beneficiaries.find(bn => bn.id === a.beneficiaryId)?.name || "";
          bVal = beneficiaries.find(bn => bn.id === b.beneficiaryId)?.name || ""; break;
        case "type":
          aVal = a.type; bVal = b.type; break;
        case "source":
          aVal = a.isFromInstallment ? "parcelamento" : a.source || "manual";
          bVal = b.isFromInstallment ? "parcelamento" : b.source || "manual"; break;
        case "amount":
          aVal = parseFloat(a.amount); bVal = parseFloat(b.amount); break;
        default:
          aVal = a.yearMonth; bVal = b.yearMonth;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return unified;
  }, [selectedCategoryFilter, selectedMonth, allQuarterItems, allQuarterTransactions, categories, subcategories, beneficiaries, sortColumn, sortDirection, hiddenChartCategories]);

  const totalPages = Math.max(1, Math.ceil(displayItems.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayItems.slice(start, start + ITEMS_PER_PAGE);
  }, [displayItems, currentPage]);

  const displayTotals = useMemo(() => {
    let receitas = 0, despesas = 0;
    for (const item of displayItems) {
      const amt = parseFloat(item.amount?.toString() || "0");
      if (item.type === "receita") receitas += amt;
      else despesas += amt;
    }
    return { receitas, despesas, saldo: receitas - despesas };
  }, [displayItems]);

  const allBudgetTotals = useMemo(() => {
    let receitas = 0, despesas = 0, countRec = 0, countDesp = 0;
    for (const item of filteredBudgetItems) {
      const amt = parseFloat(item.amount?.toString() || "0");
      if (item.type === "receita") { receitas += amt; countRec++; }
      else { despesas += amt; countDesp++; }
    }
    for (const t of filteredTransactions) {
      const amt = Math.abs(parseFloat(String(t.amount)));
      if (t.type === "receita") { receitas += amt; countRec++; }
      else { despesas += amt; countDesp++; }
    }
    return { receitas, despesas, saldo: receitas - despesas, countRec, countDesp, total: filteredBudgetItems.length + filteredTransactions.length };
  }, [filteredBudgetItems, filteredTransactions]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(displayItems.filter(r => r._kind === "budget").map((t) => t.id));
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

  const chartMonths = useMemo(() => {
    if (viewMode === "all" && months.length > 0) {
      return [...months];
    }
    const result: string[] = [];
    const startMonth = ((selectedQuarter - 1) * 3) + 1;
    const startDate = new Date(selectedYear, startMonth - 7, 1);
    for (let i = 0; i < 12; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return result;
  }, [selectedYear, selectedQuarter, viewMode, months]);

  const chartMonthsParam = useMemo(() => chartMonths.join(","), [chartMonths]);

  const { data: realizedAggregates = [] } = useQuery<{ month: string; receitas: number; despesas: number; despesasPorCategoria: { categoryId: number; total: number }[] }[]>({
    queryKey: ["/api/transactions/aggregates-by-month", chartMonthsParam],
    queryFn: async () => {
      const res = await fetch(`/api/transactions/aggregates-by-month?months=${chartMonthsParam}`);
      if (!res.ok) throw new Error("Failed to fetch aggregates");
      return res.json();
    },
    enabled: chartMonths.length > 0,
  });

  const realizedByMonth = useMemo(() => {
    const map = new Map<string, { receitas: number; despesas: number; despesasPorCategoria: { categoryId: number; total: number }[] }>();
    for (const agg of realizedAggregates) {
      map.set(agg.month, agg);
    }
    return map;
  }, [realizedAggregates]);

  const chartData = useMemo(() => {
    const categoryTotals = new Map<string, Map<string, number>>();
    const catColors = new Map<string, string>();
    const monthReceitas = new Map<string, number>();
    const monthDespesas = new Map<string, number>();
    const monthReceitasReal = new Map<string, number>();
    const monthDespesasReal = new Map<string, number>();

    if (filterStatus !== "realizada") {
      for (const item of filteredBudgetItems) {
        if (!chartMonths.includes(item.yearMonth)) continue;
        const amount = parseFloat(item.amount?.toString() || "0");
        if (item.type === "receita") {
          monthReceitas.set(item.yearMonth, (monthReceitas.get(item.yearMonth) || 0) + amount);
        } else {
          monthDespesas.set(item.yearMonth, (monthDespesas.get(item.yearMonth) || 0) + amount);
          const cat = categories.find(c => c.id === item.categoryId);
          const catName = cat?.name || "Sem categoria";
          if (!categoryTotals.has(catName)) categoryTotals.set(catName, new Map());
          const monthMap = categoryTotals.get(catName)!;
          monthMap.set(item.yearMonth, (monthMap.get(item.yearMonth) || 0) + amount);
          if (cat?.color) catColors.set(catName, cat.color);
        }
      }
    }

    if (filterStatus !== "prevista") {
      for (const m of chartMonths) {
        const txs = transactionsByMonth.get(m) || [];
        for (const t of txs) {
          const amount = Math.abs(parseFloat(String(t.amount)));
          if (t.type === "receita") {
            monthReceitasReal.set(m, (monthReceitasReal.get(m) || 0) + amount);
          } else {
            monthDespesasReal.set(m, (monthDespesasReal.get(m) || 0) + amount);
            const cat = categories.find(c => c.id === t.categoryId);
            const catName = cat?.name || "Sem categoria";
            if (!categoryTotals.has(catName)) categoryTotals.set(catName, new Map());
            const monthMap = categoryTotals.get(catName)!;
            monthMap.set(m, (monthMap.get(m) || 0) + amount);
            if (cat?.color) catColors.set(catName, cat.color);
          }
        }
      }
    }

    return {
      data: chartMonths.map((m) => {
        const point: { month: string; receitas?: number; despesas?: number; receitasRealizadas?: number; despesasRealizadas?: number; [key: string]: number | string | undefined } = { month: getMonthName(m) };
        const rec = monthReceitas.get(m) || 0;
        const desp = monthDespesas.get(m) || 0;
        if (rec > 0) point.receitas = rec;
        if (desp > 0) point.despesas = desp;

        const recReal = monthReceitasReal.get(m) || 0;
        const despReal = monthDespesasReal.get(m) || 0;
        if (recReal > 0) point.receitasRealizadas = recReal;
        if (despReal > 0) point.despesasRealizadas = despReal;

        categoryTotals.forEach((monthMap, catName) => {
          const val = monthMap.get(m) || 0;
          if (val > 0) point[catName] = val;
        });
        return point;
      }),
      categories: Array.from(categoryTotals.keys()),
      colors: catColors,
    };
  }, [chartMonths, filteredBudgetItems, categories, transactionsByMonth, filterStatus]);

  const filteredCategories = categories.filter((c) => c.active);
  const filteredSubcategories = subcategories.filter((s) => s.categoryId === formData.categoryId);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Visao Planejado" />
        <div className="px-4 py-3 space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Visao Planejado" subtitle={viewMode === "quarter" ? getQuarterLabel(selectedQuarter, selectedYear) : viewMode === "year" ? String(selectedYear) : "Todos"} selectedMonth={selectedMonth} onMonthChange={handleMonthChange}>
        {viewMode !== "all" && (
          <>
            <Button variant="outline" size="icon" onClick={() => handleNavigateQuarter(-1)} data-testid="button-prev-quarter">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4].map((q) => (
                <Button
                  key={q}
                  variant={viewMode === "quarter" && selectedQuarter === q ? "default" : "outline"}
                  size="sm"
                  className="text-xs px-2"
                  onClick={() => { setViewMode("quarter"); handleSelectQuarter(q); }}
                  data-testid={`button-q${q}`}
                >
                  Q{q}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => handleNavigateQuarter(1)} data-testid="button-next-quarter">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}
        {viewMode !== "all" && (
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear - 1)} data-testid="button-prev-year">
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Badge variant="outline" className="text-xs min-w-[50px] justify-center">{selectedYear}</Badge>
            <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear + 1)} data-testid="button-next-year">
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            const exportData = filteredBudgetItems.map(item => ({
              Mes: getFullMonthName(item.yearMonth),
              Descricao: item.description || '',
              TituloBreve: item.shortTitle || '',
              Tipo: item.type === "receita" ? "Receita" : "Despesa",
              Valor: item.type === "despesa" ? -Math.abs(parseFloat(item.amount)) : Math.abs(parseFloat(item.amount)),
              Categoria: categories.find(c => c.id === item.categoryId)?.name || '',
              Subcategoria: subcategories.find(s => s.id === item.subcategoryId)?.name || '',
              Beneficiario: beneficiaries.find(b => b.id === item.beneficiaryId)?.name || '',
              DataTransacao: item.transactionDate || '',
              DataVencimento: item.billDueDate || '',
              Parcela: item.installmentCurrent ? `${item.installmentCurrent}/${item.installmentTotal}` : '',
              Recorrente: item.isRecurring ? "Sim" : "Nao",
            }));
            exportToExcel(exportData, `planejamento_${selectedYear}_Q${selectedQuarter}`, 'Planejamento');
            toast({ title: "Exportado!", description: `${exportData.length} itens exportados para Excel.` });
          }}
          data-testid="button-export-budget"
        >
          <FileDown className="w-3 h-3 mr-1" />
          Exportar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-installments"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          Sync
        </Button>
        <div className="flex items-center gap-0.5">
          <Button
            variant={viewMode === "year" ? "default" : "outline"}
            size="sm"
            className="text-xs px-2"
            onClick={() => setViewMode(viewMode === "year" ? "quarter" : "year")}
            data-testid="button-view-year"
          >
            Ano
          </Button>
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            size="sm"
            className="text-xs px-2"
            onClick={() => setViewMode(viewMode === "all" ? "quarter" : "all")}
            data-testid="button-view-all"
          >
            Todos
          </Button>
        </div>
      </PageHeader>

      <div className="px-4 py-2 space-y-2">
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-medium">Receitas</span>
              </div>
              <span className="text-lg font-bold text-success" data-testid="text-plan-receitas">{formatCurrency(quarterTotals.receitas)}</span>
              <span className="text-xs text-muted-foreground ml-1">({allQuarterItems.filter(i => i.type === 'receita').length})</span>
              {allBudgetTotals.countRec !== allQuarterItems.filter(i => i.type === 'receita').length && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Total: {formatCurrency(allBudgetTotals.receitas)} ({allBudgetTotals.countRec})
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium">Despesas</span>
              </div>
              <span className="text-lg font-bold text-destructive" data-testid="text-plan-despesas">{formatCurrency(quarterTotals.despesas)}</span>
              <span className="text-xs text-muted-foreground ml-1">({allQuarterItems.filter(i => i.type === 'despesa').length})</span>
              {allBudgetTotals.countDesp !== allQuarterItems.filter(i => i.type === 'despesa').length && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Total: {formatCurrency(allBudgetTotals.despesas)} ({allBudgetTotals.countDesp})
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Saldo</span>
              </div>
              <span className={`text-lg font-bold ${quarterTotals.saldo >= 0 ? "text-success" : "text-destructive"}`} data-testid="text-plan-saldo">{formatCurrency(quarterTotals.saldo)}</span>
              {allBudgetTotals.total !== allQuarterItems.length && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Total: {formatCurrency(allBudgetTotals.saldo)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Itens</span>
              </div>
              <span className="text-lg font-bold" data-testid="text-plan-count">{totalItemCount}</span>
              <span className="text-xs text-muted-foreground ml-1">de {allBudgetTotals.total}</span>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <div className="flex items-center gap-1 mb-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (monthsScrollRef.current) monthsScrollRef.current.scrollLeft = 0; }} data-testid="button-scroll-start">
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (monthsScrollRef.current) monthsScrollRef.current.scrollLeft -= 400; }} data-testid="button-scroll-left">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (monthsScrollRef.current) monthsScrollRef.current.scrollLeft += 400; }} data-testid="button-scroll-right">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (monthsScrollRef.current) monthsScrollRef.current.scrollLeft = monthsScrollRef.current.scrollWidth; }} data-testid="button-scroll-end">
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div ref={monthsScrollRef} className="overflow-x-auto pb-2" style={{ scrollBehavior: 'smooth' }}>
            <div className="grid grid-rows-2 grid-flow-col gap-2" style={{ gridAutoColumns: 'minmax(220px, 1fr)' }}>
          {months.map((month) => {
            const items = itemsByMonth.get(month) || [];
            const txItems = transactionsByMonth.get(month) || [];
            const expenseData = getExpensesByCategory(items, txItems);
            const totals = monthTotals.get(month) || { receitas: 0, despesas: 0, receitasReal: 0, despesasReal: 0 };
            const isCurrentMonth = month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

            return (
              <Card key={month} className={isCurrentMonth ? "ring-1 ring-primary" : ""}>
                <CardContent className="p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{getFullMonthName(month)}</span>
                    <Button variant="outline" size="sm" className="text-[10px] h-6 px-1.5" onClick={() => handleOpenDialog(month)} data-testid={`button-add-${month}`}>
                      <Plus className="w-2.5 h-2.5 mr-0.5" />
                      Add
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {expenseData.length > 0 ? (
                      <>
                        <ResponsiveContainer width={80} height={80}>
                          <PieChart>
                            <Pie data={expenseData} cx="50%" cy="50%" innerRadius={20} outerRadius={35} paddingAngle={2} dataKey="value"
                              onClick={(_, index) => setSelectedCategoryFilter(expenseData[index].name)}
                              style={{ cursor: "pointer" }}
                            >
                              {expenseData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: "10px", padding: "4px 8px" }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-0.5">
                          {expenseData.slice(0, 4).map((entry, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between text-[10px] cursor-pointer hover:opacity-70"
                              onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === entry.name ? null : entry.name)}
                              data-testid={`pie-legend-${month}-${entry.name}`}
                            >
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className={`truncate max-w-[70px] ${selectedCategoryFilter === entry.name ? "font-bold underline" : ""}`}>{entry.name}</span>
                              </div>
                              <span className="font-medium">{formatCurrency(entry.value)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-[80px] flex items-center justify-center text-muted-foreground text-[10px] w-full">Sem despesas</div>
                    )}
                  </div>
                  <div className="border-t mt-1 pt-1 space-y-0.5 text-[10px]">
                    {filterStatus !== "realizada" && (
                      <div className="grid grid-cols-3 gap-1">
                        <div className="text-center">
                          <div className="text-muted-foreground">Rec. Plan.</div>
                          <div className="text-success font-medium opacity-60">{formatCurrency(totals.receitas)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground">Desp. Plan.</div>
                          <div className="text-destructive font-medium opacity-60">{formatCurrency(totals.despesas)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground">Saldo Plan.</div>
                          <div className={`font-medium opacity-60 ${(totals.receitas - totals.despesas) >= 0 ? "text-success" : "text-destructive"}`}>
                            {formatCurrency(totals.receitas - totals.despesas)}
                          </div>
                        </div>
                      </div>
                    )}
                    {filterStatus !== "prevista" && (totals.receitasReal > 0 || totals.despesasReal > 0) && (
                      <div className="grid grid-cols-3 gap-1">
                        <div className="text-center">
                          <div className="text-muted-foreground">Rec. Real.</div>
                          <div className="text-success font-semibold">{formatCurrency(totals.receitasReal)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground">Desp. Real.</div>
                          <div className="text-destructive font-semibold">{formatCurrency(totals.despesasReal)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground">Saldo Real.</div>
                          <div className={`font-semibold ${(totals.receitasReal - totals.despesasReal) >= 0 ? "text-success" : "text-destructive"}`}>
                            {formatCurrency(totals.receitasReal - totals.despesasReal)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
            </div>
          </div>
        </div>
      </div>

      <Card className="mx-4">
        <CardContent className="p-2">
          <div className="grid gap-2 grid-cols-1">
            <div>
              <span className="text-[10px] font-medium mb-0.5 block">Planejado vs Realizado</span>
              {chartData.data.some(d => d.receitas || d.despesas || d.receitasRealizadas || d.despesasRealizadas) ? (() => {
                const formatK = (v: number) => {
                  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
                  return v > 0 ? v.toFixed(0) : '';
                };
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData.data} margin={{ top: 16, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" fontSize={9} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} fontSize={9} stroke="hsl(var(--muted-foreground))" width={35} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '10px' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '8px', paddingTop: '2px', cursor: 'pointer' }}
                        iconSize={8}
                        onClick={(e: any) => {
                          if (e?.dataKey) {
                            setHiddenBarSeries(prev => {
                              const next = new Set(prev);
                              if (next.has(e.dataKey)) next.delete(e.dataKey); else next.add(e.dataKey);
                              return next;
                            });
                          }
                        }}
                        formatter={(value: string, entry: any) => (
                          <span style={{ color: hiddenBarSeries.has(entry.dataKey) ? "hsl(var(--muted-foreground))" : entry.color, textDecoration: hiddenBarSeries.has(entry.dataKey) ? "line-through" : "none" }}>{value}</span>
                        )}
                      />
                      <Bar dataKey="receitas" name="Rec. Planejado" fill="#10B981" radius={[3, 3, 0, 0]} opacity={0.4} hide={hiddenBarSeries.has("receitas")}>
                        <LabelList dataKey="receitas" position="top" fontSize={8} fill="#10B981" formatter={(v: number) => formatK(v)} />
                      </Bar>
                      <Bar dataKey="receitasRealizadas" name="Rec. Realizado" fill="#10B981" radius={[3, 3, 0, 0]} hide={hiddenBarSeries.has("receitasRealizadas")}>
                        <LabelList dataKey="receitasRealizadas" position="top" fontSize={8} fill="#10B981" formatter={(v: number) => formatK(v)} />
                      </Bar>
                      <Bar dataKey="despesas" name="Desp. Planejado" fill="#EF4444" radius={[3, 3, 0, 0]} opacity={0.4} hide={hiddenBarSeries.has("despesas")}>
                        <LabelList dataKey="despesas" position="top" fontSize={8} fill="#EF4444" formatter={(v: number) => formatK(v)} />
                      </Bar>
                      <Bar dataKey="despesasRealizadas" name="Desp. Realizado" fill="#EF4444" radius={[3, 3, 0, 0]} hide={hiddenBarSeries.has("despesasRealizadas")}>
                        <LabelList dataKey="despesasRealizadas" position="top" fontSize={8} fill="#EF4444" formatter={(v: number) => formatK(v)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })() : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Nenhum dado disponivel</div>
              )}
            </div>
            <div>
              <span className="text-[10px] font-medium mb-0.5 block">Evolucao Mensal por Categoria</span>
              {chartData.data.length > 0 && chartData.categories.length > 0 ? (() => {
                const formatK = (v: number) => {
                  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
                  return v.toFixed(0);
                };
                const renderTotalLabel = (props: any) => {
                  const { x, y, value } = props;
                  if (value === undefined || value === null) return null;
                  return (
                    <text x={x} y={y - 8} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={9} fontWeight={600}>
                      {formatK(Number(value))}
                    </text>
                  );
                };
                const totalData = chartData.data.map(d => {
                  let total = 0;
                  chartData.categories.forEach(cat => {
                    if (!hiddenChartCategories.has(cat)) {
                      const val = d[cat];
                      if (typeof val === 'number') total += val;
                    }
                  });
                  return {
                    ...d,
                    _total: total > 0 ? total : undefined,
                    _totalRealizado: (d.despesasRealizadas && typeof d.despesasRealizadas === 'number' && d.despesasRealizadas > 0) ? d.despesasRealizadas : undefined,
                  };
                });
                const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
                const legendEntries: Array<{ name: string; color: string }> = [
                  ...chartData.categories.map((catName, idx) => ({
                    name: catName,
                    color: chartData.colors.get(catName) || CHART_COLORS[idx % CHART_COLORS.length],
                  })),
                  { name: "Total Planejado", color: "hsl(var(--foreground))" },
                  { name: "Total Realizado", color: "#F59E0B" },
                ];
                return (
                  <>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1 items-center">
                    {(() => {
                      const allNames = legendEntries.map(e => e.name);
                      const allHidden = allNames.every(n => hiddenChartCategories.has(n));
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (allHidden) {
                              setHiddenChartCategories(new Set());
                            } else {
                              setHiddenChartCategories(new Set(allNames));
                            }
                          }}
                          className="text-[9px] text-muted-foreground hover:text-foreground underline mr-1"
                          data-testid="button-toggle-all-chart-categories"
                        >
                          {allHidden ? "Marcar todos" : "Desmarcar todos"}
                        </button>
                      );
                    })()}
                    {legendEntries.map(({ name, color }) => {
                      const isVisible = !hiddenChartCategories.has(name);
                      return (
                        <label key={name} className="flex items-center gap-1 cursor-pointer select-none" data-testid={`chart-legend-${name}`}>
                          <Checkbox
                            checked={isVisible}
                            onCheckedChange={() => {
                              const next = new Set(hiddenChartCategories);
                              if (isVisible) next.add(name); else next.delete(name);
                              setHiddenChartCategories(next);
                            }}
                            className="h-3 w-3"
                            style={{ borderColor: color, backgroundColor: isVisible ? color : "transparent" }}
                          />
                          <span className="text-[10px]" style={{ color: isVisible ? color : "hsl(var(--muted-foreground))" }}>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={totalData} margin={{ top: 16, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" fontSize={9} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} fontSize={9} stroke="hsl(var(--muted-foreground))" width={35} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name === '_total' ? 'Total Planejado' : name === '_totalRealizado' ? 'Total Realizado' : name]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '10px' }}
                      />
                      {chartData.categories
                        .filter(catName => !hiddenChartCategories.has(catName))
                        .map((catName, idx) => {
                        const lineColor = chartData.colors.get(catName) || CHART_COLORS[idx % CHART_COLORS.length];
                        return (
                        <Line
                          key={catName}
                          type="monotone"
                          dataKey={catName}
                          name={catName}
                          stroke={lineColor}
                          strokeWidth={1.5}
                          dot={{ fill: lineColor, strokeWidth: 1, r: 2 }}
                          activeDot={{ r: 4, cursor: "pointer" }}
                          connectNulls
                        >
                          <LabelList
                            content={(props: any) => {
                              const { x, y, value } = props;
                              if (value === undefined || value === null || value === 0) return null;
                              return (
                                <text x={x} y={y - 6} textAnchor="middle" fill={lineColor} fontSize={8}>
                                  {formatK(Number(value))}
                                </text>
                              );
                            }}
                          />
                        </Line>
                        );
                      })}
                      {!hiddenChartCategories.has("Total Planejado") && (
                        <Line
                          type="monotone"
                          dataKey="_total"
                          name="Total Planejado"
                          stroke="hsl(var(--foreground))"
                          strokeWidth={2.5}
                          dot={{ fill: 'hsl(var(--foreground))', strokeWidth: 0, r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        >
                          <LabelList content={renderTotalLabel} />
                        </Line>
                      )}
                      {!hiddenChartCategories.has("Total Realizado") && (
                        <Line
                          type="monotone"
                          dataKey="_totalRealizado"
                          name="Total Realizado"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          strokeDasharray="5 3"
                          dot={{ fill: '#F59E0B', strokeWidth: 0, r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        >
                          <LabelList
                            content={(props: any) => {
                              const { x, y, value } = props;
                              if (value === undefined || value === null) return null;
                              return (
                                <text x={x} y={y + 14} textAnchor="middle" fill="#F59E0B" fontSize={9} fontWeight={600}>
                                  {formatK(Number(value))}
                                </text>
                              );
                            }}
                          />
                        </Line>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  </>
                );
              })() : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Nenhum dado disponivel</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mx-4">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3 h-3" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 h-8 text-xs w-[100px]"
                  data-testid="input-search-plan"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                <SelectTrigger className="w-[80px] h-8 text-xs" data-testid="filter-plan-type">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Visao</Label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="w-[90px] h-8 text-xs" data-testid="filter-plan-status">
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
              <Select value={filterSource} onValueChange={(v) => setFilterSource(v)}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-plan-source">
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
              <Select value={filterCategoryId} onValueChange={(v) => { setFilterCategoryId(v); setFilterSubcategoryId("all"); }}>
                <SelectTrigger className="w-[110px] h-8 text-xs" data-testid="filter-plan-category">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="empty">Vazio</SelectItem>
                  {categories.filter(c => c.active).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Subcategoria</Label>
              <Select value={filterSubcategoryId} onValueChange={(v) => setFilterSubcategoryId(v)}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-plan-subcategory">
                  <SelectValue placeholder="Subcateg." />
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
              <Button variant="ghost" size="sm" className="text-xs" onClick={clearAllFilters} data-testid="button-clear-filters">
                <X className="w-3 h-3 mr-0.5" />
                Limpar
              </Button>
            )}
            <div className="flex-1" />
            <Button size="sm" onClick={() => handleOpenDialog(selectedMonth || months[0])} data-testid="button-add-item">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {displayItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum item encontrado</p>
              <p className="text-sm">Clique em "Novo" para adicionar um item</p>
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
            <div>
              <Table className="text-xs table-fixed w-full">
                <colgroup>
                  <col style={{ width: colWidths.checkbox ? `${colWidths.checkbox}px` : undefined }} />
                  <col style={{ width: colWidths.dtTrans }} />
                  <col style={{ width: colWidths.vencFat }} />
                  <col />
                  <col style={{ width: colWidths.tipo }} />
                  <col style={{ width: colWidths.status }} />
                  <col style={{ width: colWidths.orig }} />
                  <col style={{ width: colWidths.categoria }} />
                  <col style={{ width: colWidths.subcategoria }} />
                  <col style={{ width: colWidths.valor }} />
                  <col style={{ width: colWidths.acoes }} />
                </colgroup>
                <TableHeader className="sticky top-[40px] z-40">
                  <TableRow className="h-7 bg-card">
                    <TableHead className="py-1">
                      <Checkbox
                        checked={displayItems.length > 0 && displayItems.every((t) => selectedIds.has(t.id))}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("transactionDate")}>
                      <div className="flex items-center">Dt.Trans.<SortIcon column="transactionDate" /></div>
                      <ResizeHandle col="dtTrans" onResizeStart={handleResizeStart} />
                    </TableHead>
                    <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("billDueDate")}>
                      <div className="flex items-center">Venc.Fat.<SortIcon column="billDueDate" /></div>
                      <ResizeHandle col="vencFat" onResizeStart={handleResizeStart} />
                    </TableHead>
                    <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("shortTitle")}>
                      <div className="flex items-center">Descricao<SortIcon column="shortTitle" /></div>
                    </TableHead>
                    <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("type")}>
                      <div className="flex items-center">Tipo<SortIcon column="type" /></div>
                      <ResizeHandle col="tipo" onResizeStart={handleResizeStart} />
                    </TableHead>
                    <TableHead className="py-1 text-xs relative">
                      Visao
                      <ResizeHandle col="status" onResizeStart={handleResizeStart} />
                    </TableHead>
                    <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("source")}>
                      <div className="flex items-center">Orig.<SortIcon column="source" /></div>
                      <ResizeHandle col="orig" onResizeStart={handleResizeStart} />
                    </TableHead>
                    <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("categoryId")}>
                      <div className="flex items-center">Cat.<SortIcon column="categoryId" /></div>
                      <ResizeHandle col="categoria" onResizeStart={handleResizeStart} />
                    </TableHead>
                    <TableHead className="py-1 text-xs cursor-pointer relative" onClick={() => handleSort("subcategoryId")}>
                      <div className="flex items-center">Subcateg.<SortIcon column="subcategoryId" /></div>
                      <ResizeHandle col="subcategoria" onResizeStart={handleResizeStart} />
                    </TableHead>
                    <TableHead className="py-1 text-xs cursor-pointer text-right relative" onClick={() => handleSort("amount")}>
                      <div className="flex items-center justify-end">Valor<SortIcon column="amount" /></div>
                      <ResizeHandle col="valor" onResizeStart={handleResizeStart} />
                    </TableHead>
                    <TableHead className="py-1 text-xs relative">Acoes<ResizeHandle col="acoes" onResizeStart={handleResizeStart} /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const cat = categories.find(c => c.id === item.categoryId);
                    const sub = subcategories.find(s => s.id === item.subcategoryId);
                    return (
                      <TableRow key={item._id} className="h-10" data-testid={`item-row-${item._id}`}>
                        <TableCell className="py-1.5">
                          {item._kind === "budget" && (
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={(checked) => toggleSelectOne(item.id, !!checked)}
                              data-testid={`checkbox-select-${item._id}`}
                            />
                          )}
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
                          {item._kind === "budget" ? (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950">
                              Plan
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950">
                              Real
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">
                                {item._kind === "transaction" && item.source === "cartao" ? (
                                  <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                                ) : item._kind === "transaction" && item.source === "conta_corrente" ? (
                                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                                ) : (item.isFromInstallment || item.source === "import") ? (
                                  <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                                ) : (
                                  <PenLine className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {item._kind === "transaction" ? (
                                item.source === "cartao" ? "Cartao" : item.source === "conta_corrente" ? "Conta Corrente" : "Manual"
                              ) : (
                                item.isFromInstallment ? `Parcelamento${item.installmentCurrent && item.installmentTotal ? ` ${item.installmentCurrent}/${item.installmentTotal}` : ""}` : item.source === "import" ? "Importado" : "Manual"
                              )}
                              {item.isRecurring ? " (Recorrente)" : ""}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-1.5 overflow-hidden">
                          {cat ? (
                            <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} size="sm" />
                          ) : <span className="text-xs text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground truncate overflow-hidden">
                          {sub?.name || "-"}
                        </TableCell>
                        <TableCell className={`py-1.5 text-right font-medium text-xs whitespace-nowrap ${item.type === "receita" ? "text-success" : "text-destructive"}`}>
                          {item.type === "receita" ? "+" : "-"}{formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {item._kind === "budget" ? (
                            <div className="flex items-center gap-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleEditItem(item.original as BudgetItem)}
                                data-testid={`button-edit-${item._id}`}
                              >
                                <Edit2 className="w-3 h-3 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => { if (confirm("Excluir este item?")) deleteMutation.mutate(item.id); }}
                                data-testid={`button-delete-${item._id}`}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="h-7 bg-muted/50 font-medium">
                    <TableCell colSpan={3} className="py-0.5 text-xs">
                      {displayItems.length} item(ns)
                    </TableCell>
                    <TableCell colSpan={6} className="py-0.5"></TableCell>
                    <TableCell className="py-0.5 text-right text-xs whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-success">+{formatCurrency(displayTotals.receitas)}</span>
                        <span className="text-destructive">-{formatCurrency(displayTotals.despesas)}</span>
                        <span className={displayTotals.saldo >= 0 ? "text-success" : "text-destructive"}>={formatCurrency(displayTotals.saldo)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-0.5"></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t" data-testid="pagination-controls">
                <span className="text-xs text-muted-foreground">
                  Pagina {currentPage} de {totalPages} ({displayItems.length} itens)
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(1)}
                    data-testid="button-first-page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    data-testid="button-last-page"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Item" : "Novo Item"} - {selectedMonth && getFullMonthName(selectedMonth)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 relative">
              <Label>Descricao Breve</Label>
              <Input
                value={formData.shortTitle}
                onChange={(e) => {
                  setFormData({ ...formData, shortTitle: e.target.value, description: e.target.value });
                  setShowAutocompleteSuggestions(true);
                }}
                onFocus={() => setShowAutocompleteSuggestions(true)}
                onBlur={() => setTimeout(() => setShowAutocompleteSuggestions(false), 200)}
                placeholder="Digite para buscar sugestoes... Ex: Salario"
                autoComplete="off"
                data-testid="input-short-title"
              />
              {showAutocompleteSuggestions && autocompleteSuggestions.length > 0 && !editingItem && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                  {autocompleteSuggestions.map((s, idx) => {
                    const category = categories.find(c => c.id === s.categoryId);
                    return (
                      <div
                        key={`${s.shortTitle}-${idx}`}
                        className="px-3 py-2 cursor-pointer hover-elevate flex items-center justify-between text-sm border-b last:border-b-0"
                        onMouseDown={() => applyAutocompleteSuggestion(s)}
                        data-testid={`autocomplete-${s.shortTitle}`}
                      >
                        <span className="font-medium truncate flex-1">{s.shortTitle}</span>
                        <div className="flex items-center gap-2 ml-2">
                          {category && (
                            <Badge variant="outline" className="text-xs" style={{ borderColor: category.color || undefined, color: category.color || undefined }}>
                              {category.name}
                            </Badge>
                          )}
                          <span className="text-muted-foreground whitespace-nowrap">{formatCurrency(parseFloat(s.amount))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descricao Completa (opcional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descricao detalhada..."
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as "receita" | "despesa", categoryId: null, subcategoryId: null })}
                >
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formData.amountDisplay}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const display = formatBRLInput(raw);
                    const amount = parseBRLInput(display);
                    setFormData({ ...formData, amountDisplay: display, amount });
                  }}
                  placeholder="0,00"
                  data-testid="input-amount"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Transacao</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  value={formData.transactionDateDisplay}
                  onChange={(e) => {
                    const display = formatDateInputBR(e.target.value, formData.transactionDateDisplay);
                    const iso = parseDateBR(display);
                    setFormData({ ...formData, transactionDateDisplay: display, transactionDate: display === "" ? "" : (iso || formData.transactionDate) });
                  }}
                  data-testid="input-transaction-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento Fatura</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  value={formData.billDueDateDisplay}
                  onChange={(e) => {
                    const display = formatDateInputBR(e.target.value, formData.billDueDateDisplay);
                    const iso = parseDateBR(display);
                    setFormData({ ...formData, billDueDateDisplay: display, billDueDate: display === "" ? "" : (iso || formData.billDueDate) });
                  }}
                  data-testid="input-bill-due-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <div className="flex gap-1">
                  <Select
                    value={formData.categoryId?.toString() || "none"}
                    onValueChange={(v) => setFormData({ ...formData, categoryId: v === "none" ? null : parseInt(v), subcategoryId: null })}
                  >
                    <SelectTrigger data-testid="select-category" className="flex-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {filteredCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCategoryDialogOpen(true)}
                    data-testid="button-add-category"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subcategoria</Label>
                <div className="flex gap-1">
                  <Select
                    value={formData.subcategoryId?.toString() || "none"}
                    onValueChange={(v) => setFormData({ ...formData, subcategoryId: v === "none" ? null : parseInt(v) })}
                    disabled={!formData.categoryId}
                  >
                    <SelectTrigger data-testid="select-subcategory" className="flex-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {filteredSubcategories.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSubcategoryDialogOpen(true)}
                    disabled={!formData.categoryId}
                    data-testid="button-add-subcategory"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Beneficiario</Label>
                <Select
                  value={formData.beneficiaryId?.toString() || "none"}
                  onValueChange={(v) => setFormData({ ...formData, beneficiaryId: v === "none" ? null : parseInt(v) })}
                >
                  <SelectTrigger data-testid="select-beneficiary">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {beneficiaries.filter((b) => b.active).map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observacoes (opcional)</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Adicione observacoes sobre este item..."
                data-testid="input-notes"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={formData.isRecurring}
                onCheckedChange={(c) => setFormData({ ...formData, isRecurring: !!c, divideMonths: 1, repeatMode: !!c ? "count" : "none" })}
                data-testid="checkbox-recurring"
              />
              <Label htmlFor="recurring">Recorrente</Label>
            </div>

            {formData.isRecurring && (
              <div className="space-y-2 border rounded-md p-3">
                <Label className="text-xs font-medium">Repetir lancamento</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.repeatMode === "none" ? "default" : "outline"}
                    onClick={() => setFormData({ ...formData, repeatMode: "none", repeatMonths: 0 })}
                    data-testid="btn-repeat-none"
                  >Indefinido</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.repeatMode === "count" ? "default" : "outline"}
                    onClick={() => setFormData({ ...formData, repeatMode: "count", repeatMonths: 12 })}
                    data-testid="btn-repeat-count"
                  >Repetir N vezes</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.repeatMode === "until" ? "default" : "outline"}
                    onClick={() => {
                      const now = new Date();
                      const futureMonth = now.getMonth() + 7;
                      const futureYear = now.getFullYear() + Math.floor(futureMonth / 12);
                      const fm = (futureMonth % 12) + 1;
                      setFormData({ ...formData, repeatMode: "until", repeatUntil: `${String(fm).padStart(2, "0")}/${futureYear}` });
                    }}
                    data-testid="btn-repeat-until"
                  >Repetir ate</Button>
                </div>
                {formData.repeatMode === "none" && (
                  <p className="text-xs text-muted-foreground">Item sera repetido por 60 meses (5 anos)</p>
                )}
                {formData.repeatMode === "count" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Quantos meses? (0 = indefinido, 60 meses)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={formData.repeatMonths}
                      onChange={(e) => setFormData({ ...formData, repeatMonths: Math.max(0, parseInt(e.target.value) || 0) })}
                      data-testid="input-repeat-months"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.repeatMonths === 0 ? "60 meses (indefinido)" : `${formData.repeatMonths} mes(es)`} a partir de {selectedMonth || "mes selecionado"}
                    </p>
                  </div>
                )}
                {formData.repeatMode === "until" && (() => {
                  let monthCount = 0;
                  if (formData.repeatUntil && selectedMonth) {
                    const parts = formData.repeatUntil.split("/");
                    if (parts.length === 2) {
                      const untilM = parseInt(parts[0]);
                      const untilY = parseInt(parts[1]);
                      const [startY, startM] = selectedMonth.split("-").map(Number);
                      monthCount = (untilY - startY) * 12 + (untilM - startM) + 1;
                      if (monthCount < 1) monthCount = 0;
                    }
                  }
                  return (
                    <div className="space-y-1">
                      <Label className="text-xs">Repetir ate</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          placeholder="MM/AAAA"
                          value={formData.repeatUntil}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^\d/]/g, "");
                            if (val.length === 2 && !val.includes("/") && !formData.repeatUntil.endsWith("/")) {
                              val += "/";
                            }
                            if (val.length > 7) val = val.slice(0, 7);
                            setFormData({ ...formData, repeatUntil: val });
                          }}
                          maxLength={7}
                          className="w-32"
                          data-testid="input-repeat-until"
                        />
                        {monthCount > 0 && (
                          <span className="text-xs text-muted-foreground">({monthCount} meses)</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {!editingItem && !formData.isRecurring && (
              <div className="space-y-2">
                <Label>Dividir em quantos meses? (1 = sem divisao)</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={formData.divideMonths}
                  onChange={(e) => setFormData({ ...formData, divideMonths: parseInt(e.target.value) || 1 })}
                  data-testid="input-divide-months"
                />
                {formData.divideMonths > 1 && formData.amount && (
                  <p className="text-xs text-muted-foreground">
                    Valor por mes: {formatCurrency(parseFloat(formData.amount) / formData.divideMonths)}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4">
              {editingItem && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    deleteMutation.mutate(editingItem.id);
                    setDialogOpen(false);
                  }}
                  data-testid="button-delete"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending || isSaving}
                  data-testid="button-save"
                >
                  {editingItem ? "Salvar" : (() => {
                    if (!formData.isRecurring && formData.divideMonths <= 1) return "Adicionar";
                    let count = formData.divideMonths > 1 ? formData.divideMonths : formData.repeatMonths;
                    if (formData.isRecurring && (formData.repeatMode === "none" || formData.repeatMonths === 0)) count = 60;
                    if (formData.isRecurring && formData.repeatMode === "until" && formData.repeatUntil) {
                      const parts = formData.repeatUntil.split("/");
                      if (parts.length === 2 && selectedMonth) {
                        const um = parseInt(parts[0]), uy = parseInt(parts[1]);
                        const [sy, sm] = selectedMonth.split("-").map(Number);
                        count = (uy - sy) * 12 + (um - sm) + 1;
                      }
                    }
                    return count > 1 ? `Criar ${count} itens` : "Adicionar";
                  })()}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Categoria ({formData.type === "receita" ? "Receita" : "Despesa"})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Categoria</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: Alimentacao, Transporte..."
                data-testid="input-new-category-name"
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
                  data-testid="input-new-category-color"
                />
                <Input
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!newCategoryName.trim()) {
                    toast({ title: "Informe o nome da categoria", variant: "destructive" });
                    return;
                  }
                  createCategoryMutation.mutate({
                    name: newCategoryName.trim(),
                    type: formData.type,
                    color: newCategoryColor,
                    active: true,
                  });
                }}
                disabled={createCategoryMutation.isPending}
                data-testid="button-save-category"
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
                {categories.find(c => c.id === formData.categoryId)?.name || "Nenhuma selecionada"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome da Subcategoria</Label>
              <Input
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                placeholder="Ex: Restaurante, Uber..."
                data-testid="input-new-subcategory-name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSubcategoryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!newSubcategoryName.trim()) {
                    toast({ title: "Informe o nome da subcategoria", variant: "destructive" });
                    return;
                  }
                  if (!formData.categoryId) {
                    toast({ title: "Selecione uma categoria primeiro", variant: "destructive" });
                    return;
                  }
                  createSubcategoryMutation.mutate({
                    name: newSubcategoryName.trim(),
                    categoryId: formData.categoryId,
                  });
                }}
                disabled={createSubcategoryMutation.isPending}
                data-testid="button-save-subcategory"
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
  );
}
