import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Star, Search, CreditCard, Building2, PenLine, CheckSquare, ArrowUpDown, ArrowUp, ArrowDown, Calendar, X, Check, TrendingUp, TrendingDown, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LabelList } from "recharts";
import { CategoryIcon } from "@/components/category-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import type { Beneficiary, Transaction, BankAccount, Category, Subcategory } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";

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

type SortColumn = "date" | "description" | "amount" | "type" | "status" | "source";
type SortDirection = "asc" | "desc";

const beneficiaryFormSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio"),
  active: z.boolean().default(true),
});

type BeneficiaryFormValues = z.infer<typeof beneficiaryFormSchema>;

const BENEFICIARY_COLORS = [
  "#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#A855F7", "#D946EF", "#0EA5E9", "#22C55E",
];

const DONUT_COLORS = [
  "#F59E0B", "#3B82F6", "#EF4444", "#10B981", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#A855F7", "#D946EF", "#0EA5E9", "#22C55E",
];

function getMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y}`;
}

function getTxMonth(t: Transaction): string {
  if (t.source === "cartao" && t.cardBillMonth) return t.cardBillMonth;
  const dateStr = t.paymentDate || t.transactionDate || t.date;
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getSourceBadgeChart(source: string | null) {
  if (source === "cartao") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs"><CreditCard className="w-3 h-3" /></Badge>
        </TooltipTrigger>
        <TooltipContent>Cartao de Credito</TooltipContent>
      </Tooltip>
    );
  }
  if (source === "conta_corrente") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs"><Building2 className="w-3 h-3" /></Badge>
        </TooltipTrigger>
        <TooltipContent>Conta Corrente</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="text-xs"><PenLine className="w-3 h-3" /></Badge>
      </TooltipTrigger>
      <TooltipContent>Manual</TooltipContent>
    </Tooltip>
  );
}

function BeneficiaryCharts({ transactions, beneficiaries, categories, selectedMonth }: { transactions: Transaction[]; beneficiaries: Beneficiary[]; categories: Category[]; selectedMonth: string | null }) {
  const [chartType, setChartType] = useState<"absoluto" | "percentual">("absoluto");
  const [filterChartType, setFilterChartType] = useState<"despesa" | "receita" | "all">("despesa");
  const [selectedChartMonth, setSelectedChartMonth] = useState<string | null>(null);
  const [selectedChartBenef, setSelectedChartBenef] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 15;

  type SortColumn = "date" | "paymentDate" | "description" | "source" | "beneficiary" | "category" | "type" | "amount";
  const [sortCol, setSortCol] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "date" || col === "amount" ? "desc" : "asc");
    }
    setTablePage(1);
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 ml-0.5 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-0.5" /> : <ArrowDown className="w-3 h-3 ml-0.5" />;
  };

  const benefMap = new Map<number, string>();
  for (const b of beneficiaries) benefMap.set(b.id, b.name);
  const benefNameToId = new Map<string, number>();
  for (const b of beneficiaries) benefNameToId.set(b.name, b.id);

  const labelToYM = new Map<string, string>();

  const { chartData, percentData, beneficiaryNames, beneficiaryColorMap } = (() => {
    const txWithBenef = transactions.filter(t => t.beneficiaryId != null);

    const monthSet = new Set<string>();
    for (const t of txWithBenef) monthSet.add(getTxMonth(t));
    const allSortedMonths = Array.from(monthSet).sort();
    const sortedMonths = selectedMonth ? allSortedMonths.filter(m => m === selectedMonth) : allSortedMonths;
    for (const m of sortedMonths) labelToYM.set(getMonthLabel(m), m);

    const activeBenefIds = new Set<number>();
    const monthlyData = new Map<string, Map<number, { receitas: number; despesas: number }>>();
    for (const m of sortedMonths) monthlyData.set(m, new Map());

    for (const t of txWithBenef) {
      if (filterChartType !== "all" && t.type !== filterChartType) continue;
      const month = getTxMonth(t);
      if (!monthlyData.has(month)) continue;
      const bId = t.beneficiaryId!;
      activeBenefIds.add(bId);
      const mMap = monthlyData.get(month)!;
      if (!mMap.has(bId)) mMap.set(bId, { receitas: 0, despesas: 0 });
      const entry = mMap.get(bId)!;
      const amt = Math.abs(parseFloat(String(t.amount)));
      if (t.type === "receita") entry.receitas += amt;
      else entry.despesas += amt;
    }

    const names = Array.from(activeBenefIds).map(id => benefMap.get(id) || `#${id}`);
    const colorMap = new Map<string, string>();
    const sortedNames = [...names].sort();
    sortedNames.forEach((name, i) => colorMap.set(name, BENEFICIARY_COLORS[i % BENEFICIARY_COLORS.length]));

    const data = sortedMonths.map(m => {
      const point: Record<string, number | string> = { month: getMonthLabel(m), _ym: m };
      const mMap = monthlyData.get(m)!;
      Array.from(mMap.entries()).forEach(([bId, vals]) => {
        const name = benefMap.get(bId) || `#${bId}`;
        const total = filterChartType === "receita" ? vals.receitas : filterChartType === "despesa" ? vals.despesas : vals.despesas + vals.receitas;
        if (total > 0) point[name] = Math.round(total * 100) / 100;
      });
      return point;
    });

    const pctData = sortedMonths.map(m => {
      const point: Record<string, number | string> = { month: getMonthLabel(m), _ym: m };
      const mMap = monthlyData.get(m)!;
      let monthTotal = 0;
      Array.from(mMap.values()).forEach(vals => {
        monthTotal += filterChartType === "receita" ? vals.receitas : filterChartType === "despesa" ? vals.despesas : vals.despesas + vals.receitas;
      });
      if (monthTotal > 0) {
        Array.from(mMap.entries()).forEach(([bId, vals]) => {
          const name = benefMap.get(bId) || `#${bId}`;
          const total = filterChartType === "receita" ? vals.receitas : filterChartType === "despesa" ? vals.despesas : vals.despesas + vals.receitas;
          point[name] = Math.round((total / monthTotal) * 10000) / 100;
        });
      }
      return point;
    });

    return { chartData: data, percentData: pctData, beneficiaryNames: sortedNames, beneficiaryColorMap: colorMap };
  })();

  const displayData = chartType === "absoluto" ? chartData : percentData;

  const filteredTableTx = transactions.filter(t => {
    if (!t.beneficiaryId) return false;
    if (filterChartType !== "all" && t.type !== filterChartType) return false;
    const month = getTxMonth(t);
    if (selectedMonth && month !== selectedMonth) return false;
    if (selectedChartMonth && month !== selectedChartMonth) return false;
    if (selectedChartBenef) {
      const bName = benefMap.get(t.beneficiaryId) || "";
      if (bName !== selectedChartBenef) return false;
    }
    return true;
  }).sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortCol) {
      case "date": return dir * (new Date(a.transactionDate || a.date).getTime() - new Date(b.transactionDate || b.date).getTime());
      case "paymentDate": return dir * (new Date(a.paymentDate || a.transactionDate || a.date).getTime() - new Date(b.paymentDate || b.transactionDate || b.date).getTime());
      case "description": return dir * (a.shortTitle || a.description || "").localeCompare(b.shortTitle || b.description || "");
      case "source": return dir * (a.source || "").localeCompare(b.source || "");
      case "beneficiary": {
        const aName = a.beneficiaryId ? benefMap.get(a.beneficiaryId) || "" : "";
        const bName = b.beneficiaryId ? benefMap.get(b.beneficiaryId) || "" : "";
        return dir * aName.localeCompare(bName);
      }
      case "category": {
        const aCat = categories.find(c => c.id === a.categoryId)?.name || "";
        const bCat = categories.find(c => c.id === b.categoryId)?.name || "";
        return dir * aCat.localeCompare(bCat);
      }
      case "type": return dir * (a.type || "").localeCompare(b.type || "");
      case "amount": return dir * (Math.abs(parseFloat(String(a.amount))) - Math.abs(parseFloat(String(b.amount))));
      default: return 0;
    }
  });

  const totalPages = Math.ceil(filteredTableTx.length / tablePageSize);
  const pagedTx = filteredTableTx.slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize);

  const tableTotals = filteredTableTx.reduce((acc, t) => {
    const amt = parseFloat(String(t.amount));
    if (t.type === "receita") acc.receitas += amt;
    else acc.despesas += amt;
    return acc;
  }, { receitas: 0, despesas: 0 });

  const categoryDonutData = (() => {
    const catTotals = new Map<number, number>();
    for (const t of filteredTableTx) {
      if (!t.categoryId) continue;
      if (t.type === "receita" && t.isRefund) continue;
      catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + Math.abs(parseFloat(String(t.amount))));
    }
    return Array.from(catTotals.entries())
      .map(([catId, total]) => {
        const cat = categories.find(c => c.id === catId);
        return { name: cat?.name || "Sem categoria", value: Math.round(total * 100) / 100, color: cat?.color || "#9CA3AF", icon: cat?.icon };
      })
      .sort((a, b) => b.value - a.value);
  })();

  const handleBarClick = (data: any) => {
    if (!data?.activeLabel) return;
    const ym = labelToYM.get(data.activeLabel) || null;
    if (selectedChartMonth === ym) {
      setSelectedChartMonth(null);
    } else {
      setSelectedChartMonth(ym);
    }
    setTablePage(1);
  };

  const handleBenefClick = (name: string) => {
    if (selectedChartBenef === name) {
      setSelectedChartBenef(null);
    } else {
      setSelectedChartBenef(name);
    }
    setTablePage(1);
  };

  const clearFilters = () => {
    setSelectedChartMonth(null);
    setSelectedChartBenef(null);
    setTablePage(1);
  };

  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const sorted = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
    return (
      <div className="bg-popover border rounded-md p-2 shadow-md text-xs max-h-64 overflow-auto">
        <p className="font-medium mb-1">{label}</p>
        {sorted.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="flex-1 truncate">{entry.dataKey}</span>
            <span className="font-medium tabular-nums">
              {chartType === "percentual" ? `${entry.value?.toFixed(1)}%` : formatCurrency(entry.value || 0)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const donutTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    const total = categoryDonutData.reduce((s, d) => s + d.value, 0);
    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
    return (
      <div className="bg-popover border rounded-md p-2 shadow-md text-xs">
        <p className="font-medium">{entry.name}</p>
        <p>{formatCurrency(entry.value)} ({pct}%)</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <Label className="text-xs text-muted-foreground">Visualizacao</Label>
          <Select value={chartType} onValueChange={(v: "absoluto" | "percentual") => setChartType(v)}>
            <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-chart-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="absoluto">Valores (R$)</SelectItem>
              <SelectItem value="percentual">Percentual (%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={filterChartType} onValueChange={(v: "despesa" | "receita" | "all") => setFilterChartType(v)}>
            <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-chart-filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="despesa">Despesas</SelectItem>
              <SelectItem value="receita">Receitas</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(selectedChartMonth || selectedChartBenef) && (
          <div className="flex items-center gap-1 ml-2">
            {selectedChartMonth && (
              <Badge variant="secondary" className="text-xs gap-1">
                {getMonthLabel(selectedChartMonth)}
                <X className="w-3 h-3 cursor-pointer" onClick={() => { setSelectedChartMonth(null); setTablePage(1); }} />
              </Badge>
            )}
            {selectedChartBenef && (
              <Badge variant="secondary" className="text-xs gap-1" style={{ borderColor: beneficiaryColorMap.get(selectedChartBenef) }}>
                {selectedChartBenef}
                <X className="w-3 h-3 cursor-pointer" onClick={() => { setSelectedChartBenef(null); setTablePage(1); }} />
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearFilters} data-testid="button-clear-chart-filters">
              Limpar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-2">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">
              {chartType === "absoluto"
                ? `${filterChartType === "receita" ? "Receitas" : filterChartType === "despesa" ? "Despesas" : "Total"} por Beneficiario`
                : `Percentual de ${filterChartType === "receita" ? "Receitas" : filterChartType === "despesa" ? "Despesas" : "Gastos"} por Beneficiario`}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1 pb-2">
            {displayData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transacao com beneficiario encontrada</p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={displayData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }} onClick={handleBarClick} style={{ cursor: "pointer" }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={chartType === "percentual" ? (v: number) => `${v}%` : (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    domain={chartType === "percentual" ? [0, 100] : undefined}
                  />
                  <RechartsTooltip content={customTooltip} />
                  <Legend
                    wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                    iconType="square"
                    iconSize={8}
                    onClick={(e: any) => { if (e?.value) handleBenefClick(e.value); }}
                    formatter={(value: string) => (
                      <span style={{ fontWeight: selectedChartBenef === value ? "bold" : "normal", textDecoration: selectedChartBenef === value ? "underline" : "none" }}>
                        {value}
                      </span>
                    )}
                  />
                  {beneficiaryNames.map((name, idx) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="a"
                      fill={beneficiaryColorMap.get(name) || "#9CA3AF"}
                      opacity={selectedChartBenef && selectedChartBenef !== name ? 0.3 : 1}
                      radius={0}
                    >
                      <LabelList
                        dataKey={name}
                        position="center"
                        content={({ x, y, width, height, index, value }: any) => {
                          if (index == null || !displayData[index] || !value || value <= 0) return null;
                          const segH = Math.abs(height || 0);
                          if (segH < 22) return null;
                          const d = displayData[index];
                          let monthTotal = 0;
                          for (const key of Object.keys(d)) {
                            if (key !== "month" && key !== "_ym" && typeof d[key] === "number") monthTotal += d[key] as number;
                          }
                          const pct = monthTotal > 0 ? ((value / monthTotal) * 100).toFixed(0) : "0";
                          const valLabel = chartType === "percentual"
                            ? `${Number(value).toFixed(0)}%`
                            : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
                          const cx = (x as number) + (width as number) / 2;
                          const cy = (y as number) + segH / 2;
                          if (chartType === "percentual") {
                            return (
                              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={600}>
                                {valLabel}
                              </text>
                            );
                          }
                          if (segH < 32) {
                            return (
                              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={8} fontWeight={600}>
                                {valLabel} ({pct}%)
                              </text>
                            );
                          }
                          return (
                            <g>
                              <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={600}>
                                {valLabel}
                              </text>
                              <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.8)" fontSize={8}>
                                {pct}%
                              </text>
                            </g>
                          );
                        }}
                      />
                      {idx === beneficiaryNames.length - 1 && (
                        <LabelList
                          position="top"
                          content={({ x, y, width, index }: any) => {
                            if (index == null || !displayData[index]) return null;
                            const d = displayData[index];
                            let total = 0;
                            for (const key of Object.keys(d)) {
                              if (key !== "month" && key !== "_ym" && typeof d[key] === "number") total += d[key] as number;
                            }
                            if (total <= 0) return null;
                            const label = chartType === "percentual"
                              ? `${Math.round(total)}%`
                              : total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(Math.round(total));
                            return (
                              <text x={(x as number) + (width as number) / 2} y={(y as number) - 4} textAnchor="middle" fill="currentColor" fontSize={9} fontWeight={600}>
                                {label}
                              </text>
                            );
                          }}
                        />
                      )}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Categorias no Periodo</CardTitle>
          </CardHeader>
          <CardContent className="px-1 pb-2">
            {categoryDonutData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryDonutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color || DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={donutTooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 px-2 max-h-40 overflow-auto">
                  {categoryDonutData.map((entry) => {
                    const total = categoryDonutData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
                    const cat = categories.find(c => c.name === entry.name);
                    return (
                      <div key={entry.name} className="flex items-center gap-2 text-xs">
                        <CategoryIcon iconName={cat?.icon} color={entry.color} categoryName={entry.name} />
                        <span className="flex-1 truncate">{entry.name}</span>
                        <span className="tabular-nums text-muted-foreground">{pct}%</span>
                        <span className="tabular-nums font-medium">{formatCurrency(entry.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {beneficiaryNames.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {beneficiaryNames.map((name) => {
            const total = chartData.reduce((sum, d) => sum + (typeof d[name] === "number" ? (d[name] as number) : 0), 0);
            const grandTotal = chartData.reduce((sum, d) => {
              let rowTotal = 0;
              for (const key of Object.keys(d)) {
                if (key !== "month" && key !== "_ym" && typeof d[key] === "number") rowTotal += d[key] as number;
              }
              return sum + rowTotal;
            }, 0);
            const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
            const isSelected = selectedChartBenef === name;
            return (
              <Card key={name} className={`cursor-pointer ${isSelected ? "ring-2 ring-primary" : ""}`} onClick={() => handleBenefClick(name)}>
                <CardContent className="py-2 px-3 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: beneficiaryColorMap.get(name) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% do total</p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{formatCurrency(total)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="py-2 px-3 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm">
            Transacoes
            {(selectedChartMonth || selectedChartBenef) && (
              <span className="text-muted-foreground font-normal ml-2">
                ({filteredTableTx.length} registros)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-xs gap-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              {formatCurrency(tableTotals.receitas)}
            </Badge>
            <Badge variant="outline" className="text-xs gap-1">
              <TrendingDown className="w-3 h-3 text-red-600" />
              {formatCurrency(tableTotals.despesas)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-1.5 text-xs w-20 cursor-pointer select-none" onClick={() => toggleSort("date")} data-testid="sort-chart-date">
                  <div className="flex items-center">Dt. Trans.<SortIcon col="date" /></div>
                </TableHead>
                <TableHead className="py-1.5 text-xs w-20 cursor-pointer select-none" onClick={() => toggleSort("paymentDate")} data-testid="sort-chart-payment-date">
                  <div className="flex items-center">Dt. Pgto.<SortIcon col="paymentDate" /></div>
                </TableHead>
                <TableHead className="py-1.5 text-xs cursor-pointer select-none" onClick={() => toggleSort("description")} data-testid="sort-chart-description">
                  <div className="flex items-center">Descricao<SortIcon col="description" /></div>
                </TableHead>
                <TableHead className="py-1.5 text-xs w-10 cursor-pointer select-none" onClick={() => toggleSort("source")} data-testid="sort-chart-source">
                  <div className="flex items-center">Orig.<SortIcon col="source" /></div>
                </TableHead>
                <TableHead className="py-1.5 text-xs w-24 cursor-pointer select-none" onClick={() => toggleSort("beneficiary")} data-testid="sort-chart-beneficiary">
                  <div className="flex items-center">Beneficiario<SortIcon col="beneficiary" /></div>
                </TableHead>
                <TableHead className="py-1.5 text-xs w-10 cursor-pointer select-none" onClick={() => toggleSort("category")} data-testid="sort-chart-category">
                  <div className="flex items-center">Cat.<SortIcon col="category" /></div>
                </TableHead>
                <TableHead className="py-1.5 text-xs w-20 cursor-pointer select-none" onClick={() => toggleSort("type")} data-testid="sort-chart-type">
                  <div className="flex items-center">Tipo<SortIcon col="type" /></div>
                </TableHead>
                <TableHead className="py-1.5 text-xs w-24 text-right cursor-pointer select-none" onClick={() => toggleSort("amount")} data-testid="sort-chart-amount">
                  <div className="flex items-center justify-end">Valor<SortIcon col="amount" /></div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTx.map((t) => {
                const cat = categories.find(c => c.id === t.categoryId);
                const bName = t.beneficiaryId ? benefMap.get(t.beneficiaryId) : null;
                return (
                  <TableRow key={t.id} data-testid={`row-chart-tx-${t.id}`}>
                    <TableCell className="py-1.5 text-xs tabular-nums whitespace-nowrap">{formatDate(t.transactionDate || t.date)}</TableCell>
                    <TableCell className="py-1.5 text-xs tabular-nums whitespace-nowrap">{formatDate(t.paymentDate || t.transactionDate || t.date)}</TableCell>
                    <TableCell className="py-1.5 text-xs truncate max-w-[200px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{t.shortTitle || t.description}</span>
                        </TooltipTrigger>
                        {t.originalDescription && t.originalDescription !== t.shortTitle && (
                          <TooltipContent>{t.originalDescription}</TooltipContent>
                        )}
                      </Tooltip>
                    </TableCell>
                    <TableCell className="py-1.5">{getSourceBadgeChart(t.source)}</TableCell>
                    <TableCell className="py-1.5 text-xs truncate">{bName || "-"}</TableCell>
                    <TableCell className="py-1.5">
                      {cat ? <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} /> : <span className="text-xs text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant={t.type === "receita" ? "default" : "destructive"} className="text-xs">
                        {t.type === "receita" ? "Rec" : "Desp"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`py-1.5 text-xs text-right tabular-nums font-medium ${t.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "despesa" ? "-" : ""}{formatCurrency(t.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {pagedTx.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">
                    Nenhuma transacao encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filteredTableTx.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="text-xs font-medium">Total ({filteredTableTx.length} registros)</TableCell>
                  <TableCell className={`text-xs text-right tabular-nums font-medium ${tableTotals.receitas - tableTotals.despesas >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(tableTotals.receitas - tableTotals.despesas)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 pt-2">
              <span className="text-xs text-muted-foreground">
                Pagina {tablePage} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage(p => p - 1)}
                  data-testid="button-chart-table-prev"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={tablePage >= totalPages}
                  onClick={() => setTablePage(p => p + 1)}
                  data-testid="button-chart-table-next"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Beneficiarios(props: { defaultTab?: "cadastro" | "atribuir" } & Record<string, any>) {
  const defaultTab = props.defaultTab ?? "cadastro";
  const { toast } = useToast();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<string>(location === "/beneficiar" ? "atribuir" : defaultTab);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  
  // Estados para aba de atribuição
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBeneficiaryId, setBulkBeneficiaryId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const itemsPerPage = 10;
  
  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "prevista" | "realizada">("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState<string>("all");
  const [filterBankAccountId, setFilterBankAccountId] = useState<string>("all");
  const currentYM = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentYM);
  const [selectedMonthGraficos, setSelectedMonthGraficos] = useState<string | null>(null);
  const handleMonthChange = (month: string | null) => {
    setSelectedMonth(month);
    setCurrentPage(1);
  };
  const handleMonthChangeGraficos = (month: string | null) => {
    setSelectedMonthGraficos(month);
  };
  
  // Seleção individual de beneficiário por transação
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<Record<number, string>>({});

  const { data: beneficiaries = [], isLoading } = useQuery<Beneficiary[]>({
    queryKey: ["/api/beneficiaries"],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const form = useForm<BeneficiaryFormValues>({
    resolver: zodResolver(beneficiaryFormSchema),
    defaultValues: {
      name: "",
      active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BeneficiaryFormValues) => {
      return apiRequest("POST", "/api/beneficiaries", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      toast({ title: "Beneficiario criado com sucesso" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar beneficiario", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BeneficiaryFormValues }) => {
      return apiRequest("PATCH", `/api/beneficiaries/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      toast({ title: "Beneficiario atualizado com sucesso" });
      setDialogOpen(false);
      setEditingBeneficiary(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar beneficiario", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/beneficiaries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      toast({ title: "Beneficiario removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover beneficiario", variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/beneficiaries/${id}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
      toast({ title: "Beneficiario padrao atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar beneficiario padrao", variant: "destructive" });
    },
  });

  const [editTxDialogOpen, setEditTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTxForm, setEditTxForm] = useState({ shortTitle: "", amount: "", type: "despesa" as "receita" | "despesa", date: "" });

  const deleteTransactionMutation = useMutation({
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

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/transactions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Transacao atualizada com sucesso!" });
      setEditTxDialogOpen(false);
      setEditingTx(null);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar transacao", variant: "destructive" });
    },
  });

  const handleEditTx = (t: Transaction) => {
    setEditingTx(t);
    setEditTxForm({
      shortTitle: t.shortTitle || t.description,
      amount: String(t.amount),
      type: t.type as "receita" | "despesa",
      date: t.date,
    });
    setEditTxDialogOpen(true);
  };

  const handleSaveTxEdit = () => {
    if (!editingTx) return;
    updateTransactionMutation.mutate({
      id: editingTx.id,
      data: {
        shortTitle: editTxForm.shortTitle,
        amount: editTxForm.amount,
        type: editTxForm.type,
        date: editTxForm.date,
      },
    });
  };

  const updateBeneficiaryBatchMutation = useMutation({
    mutationFn: async ({ ids, beneficiaryId }: { ids: number[]; beneficiaryId: number | null }) => {
      return apiRequest("POST", "/api/transactions/update-beneficiary-batch", { ids, beneficiaryId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Beneficiario atualizado com sucesso!" });
      setSelectedIds(new Set());
      setBulkBeneficiaryId("");
    },
    onError: () => {
      toast({ title: "Erro ao atualizar beneficiario", variant: "destructive" });
    },
  });

  const updateSingleBeneficiaryMutation = useMutation({
    mutationFn: async ({ id, beneficiaryId }: { id: number; beneficiaryId: number | null }) => {
      return apiRequest("PATCH", `/api/transactions/${id}`, { beneficiaryId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Beneficiario atualizado!" });
      setSelectedBeneficiaries((prev) => {
        const newState = { ...prev };
        delete newState[variables.id];
        return newState;
      });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar beneficiario", variant: "destructive" });
    },
  });

  const handleSingleBeneficiaryUpdate = (transactionId: number) => {
    const selection = selectedBeneficiaries[transactionId];
    const beneficiaryId = selection && selection !== "none" ? parseInt(selection) : null;
    updateSingleBeneficiaryMutation.mutate({ id: transactionId, beneficiaryId });
  };

  // Funções auxiliares para aba de atribuição
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

  const getSourceIcon = (source: string | null) => {
    if (source === "cartao") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex"><CreditCard className="w-3.5 h-3.5 text-muted-foreground" /></span>
          </TooltipTrigger>
          <TooltipContent>Cartao de Credito</TooltipContent>
        </Tooltip>
      );
    }
    if (source === "conta_corrente") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /></span>
          </TooltipTrigger>
          <TooltipContent>Conta Corrente</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex"><PenLine className="w-3.5 h-3.5 text-muted-foreground" /></span>
        </TooltipTrigger>
        <TooltipContent>Manual</TooltipContent>
      </Tooltip>
    );
  };

  const getBankAccountName = (bankAccountId: number | null) => {
    if (!bankAccountId) return null;
    const account = bankAccounts.find((a) => a.id === bankAccountId);
    return account?.name || null;
  };

  const getBeneficiaryName = (beneficiaryId: number | null) => {
    if (!beneficiaryId) return null;
    const beneficiary = beneficiaries.find((b) => b.id === beneficiaryId);
    return beneficiary?.name || null;
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredTransactionsForAssignment.map((t) => t.id));
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

  const handleBulkBeneficiaryUpdate = () => {
    if (selectedIds.size === 0) {
      toast({ title: "Selecione pelo menos uma transacao", variant: "destructive" });
      return;
    }
    const beneficiaryId = bulkBeneficiaryId && bulkBeneficiaryId !== "none" 
      ? parseInt(bulkBeneficiaryId) 
      : null;
    updateBeneficiaryBatchMutation.mutate({ 
      ids: Array.from(selectedIds), 
      beneficiaryId 
    });
  };

  // Filtrar transações
  const filteredTransactionsForAssignment = transactions
    .filter((t) => !t.isCardBillPayment)
    .filter((t) => showAll || !t.beneficiaryId)
    .filter((t) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      const amountStr = Math.abs(Number(t.amount)).toFixed(2);
      const amountFormatted = amountStr.replace(".", ",");
      return (
        t.description.toLowerCase().includes(search) ||
        (t.originalDescription && t.originalDescription.toLowerCase().includes(search)) ||
        (t.shortTitle && t.shortTitle.toLowerCase().includes(search)) ||
        amountStr.includes(searchTerm) ||
        amountFormatted.includes(searchTerm)
      );
    })
    .filter((t) => {
      if (selectedMonth) {
        const txDate = t.date.substring(0, 7);
        if (txDate !== selectedMonth) return false;
      }
      const matchesType = filterType === "all" || t.type === filterType;
      const matchesStatus = filterStatus === "all" || t.status === filterStatus;
      const matchesCategory = filterCategoryId === "all" || (filterCategoryId === "empty" ? !t.categoryId : t.categoryId === Number(filterCategoryId));
      const matchesSubcategory = filterSubcategoryId === "all" || (filterSubcategoryId === "empty" ? !t.subcategoryId : t.subcategoryId === Number(filterSubcategoryId));
      const matchesBeneficiary = filterBeneficiaryId === "all" || (filterBeneficiaryId === "empty" ? !t.beneficiaryId : t.beneficiaryId === Number(filterBeneficiaryId));
      const matchesBankAccount = filterBankAccountId === "all" || t.bankAccountId === Number(filterBankAccountId);
      return matchesType && matchesStatus && matchesCategory && matchesSubcategory && matchesBeneficiary && matchesBankAccount;
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
        case "amount":
          aVal = Math.abs(parseFloat(a.amount));
          bVal = Math.abs(parseFloat(b.amount));
          break;
        case "type":
          aVal = a.type;
          bVal = b.type;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "source":
          aVal = a.source || "";
          bVal = b.source || "";
          break;
        default:
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  const filteredTotals = filteredTransactionsForAssignment.reduce(
    (acc, t) => {
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
      if (t.type === "receita") acc.receitas += Math.abs(amount);
      else acc.despesas += Math.abs(amount);
      return acc;
    },
    { receitas: 0, despesas: 0 }
  );
  const filteredSaldo = filteredTotals.receitas - filteredTotals.despesas;

  const totalPages = Math.ceil(filteredTransactionsForAssignment.length / itemsPerPage);
  const paginatedTransactions = filteredTransactionsForAssignment.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSubmit = (data: BeneficiaryFormValues) => {
    if (editingBeneficiary) {
      updateMutation.mutate({ id: editingBeneficiary.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (beneficiary: Beneficiary) => {
    setEditingBeneficiary(beneficiary);
    form.reset({
      name: beneficiary.name,
      active: beneficiary.active ?? true,
    });
    setDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingBeneficiary(null);
      form.reset();
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Beneficiarios</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Beneficiar"
        selectedMonth={activeTab === "atribuir" ? selectedMonth : activeTab === "graficos" ? selectedMonthGraficos : undefined}
        onMonthChange={activeTab === "atribuir" ? handleMonthChange : activeTab === "graficos" ? handleMonthChangeGraficos : undefined}
      >
        {activeTab === "atribuir" && (
          <Button
            variant={showAll ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowAll(!showAll); setCurrentPage(1); }}
            data-testid="button-show-all"
          >
            {showAll ? "Todas" : "Sem Benef."}
          </Button>
        )}
      </PageHeader>
      <div className="px-4 py-3 space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList>
          <TabsTrigger value="cadastro" data-testid="tab-cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="atribuir" data-testid="tab-atribuir">
            Atribuir
            {filteredTransactionsForAssignment.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filteredTransactionsForAssignment.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="graficos" data-testid="tab-graficos">
            <BarChart3 className="w-3.5 h-3.5 mr-1" />
            Graficos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Lista de Beneficiarios</CardTitle>
              <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-beneficiary">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Beneficiario
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingBeneficiary ? "Editar Beneficiario" : "Novo Beneficiario"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Nome do beneficiario" data-testid="input-beneficiary-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="active"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel>Ativo</FormLabel>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-beneficiary-active"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                          Cancelar
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createMutation.isPending || updateMutation.isPending}
                          data-testid="button-save-beneficiary"
                        >
                          {editingBeneficiary ? "Salvar" : "Criar"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {beneficiaries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum beneficiario cadastrado</p>
                  <p className="text-sm">Crie um beneficiario para comecar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Padrao</TableHead>
                      <TableHead className="w-[100px]">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {beneficiaries.map((beneficiary) => (
                      <TableRow key={beneficiary.id} data-testid={`row-beneficiary-${beneficiary.id}`}>
                        <TableCell className="font-medium">{beneficiary.name}</TableCell>
                        <TableCell>
                          <Badge variant={beneficiary.active ? "default" : "secondary"}>
                            {beneficiary.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {beneficiary.isDefault ? (
                            <Badge variant="default" className="bg-amber-500" data-testid={`badge-default-${beneficiary.id}`}>
                              <Star className="w-3 h-3 mr-1" />
                              Padrao
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDefaultMutation.mutate(beneficiary.id)}
                              disabled={setDefaultMutation.isPending}
                              data-testid={`button-set-default-${beneficiary.id}`}
                            >
                              Definir como padrao
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(beneficiary)}
                              data-testid={`button-edit-beneficiary-${beneficiary.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(beneficiary.id)}
                              disabled={deleteMutation.isPending || !!beneficiary.isDefault}
                              data-testid={`button-delete-beneficiary-${beneficiary.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atribuir">
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs font-medium">Receitas</span>
                </div>
                <span className="text-lg font-bold text-success" data-testid="text-total-receitas">{formatCurrency(filteredTotals.receitas)}</span>
                <span className="text-xs text-muted-foreground ml-1">({filteredTransactionsForAssignment.filter(t => t.type === 'receita').length})</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-medium">Despesas</span>
                </div>
                <span className="text-lg font-bold text-destructive" data-testid="text-total-despesas">{formatCurrency(filteredTotals.despesas)}</span>
                <span className="text-xs text-muted-foreground ml-1">({filteredTransactionsForAssignment.filter(t => t.type === 'despesa').length})</span>
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
                <span className="text-lg font-bold" data-testid="text-count">{filteredTransactionsForAssignment.length}</span>
                <span className="text-xs text-muted-foreground ml-1">de {transactions.filter(t => !t.isCardBillPayment).length}</span>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2 pt-3">
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
                      data-testid="input-search-transactions"
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
                      {categories.filter(c => c.active).map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
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
                      {subcategories.filter(s => s.active && (filterCategoryId === "all" || s.categoryId === Number(filterCategoryId))).map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
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
                        <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
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
                        <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(filterCategoryId !== "all" || filterSubcategoryId !== "all" || filterBeneficiaryId !== "all" || filterBankAccountId !== "all") && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setFilterCategoryId("all"); setFilterSubcategoryId("all"); setFilterBeneficiaryId("all"); setFilterBankAccountId("all"); setCurrentPage(1); }} data-testid="button-clear-filters">
                    <X className="w-3 h-3 mr-1" />
                    Limpar
                  </Button>
                )}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <Badge variant="secondary">
                      <CheckSquare className="w-3 h-3 mr-1" />
                      {selectedIds.size} sel.
                    </Badge>
                    <Select value={bulkBeneficiaryId} onValueChange={setBulkBeneficiaryId}>
                      <SelectTrigger className="w-[150px] h-8 text-xs shrink-0" data-testid="select-bulk-beneficiary">
                        <SelectValue placeholder="Beneficiario" />
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
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={handleBulkBeneficiaryUpdate}
                      disabled={updateBeneficiaryBatchMutation.isPending || !bulkBeneficiaryId}
                      data-testid="button-apply-bulk-beneficiary"
                    >
                      Aplicar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : filteredTransactionsForAssignment.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{showAll ? "Nenhuma transacao encontrada" : "Nenhuma transacao sem beneficiario"}</p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden">
                    <Table className="text-sm table-fixed w-full">
                      <colgroup>
                        <col style={{ width: "36px" }} />
                        <col style={{ width: "72px" }} />
                        <col />
                        <col style={{ width: "44px" }} />
                        <col style={{ width: "70px" }} />
                        <col style={{ width: "60px" }} />
                        <col style={{ width: "60px" }} />
                        <col style={{ width: "130px" }} />
                        <col style={{ width: "80px" }} />
                        <col style={{ width: "85px" }} />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="h-7">
                          <TableHead className="py-1">
                            <Checkbox
                              checked={filteredTransactionsForAssignment.length > 0 && filteredTransactionsForAssignment.every((t) => selectedIds.has(t.id))}
                              onCheckedChange={toggleSelectAll}
                              data-testid="checkbox-select-all"
                            />
                          </TableHead>
                          <TableHead 
                            className="py-1 cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort("date")}
                          >
                            <div className="flex items-center">
                              Data
                              {getSortIcon("date")}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="py-1 cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort("description")}
                          >
                            <div className="flex items-center">
                              Descricao
                              {getSortIcon("description")}
                            </div>
                          </TableHead>
                          <TableHead className="py-1">Orig.</TableHead>
                          <TableHead className="py-1">Pgto</TableHead>
                          <TableHead 
                            className="py-1 cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort("type")}
                          >
                            <div className="flex items-center">
                              Tipo
                              {getSortIcon("type")}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="py-1 cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort("status")}
                          >
                            <div className="flex items-center">
                              Status
                              {getSortIcon("status")}
                            </div>
                          </TableHead>
                          <TableHead className="py-1">Beneficiario</TableHead>
                          <TableHead className="py-1">Acoes</TableHead>
                          <TableHead 
                            className="py-1 text-right cursor-pointer hover:bg-muted/50"
                            onClick={() => handleSort("amount")}
                          >
                            <div className="flex items-center justify-end">
                              Valor
                              {getSortIcon("amount")}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTransactions.map((transaction) => {
                          const bankAccountName = getBankAccountName(transaction.bankAccountId);
                          return (
                            <TableRow key={transaction.id} className="h-8">
                              <TableCell className="py-0.5">
                                <Checkbox
                                  checked={selectedIds.has(transaction.id)}
                                  onCheckedChange={(checked) => toggleSelectOne(transaction.id, !!checked)}
                                  data-testid={`checkbox-select-${transaction.id}`}
                                />
                              </TableCell>
                              <TableCell className="py-0.5 text-xs whitespace-nowrap">
                                {formatDate(transaction.date)}
                              </TableCell>
                              <TableCell className="py-0.5 overflow-hidden truncate">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help text-xs">
                                      {transaction.shortTitle || transaction.description}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-[300px]">{transaction.originalDescription || transaction.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="py-0.5">
                                {getSourceIcon(transaction.source)}
                              </TableCell>
                              <TableCell className="py-0.5 text-xs truncate overflow-hidden">
                                {bankAccountName || "-"}
                              </TableCell>
                              <TableCell className="py-0.5">
                                <Badge variant={transaction.type === "receita" ? "default" : "secondary"} className="text-xs">
                                  {transaction.type === "receita" ? "R" : "D"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-0.5">
                                <Badge variant={transaction.status === "realizada" ? "default" : "outline"} className="text-xs">
                                  {transaction.status === "realizada" ? "Real" : "Prev"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-0.5 overflow-hidden">
                                <Select 
                                  value={selectedBeneficiaries[transaction.id] ?? (transaction.beneficiaryId ? String(transaction.beneficiaryId) : "")}
                                  onValueChange={(v) => setSelectedBeneficiaries((prev) => ({ ...prev, [transaction.id]: v }))}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs" data-testid={`select-beneficiary-${transaction.id}`}>
                                    <SelectValue placeholder="Selecione" />
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
                              </TableCell>
                              <TableCell className="py-0.5">
                                <div className="flex items-center gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleSingleBeneficiaryUpdate(transaction.id)}
                                    disabled={updateSingleBeneficiaryMutation.isPending || !selectedBeneficiaries[transaction.id]}
                                    data-testid={`button-update-beneficiary-${transaction.id}`}
                                  >
                                    <Check className="w-3.5 h-3.5 text-success" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleEditTx(transaction)}
                                    data-testid={`button-edit-tx-${transaction.id}`}
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-primary" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => { if (confirm("Excluir esta transacao?")) deleteTransactionMutation.mutate(transaction.id); }}
                                    data-testid={`button-delete-tx-${transaction.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className={`py-0.5 text-right font-medium text-sm whitespace-nowrap ${transaction.type === "receita" ? "text-success" : "text-destructive"}`}>
                                {transaction.type === "receita" ? "+" : "-"}{formatCurrency(transaction.amount)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="h-7 bg-muted/50 font-medium">
                          <TableCell className="py-0.5"></TableCell>
                          <TableCell colSpan={2} className="py-0.5 text-xs">
                            {filteredTransactionsForAssignment.length} transacao(oes)
                          </TableCell>
                          <TableCell colSpan={5} className="py-0.5"></TableCell>
                          <TableCell className="py-0.5"></TableCell>
                          <TableCell className="py-0.5 text-right text-xs whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-success">+{formatCurrency(filteredTotals.receitas)}</span>
                              <span className="text-destructive">-{formatCurrency(filteredTotals.despesas)}</span>
                              <span className={filteredSaldo >= 0 ? "text-success" : "text-destructive"}>={formatCurrency(filteredSaldo)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredTransactionsForAssignment.length)} de {filteredTransactionsForAssignment.length}
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
                        <span className="text-sm">
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
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graficos">
          <BeneficiaryCharts transactions={transactions} beneficiaries={beneficiaries} categories={categories} selectedMonth={selectedMonthGraficos} />
        </TabsContent>
      </Tabs>

      <Dialog open={editTxDialogOpen} onOpenChange={setEditTxDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Transacao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Descricao</Label>
              <Input
                value={editTxForm.shortTitle}
                onChange={(e) => setEditTxForm({ ...editTxForm, shortTitle: e.target.value })}
                data-testid="input-edit-tx-short-title"
              />
            </div>
            <div>
              <Label className="text-sm">Valor</Label>
              <Input
                value={editTxForm.amount}
                onChange={(e) => setEditTxForm({ ...editTxForm, amount: e.target.value })}
                type="number"
                step="0.01"
                data-testid="input-edit-tx-amount"
              />
            </div>
            <div>
              <Label className="text-sm">Tipo</Label>
              <Select value={editTxForm.type} onValueChange={(v: "receita" | "despesa") => setEditTxForm({ ...editTxForm, type: v })}>
                <SelectTrigger data-testid="select-edit-tx-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Data</Label>
              <Input
                value={editTxForm.date}
                onChange={(e) => setEditTxForm({ ...editTxForm, date: e.target.value })}
                type="date"
                data-testid="input-edit-tx-date"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTxDialogOpen(false)} data-testid="button-cancel-edit-tx">
                Cancelar
              </Button>
              <Button
                onClick={handleSaveTxEdit}
                disabled={updateTransactionMutation.isPending}
                data-testid="button-save-edit-tx"
              >
                {updateTransactionMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
