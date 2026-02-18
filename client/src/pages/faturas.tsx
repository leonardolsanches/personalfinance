import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, AlertTriangle, CheckCircle, Clock, RotateCcw, ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight, Building2, PenLine, Repeat, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import type { Transaction, Category, Subcategory } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { useColumnWidths } from "@/hooks/use-column-widths";
import { ResizeHandle } from "@/components/resize-handle";
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

function getMonthName(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${monthNames[parseInt(m) - 1]}/${year}`;
}

type SortColumn = "date" | "description" | "category" | "subcategory" | "status" | "type" | "amount";

export default function Faturas() {
  const { toast } = useToast();
  const currentYM = getCurrentYearMonth();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentYM);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "realizada" | "prevista">("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [hiddenLineSeries, setHiddenLineSeries] = useState<Set<string>>(new Set());
  const itemsPerPage = 10;

  const defaultColWidths = { dtTrans: 72, vencFat: 72, descricao: 0, tipo: 44, status: 55, orig: 44, categoria: 90, subcategoria: 90, valor: 90, acoes: 60 };
  const { colWidths, handleResizeStart } = useColumnWidths("faturas", defaultColWidths);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const toggleFraudMutation = useMutation({
    mutationFn: async ({ id, isFraudSuspect, installmentGroupId }: { id: number; isFraudSuspect: boolean; installmentGroupId?: string | null }) => {
      if (installmentGroupId) {
        return apiRequest("POST", `/api/transactions/fraud-group`, { installmentGroupId, isFraudSuspect });
      }
      return apiRequest("PATCH", `/api/transactions/${id}`, { isFraudSuspect });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transacao atualizada" });
    },
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

  const cardTransactions = transactions.filter((t) => t.source === "cartao");
  
  const billMonths = Array.from(new Set(cardTransactions.map((t) => t.cardBillMonth).filter(Boolean)))
    .sort((a, b) => (a || "").localeCompare(b || ""));

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

  const filteredTransactions = cardTransactions
    .filter((t) => {
      if (!selectedMonth) return true;
      return t.cardBillMonth === selectedMonth;
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
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
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
          const aAmount = typeof a.amount === 'string' ? parseFloat(a.amount) : a.amount;
          const bAmount = typeof b.amount === 'string' ? parseFloat(b.amount) : b.amount;
          aVal = a.type === "receita" ? aAmount : -aAmount;
          bVal = b.type === "receita" ? bAmount : -bAmount;
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

  const billsByMonth = billMonths.reduce((acc, month) => {
    if (!month) return acc;
    const monthTxs = cardTransactions.filter((t) => t.cardBillMonth === month);
    const totalDespesas = monthTxs
      .filter((t) => t.type === "despesa")
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
    const totalEstornos = monthTxs
      .filter((t) => t.type === "receita" || t.isRefund)
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
    const isPast = monthTxs.every((t) => t.status === "realizada");
    acc[month] = { total: totalDespesas - totalEstornos, estornos: totalEstornos, count: monthTxs.length, isPast };
    return acc;
  }, {} as Record<string, { total: number; estornos: number; count: number; isPast: boolean }>);

  const realizedDespesas = cardTransactions
    .filter((t) => t.status === "realizada" && t.type === "despesa")
    .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
  const realizedEstornos = cardTransactions
    .filter((t) => t.status === "realizada" && (t.type === "receita" || t.isRefund))
    .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
  const totalRealized = realizedDespesas - realizedEstornos;

  const plannedDespesas = cardTransactions
    .filter((t) => t.status === "prevista" && t.type === "despesa")
    .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
  const plannedEstornos = cardTransactions
    .filter((t) => t.status === "prevista" && (t.type === "receita" || t.isRefund))
    .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
  const totalPlanned = plannedDespesas - plannedEstornos;

  const fraudSuspectCount = cardTransactions.filter((t) => t.isFraudSuspect).length;

  const futureInstallments = cardTransactions
    .filter((t) => t.installmentGroupId && t.installmentTotal && t.installmentTotal > 1 && t.status === "prevista")
    .reduce((acc, t) => {
      const groupId = t.installmentGroupId!;
      if (!acc[groupId]) {
        const allInGroup = cardTransactions.filter((x) => x.installmentGroupId === groupId);
        const totalParcelas = t.installmentTotal!;
        const valorParcela = parseFloat(String(t.amount));
        const parcelasPagas = allInGroup.filter((x) => x.status === "realizada").length;
        const parcelasPendentes = allInGroup.filter((x) => x.status === "prevista").length;
        const proximaFatura = allInGroup
          .filter((x) => x.status === "prevista")
          .sort((a, b) => (a.cardBillMonth || "").localeCompare(b.cardBillMonth || ""))[0]?.cardBillMonth;
        
        acc[groupId] = {
          description: t.shortTitle || t.description,
          totalParcelas,
          parcelasPagas,
          parcelasPendentes,
          valorParcela,
          valorRestante: valorParcela * parcelasPendentes,
          proximaFatura,
          categoryId: t.categoryId,
          isFraudSuspect: t.isFraudSuspect,
        };
      }
      return acc;
    }, {} as Record<string, { description: string; totalParcelas: number; parcelasPagas: number; parcelasPendentes: number; valorParcela: number; valorRestante: number; proximaFatura?: string | null; categoryId: number | null; isFraudSuspect?: boolean | null }>);

  const futureInstallmentsList = Object.entries(futureInstallments)
    .sort((a, b) => (a[1].proximaFatura || "").localeCompare(b[1].proximaFatura || ""));

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Visao Cartao" subtitle="Visualize e gerencie suas faturas" />
        <div className="px-4 py-3 space-y-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Visao Cartao" subtitle="Faturas de cartao de credito" selectedMonth={selectedMonth} onMonthChange={handleMonthChange} />
      <div className="px-4 py-3 space-y-3">
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <CheckCircle className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-medium">Realizado</span>
              </div>
              <span className="text-lg font-bold text-success" data-testid="text-realizado">{formatCurrency(totalRealized)}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium">Previsto</span>
              </div>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400" data-testid="text-previsto">{formatCurrency(totalPlanned)}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Total Faturas</span>
              </div>
              <span className="text-lg font-bold" data-testid="text-total-faturas">{billMonths.length}</span>
              <span className="text-xs text-muted-foreground ml-1">({cardTransactions.length} itens)</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <AlertTriangle className={`h-3.5 w-3.5 ${fraudSuspectCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium">Fraudes</span>
              </div>
              <span className={`text-lg font-bold ${fraudSuspectCount > 0 ? "text-destructive" : ""}`} data-testid="text-fraudes">{fraudSuspectCount}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-3">
            <div className="text-sm font-semibold mb-2">Evolucao das Faturas</div>
            {billMonths.length > 0 ? (
              (() => {
                const chartData = billMonths.map(month => {
                  if (!month) return null;
                  const billData = billsByMonth[month];
                  if (!billData) return null;
                  return {
                    month: getMonthName(month),
                    valorRealizado: billData.isPast ? billData.total : undefined,
                    valorPrevisto: !billData.isPast ? billData.total : undefined,
                    estornos: billData.estornos > 0 ? billData.estornos : undefined,
                  };
                }).filter(Boolean);
                const lastRealizedIdx = chartData.findIndex(d => d?.valorPrevisto !== undefined) - 1;
                if (lastRealizedIdx >= 0 && chartData[lastRealizedIdx] && chartData[lastRealizedIdx + 1]) {
                  chartData[lastRealizedIdx + 1]!.valorPrevisto = chartData[lastRealizedIdx]!.valorRealizado;
                }
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} className="text-xs" />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = { valorRealizado: 'Fatura Realizada', valorPrevisto: 'Fatura Prevista', estornos: 'Estornos' };
                          return [formatCurrency(value), labels[name] || name];
                        }}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                      />
                      <Legend
                        formatter={(value: string, entry: any) => {
                          const labels: Record<string, string> = { valorRealizado: 'Realizado', valorPrevisto: 'Previsto', estornos: 'Estornos' };
                          const label = labels[value] || value;
                          const isHidden = hiddenLineSeries.has(entry.dataKey);
                          return <span style={{ color: isHidden ? "hsl(var(--muted-foreground))" : entry.color, textDecoration: isHidden ? "line-through" : "none", cursor: "pointer" }}>{label}</span>;
                        }}
                        onClick={(e: any) => {
                          if (e?.dataKey) {
                            setHiddenLineSeries(prev => {
                              const next = new Set(prev);
                              if (next.has(e.dataKey)) next.delete(e.dataKey); else next.add(e.dataKey);
                              return next;
                            });
                          }
                        }}
                      />
                      <Line type="monotone" dataKey="valorRealizado" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} connectNulls hide={hiddenLineSeries.has("valorRealizado")} />
                      <Line type="monotone" dataKey="valorPrevisto" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4, strokeDasharray: '' }} activeDot={{ r: 6 }} connectNulls hide={hiddenLineSeries.has("valorPrevisto")} />
                      <Line type="monotone" dataKey="estornos" stroke="#F59E0B" strokeWidth={1} strokeDasharray="3 3" dot={{ fill: '#F59E0B', strokeWidth: 1, r: 3 }} connectNulls legendType="line" hide={hiddenLineSeries.has("estornos")} />
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()
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
              {(filterType !== "all" || filterStatus !== "all" || filterCategoryId !== "all" || filterSubcategoryId !== "all") && (
                <Button variant="ghost" size="sm" className="self-end" onClick={() => { setFilterType("all"); setFilterStatus("all"); setFilterCategoryId("all"); setFilterSubcategoryId("all"); setCurrentPage(1); }}>
                  Limpar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transacao encontrada</p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden">
                  <Table className="text-sm table-fixed w-full">
                    <colgroup>
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
                        <TableRow
                          key={t.id}
                          className={`h-10 ${t.isFraudSuspect ? "bg-red-50 dark:bg-red-950" : ""}`}
                          data-testid={`row-fatura-${t.id}`}
                        >
                          <TableCell className="py-1.5 text-xs whitespace-nowrap">{t.transactionDate ? formatDate(t.transactionDate) : formatDate(t.date)}</TableCell>
                          <TableCell className="py-1.5 text-xs whitespace-nowrap">{t.paymentDate ? formatDate(t.paymentDate) : "-"}</TableCell>
                          <TableCell className="py-1.5 overflow-hidden">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 min-w-0 cursor-default">
                                  <span className="font-medium text-sm truncate">
                                    {t.shortTitle || t.description}
                                  </span>
                                  {t.installmentCurrent && t.installmentTotal && (
                                    <Badge variant="secondary" className="text-xs shrink-0">
                                      {t.installmentCurrent}/{t.installmentTotal}
                                    </Badge>
                                  )}
                                  {t.isRefund && (
                                    <Badge variant="outline" className="text-xs bg-success/10 text-success shrink-0">
                                      <RotateCcw className="w-2.5 h-2.5" />
                                    </Badge>
                                  )}
                                  {t.isRecurring && (
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      <Repeat className="w-2.5 h-2.5" />
                                    </Badge>
                                  )}
                                </div>
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Checkbox
                                      checked={t.isFraudSuspect || false}
                                      onCheckedChange={(checked) =>
                                        toggleFraudMutation.mutate({
                                          id: t.id,
                                          isFraudSuspect: !!checked,
                                          installmentGroupId: t.installmentGroupId
                                        })
                                      }
                                      data-testid={`checkbox-fraud-${t.id}`}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>Marcar como fraude</TooltipContent>
                              </Tooltip>
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
                          {filteredTransactions.length} transacao(oes)
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

        {futureInstallmentsList.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                Parcelamentos em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden">
                <Table className="text-sm table-fixed w-full">
                  <colgroup>
                    <col />
                    <col style={{ width: "90px" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "90px" }} />
                    <col style={{ width: "90px" }} />
                    <col style={{ width: "80px" }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="h-9">
                      <TableHead>Descricao</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-center">Progresso</TableHead>
                      <TableHead className="text-right">Parcela</TableHead>
                      <TableHead className="text-right">Restante</TableHead>
                      <TableHead>Proxima</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {futureInstallmentsList.map(([groupId, info]) => (
                      <TableRow
                        key={groupId}
                        className={`h-10 ${info.isFraudSuspect ? "bg-red-50 dark:bg-red-950" : ""}`}
                      >
                        <TableCell className="py-1.5 overflow-hidden">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-medium text-sm truncate">{info.description}</span>
                            {info.isFraudSuspect && (
                              <Badge variant="destructive" className="text-xs shrink-0">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Fraude
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          {(() => {
                            const cat = getCategory(info.categoryId);
                            return cat ? (
                              <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} />
                            ) : <span className="text-xs text-muted-foreground">-</span>;
                          })()}
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <Badge variant="outline" className="text-xs">
                            {info.parcelasPagas}/{info.totalParcelas} pagas
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-medium text-sm">
                          {formatCurrency(info.valorParcela)}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-medium text-sm text-blue-600 dark:text-blue-400">
                          {formatCurrency(info.valorRestante)}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs">
                          {info.proximaFatura ? getMonthName(info.proximaFatura) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="h-9 bg-muted/50 font-medium">
                      <TableCell colSpan={2} className="py-1.5 text-xs">
                        {futureInstallmentsList.length} parcelamento(s)
                      </TableCell>
                      <TableCell className="py-1.5"></TableCell>
                      <TableCell className="py-1.5 text-right text-xs text-destructive whitespace-nowrap">
                        {formatCurrency(futureInstallmentsList.reduce((sum, [, info]) => sum + info.valorParcela, 0))}
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {formatCurrency(futureInstallmentsList.reduce((sum, [, info]) => sum + info.valorRestante, 0))}
                      </TableCell>
                      <TableCell className="py-1.5"></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
