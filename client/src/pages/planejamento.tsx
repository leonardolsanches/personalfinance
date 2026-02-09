import { useState, useMemo, useCallback, useRef } from "react";
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
  GripVertical,
} from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { exportToExcel } from "@/lib/exportExcel";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, LabelList, BarChart, Bar } from "recharts";
import type { BudgetItem, Category, Subcategory, Beneficiary, InsertCategory, InsertSubcategory } from "@shared/schema";
import { PageHeader } from "@/components/page-header";

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

interface BudgetItemFormData {
  description: string;
  shortTitle: string;
  type: "receita" | "despesa";
  categoryId: number | null;
  subcategoryId: number | null;
  beneficiaryId: number | null;
  amount: string;
  transactionDate: string;
  billDueDate: string;
  isRecurring: boolean;
  repeatMonths: number;
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
  transactionDate: getTodayString(),
  billDueDate: getTodayString(),
  isRecurring: false,
  repeatMonths: 1,
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
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentYearMonth);
  const handleMonthChange = (month: string | null) => {
    setSelectedMonth(month);
    if (month) {
      const [y, m] = month.split("-").map(Number);
      setSelectedYear(y);
      setSelectedQuarter(getQuarterFromMonth(m));
    }
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<BudgetItemFormData>(defaultFormData);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAutocompleteSuggestions, setShowAutocompleteSuggestions] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  const defaultColWidths = { mes: 60, descricao: 0, categoria: 36, subcategoria: 80, beneficiario: 80, tipo: 40, info: 50, valor: 85, acoes: 60 };
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

  const months = useMemo(() => {
    const startMonth = getQuarterStartMonth(selectedQuarter);
    return generateMonths(selectedYear, startMonth, 3);
  }, [selectedYear, selectedQuarter]);

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
    onSuccess: () => {
      setDialogOpen(false);
      setEditingItem(null);
      setFormData(defaultFormData);
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

  const getExpensesByCategory = (items: BudgetItem[]) => {
    const expenseItems = items.filter(item => item.type === "despesa");
    const groups = new Map<number | null, { name: string; value: number; color: string }>();
    
    for (const item of expenseItems) {
      const catId = item.categoryId;
      if (!groups.has(catId)) {
        const category = categories.find(c => c.id === catId);
        groups.set(catId, { 
          name: category?.name || "Sem categoria", 
          value: 0, 
          color: category?.color || "#888888" 
        });
      }
      const group = groups.get(catId)!;
      group.value += parseFloat(item.amount?.toString() || "0");
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
    });
    setDialogOpen(true);
  };

  const handleEditItem = (item: BudgetItem) => {
    setEditingItem(item);
    setSelectedMonth(item.yearMonth);
    setFormData({
      description: item.description,
      shortTitle: item.shortTitle || "",
      type: item.type as "receita" | "despesa",
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      beneficiaryId: item.beneficiaryId,
      amount: item.amount,
      transactionDate: item.transactionDate || "",
      billDueDate: item.billDueDate || "",
      isRecurring: item.isRecurring || false,
      repeatMonths: 1,
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
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          description: formData.description,
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
        },
      });
    } else {
      const items: any[] = [];
      const baseAmount = parseFloat(formData.amount);
      const repeatCount = formData.isRecurring && formData.repeatMonths === 0 ? 60 : formData.repeatMonths;
      const monthsToCreate = formData.isRecurring
        ? repeatCount
        : formData.divideMonths > 1
          ? formData.divideMonths
          : 1;
      const amountPerMonth = formData.divideMonths > 1 ? baseAmount / formData.divideMonths : baseAmount;

      let [year, month] = selectedMonth.split("-").map(Number);
      for (let i = 0; i < monthsToCreate; i++) {
        const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
        items.push({
          description: formData.description,
          shortTitle: formData.shortTitle || null,
          type: formData.type,
          categoryId: formData.categoryId,
          subcategoryId: formData.subcategoryId,
          beneficiaryId: formData.beneficiaryId,
          yearMonth,
          amount: amountPerMonth.toFixed(2),
          transactionDate: formData.transactionDate || null,
          billDueDate: formData.billDueDate || null,
          isRecurring: formData.isRecurring,
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
    }));
  };

  const applyAutocompleteSuggestion = (suggestion: AutocompleteSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      shortTitle: suggestion.shortTitle,
      description: suggestion.shortTitle,
      amount: suggestion.amount,
      categoryId: suggestion.categoryId,
      subcategoryId: suggestion.subcategoryId,
    }));
    setShowAutocompleteSuggestions(false);
  };

  const filteredBudgetItems = useMemo(() => {
    return budgetItems.filter((item) => {
      if (filterType !== "all" && item.type !== filterType) return false;
      if (filterCategoryId !== "all") {
        if (filterCategoryId === "empty") { if (item.categoryId) return false; }
        else if (item.categoryId !== Number(filterCategoryId)) return false;
      }
      if (filterSubcategoryId !== "all") {
        if (filterSubcategoryId === "empty") { if (item.subcategoryId) return false; }
        else if (item.subcategoryId !== Number(filterSubcategoryId)) return false;
      }
      if (filterBeneficiaryId !== "all") {
        if (filterBeneficiaryId === "empty") { if (item.beneficiaryId) return false; }
        else if (item.beneficiaryId !== Number(filterBeneficiaryId)) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchDesc = item.description?.toLowerCase().includes(term);
        const matchShort = item.shortTitle?.toLowerCase().includes(term);
        if (!matchDesc && !matchShort) return false;
      }
      return true;
    });
  }, [budgetItems, filterType, filterCategoryId, filterSubcategoryId, filterBeneficiaryId, searchTerm]);

  const hasActiveFilters = filterType !== "all" || filterCategoryId !== "all" || filterSubcategoryId !== "all" || filterBeneficiaryId !== "all" || searchTerm;

  const clearAllFilters = () => {
    setFilterType("all");
    setFilterCategoryId("all");
    setFilterSubcategoryId("all");
    setFilterBeneficiaryId("all");
    setSearchTerm("");
  };

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
    const totals = new Map<string, { receitas: number; despesas: number }>();
    Array.from(itemsByMonth.entries()).forEach(([month, items]) => {
      let receitas = 0;
      let despesas = 0;
      for (const item of items) {
        const amount = parseFloat(item.amount);
        if (item.type === "receita") {
          receitas += amount;
        } else {
          despesas += amount;
        }
      }
      totals.set(month, { receitas, despesas });
    });
    return totals;
  }, [itemsByMonth]);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  const quarterTotals = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    months.forEach((m) => {
      const t = monthTotals.get(m);
      if (t) { receitas += t.receitas; despesas += t.despesas; }
    });
    return { receitas, despesas, saldo: receitas - despesas };
  }, [months, monthTotals]);

  const allQuarterItems = useMemo(() => {
    const items: BudgetItem[] = [];
    months.forEach((m) => {
      const monthItems = itemsByMonth.get(m) || [];
      items.push(...monthItems);
    });
    return items;
  }, [months, itemsByMonth]);

  const displayItems = useMemo(() => {
    let items = allQuarterItems;
    if (selectedCategoryFilter) {
      items = items.filter((item) => {
        const cat = categories.find(c => c.id === item.categoryId);
        return cat?.name === selectedCategoryFilter && item.type === "despesa";
      });
    }
    if (selectedMonth) {
      items = items.filter(item => item.yearMonth === selectedMonth);
    }
    return items;
  }, [selectedCategoryFilter, selectedMonth, allQuarterItems, categories]);

  const displayTotals = useMemo(() => {
    let receitas = 0, despesas = 0;
    for (const item of displayItems) {
      const amt = parseFloat(item.amount?.toString() || "0");
      if (item.type === "receita") receitas += amt;
      else despesas += amt;
    }
    return { receitas, despesas, saldo: receitas - despesas };
  }, [displayItems]);

  const chartMonths = useMemo(() => {
    const result: string[] = [];
    const startMonth = ((selectedQuarter - 1) * 3) + 1;
    const startDate = new Date(selectedYear, startMonth - 7, 1);
    for (let i = 0; i < 12; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return result;
  }, [selectedYear, selectedQuarter]);

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
    const monthsWithBudget = new Set<string>();

    for (const item of filteredBudgetItems) {
      if (!chartMonths.includes(item.yearMonth)) continue;
      monthsWithBudget.add(item.yearMonth);
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

    for (const m of chartMonths) {
      if (monthsWithBudget.has(m)) continue;
      const realized = realizedByMonth.get(m);
      if (!realized) continue;
      if (realized.receitas > 0) {
        monthReceitas.set(m, (monthReceitas.get(m) || 0) + realized.receitas);
      }
      if (realized.despesas > 0) {
        monthDespesas.set(m, (monthDespesas.get(m) || 0) + realized.despesas);
      }
      if (realized.despesasPorCategoria) {
        for (const dc of realized.despesasPorCategoria) {
          const cat = categories.find(c => c.id === dc.categoryId);
          const catName = cat?.name || "Sem categoria";
          if (!categoryTotals.has(catName)) categoryTotals.set(catName, new Map());
          const monthMap = categoryTotals.get(catName)!;
          monthMap.set(m, (monthMap.get(m) || 0) + dc.total);
          if (cat?.color) catColors.set(catName, cat.color);
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

        const realized = realizedByMonth.get(m);
        if (realized) {
          if (realized.receitas > 0) point.receitasRealizadas = realized.receitas;
          if (realized.despesas > 0) point.despesasRealizadas = realized.despesas;
        }

        categoryTotals.forEach((monthMap, catName) => {
          const val = monthMap.get(m) || 0;
          if (val > 0) point[catName] = val;
        });
        return point;
      }),
      categories: Array.from(categoryTotals.keys()),
      colors: catColors,
    };
  }, [chartMonths, filteredBudgetItems, categories, realizedByMonth]);

  const filteredCategories = categories.filter((c) => c.type === formData.type && c.active);
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
      <PageHeader title="Visao Planejado" subtitle={getQuarterLabel(selectedQuarter, selectedYear)} selectedMonth={selectedMonth} onMonthChange={handleMonthChange}>
        <Button variant="outline" size="icon" onClick={() => handleNavigateQuarter(-1)} data-testid="button-prev-quarter">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4].map((q) => (
            <Button
              key={q}
              variant={selectedQuarter === q ? "default" : "outline"}
              size="sm"
              className="text-xs px-2"
              onClick={() => handleSelectQuarter(q)}
              data-testid={`button-q${q}`}
            >
              Q{q}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="icon" onClick={() => handleNavigateQuarter(1)} data-testid="button-next-quarter">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear - 1)} data-testid="button-prev-year">
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <Badge variant="outline" className="text-xs min-w-[50px] justify-center">{selectedYear}</Badge>
          <Button variant="ghost" size="icon" onClick={() => setSelectedYear(selectedYear + 1)} data-testid="button-next-year">
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
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
      </PageHeader>

      <div className="px-4 py-2 space-y-2">
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-medium">Receitas</span>
              </div>
              <span className="text-lg font-bold text-success" data-testid="text-plan-receitas">{formatCurrency(displayTotals.receitas)}</span>
              <span className="text-xs text-muted-foreground ml-1">({displayItems.filter(i => i.type === 'receita').length})</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium">Despesas</span>
              </div>
              <span className="text-lg font-bold text-destructive" data-testid="text-plan-despesas">{formatCurrency(displayTotals.despesas)}</span>
              <span className="text-xs text-muted-foreground ml-1">({displayItems.filter(i => i.type === 'despesa').length})</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Saldo</span>
              </div>
              <span className={`text-lg font-bold ${displayTotals.saldo >= 0 ? "text-success" : "text-destructive"}`} data-testid="text-plan-saldo">{formatCurrency(displayTotals.saldo)}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Itens</span>
              </div>
              <span className="text-lg font-bold" data-testid="text-plan-count">{displayItems.length}</span>
              <span className="text-xs text-muted-foreground ml-1">de {allQuarterItems.length}</span>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {months.map((month) => {
            const items = itemsByMonth.get(month) || [];
            const expenseData = getExpensesByCategory(items);
            const totals = monthTotals.get(month) || { receitas: 0, despesas: 0 };
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
                            <div key={index} className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="truncate max-w-[70px]">{entry.name}</span>
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
                    {(() => {
                      const r = realizedByMonth.get(month);
                      if (!r || (r.receitas === 0 && r.despesas === 0)) return null;
                      return (
                        <div className="grid grid-cols-3 gap-1">
                          <div className="text-center">
                            <div className="text-muted-foreground">Rec. Real.</div>
                            <div className="text-success font-semibold">{formatCurrency(r.receitas)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground">Desp. Real.</div>
                            <div className="text-destructive font-semibold">{formatCurrency(r.despesas)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground">Saldo Real.</div>
                            <div className={`font-semibold ${(r.receitas - r.despesas) >= 0 ? "text-success" : "text-destructive"}`}>
                              {formatCurrency(r.receitas - r.despesas)}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="sticky top-[40px] z-40 rounded-none border-x-0">
        <CardContent className="p-2">
          <div className="grid gap-2 md:grid-cols-2">
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
                      <Legend wrapperStyle={{ fontSize: '8px', paddingTop: '2px' }} iconSize={8} />
                      <Bar dataKey="receitas" name="Rec. Planejado" fill="#10B981" radius={[3, 3, 0, 0]} opacity={0.4}>
                        <LabelList dataKey="receitas" position="top" fontSize={8} fill="#10B981" formatter={(v: number) => formatK(v)} />
                      </Bar>
                      <Bar dataKey="receitasRealizadas" name="Rec. Realizado" fill="#10B981" radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="receitasRealizadas" position="top" fontSize={8} fill="#10B981" formatter={(v: number) => formatK(v)} />
                      </Bar>
                      <Bar dataKey="despesas" name="Desp. Planejado" fill="#EF4444" radius={[3, 3, 0, 0]} opacity={0.4}>
                        <LabelList dataKey="despesas" position="top" fontSize={8} fill="#EF4444" formatter={(v: number) => formatK(v)} />
                      </Bar>
                      <Bar dataKey="despesasRealizadas" name="Desp. Realizado" fill="#EF4444" radius={[3, 3, 0, 0]}>
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
                    const val = d[cat];
                    if (typeof val === 'number') total += val;
                  });
                  return {
                    ...d,
                    _total: total > 0 ? total : undefined,
                    _totalRealizado: (d.despesasRealizadas && typeof d.despesasRealizadas === 'number' && d.despesasRealizadas > 0) ? d.despesasRealizadas : undefined,
                  };
                });
                const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={totalData} margin={{ top: 16, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" fontSize={9} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} fontSize={9} stroke="hsl(var(--muted-foreground))" width={35} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name === '_total' ? 'Total Planejado' : name === '_totalRealizado' ? 'Total Realizado' : name]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '10px' }}
                      />
                      <Legend
                        formatter={(value: string) => value === '_total' ? 'Total Planejado' : value === '_totalRealizado' ? 'Total Realizado' : value}
                        wrapperStyle={{ fontSize: '8px', paddingTop: '2px' }}
                        iconSize={8}
                      />
                      {chartData.categories.map((catName, idx) => (
                        <Line
                          key={catName}
                          type="monotone"
                          dataKey={catName}
                          name={catName}
                          stroke={chartData.colors.get(catName) || CHART_COLORS[idx % CHART_COLORS.length]}
                          strokeWidth={1.5}
                          dot={{ fill: chartData.colors.get(catName) || CHART_COLORS[idx % CHART_COLORS.length], strokeWidth: 1, r: 2 }}
                          activeDot={{ r: 4, cursor: "pointer" }}
                          connectNulls
                        />
                      ))}
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
                      />
                    </LineChart>
                  </ResponsiveContainer>
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
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Beneficiario</Label>
              <Select value={filterBeneficiaryId} onValueChange={(v) => setFilterBeneficiaryId(v)}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-plan-beneficiary">
                  <SelectValue placeholder="Benefic." />
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
            <div className="overflow-hidden">
              <Table className="text-xs table-fixed w-full">
                <colgroup>
                  <col style={{ width: colWidths.mes || 60 }} />
                  <col />
                  <col style={{ width: colWidths.categoria || 36 }} />
                  <col style={{ width: colWidths.subcategoria || 80 }} />
                  <col style={{ width: colWidths.beneficiario || 80 }} />
                  <col style={{ width: colWidths.tipo || 40 }} />
                  <col style={{ width: colWidths.info || 50 }} />
                  <col style={{ width: colWidths.valor || 85 }} />
                  <col style={{ width: colWidths.acoes || 60 }} />
                </colgroup>
                <TableHeader>
                  <TableRow className="h-7">
                    <TableHead className="py-1 text-xs relative">Mes<ResizeHandle col="mes" /></TableHead>
                    <TableHead className="py-1 text-xs relative">Descricao</TableHead>
                    <TableHead className="py-1 text-xs relative">Cat.<ResizeHandle col="categoria" /></TableHead>
                    <TableHead className="py-1 text-xs relative">Subcateg.<ResizeHandle col="subcategoria" /></TableHead>
                    <TableHead className="py-1 text-xs relative">Benefic.<ResizeHandle col="beneficiario" /></TableHead>
                    <TableHead className="py-1 text-xs relative">Tipo<ResizeHandle col="tipo" /></TableHead>
                    <TableHead className="py-1 text-xs relative">Info<ResizeHandle col="info" /></TableHead>
                    <TableHead className="py-1 text-xs text-right relative">Valor<ResizeHandle col="valor" /></TableHead>
                    <TableHead className="py-1 text-xs relative">Acoes<ResizeHandle col="acoes" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map((item) => {
                    const cat = categories.find(c => c.id === item.categoryId);
                    const sub = subcategories.find(s => s.id === item.subcategoryId);
                    const ben = beneficiaries.find(b => b.id === item.beneficiaryId);
                    return (
                      <TableRow key={item.id} className="h-8" data-testid={`item-row-${item.id}`}>
                        <TableCell className="py-0.5 text-xs truncate overflow-hidden">{getMonthName(item.yearMonth)}</TableCell>
                        <TableCell className="py-0.5 overflow-hidden">
                          <span className="font-medium text-xs truncate block" title={item.description}>
                            {item.shortTitle || item.description}
                          </span>
                        </TableCell>
                        <TableCell className="py-0.5 overflow-hidden">
                          {cat ? (
                            <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} size="sm" />
                          ) : <span className="text-xs text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="py-0.5 text-xs text-muted-foreground truncate overflow-hidden">
                          {sub?.name || "-"}
                        </TableCell>
                        <TableCell className="py-0.5 text-xs text-muted-foreground truncate overflow-hidden">
                          {ben?.name || "-"}
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
                        <TableCell className="py-0.5">
                          <div className="flex items-center gap-0.5">
                            {item.isFromInstallment && <CreditCard className="w-3 h-3 text-muted-foreground" />}
                            {item.isRecurring && <Repeat className="w-3 h-3 text-muted-foreground" />}
                            {item.installmentCurrent && item.installmentTotal && (
                              <span className="text-[10px] text-muted-foreground">{item.installmentCurrent}/{item.installmentTotal}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={`py-0.5 text-right font-medium text-xs whitespace-nowrap ${item.type === "receita" ? "text-success" : "text-destructive"}`}>
                          {item.type === "receita" ? "+" : "-"}{formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="py-0.5">
                          <div className="flex items-center gap-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditItem(item)}
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Edit2 className="w-3 h-3 text-primary" />
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
                    <TableCell colSpan={2} className="py-0.5 text-xs">
                      {displayItems.length} item(ns)
                    </TableCell>
                    <TableCell colSpan={5} className="py-0.5"></TableCell>
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
                <Label className="text-xs">Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0,00"
                  data-testid="input-amount"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Transacao</Label>
                <Input
                  type="date"
                  value={formData.transactionDate}
                  onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                  data-testid="input-transaction-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento Fatura</Label>
                <Input
                  type="date"
                  value={formData.billDueDate}
                  onChange={(e) => setFormData({ ...formData, billDueDate: e.target.value })}
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

            {!editingItem && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={formData.isRecurring}
                    onCheckedChange={(c) => setFormData({ ...formData, isRecurring: !!c, divideMonths: 1 })}
                    data-testid="checkbox-recurring"
                  />
                  <Label htmlFor="recurring">Recorrente (repetir por N meses)</Label>
                </div>

                {formData.isRecurring && (
                  <div className="space-y-2">
                    <Label>Repetir por quantos meses? (0 = indefinido)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={formData.repeatMonths}
                      onChange={(e) => setFormData({ ...formData, repeatMonths: parseInt(e.target.value) || 0 })}
                      data-testid="input-repeat-months"
                    />
                    {formData.repeatMonths === 0 && (
                      <p className="text-xs text-muted-foreground">Item sera repetido por 60 meses (5 anos)</p>
                    )}
                  </div>
                )}

                {!formData.isRecurring && (
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
              </>
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  {editingItem ? "Salvar" : "Adicionar"}
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

    </div>
  );
}
