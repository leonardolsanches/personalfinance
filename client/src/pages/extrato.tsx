import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { filterCardBillPayments } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Building2, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Search, ArrowUpDown, CreditCard, PenLine, Pencil, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryIcon } from "@/components/category-icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LabelList } from "recharts";
import type { Transaction, Category, Subcategory } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { useColumnWidths } from "@/hooks/use-column-widths";
import { ResizeHandle } from "@/components/resize-handle";
import { useToast } from "@/hooks/use-toast";
import { getCurrentYearMonth } from "@/components/month-navigator";

function formatCurrency(value: number | string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

function formatDate(date: string) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

function getMonthKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${monthNames[parseInt(m) - 1]}/${year}`;
}

type SortColumn = "date" | "description" | "category" | "subcategory" | "status" | "type" | "amount";

export default function Extrato() {
  const { toast } = useToast();
  const currentYM = getCurrentYearMonth();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentYM);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "realizada" | "prevista">("realizada");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [hiddenBarSeries, setHiddenBarSeries] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const itemsPerPage = 10;

  const defaultColWidths = { checkbox: 36, dtTrans: 72, vencFat: 72, descricao: 0, tipo: 44, status: 55, orig: 44, categoria: 90, subcategoria: 90, valor: 90, acoes: 60 };
  const { colWidths, handleResizeStart } = useColumnWidths("extrato", defaultColWidths);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transacao excluida" });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return apiRequest("POST", "/api/transactions/delete-batch", { ids });
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: `${ids.length} transacoes excluidas` });
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    },
    onError: () => {
      toast({ title: "Erro ao excluir transacoes", variant: "destructive" });
    },
  });

  const visibleTransactions = filterCardBillPayments(transactions);
  const ccTransactions = visibleTransactions.filter((t) => t.source === "conta_corrente");

  const allMonths = Array.from(new Set(ccTransactions.map((t) => getMonthKey(t.date)))).sort();

  const handleMonthChange = (month: string | null) => {
    setSelectedMonth(month);
    setCurrentPage(1);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const SortHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <span className="flex items-center gap-0.5 cursor-pointer select-none" onClick={() => handleSort(column)}>
      {children}
      {sortColumn === column ? (
        sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : null}
    </span>
  );

  const getCategory = (categoryId: number | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId) || null;
  };

  const getSubcategoryName = (subcategoryId: number | null) => {
    if (!subcategoryId) return "-";
    return subcategories.find((s) => s.id === subcategoryId)?.name || "-";
  };

  const getSourceBadge = (source: string | null) => {
    if (source === "cartao") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs border-purple-400 dark:border-purple-600">
              <CreditCard className="w-3 h-3 text-purple-600 dark:text-purple-400" />
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
            <Badge variant="outline" className="text-xs border-blue-400 dark:border-blue-600">
              <Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
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
            <PenLine className="w-3 h-3 text-muted-foreground" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Manual</TooltipContent>
      </Tooltip>
    );
  };

  const filteredTransactions = ccTransactions
    .filter((t) => {
      if (selectedMonth && getMonthKey(t.date) !== selectedMonth) return false;
      return true;
    })
    .filter((t) => filterType === "all" || t.type === filterType)
    .filter((t) => filterStatus === "all" || t.status === filterStatus)
    .filter((t) => {
      if (filterCategoryId === "all") return true;
      if (filterCategoryId === "empty") return !t.categoryId;
      return String(t.categoryId) === filterCategoryId;
    })
    .filter((t) => {
      if (filterSubcategoryId === "all") return true;
      if (filterSubcategoryId === "empty") return !t.subcategoryId;
      return String(t.subcategoryId) === filterSubcategoryId;
    })
    .filter((t) => {
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
          aVal = new Date(a.transactionDate || a.date).getTime();
          bVal = new Date(b.transactionDate || b.date).getTime();
          break;
        case "description":
          aVal = (a.shortTitle || a.description).toLowerCase();
          bVal = (b.shortTitle || b.description).toLowerCase();
          break;
        case "category":
          aVal = (getCategory(a.categoryId)?.name || "").toLowerCase();
          bVal = (getCategory(b.categoryId)?.name || "").toLowerCase();
          break;
        case "subcategory":
          aVal = getSubcategoryName(a.subcategoryId).toLowerCase();
          bVal = getSubcategoryName(b.subcategoryId).toLowerCase();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "type":
          aVal = a.type;
          bVal = b.type;
          break;
        case "amount":
          aVal = parseFloat(String(a.amount));
          bVal = parseFloat(String(b.amount));
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedTransactions.map((t) => t.id)));
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

  const filteredTotals = filteredTransactions.reduce(
    (acc, t) => {
      const amount = Math.abs(parseFloat(String(t.amount)));
      if (t.type === "receita") acc.receitas += amount;
      else acc.despesas += amount;
      return acc;
    },
    { receitas: 0, despesas: 0 }
  );
  const filteredSaldo = filteredTotals.receitas - filteredTotals.despesas;

  const realizadoTransactions = ccTransactions.filter((t) => t.status === "realizada");

  const monthlyData = allMonths.map((month) => {
    const monthTxs = realizadoTransactions.filter((t) => getMonthKey(t.date) === month);
    const receitas = monthTxs
      .filter((t) => t.type === "receita")
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
    const despesas = monthTxs
      .filter((t) => t.type === "despesa")
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
    return { month: getMonthName(month), key: month, receitas, despesas, count: monthTxs.length };
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Visao Conta Corrente" subtitle="Visualize movimentacoes do extrato bancario" />
        <div className="px-4 py-3 space-y-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Visao Conta Corrente" subtitle="Extrato bancario" selectedMonth={selectedMonth} onMonthChange={handleMonthChange} />
      <div className="px-4 py-3 space-y-3">
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-medium">Receitas</span>
              </div>
              <span className="text-lg font-bold text-success" data-testid="text-receitas">{formatCurrency(filteredTotals.receitas)}</span>
              <span className="text-xs text-muted-foreground ml-1">({filteredTransactions.filter(t => t.type === 'receita').length})</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium">Despesas</span>
              </div>
              <span className="text-lg font-bold text-destructive" data-testid="text-despesas">{formatCurrency(filteredTotals.despesas)}</span>
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
              <span className="text-xs text-muted-foreground ml-1">de {ccTransactions.length}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-3">
            <div className="text-sm font-semibold mb-2">Movimentacao Mensal</div>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { receitas: "Receitas", despesas: "Despesas" };
                      return [formatCurrency(value), labels[name] || name];
                    }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Legend
                    formatter={(value: string, entry: any) => {
                      const labels: Record<string, string> = { receitas: "Receitas", despesas: "Despesas" };
                      const label = labels[value] || value;
                      const isHidden = hiddenBarSeries.has(entry.dataKey);
                      return <span style={{ color: isHidden ? "hsl(var(--muted-foreground))" : entry.color, textDecoration: isHidden ? "line-through" : "none", cursor: "pointer" }}>{label}</span>;
                    }}
                    onClick={(e: any) => {
                      if (e?.dataKey) {
                        setHiddenBarSeries(prev => {
                          const next = new Set(prev);
                          if (next.has(e.dataKey)) next.delete(e.dataKey); else next.add(e.dataKey);
                          return next;
                        });
                      }
                    }}
                  />
                  <Bar dataKey="receitas" fill="#10B981" radius={[4, 4, 0, 0]} hide={hiddenBarSeries.has("receitas")}>
                    <LabelList dataKey="receitas" position="top" formatter={(v: number) => v > 0 ? `${(v / 1000).toFixed(1)}k` : ''} className="text-[10px] fill-muted-foreground" />
                  </Bar>
                  <Bar dataKey="despesas" fill="#EF4444" radius={[4, 4, 0, 0]} hide={hiddenBarSeries.has("despesas")}>
                    <LabelList dataKey="despesas" position="top" formatter={(v: number) => v > 0 ? `${(v / 1000).toFixed(1)}k` : ''} className="text-[10px] fill-muted-foreground" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                <p>Nenhum dado disponivel</p>
              </div>
            )}
          </CardHeader>
        </Card>

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
                <Label className="text-xs text-muted-foreground">Visao</Label>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as any); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-status">
                    <SelectValue placeholder="Visao" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Ambos</SelectItem>
                    <SelectItem value="realizada">Realizado</SelectItem>
                    <SelectItem value="prevista">Planejado</SelectItem>
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
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
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
              {(filterType !== "all" || filterStatus !== "realizada" || filterCategoryId !== "all" || filterSubcategoryId !== "all") && (
                <Button variant="ghost" size="sm" className="self-end" onClick={() => { setFilterType("all"); setFilterStatus("realizada"); setFilterCategoryId("all"); setFilterSubcategoryId("all"); setCurrentPage(1); }}>
                  Limpar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transacao encontrada</p>
              </div>
            ) : (
              <>
                {selectedIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-md">
                    <Badge variant="secondary">
                      {selectedIds.size} selecionadas
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={batchDeleteMutation.isPending}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Excluir Selecionadas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIds(new Set())}
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
                        <TableHead className="py-1.5 px-1">
                          <Checkbox
                            checked={paginatedTransactions.length > 0 && paginatedTransactions.every((t) => selectedIds.has(t.id))}
                            onCheckedChange={toggleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead className="py-1.5 relative">
                          <SortHeader column="date">Dt.Trans.</SortHeader>
                          <ResizeHandle col="dtTrans" onResizeStart={handleResizeStart} />
                        </TableHead>
                        <TableHead className="py-1.5 relative">
                          Venc.Fat.
                          <ResizeHandle col="vencFat" onResizeStart={handleResizeStart} />
                        </TableHead>
                        <TableHead className="py-1.5 relative">
                          <SortHeader column="description">Descricao</SortHeader>
                          <ResizeHandle col="descricao" onResizeStart={handleResizeStart} />
                        </TableHead>
                        <TableHead className="py-1.5 relative">
                          <SortHeader column="type">Tipo</SortHeader>
                          <ResizeHandle col="tipo" onResizeStart={handleResizeStart} />
                        </TableHead>
                        <TableHead className="py-1.5 relative">
                          <SortHeader column="status">Visao</SortHeader>
                          <ResizeHandle col="status" onResizeStart={handleResizeStart} />
                        </TableHead>
                        <TableHead className="py-1.5 relative">
                          Orig.
                          <ResizeHandle col="orig" onResizeStart={handleResizeStart} />
                        </TableHead>
                        <TableHead className="py-1.5 relative">
                          <SortHeader column="category">Cat.</SortHeader>
                          <ResizeHandle col="categoria" onResizeStart={handleResizeStart} />
                        </TableHead>
                        <TableHead className="py-1.5 relative">
                          <SortHeader column="subcategory">Subcateg.</SortHeader>
                          <ResizeHandle col="subcategoria" onResizeStart={handleResizeStart} />
                        </TableHead>
                        <TableHead className="py-1.5 text-right relative">
                          <SortHeader column="amount">Valor</SortHeader>
                          <ResizeHandle col="valor" onResizeStart={handleResizeStart} />
                        </TableHead>
                        <TableHead className="py-1.5 relative">
                          Acoes
                          <ResizeHandle col="acoes" onResizeStart={handleResizeStart} />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.map((t) => (
                        <TableRow key={t.id} className="h-10" data-testid={`row-extrato-${t.id}`}>
                          <TableCell className="py-1.5 px-1">
                            <Checkbox
                              checked={selectedIds.has(t.id)}
                              onCheckedChange={(checked) => toggleSelectOne(t.id, !!checked)}
                              data-testid={`checkbox-select-${t.id}`}
                            />
                          </TableCell>
                          <TableCell className="py-1.5 text-xs whitespace-nowrap">{t.transactionDate ? formatDate(t.transactionDate) : formatDate(t.date)}</TableCell>
                          <TableCell className="py-1.5 text-xs whitespace-nowrap">{t.paymentDate ? formatDate(t.paymentDate) : "-"}</TableCell>
                          <TableCell className="py-1.5 overflow-hidden">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-medium text-sm truncate block cursor-default">
                                  {t.shortTitle || t.description}
                                </span>
                              </TooltipTrigger>
                              {t.originalDescription && t.originalDescription !== (t.shortTitle || t.description) && (
                                <TooltipContent>
                                  <p className="max-w-[300px] text-xs">{t.originalDescription}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Badge variant="outline" className={`text-xs font-bold ${t.type === "receita" ? "border-green-600 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950" : "border-red-600 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950"}`}>
                              {t.type === "receita" ? "R" : "D"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Badge variant="outline" className={`text-xs font-bold ${t.status === "realizada" ? "border-emerald-700 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950" : "border-blue-700 text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950"}`}>
                              {t.status === "realizada" ? "Real" : "Plan"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1.5">
                            {getSourceBadge(t.source)}
                          </TableCell>
                          <TableCell className="py-1.5 overflow-hidden">
                            {(() => {
                              const cat = getCategory(t.categoryId);
                              return cat ? (
                                <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} />
                              ) : <span className="text-xs text-muted-foreground">-</span>;
                            })()}
                          </TableCell>
                          <TableCell className="py-1.5 text-xs text-muted-foreground truncate overflow-hidden">
                            {getSubcategoryName(t.subcategoryId)}
                          </TableCell>
                          <TableCell className={`py-1.5 text-right font-medium text-sm whitespace-nowrap ${t.type === "receita" ? "text-success" : "text-destructive"}`}>
                            {t.type === "receita" ? "+" : "-"}{formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(t.id)}
                                data-testid={`button-delete-${t.id}`}
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
                          {filteredTransactions.length} lancamento(s)
                        </TableCell>
                        <TableCell colSpan={6} className="py-1.5"></TableCell>
                        <TableCell className="py-1.5 text-right text-xs whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-success">+{formatCurrency(filteredTotals.receitas)}</span>
                            <span className="text-destructive">-{formatCurrency(filteredTotals.despesas)}</span>
                            <span className={filteredSaldo >= 0 ? "text-success" : "text-destructive"}>={formatCurrency(filteredSaldo)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>

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
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar Exclusao em Massa
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> transacoes selecionadas? Esta acao nao pode ser desfeita.
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
