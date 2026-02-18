import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { filterCardBillPayments } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  CreditCard,
  Pencil,
  Trash2,
  X,
  Building2,
  PenLine,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CategoryIcon } from "@/components/category-icon";
import { Checkbox } from "@/components/ui/checkbox";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, LineChart, Line, LabelList } from "recharts";
import type { Transaction, Category, Subcategory, Beneficiary } from "@shared/schema";

interface DashboardStats {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  saldoAnterior: number;
  saldoAcumulado: number;
  saldoExtrato: number | null;
  contasPendentes: number;
  contasVencidas: number;
  receitasPrevistas: number;
  receitasRealizadas: number;
  despesasPrevistas: number;
  despesasRealizadas: number;
  transacoesPorMes: { month: string; receitas: number; despesas: number }[];
  despesasPorCategoria: { name: string; value: number; color: string }[];
  despesasPorCategoriaPorMes: { month: string; isFuture?: number; [key: string]: number | string | undefined }[];
  categoryColors: { [key: string]: string };
  currentMonthIndex?: number;
  refMonth?: string;
}

function getRefMonthLabel(refMonth: string): string {
  const [year, month] = refMonth.split('-');
  const monthNames = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedFilter, setSelectedFilter] = useState<{
    type: "category" | "month" | null;
    category?: string;
    month?: string;
  }>({ type: null });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<{
    shortTitle?: string;
    amount?: string;
    categoryId?: number | null;
    subcategoryId?: number | null;
    status?: "prevista" | "realizada";
    type?: "receita" | "despesa";
  }>({});

  const now = new Date();
  const defaultRefMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [refMonth, setRefMonth] = useState<string | null>(defaultRefMonth);
  const handleMonthChange = (month: string | null) => { setRefMonth(month); setCurrentPage(1); };
  const [hiddenChartCategories, setHiddenChartCategories] = useState<Set<string>>(new Set());
  const [hiddenBarSeries, setHiddenBarSeries] = useState<Set<string>>(new Set());
  const [chartStatusFilter, setChartStatusFilter] = useState<"realizada" | "prevista" | "ambos">("ambos");
  const [filterSource, setFilterSource] = useState<"all" | "manual" | "cartao" | "conta_corrente">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<"date" | "paymentDate" | "description" | "type" | "status" | "source" | "category" | "subcategory" | "amount">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const statsUrl = refMonth ? `/api/dashboard/stats?refMonth=${refMonth}` : null;
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", refMonth],
    queryFn: async () => {
      if (!statsUrl) return null;
      const res = await fetch(statsUrl);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!refMonth,
  });

  const { data: allTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });
  const transactions = filterCardBillPayments(allTransactions);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const { data: beneficiaries = [] } = useQuery<Beneficiary[]>({
    queryKey: ["/api/beneficiaries"],
  });

  const { data: importPendencies = [] } = useQuery<{ month: string; pendingExtrato: boolean; pendingFatura: boolean }[]>({
    queryKey: ["/api/import/pendencies"],
  });

  const pendingImportCount = importPendencies.filter(m => m.pendingExtrato || m.pendingFatura).length;

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === 'string' && key.startsWith('/api/dashboard/stats');
    }});
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Transaction> }) => {
      return apiRequest("PATCH", `/api/transactions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      invalidateDashboard();
      setEditingTransaction(null);
      toast({ title: "Transacao atualizada com sucesso" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      invalidateDashboard();
      toast({ title: "Transacao excluida com sucesso" });
    },
  });

  const getCompetenciaMonth = (t: Transaction): string => {
    if (t.paymentDate) {
      const d = new Date(t.paymentDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    if (t.source === "cartao" && t.cardBillMonth) return t.cardBillMonth;
    const d = new Date(t.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  // Extrair mês/ano de um label do gráfico (ex: "Jan", "Jan/2025")
  const parseMonthLabel = (label: string): { monthIndex: number; year: number } | null => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const parts = label.split('/');
    const monthName = parts[0];
    const monthIdx = monthNames.indexOf(monthName);
    if (monthIdx < 0) return null;
    const year = parts.length > 1 ? parseInt(parts[1]) : parseInt((refMonth || defaultRefMonth).split('-')[0]);
    return { monthIndex: monthIdx, year };
  };

  // Filtrar transações baseado na seleção do gráfico
  const filteredTransactions = transactions.filter((t) => {
    if (!selectedFilter.type) return false;
    
    if (selectedFilter.type === "category" && selectedFilter.category) {
      const category = categories.find((c) => c.name === selectedFilter.category);
      return category && t.categoryId === category.id && t.type === "despesa";
    }
    
    if (selectedFilter.type === "month" && selectedFilter.month) {
      const parsed = parseMonthLabel(selectedFilter.month);
      if (!parsed) return false;
      
      const targetYM = `${parsed.year}-${String(parsed.monthIndex + 1).padStart(2, '0')}`;
      return getCompetenciaMonth(t) === targetYM;
    }
    
    return false;
  });

  const headerFilteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterBeneficiaryId !== "all") {
        if (filterBeneficiaryId === "empty") { if (t.beneficiaryId) return false; }
        else if (String(t.beneficiaryId) !== filterBeneficiaryId) return false;
      }
      if (filterCategoryId !== "all") {
        if (filterCategoryId === "empty") { if (t.categoryId) return false; }
        else if (String(t.categoryId) !== filterCategoryId) return false;
      }
      if (filterSubcategoryId !== "all") {
        if (filterSubcategoryId === "empty") { if (t.subcategoryId) return false; }
        else if (String(t.subcategoryId) !== filterSubcategoryId) return false;
      }
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!(t.description.toLowerCase().includes(search) ||
          (t.originalDescription && t.originalDescription.toLowerCase().includes(search)) ||
          (t.shortTitle && t.shortTitle.toLowerCase().includes(search)))) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterBeneficiaryId, filterCategoryId, filterSubcategoryId, searchTerm]);

  const monthTransactions = useMemo(() => {
    return headerFilteredTransactions.filter((t) => {
      if (!refMonth) return true;
      return getCompetenciaMonth(t) === refMonth;
    });
  }, [headerFilteredTransactions, refMonth]);

  const baseDisplayTransactions = selectedFilter.type ? filteredTransactions.filter(t => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterBeneficiaryId !== "all") {
      if (filterBeneficiaryId === "empty") { if (t.beneficiaryId) return false; }
      else if (String(t.beneficiaryId) !== filterBeneficiaryId) return false;
    }
    if (filterCategoryId !== "all") {
      if (filterCategoryId === "empty") { if (t.categoryId) return false; }
      else if (String(t.categoryId) !== filterCategoryId) return false;
    }
    if (filterSubcategoryId !== "all") {
      if (filterSubcategoryId === "empty") { if (t.subcategoryId) return false; }
      else if (String(t.subcategoryId) !== filterSubcategoryId) return false;
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!(t.description.toLowerCase().includes(search) ||
        (t.originalDescription && t.originalDescription.toLowerCase().includes(search)) ||
        (t.shortTitle && t.shortTitle.toLowerCase().includes(search)))) return false;
    }
    return true;
  }) : monthTransactions;
  const displayTransactions = baseDisplayTransactions
    .filter(t => {
      if (filterSource !== "all" && t.source !== filterSource) return false;
      if (chartStatusFilter !== "ambos" && t.status !== chartStatusFilter) return false;
      if (hiddenChartCategories.size > 0) {
        const catName = t.categoryId ? (categories.find(c => c.id === t.categoryId)?.name || null) : null;
        if (catName && hiddenChartCategories.has(catName)) return false;
      }
      return true;
    });

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "-";
    return categories.find((c) => c.id === categoryId)?.name || "-";
  };

  const getSubcategoryName = (subcategoryId: number | null) => {
    if (!subcategoryId) return "-";
    return subcategories.find((s) => s.id === subcategoryId)?.name || "-";
  };

  const formatDate = (date: string) => { const d = new Date(date); const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth() + 1).padStart(2, '0'); const yy = String(d.getFullYear()).slice(2); return `${dd}/${mm}/${yy}`; };

  const handlePieClick = (data: { name: string }) => {
    setSelectedFilter({ type: "category", category: data.name });
    setCurrentPage(1);
  };

  const handleLineClick = (month: string, category?: string) => {
    if (category) {
      setSelectedFilter({ type: "category", category, month });
    } else {
      setSelectedFilter({ type: "month", month });
    }
    setCurrentPage(1);
  };

  const clearFilter = () => {
    setSelectedFilter({ type: null });
    setFilterSource("all");
    setSearchTerm("");
    setFilterType("all");
    setFilterBeneficiaryId("all");
    setFilterCategoryId("all");
    setFilterSubcategoryId("all");
    setCurrentPage(1);
  };

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortHeader = ({ column, children, className }: { column: typeof sortColumn; children: React.ReactNode; className?: string }) => (
    <button
      className={`flex items-center gap-0.5 hover:text-foreground transition-colors ${className || ""}`}
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

  const sortedDisplayTransactions = useMemo(() => {
    return [...displayTransactions].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "date":
          comparison = (a.transactionDate || a.date).localeCompare(b.transactionDate || b.date);
          break;
        case "paymentDate":
          comparison = (a.paymentDate || "").localeCompare(b.paymentDate || "");
          break;
        case "description":
          comparison = (a.shortTitle || a.description).localeCompare(b.shortTitle || b.description);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "source":
          comparison = (a.source || "").localeCompare(b.source || "");
          break;
        case "category":
          comparison = getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId));
          break;
        case "subcategory":
          comparison = getSubcategoryName(a.subcategoryId).localeCompare(getSubcategoryName(b.subcategoryId));
          break;
        case "amount":
          comparison = Number(a.amount) - Number(b.amount);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [displayTransactions, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedDisplayTransactions.length / itemsPerPage));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedDisplayTransactions.slice(start, start + itemsPerPage);
  }, [sortedDisplayTransactions, currentPage, itemsPerPage]);

  const openEditDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditForm({
      shortTitle: transaction.shortTitle || transaction.description,
      amount: String(transaction.amount),
      categoryId: transaction.categoryId,
      subcategoryId: transaction.subcategoryId,
      status: transaction.status,
      type: transaction.type,
    });
  };

  const saveEdit = () => {
    if (!editingTransaction) return;
    const updateData = {
      ...editForm,
      amount: editForm.amount ? String(parseFloat(editForm.amount).toFixed(2)) : undefined,
    };
    updateMutation.mutate({ id: editingTransaction.id, data: updateData });
  };

  const allTotals = useMemo(() => {
    let receitas = 0, despesas = 0, countRec = 0, countDesp = 0;
    for (const t of monthTransactions) {
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
      if (t.type === "receita") { receitas += amount; countRec++; }
      else { despesas += amount; countDesp++; }
    }
    return { receitas, despesas, saldo: receitas - despesas, countRec, countDesp, total: monthTransactions.length };
  }, [monthTransactions]);

  const totals = useMemo(() => {
    if (chartStatusFilter === "ambos") return allTotals;
    let receitas = 0, despesas = 0, countRec = 0, countDesp = 0;
    for (const t of monthTransactions) {
      if (t.status !== chartStatusFilter) continue;
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
      if (t.type === "receita") { receitas += amount; countRec++; }
      else { despesas += amount; countDesp++; }
    }
    const total = countRec + countDesp;
    return { receitas, despesas, saldo: receitas - despesas, countRec, countDesp, total };
  }, [monthTransactions, chartStatusFilter, allTotals]);

  const tableTotals = useMemo(() => {
    let receitas = 0, despesas = 0, countRec = 0, countDesp = 0;
    for (const t of displayTransactions) {
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
      if (t.type === "receita") { receitas += amount; countRec++; }
      else { despesas += amount; countDesp++; }
    }
    return { receitas, despesas, saldo: receitas - despesas, countRec, countDesp, total: displayTransactions.length };
  }, [displayTransactions]);

  const [selectedDonutCategory, setSelectedDonutCategory] = useState<string | null>(null);
  const [selectedSubcatCategory, setSelectedSubcatCategory] = useState<string | null>(null);

  const cardTotals = useMemo(() => {
    if (!selectedDonutCategory) return totals;
    let receitas = 0, despesas = 0, countRec = 0, countDesp = 0;
    for (const t of monthTransactions) {
      if (chartStatusFilter !== "ambos" && t.status !== chartStatusFilter) continue;
      const cat = categories.find(c => c.id === t.categoryId);
      if (!cat || cat.name !== selectedDonutCategory) continue;
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
      if (t.type === "receita") { receitas += amount; countRec++; }
      else { despesas += amount; countDesp++; }
    }
    const total = countRec + countDesp;
    return { receitas, despesas, saldo: receitas - despesas, countRec, countDesp, total };
  }, [monthTransactions, selectedDonutCategory, categories, totals, chartStatusFilter]);

  const donutData = useMemo(() => {
    const source = refMonth ? monthTransactions : headerFilteredTransactions;
    const map = new Map<string, { value: number; count: number; color: string }>();
    for (const t of source) {
      if (t.type !== "despesa") continue;
      if (chartStatusFilter !== "ambos" && t.status !== chartStatusFilter) continue;
      const cat = categories.find(c => c.id === t.categoryId);
      const catName = cat?.name || "Sem Categoria";
      const catColor = cat?.color || "#9CA3AF";
      const amount = Math.abs(typeof t.amount === "string" ? parseFloat(t.amount) : t.amount);
      const existing = map.get(catName) || { value: 0, count: 0, color: catColor };
      existing.value += amount;
      existing.count += 1;
      map.set(catName, existing);
    }
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.value - a.value);
  }, [monthTransactions, headerFilteredTransactions, categories, refMonth, chartStatusFilter]);

  const subcatDonutData = useMemo(() => {
    const source = refMonth ? monthTransactions : headerFilteredTransactions;
    const map = new Map<string, { value: number; count: number }>();
    for (const t of source) {
      if (t.type !== "despesa") continue;
      if (chartStatusFilter !== "ambos" && t.status !== chartStatusFilter) continue;
      if (selectedDonutCategory) {
        const cat = categories.find(c => c.id === t.categoryId);
        if (!cat || cat.name !== selectedDonutCategory) continue;
      }
      const sub = subcategories.find(s => s.id === t.subcategoryId);
      const subName = sub?.name || "Sem Subcategoria";
      const amount = Math.abs(typeof t.amount === "string" ? parseFloat(t.amount) : t.amount);
      const existing = map.get(subName) || { value: 0, count: 0 };
      existing.value += amount;
      existing.count += 1;
      map.set(subName, existing);
    }
    return Array.from(map.entries()).map(([name, d], i) => ({ name, ...d, color: COLORS[i % COLORS.length] })).sort((a, b) => b.value - a.value);
  }, [monthTransactions, headerFilteredTransactions, subcategories, categories, refMonth, chartStatusFilter, selectedDonutCategory]);

  const barData = useMemo(() => {
    if (headerFilteredTransactions.length === 0) return [] as any[];
    const map = new Map<string, { receitas: number; despesas: number; countRec: number; countDesp: number; recReal: number; recPlan: number; despReal: number; despPlan: number; cntRecReal: number; cntRecPlan: number; cntDespReal: number; cntDespPlan: number }>();
    for (const t of headerFilteredTransactions) {
      if (chartStatusFilter !== "ambos" && t.status !== chartStatusFilter) continue;
      const month = getCompetenciaMonth(t);
      const existing = map.get(month) || { receitas: 0, despesas: 0, countRec: 0, countDesp: 0, recReal: 0, recPlan: 0, despReal: 0, despPlan: 0, cntRecReal: 0, cntRecPlan: 0, cntDespReal: 0, cntDespPlan: 0 };
      const amount = Math.abs(typeof t.amount === "string" ? parseFloat(t.amount) : t.amount);
      if (t.type === "receita") {
        existing.receitas += amount; existing.countRec++;
        if (t.status === "realizada") { existing.recReal += amount; existing.cntRecReal++; }
        else { existing.recPlan += amount; existing.cntRecPlan++; }
      } else {
        existing.despesas += amount; existing.countDesp++;
        if (t.status === "realizada") { existing.despReal += amount; existing.cntDespReal++; }
        else { existing.despPlan += amount; existing.cntDespPlan++; }
      }
      map.set(month, existing);
    }
    const months = Array.from(map.keys()).sort();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return months.map(ym => {
      const [y, mo] = ym.split("-");
      const label = `${monthNames[parseInt(mo) - 1]}/${y}`;
      return { month: label, ...map.get(ym)! };
    });
  }, [headerFilteredTransactions, chartStatusFilter]);

  const categoryColors = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const cat of categories) {
      if (cat.color) colors[cat.name] = cat.color;
    }
    return colors;
  }, [categories]);

  const lineData = useMemo(() => {
    if (headerFilteredTransactions.length === 0) return [] as Record<string, any>[];
    const monthMap = new Map<string, Record<string, number>>();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    for (const t of headerFilteredTransactions) {
      if (t.type !== "despesa") continue;
      if (chartStatusFilter !== "ambos" && t.status !== chartStatusFilter) continue;
      const ym = getCompetenciaMonth(t);
      const [y, mo] = ym.split("-");
      const label = `${monthNames[parseInt(mo) - 1]}/${y}`;
      const cat = categories.find(c => c.id === t.categoryId);
      const catName = cat?.name || "Sem Categoria";
      const amount = Math.abs(typeof t.amount === "string" ? parseFloat(t.amount) : t.amount);
      if (!monthMap.has(ym)) monthMap.set(ym, { month: 0 } as any);
      const point = monthMap.get(ym)!;
      point._label = label as any;
      point[catName] = (point[catName] || 0) + amount;
    }
    const months = Array.from(monthMap.keys()).sort();
    return months.map(ym => {
      const point = monthMap.get(ym)!;
      const result: Record<string, any> = { month: point._label };
      let totalDesp = 0;
      Object.entries(point).forEach(([key, value]) => {
        if (key === '_label' || key === 'month') return;
        if (typeof value === 'number' && value > 0) {
          totalDesp += value;
          result[key] = value;
        }
      });
      if (totalDesp > 0) result['_total'] = totalDesp;
      return result;
    });
  }, [headerFilteredTransactions, categories, chartStatusFilter]);

  if (isLoading && refMonth) {
    return (
      <div>
        <PageHeader title="Visão Geral" selectedMonth={refMonth} onMonthChange={handleMonthChange} />
        <div className="px-4 py-3 grid gap-2 grid-cols-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-2">
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const data = stats || {
    totalReceitas: 0,
    totalDespesas: 0,
    saldo: 0,
    saldoAnterior: 0,
    saldoAcumulado: 0,
    saldoExtrato: null,
    contasPendentes: 0,
    contasVencidas: 0,
    receitasPrevistas: 0,
    receitasRealizadas: 0,
    despesasPrevistas: 0,
    despesasRealizadas: 0,
    transacoesPorMes: [],
    despesasPorCategoria: [],
    despesasPorCategoriaPorMes: [],
    categoryColors: {},
    currentMonthIndex: new Date().getMonth(),
  };

  const isCurrentMonth = refMonth === defaultRefMonth;

  return (
    <div>
      <PageHeader title="Visão Geral" selectedMonth={refMonth} onMonthChange={handleMonthChange}>
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Visao</label>
          <Select value={chartStatusFilter} onValueChange={(v) => setChartStatusFilter(v as any)}>
            <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="select-chart-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ambos">Ambos</SelectItem>
              <SelectItem value="realizada">Realizado</SelectItem>
              <SelectItem value="prevista">Planejado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Buscar</label>
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
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Tipo</label>
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
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Beneficiario</label>
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
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Categoria</label>
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
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-muted-foreground leading-none">Subcategoria</label>
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
        {(filterType !== "all" || filterBeneficiaryId !== "all" || filterCategoryId !== "all" || filterSubcategoryId !== "all" || searchTerm) && (
          <Button variant="ghost" size="sm" onClick={clearFilter} data-testid="button-clear-filters">
            Limpar
          </Button>
        )}
      </PageHeader>
      <div className="px-4 py-3 space-y-3">

      <div className="grid grid-cols-4 gap-3">
        <Card className={selectedDonutCategory ? "ring-1 ring-primary" : ""}>
          <CardContent className="py-2 px-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
              Receitas
              {selectedDonutCategory && <Badge variant="secondary" className="text-[8px] px-1 py-0">{selectedDonutCategory}</Badge>}
            </div>
            <div className="flex items-center gap-1" data-testid="text-total-receitas">
              <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" />
              <span className="text-lg font-bold text-success">{formatCurrency(cardTotals.receitas)}</span>
              <span className="text-xs text-muted-foreground">({cardTotals.countRec})</span>
            </div>
            {chartStatusFilter !== "ambos" && (
              <div className="text-[10px] text-muted-foreground">de {formatCurrency(allTotals.receitas)} ({allTotals.countRec})</div>
            )}
          </CardContent>
        </Card>
        <Card className={selectedDonutCategory ? "ring-1 ring-primary" : ""}>
          <CardContent className="py-2 px-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
              Despesas
              {selectedDonutCategory && <Badge variant="secondary" className="text-[8px] px-1 py-0">{selectedDonutCategory}</Badge>}
            </div>
            <div className="flex items-center gap-1" data-testid="text-total-despesas">
              <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span className="text-lg font-bold text-destructive">{formatCurrency(cardTotals.despesas)}</span>
              <span className="text-xs text-muted-foreground">({cardTotals.countDesp})</span>
            </div>
            {chartStatusFilter !== "ambos" && (
              <div className="text-[10px] text-muted-foreground">de {formatCurrency(allTotals.despesas)} ({allTotals.countDesp})</div>
            )}
          </CardContent>
        </Card>
        <Card className={selectedDonutCategory ? "ring-1 ring-primary" : ""}>
          <CardContent className="py-2 px-3">
            <div className="text-xs text-muted-foreground">Saldo</div>
            <div className={`text-lg font-bold ${cardTotals.saldo >= 0 ? "text-success" : "text-destructive"}`} data-testid="text-saldo">
              {formatCurrency(cardTotals.saldo)}
            </div>
            {chartStatusFilter !== "ambos" && (
              <div className="text-[10px] text-muted-foreground">de {formatCurrency(allTotals.saldo)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-2 px-3">
            <div className="text-xs text-muted-foreground">Transacoes</div>
            <div className="text-lg font-bold" data-testid="text-total-transacoes">{cardTotals.total}</div>
            {chartStatusFilter !== "ambos" && (
              <div className="text-[10px] text-muted-foreground">de {allTotals.total}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <>
        <Card>
          <CardContent className="p-2">
            <span className="text-xs font-medium mb-1 block">Receitas x Despesas</span>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 16, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `R$${v/1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "11px" }}
                    formatter={(value: number, name: string, props: any) => {
                      if (chartStatusFilter === "ambos") {
                        const cntMap: Record<string, string> = { "Rec.Real": "cntRecReal", "Rec.Plan": "cntRecPlan", "Desp.Real": "cntDespReal", "Desp.Plan": "cntDespPlan" };
                        const cnt = props.payload[cntMap[name] || ""] || 0;
                        return [`${formatCurrency(value)} (${cnt} reg)`, name];
                      }
                      const cnt = name === "Receitas" ? props.payload.countRec : props.payload.countDesp;
                      return [`${formatCurrency(value)} (${cnt} reg)`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  {chartStatusFilter === "ambos" ? (
                    <>
                      <Bar dataKey="recReal" name="Rec.Real" fill="#10B981" radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="recReal" position="top" fontSize={7} content={({ x, y, width, value, index }: any) => {
                          if (!value || value <= 0) return null;
                          const cnt = barData[index]?.cntRecReal || 0;
                          const lbl = value >= 1000 ? `${(value/1000).toFixed(1)}k` : value.toFixed(0);
                          return <text x={(x as number) + (width as number) / 2} y={(y as number) - 3} textAnchor="middle" fill="#10B981" fontSize={7} fontWeight={600}>{lbl} ({cnt})</text>;
                        }} />
                      </Bar>
                      <Bar dataKey="recPlan" name="Rec.Plan" fill="#6EE7B7" radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="recPlan" position="top" fontSize={7} content={({ x, y, width, value, index }: any) => {
                          if (!value || value <= 0) return null;
                          const cnt = barData[index]?.cntRecPlan || 0;
                          const lbl = value >= 1000 ? `${(value/1000).toFixed(1)}k` : value.toFixed(0);
                          return <text x={(x as number) + (width as number) / 2} y={(y as number) - 3} textAnchor="middle" fill="#6EE7B7" fontSize={7} fontWeight={600}>{lbl} ({cnt})</text>;
                        }} />
                      </Bar>
                      <Bar dataKey="despReal" name="Desp.Real" fill="#EF4444" radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="despReal" position="top" fontSize={7} content={({ x, y, width, value, index }: any) => {
                          if (!value || value <= 0) return null;
                          const cnt = barData[index]?.cntDespReal || 0;
                          const lbl = value >= 1000 ? `${(value/1000).toFixed(1)}k` : value.toFixed(0);
                          return <text x={(x as number) + (width as number) / 2} y={(y as number) - 3} textAnchor="middle" fill="#EF4444" fontSize={7} fontWeight={600}>{lbl} ({cnt})</text>;
                        }} />
                      </Bar>
                      <Bar dataKey="despPlan" name="Desp.Plan" fill="#FCA5A5" radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="despPlan" position="top" fontSize={7} content={({ x, y, width, value, index }: any) => {
                          if (!value || value <= 0) return null;
                          const cnt = barData[index]?.cntDespPlan || 0;
                          const lbl = value >= 1000 ? `${(value/1000).toFixed(1)}k` : value.toFixed(0);
                          return <text x={(x as number) + (width as number) / 2} y={(y as number) - 3} textAnchor="middle" fill="#FCA5A5" fontSize={7} fontWeight={600}>{lbl} ({cnt})</text>;
                        }} />
                      </Bar>
                    </>
                  ) : (
                    <>
                      <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="receitas" position="top" fontSize={8} fill="#10B981" content={({ x, y, width, value, index }: any) => {
                          if (!value || value <= 0) return null;
                          const cnt = barData[index]?.countRec || 0;
                          const lbl = value >= 1000 ? `${(value/1000).toFixed(1)}k` : value.toFixed(0);
                          return <text x={(x as number) + (width as number) / 2} y={(y as number) - 4} textAnchor="middle" fill="#10B981" fontSize={8} fontWeight={600}>{lbl} ({cnt})</text>;
                        }} />
                      </Bar>
                      <Bar dataKey="despesas" name="Despesas" fill="#EF4444" radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="despesas" position="top" fontSize={8} fill="#EF4444" content={({ x, y, width, value, index }: any) => {
                          if (!value || value <= 0) return null;
                          const cnt = barData[index]?.countDesp || 0;
                          const lbl = value >= 1000 ? `${(value/1000).toFixed(1)}k` : value.toFixed(0);
                          return <text x={(x as number) + (width as number) / 2} y={(y as number) - 4} textAnchor="middle" fill="#EF4444" fontSize={8} fontWeight={600}>{lbl} ({cnt})</text>;
                        }} />
                      </Bar>
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium">Despesas por Categoria</span>
                {selectedDonutCategory && (
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedDonutCategory(null); setSelectedSubcatCategory(null); }} data-testid="donut-clear">
                    <X className="w-3 h-3 mr-1" /> Limpar
                  </Button>
                )}
              </div>
              {donutData.length > 0 ? (
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width="45%" height={200}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={2}
                        onClick={(_, index) => {
                          const catName = donutData[index].name;
                          setSelectedDonutCategory(selectedDonutCategory === catName ? null : catName);
                          setSelectedSubcatCategory(null);
                          handlePieClick(donutData[index]);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {donutData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color || COLORS[index % COLORS.length]}
                            opacity={selectedDonutCategory && selectedDonutCategory !== entry.name ? 0.3 : 1}
                            stroke={selectedDonutCategory === entry.name ? "hsl(var(--foreground))" : undefined}
                            strokeWidth={selectedDonutCategory === entry.name ? 2 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string, props: any) => {
                          const cnt = props.payload?.count || 0;
                          return [`${formatCurrency(value)} (${cnt} reg)`, name];
                        }}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "11px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-0.5 max-h-[200px] overflow-auto">
                    {donutData.map((cat, index) => (
                      <div
                        key={cat.name}
                        className={`flex items-center justify-between gap-1 text-[11px] cursor-pointer hover:opacity-70 ${selectedDonutCategory === cat.name ? "font-bold" : ""}`}
                        onClick={() => {
                          setSelectedDonutCategory(selectedDonutCategory === cat.name ? null : cat.name);
                          setSelectedSubcatCategory(null);
                          handlePieClick(cat);
                        }}
                        data-testid={`donut-legend-${cat.name}`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color || COLORS[index % COLORS.length] }}
                          />
                          <span className={`truncate max-w-[80px] ${selectedDonutCategory === cat.name ? "underline" : ""}`}>{cat.name}</span>
                          <span className="text-muted-foreground text-[9px]">({cat.count})</span>
                        </div>
                        <span className="font-medium whitespace-nowrap">{formatCurrency(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium">
                  Despesas por Subcategoria
                  {selectedDonutCategory && <span className="text-muted-foreground ml-1">({selectedDonutCategory})</span>}
                </span>
                {selectedSubcatCategory && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSubcatCategory(null)} data-testid="subcat-donut-clear">
                    <X className="w-3 h-3 mr-1" /> Limpar
                  </Button>
                )}
              </div>
              {subcatDonutData.length > 0 ? (
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width="45%" height={200}>
                    <PieChart>
                      <Pie
                        data={subcatDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={2}
                        onClick={(_, index) => {
                          const subName = subcatDonutData[index].name;
                          setSelectedSubcatCategory(selectedSubcatCategory === subName ? null : subName);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {subcatDonutData.map((entry, index) => (
                          <Cell
                            key={`subcell-${index}`}
                            fill={entry.color}
                            opacity={selectedSubcatCategory && selectedSubcatCategory !== entry.name ? 0.3 : 1}
                            stroke={selectedSubcatCategory === entry.name ? "hsl(var(--foreground))" : undefined}
                            strokeWidth={selectedSubcatCategory === entry.name ? 2 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string, props: any) => {
                          const cnt = props.payload?.count || 0;
                          return [`${formatCurrency(value)} (${cnt} reg)`, name];
                        }}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "11px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-0.5 max-h-[200px] overflow-auto">
                    {subcatDonutData.map((sub, index) => (
                      <div
                        key={sub.name}
                        className={`flex items-center justify-between gap-1 text-[11px] cursor-pointer hover:opacity-70 ${selectedSubcatCategory === sub.name ? "font-bold" : ""}`}
                        onClick={() => setSelectedSubcatCategory(selectedSubcatCategory === sub.name ? null : sub.name)}
                        data-testid={`subcat-donut-legend-${sub.name}`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: sub.color }}
                          />
                          <span className={`truncate max-w-[80px] ${selectedSubcatCategory === sub.name ? "underline" : ""}`}>{sub.name}</span>
                          <span className="text-muted-foreground text-[9px]">({sub.count})</span>
                        </div>
                        <span className="font-medium whitespace-nowrap">{formatCurrency(sub.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </CardContent>
          </Card>
        </div>
      </>
      </div>

      <div className="px-4">
        <Card className="sticky top-[40px] z-40 rounded-none border-x-0">
          <CardContent className="p-2">
            <span className="text-[10px] font-medium mb-0.5 block">Evolucao Mensal por Categoria</span>
            {Object.keys(categoryColors).length > 0 ? (
              <>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1 items-center">
                {(() => {
                  const allNames = [...Object.keys(categoryColors), "Total"];
                  const allHidden = allNames.every(n => hiddenChartCategories.has(n));
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (allHidden) setHiddenChartCategories(new Set());
                        else setHiddenChartCategories(new Set(allNames));
                      }}
                      className="text-[9px] text-muted-foreground hover:text-foreground underline mr-1"
                      data-testid="button-toggle-all-chart-categories"
                    >
                      {allHidden ? "Marcar todos" : "Desmarcar todos"}
                    </button>
                  );
                })()}
                {[...Object.entries(categoryColors), ["Total", "hsl(var(--foreground))"]].map(([name, color]) => {
                  const isVisible = !hiddenChartCategories.has(name as string);
                  return (
                    <label key={name} className="flex items-center gap-1 cursor-pointer select-none" data-testid={`chart-legend-${name}`}>
                      <Checkbox
                        checked={isVisible}
                        onCheckedChange={() => {
                          const next = new Set(hiddenChartCategories);
                          if (isVisible) next.add(name as string); else next.delete(name as string);
                          setHiddenChartCategories(next);
                        }}
                        className="h-3 w-3"
                        style={{ borderColor: color as string, backgroundColor: isVisible ? (color as string) : "transparent" }}
                      />
                      <span className="text-[10px]" style={{ color: isVisible ? (color as string) : "hsl(var(--muted-foreground))" }}>{name}</span>
                    </label>
                  );
                })}
              </div>
              {(() => {
                const formatK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);
                return lineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={lineData}
                      onClick={(e) => { if (e && e.activeLabel) handleLineClick(e.activeLabel); }}
                      style={{ cursor: "pointer" }}
                      margin={{ top: 16, right: 10, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" fontSize={9} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} fontSize={9} stroke="hsl(var(--muted-foreground))" width={35} />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '10px' }}
                      />
                      {Object.entries(categoryColors)
                        .filter(([categoryName]) => !hiddenChartCategories.has(categoryName))
                        .map(([categoryName, color]) => (
                        <Line
                          key={categoryName}
                          type="monotone"
                          dataKey={categoryName}
                          name={categoryName}
                          stroke={color}
                          strokeWidth={1.5}
                          dot={{ fill: color, strokeWidth: 1, r: 2 }}
                          activeDot={{ r: 4, cursor: "pointer" }}
                          connectNulls
                        >
                          <LabelList content={(props: any) => {
                            const { x, y, value } = props;
                            if (value === undefined || value === null || value === 0) return null;
                            return <text x={x} y={y - 6} textAnchor="middle" fill={color} fontSize={8}>{formatK(Number(value))}</text>;
                          }} />
                        </Line>
                      ))}
                      {!hiddenChartCategories.has("Total") && (
                        <Line
                          key="_total"
                          type="monotone"
                          dataKey="_total"
                          name="Total Despesas"
                          stroke="hsl(var(--foreground))"
                          strokeWidth={2.5}
                          dot={{ fill: 'hsl(var(--foreground))', strokeWidth: 0, r: 3 }}
                          activeDot={{ r: 5, cursor: "pointer" }}
                          connectNulls
                        >
                          <LabelList content={(props: any) => {
                            const { x, y, value } = props;
                            if (value === undefined || value === null) return null;
                            return <text x={x} y={y - 8} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={9} fontWeight={600}>{formatK(Number(value))}</text>;
                          }} />
                        </Line>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
                );
              })()}
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 overflow-auto px-4 py-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-medium">
            Transacoes {selectedFilter.type 
              ? (selectedFilter.type === "category" ? `- ${selectedFilter.category}` : `- ${selectedFilter.month}`)
              : refMonth ? `- ${getRefMonthLabel(refMonth)}` : "- Todos"}
          </span>
          {selectedFilter.type && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={clearFilter}
              data-testid="button-clear-filter"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        {displayTransactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] py-0.5 px-1"><SortHeader column="date">Dt.Trans.</SortHeader></TableHead>
                <TableHead className="text-[10px] py-0.5 px-1"><SortHeader column="paymentDate">Venc.Fat.</SortHeader></TableHead>
                <TableHead className="text-[10px] py-0.5 px-1"><SortHeader column="description">Descricao</SortHeader></TableHead>
                <TableHead className="text-[10px] py-0.5 px-1"><SortHeader column="type">Tipo</SortHeader></TableHead>
                <TableHead className="text-[10px] py-0.5 px-1"><SortHeader column="status">Visao</SortHeader></TableHead>
                <TableHead className="text-[10px] py-0.5 px-1"><SortHeader column="source">Orig.</SortHeader></TableHead>
                <TableHead className="text-[10px] py-0.5 px-1"><SortHeader column="category">Cat.</SortHeader></TableHead>
                <TableHead className="text-[10px] py-0.5 px-1"><SortHeader column="subcategory">Subcateg.</SortHeader></TableHead>
                <TableHead className="text-[10px] py-0.5 px-1 text-right"><SortHeader column="amount" className="ml-auto">Valor</SortHeader></TableHead>
                <TableHead className="text-[10px] py-0.5 px-1 text-center">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.map((transaction) => {
                const cat = categories.find(c => c.id === transaction.categoryId);
                return (
                  <TableRow key={transaction.id} className="text-[10px]">
                    <TableCell className="py-0.5 px-1 whitespace-nowrap">{transaction.transactionDate ? formatDate(transaction.transactionDate) : formatDate(transaction.date)}</TableCell>
                    <TableCell className="py-0.5 px-1 whitespace-nowrap">{transaction.paymentDate ? formatDate(transaction.paymentDate) : "-"}</TableCell>
                    <TableCell className="py-0.5 px-1 max-w-[200px] truncate" title={transaction.originalDescription || transaction.description}>
                      {transaction.shortTitle || transaction.description}
                    </TableCell>
                    <TableCell className="py-0.5 px-1">
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-tight font-bold ${transaction.type === "receita" ? "border-green-600 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950" : "border-red-600 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950"}`}>
                        {transaction.type === "receita" ? "R" : "D"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-0.5 px-1">
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-tight font-bold ${transaction.status === "realizada" ? "border-emerald-700 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950" : "border-blue-700 text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950"}`}>
                        {transaction.status === "realizada" ? "Real" : "Plan"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-0.5 px-1">
                      {transaction.source === "cartao" && <CreditCard className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
                      {transaction.source === "conta_corrente" && <Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                      {transaction.source === "manual" && <PenLine className="w-3 h-3 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="py-0.5 px-1">
                      {cat ? <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} size="sm" /> : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="py-0.5 px-1 text-xs text-muted-foreground truncate">
                      {getSubcategoryName(transaction.subcategoryId)}
                    </TableCell>
                    <TableCell className={`py-0.5 px-1 text-right font-medium ${transaction.type === "receita" ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(Number(transaction.amount))}
                    </TableCell>
                    <TableCell className="py-0.5 px-1 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(transaction)}
                          data-testid={`button-edit-transaction-${transaction.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Deseja realmente excluir esta transacao?")) {
                              deleteMutation.mutate(transaction.id);
                            }
                          }}
                          data-testid={`button-delete-transaction-${transaction.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50 font-semibold text-[10px] border-t-2" data-testid="row-table-totals">
                <TableCell className="py-1 px-1" colSpan={3}>
                  Pag. {currentPage}/{totalPages} ({tableTotals.total} registros, {tableTotals.countRec} receitas, {tableTotals.countDesp} despesas)
                </TableCell>
                <TableCell className="py-1 px-1" colSpan={5}></TableCell>
                <TableCell className="py-1 px-1 text-right">
                  <div className="text-success">{formatCurrency(tableTotals.receitas)}</div>
                  <div className="text-destructive">{formatCurrency(tableTotals.despesas)}</div>
                  <div className={tableTotals.saldo >= 0 ? "text-success" : "text-destructive"}>{formatCurrency(tableTotals.saldo)}</div>
                </TableCell>
                <TableCell className="py-1 px-1"></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <div className="py-4 text-center text-muted-foreground text-xs">
            Nenhuma transacao encontrada
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, sortedDisplayTransactions.length)} de {sortedDisplayTransactions.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                Anterior
              </Button>
              <span className="text-xs">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Proximo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de Edição */}
      <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Transacao</DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Descricao Curta</label>
                <Input
                  value={editForm.shortTitle || ""}
                  onChange={(e) => setEditForm({ ...editForm, shortTitle: e.target.value })}
                  data-testid="input-edit-short-title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Valor</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount || ""}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  data-testid="input-edit-amount"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select
                  value={editForm.categoryId?.toString() || ""}
                  onValueChange={(value) => setEditForm({ ...editForm, categoryId: value ? parseInt(value) : null, subcategoryId: null })}
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editForm.categoryId && (
                <div>
                  <label className="text-sm font-medium">Subcategoria</label>
                  <Select
                    value={editForm.subcategoryId?.toString() || ""}
                    onValueChange={(value) => setEditForm({ ...editForm, subcategoryId: value ? parseInt(value) : null })}
                  >
                    <SelectTrigger data-testid="select-edit-subcategory">
                      <SelectValue placeholder="Selecione uma subcategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories
                        .filter((s) => s.categoryId === editForm.categoryId)
                        .map((sub) => (
                          <SelectItem key={sub.id} value={sub.id.toString()}>
                            {sub.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <Select
                    value={editForm.type || ""}
                    onValueChange={(value) => setEditForm({ ...editForm, type: value as "receita" | "despesa" })}
                  >
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
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={editForm.status || ""}
                    onValueChange={(value) => setEditForm({ ...editForm, status: value as "prevista" | "realizada" })}
                  >
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prevista">Prevista</SelectItem>
                      <SelectItem value="realizada">Realizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingTransaction(null)} data-testid="button-cancel-edit">
                  Cancelar
                </Button>
                <Button 
                  onClick={saveEdit} 
                  disabled={updateMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
