import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  AlertTriangle,
  Info,
  FileDown,
} from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { exportToExcel } from "@/lib/exportExcel";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import type { Transaction, Category, Subcategory } from "@shared/schema";
import { PageHeader } from "@/components/page-header";

function formatCurrency(value: number | string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

function getMonthKey(t: { paymentDate?: string | Date | null; source?: string | null; cardBillMonth?: string | null; date: string | Date }) {
  if (t.paymentDate) {
    const d = new Date(t.paymentDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (t.source === "cartao" && t.cardBillMonth) return t.cardBillMonth;
  const d = new Date(t.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
}

function formatDate(date: string) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

interface MonthlyTotal {
  yearMonth: string;
  total: number;
  transactions: Transaction[];
}

interface CategoryAnalysis {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  type: "receita" | "despesa";
  monthlyTotals: MonthlyTotal[];
  rawAverage: number;
  trimmedAverage: number;
  monthCount: number;
  outlierMonths: MonthlyTotal[];
  peakMonths: MonthlyTotal[];
  valleyMonths: MonthlyTotal[];
  insufficientData: boolean;
  q1: number;
  q3: number;
  iqr: number;
  lowerBound: number;
  upperBound: number;
}

function calculateIQR(values: number[]): { q1: number; q3: number; iqr: number; lowerBound: number; upperBound: number } {
  if (values.length < 4) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { q1: min, q3: max, iqr: max - min, lowerBound: min, upperBound: max };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1Idx = Math.floor(n * 0.25);
  const q3Idx = Math.floor(n * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  return { q1, q3, iqr, lowerBound, upperBound };
}

type SortColumn = "category" | "rawAverage" | "trimmedAverage" | "months" | "outliers";
type SortDir = "asc" | "desc";

export default function MediaCategorias() {
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("despesa");
  const [sortColumn, setSortColumn] = useState<SortColumn>("trimmedAverage");
  const [sortDirection, setSortDirection] = useState<SortDir>("desc");
  const [detailCategory, setDetailCategory] = useState<CategoryAnalysis | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: transactions = [], isLoading: loadingTx } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });
  const { data: categories = [], isLoading: loadingCat } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const analysis = useMemo(() => {
    const realized = transactions.filter((t) => t.status === "realizada" && t.categoryId);

    const byCat = new Map<number, Transaction[]>();
    for (const t of realized) {
      const list = byCat.get(t.categoryId!) || [];
      list.push(t);
      byCat.set(t.categoryId!, list);
    }

    const results: CategoryAnalysis[] = [];
    for (const [catId, txs] of Array.from(byCat.entries())) {
      const cat = categories.find((c) => c.id === catId);
      if (!cat) continue;

      const monthMap = new Map<string, MonthlyTotal>();
      for (const t of txs) {
        const ym = getMonthKey(t);
        const existing = monthMap.get(ym) || { yearMonth: ym, total: 0, transactions: [] };
        existing.total += Math.abs(parseFloat(String(t.amount)));
        existing.transactions.push(t);
        monthMap.set(ym, existing);
      }

      const monthlyTotals = Array.from(monthMap.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
      if (monthlyTotals.length < 2) continue;

      const values = monthlyTotals.map((m) => m.total);
      const rawAverage = values.reduce((s, v) => s + v, 0) / values.length;
      const { q1, q3, iqr, lowerBound, upperBound } = calculateIQR(values);

      const peakMonths: MonthlyTotal[] = [];
      const valleyMonths: MonthlyTotal[] = [];
      const normalMonths: MonthlyTotal[] = [];

      for (const m of monthlyTotals) {
        if (m.total > upperBound) {
          peakMonths.push(m);
        } else if (m.total < lowerBound) {
          valleyMonths.push(m);
        } else {
          normalMonths.push(m);
        }
      }

      const trimmedAverage = normalMonths.length > 0
        ? normalMonths.reduce((s, m) => s + m.total, 0) / normalMonths.length
        : rawAverage;

      const insufficientData = monthlyTotals.length < 4;

      results.push({
        categoryId: catId,
        categoryName: cat.name,
        categoryColor: cat.color || "#6b7280",
        type: cat.type as "receita" | "despesa",
        monthlyTotals,
        rawAverage,
        trimmedAverage: insufficientData ? rawAverage : trimmedAverage,
        monthCount: monthlyTotals.length,
        outlierMonths: insufficientData ? [] : [...peakMonths, ...valleyMonths],
        peakMonths: insufficientData ? [] : peakMonths,
        valleyMonths: insufficientData ? [] : valleyMonths,
        insufficientData,
        q1,
        q3,
        iqr,
        lowerBound,
        upperBound,
      });
    }

    return results;
  }, [transactions, categories]);

  const filtered = useMemo(() => {
    let list = analysis;
    if (filterType !== "all") {
      list = list.filter((a) => a.type === filterType);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "category":
          cmp = a.categoryName.localeCompare(b.categoryName);
          break;
        case "rawAverage":
          cmp = a.rawAverage - b.rawAverage;
          break;
        case "trimmedAverage":
          cmp = a.trimmedAverage - b.trimmedAverage;
          break;
        case "months":
          cmp = a.monthCount - b.monthCount;
          break;
        case "outliers":
          cmp = a.outlierMonths.length - b.outlierMonths.length;
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [analysis, filterType, sortColumn, sortDirection]);

  const totals = useMemo(() => {
    const receitaItems = filtered.filter((a) => a.type === "receita");
    const despesaItems = filtered.filter((a) => a.type === "despesa");
    return {
      receitaTrimmed: receitaItems.reduce((s, a) => s + a.trimmedAverage, 0),
      despesaTrimmed: despesaItems.reduce((s, a) => s + a.trimmedAverage, 0),
      receitaRaw: receitaItems.reduce((s, a) => s + a.rawAverage, 0),
      despesaRaw: despesaItems.reduce((s, a) => s + a.rawAverage, 0),
      totalCategories: filtered.length,
      totalOutliers: filtered.reduce((s, a) => s + a.outlierMonths.length, 0),
    };
  }, [filtered]);

  function toggleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  }

  function SortIcon({ col }: { col: SortColumn }) {
    if (sortColumn !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDirection === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  }

  function openDetail(cat: CategoryAnalysis) {
    setDetailCategory(cat);
    setDetailOpen(true);
  }

  function handleExport() {
    const rows = filtered.map((a) => ({
      Categoria: a.categoryName,
      Tipo: a.type === "receita" ? "Receita" : "Despesa",
      "Media Bruta": a.rawAverage.toFixed(2),
      "Media Estimada": a.trimmedAverage.toFixed(2),
      Meses: a.monthCount,
      Picos: a.peakMonths.length,
      Vales: a.valleyMonths.length,
      "Limite Inferior": a.lowerBound.toFixed(2),
      "Limite Superior": a.upperBound.toFixed(2),
    }));
    exportToExcel(rows, "media-categorias");
  }

  const isLoading = loadingTx || loadingCat;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Media Mensal por Categoria" subtitle="Analise estatistica" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Media Mensal por Categoria" subtitle="Analise estatistica com exclusao de picos e vales">
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger className="w-[120px]" data-testid="filter-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
          <FileDown className="w-4 h-4 mr-1" />
          Excel
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Media Estimada Receitas</div>
              <div className="text-lg font-bold text-green-600" data-testid="text-receita-trimmed">
                {formatCurrency(totals.receitaTrimmed)}
              </div>
              <div className="text-[10px] text-muted-foreground">Bruta: {formatCurrency(totals.receitaRaw)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Media Estimada Despesas</div>
              <div className="text-lg font-bold text-red-600" data-testid="text-despesa-trimmed">
                {formatCurrency(totals.despesaTrimmed)}
              </div>
              <div className="text-[10px] text-muted-foreground">Bruta: {formatCurrency(totals.despesaRaw)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Saldo Estimado</div>
              <div className={`text-lg font-bold ${totals.receitaTrimmed - totals.despesaTrimmed >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-saldo-estimado">
                {formatCurrency(totals.receitaTrimmed - totals.despesaTrimmed)}
              </div>
              <div className="text-[10px] text-muted-foreground">Bruto: {formatCurrency(totals.receitaRaw - totals.despesaRaw)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Categorias / Outliers</div>
              <div className="text-lg font-bold" data-testid="text-categorias-count">
                {totals.totalCategories}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {totals.totalOutliers} meses com picos/vales
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-1.5 cursor-pointer select-none" onClick={() => toggleSort("category")} data-testid="sort-category">
                      <div className="flex items-center">Categoria<SortIcon col="category" /></div>
                    </TableHead>
                    <TableHead className="py-1.5 w-[60px]">Tipo</TableHead>
                    <TableHead className="py-1.5 text-right cursor-pointer select-none" onClick={() => toggleSort("rawAverage")} data-testid="sort-raw">
                      <div className="flex items-center justify-end">Media Bruta<SortIcon col="rawAverage" /></div>
                    </TableHead>
                    <TableHead className="py-1.5 text-right cursor-pointer select-none" onClick={() => toggleSort("trimmedAverage")} data-testid="sort-trimmed">
                      <div className="flex items-center justify-end">Media Estimada<SortIcon col="trimmedAverage" /></div>
                    </TableHead>
                    <TableHead className="py-1.5 text-center cursor-pointer select-none" onClick={() => toggleSort("months")} data-testid="sort-months">
                      <div className="flex items-center justify-center">Meses<SortIcon col="months" /></div>
                    </TableHead>
                    <TableHead className="py-1.5 text-center cursor-pointer select-none" onClick={() => toggleSort("outliers")} data-testid="sort-outliers">
                      <div className="flex items-center justify-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center">Picos/Vales<SortIcon col="outliers" /><Info className="w-3 h-3 ml-1 opacity-50" /></span>
                          </TooltipTrigger>
                          <TooltipContent>Meses com valores fora do intervalo interquartil (IQR x 1.5)</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="py-1.5 text-right">Faixa Normal</TableHead>
                    <TableHead className="py-1.5 w-[60px]">Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhuma categoria com dados suficientes para analise
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((a) => {
                    const diff = a.trimmedAverage - a.rawAverage;
                    const diffPct = a.rawAverage > 0 ? ((diff / a.rawAverage) * 100).toFixed(1) : "0";
                    return (
                      <TableRow key={a.categoryId} className="text-xs" data-testid={`row-category-${a.categoryId}`}>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-2">
                            <CategoryIcon color={a.categoryColor} size="sm" />
                            <span className="font-medium">{a.categoryName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant="outline" className={`text-[10px] font-bold ${a.type === "receita" ? "border-green-600 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950" : "border-red-600 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950"}`}>
                            {a.type === "receita" ? "R" : "D"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono">{formatCurrency(a.rawAverage)}</TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-mono font-semibold">{formatCurrency(a.trimmedAverage)}</span>
                            {Math.abs(parseFloat(diffPct)) > 1 && (
                              <span className={`text-[10px] ${parseFloat(diffPct) > 0 ? "text-red-500" : "text-green-500"}`}>
                                ({diffPct}%)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {a.monthCount}
                            {a.insufficientData && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3 h-3 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>Menos de 4 meses - analise IQR nao aplicavel</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          {a.insufficientData ? (
                            <span className="text-[10px] text-amber-500">N/A</span>
                          ) : a.outlierMonths.length > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              {a.peakMonths.length > 0 && (
                                <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 gap-0.5">
                                  <TrendingUp className="w-3 h-3" />{a.peakMonths.length}
                                </Badge>
                              )}
                              {a.valleyMonths.length > 0 && (
                                <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 gap-0.5">
                                  <TrendingDown className="w-3 h-3" />{a.valleyMonths.length}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-[10px] text-muted-foreground font-mono" data-testid={`text-range-${a.categoryId}`}>
                          {a.insufficientData ? "N/A" : `${formatCurrency(Math.max(0, a.lowerBound))} - ${formatCurrency(a.upperBound)}`}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Button variant="ghost" size="icon" onClick={() => openDetail(a)} data-testid={`button-detail-${a.categoryId}`}>
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          {detailCategory && (
            <CategoryDetailView
              analysis={detailCategory}
              categories={categories}
              subcategories={subcategories}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryDetailView({
  analysis,
  categories,
  subcategories,
}: {
  analysis: CategoryAnalysis;
  categories: Category[];
  subcategories: Subcategory[];
}) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const chartData = analysis.monthlyTotals.map((m) => ({
    month: getMonthLabel(m.yearMonth),
    yearMonth: m.yearMonth,
    total: m.total,
    isPeak: m.total > analysis.upperBound,
    isValley: m.total < analysis.lowerBound,
  }));

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.yearMonth) {
      const ym = data.activePayload[0].payload.yearMonth;
      setExpandedMonth(expandedMonth === ym ? null : ym);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CategoryIcon color={analysis.categoryColor} size="sm" />
          {analysis.categoryName}
          <Badge variant="outline" className={`text-xs ml-2 font-bold ${analysis.type === "receita" ? "border-green-600 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950" : "border-red-600 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950"}`}>
            {analysis.type === "receita" ? "R" : "D"}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground">Media Bruta</div>
              <div className="text-sm font-bold font-mono">{formatCurrency(analysis.rawAverage)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground">Media Estimada</div>
              <div className="text-sm font-bold font-mono">{formatCurrency(analysis.trimmedAverage)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground">Faixa Normal</div>
              <div className="text-sm font-mono">{formatCurrency(Math.max(0, analysis.lowerBound))} - {formatCurrency(analysis.upperBound)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground">Meses Analisados</div>
              <div className="text-sm font-bold">{analysis.monthCount}</div>
              <div className="text-[10px] text-muted-foreground">
                {analysis.peakMonths.length} pico(s), {analysis.valleyMonths.length} vale(s)
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm">Totais Mensais (clique na barra para ver transacoes)</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} onClick={handleBarClick} style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip
                  formatter={(value: number) => [formatCurrency(value), "Total"]}
                  labelStyle={{ fontSize: 12 }}
                />
                <ReferenceLine y={analysis.trimmedAverage} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "Media Est.", position: "right", fontSize: 10 }} />
                <ReferenceLine y={analysis.upperBound} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                {analysis.lowerBound > 0 && (
                  <ReferenceLine y={analysis.lowerBound} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.5} />
                )}
                <Bar dataKey="total" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.isPeak ? "#ef4444" : entry.isValley ? "#3b82f6" : analysis.categoryColor}
                      opacity={entry.yearMonth === expandedMonth ? 1 : (entry.isPeak || entry.isValley ? 0.8 : 0.6)}
                      stroke={entry.yearMonth === expandedMonth ? "#000" : "none"}
                      strokeWidth={entry.yearMonth === expandedMonth ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 justify-center mt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ backgroundColor: analysis.categoryColor, opacity: 0.6 }} />Normal</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block bg-red-500 opacity-80" />Pico</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block bg-blue-500 opacity-80" />Vale</span>
              <span className="flex items-center gap-1"><span className="w-6 border-t-2 border-dashed border-green-500 inline-block" />Media Est.</span>
            </div>
          </CardContent>
        </Card>

        {expandedMonth && (() => {
          const monthData = analysis.monthlyTotals.find((m) => m.yearMonth === expandedMonth);
          if (!monthData) return null;
          const isPeak = monthData.total > analysis.upperBound;
          const isValley = monthData.total < analysis.lowerBound;
          return (
            <Card>
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getMonthLabel(expandedMonth)} - {formatCurrency(monthData.total)}
                  {isPeak && <Badge variant="outline" className="text-[10px] border-red-300 text-red-600">Pico</Badge>}
                  {isValley && <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">Vale</Badge>}
                  <span className="text-[10px] text-muted-foreground ml-auto">{monthData.transactions.length} transacoes</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-1 text-[10px]">Data</TableHead>
                      <TableHead className="py-1 text-[10px]">Descricao</TableHead>
                      <TableHead className="py-1 text-[10px]">Subcategoria</TableHead>
                      <TableHead className="py-1 text-[10px] text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...monthData.transactions].sort((a, b) => Math.abs(parseFloat(String(b.amount))) - Math.abs(parseFloat(String(a.amount)))).map((t) => {
                      const sub = subcategories.find((s) => s.id === t.subcategoryId);
                      return (
                        <TableRow key={t.id} className="text-[11px]">
                          <TableCell className="py-0.5">{formatDate(t.date)}</TableCell>
                          <TableCell className="py-0.5">{t.shortTitle || t.description}</TableCell>
                          <TableCell className="py-0.5 text-muted-foreground">{sub?.name || "-"}</TableCell>
                          <TableCell className="py-0.5 text-right font-mono">{formatCurrency(Math.abs(parseFloat(String(t.amount))))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })()}

        {analysis.peakMonths.length > 0 && (
          <Card>
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-500" />
                Picos ({analysis.peakMonths.length} meses acima de {formatCurrency(analysis.upperBound)})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {analysis.peakMonths.map((m) => (
                <OutlierMonthDetail key={m.yearMonth} month={m} type="peak" subcategories={subcategories} trimmedAvg={analysis.trimmedAverage} />
              ))}
            </CardContent>
          </Card>
        )}

        {analysis.valleyMonths.length > 0 && (
          <Card>
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-blue-500" />
                Vales ({analysis.valleyMonths.length} meses abaixo de {formatCurrency(Math.max(0, analysis.lowerBound))})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {analysis.valleyMonths.map((m) => (
                <OutlierMonthDetail key={m.yearMonth} month={m} type="valley" subcategories={subcategories} trimmedAvg={analysis.trimmedAverage} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function OutlierMonthDetail({
  month,
  type,
  subcategories,
  trimmedAvg,
}: {
  month: MonthlyTotal;
  type: "peak" | "valley";
  subcategories: Subcategory[];
  trimmedAvg: number;
}) {
  const deviation = month.total - trimmedAvg;
  const deviationPct = trimmedAvg > 0 ? ((deviation / trimmedAvg) * 100).toFixed(0) : "0";
  const sorted = [...month.transactions].sort((a, b) => Math.abs(parseFloat(String(b.amount))) - Math.abs(parseFloat(String(a.amount))));

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Badge variant={type === "peak" ? "destructive" : "default"} className="text-[10px]">
            {getMonthLabel(month.yearMonth)}
          </Badge>
          <span className="text-xs font-semibold font-mono">{formatCurrency(month.total)}</span>
          <span className={`text-[10px] ${type === "peak" ? "text-red-500" : "text-blue-500"}`}>
            ({deviationPct}% vs media)
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{month.transactions.length} transacoes</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="py-1 text-[10px]">Data</TableHead>
            <TableHead className="py-1 text-[10px]">Descricao</TableHead>
            <TableHead className="py-1 text-[10px]">Subcategoria</TableHead>
            <TableHead className="py-1 text-[10px] text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((t) => {
            const sub = subcategories.find((s) => s.id === t.subcategoryId);
            return (
              <TableRow key={t.id} className="text-[11px]">
                <TableCell className="py-0.5">{formatDate(t.date)}</TableCell>
                <TableCell className="py-0.5">{t.shortTitle || t.description}</TableCell>
                <TableCell className="py-0.5 text-muted-foreground">{sub?.name || "-"}</TableCell>
                <TableCell className="py-0.5 text-right font-mono">{formatCurrency(Math.abs(parseFloat(String(t.amount))))}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
