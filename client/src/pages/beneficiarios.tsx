import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { filterCardBillPayments } from "@/lib/utils";
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
import { Plus, Pencil, Trash2, Users, Star, Search, CreditCard, Building2, PenLine, CheckSquare, ArrowUpDown, ArrowUp, ArrowDown, X, Check, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell, LabelList, PieChart, Pie } from "recharts";
import type { Beneficiary, Transaction, BankAccount, Category, Subcategory, BudgetItem } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { ResizeHandle } from "@/components/resize-handle";
import { useColumnWidths } from "@/hooks/use-column-widths";

function formatCurrency(value: number | string) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

function formatDate(date: string) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

type SortColumn = "date" | "vencFat" | "description" | "source" | "bankAccount" | "type" | "status" | "category" | "subcategory" | "beneficiary" | "amount";
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
  if (t.paymentDate) {
    const d = new Date(t.paymentDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (t.source === "cartao" && t.cardBillMonth) return t.cardBillMonth;
  const dateStr = t.transactionDate || t.date;
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getBudgetItemMonth(bi: BudgetItem): string {
  if (bi.billDueDate) {
    const d = new Date(bi.billDueDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return bi.yearMonth;
}

function BeneficiaryCharts({ transactions, beneficiaries, categories, budgetItems, subcategories, currentYM, onDonutSliceClick, filterChartType, setFilterChartType, selectedChartBenef, setSelectedChartBenef, statusFilter, chartType }: {
  transactions: Transaction[];
  beneficiaries: Beneficiary[];
  categories: Category[];
  budgetItems: BudgetItem[];
  subcategories: Subcategory[];
  currentYM: string;
  onDonutSliceClick?: (categoryId: number | null, month: string | null) => void;
  filterChartType: "despesa" | "receita" | "all";
  setFilterChartType: (v: "despesa" | "receita" | "all") => void;
  selectedChartBenef: string | null;
  setSelectedChartBenef: (v: string | null) => void;
  statusFilter: "realizada" | "prevista" | "ambos";
  chartType: "absoluto" | "percentual";
}) {
  const [barOffset, setBarOffset] = useState<number | null>(null);
  const [donutOffset, setDonutOffset] = useState<number | null>(null);

  const benefMap = new Map<number, string>();
  for (const b of beneficiaries) benefMap.set(b.id, b.name);

  type DonutEntry = { name: string; value: number; count: number; color: string; catId: number };
  type DonutMonth = { month: string; label: string; data: DonutEntry[]; total: number; totalCount: number };

  const buildBarData = (
    txList: Transaction[],
    biList: BudgetItem[],
    fType: string,
    sFilter: "realizada" | "prevista" | "ambos"
  ) => {
    const monthSet = new Set<string>();
    const activeBenefIds = new Set<number>();
    const monthlyData = new Map<string, Map<number, { receitas: number; despesas: number; count: number }>>();

    const txWithBenef = txList.filter(t => t.beneficiaryId != null && (sFilter === "ambos" || t.status === sFilter));
    for (const t of txWithBenef) {
      const m = getTxMonth(t);
      monthSet.add(m);
    }

    const includeBudget = sFilter === "prevista" || sFilter === "ambos";
    const biWithBenef = includeBudget ? biList.filter(bi => bi.beneficiaryId != null) : [];
    for (const bi of biWithBenef) {
      const m = getBudgetItemMonth(bi);
      monthSet.add(m);
    }

    const sortedMonths = Array.from(monthSet).sort();
    for (const m of sortedMonths) monthlyData.set(m, new Map());

    for (const t of txWithBenef) {
      if (fType !== "all" && t.type !== fType) continue;
      const month = getTxMonth(t);
      if (!monthlyData.has(month)) continue;
      const bId = t.beneficiaryId!;
      activeBenefIds.add(bId);
      const mMap = monthlyData.get(month)!;
      if (!mMap.has(bId)) mMap.set(bId, { receitas: 0, despesas: 0, count: 0 });
      const entry = mMap.get(bId)!;
      const amt = Math.abs(parseFloat(String(t.amount)));
      if (t.type === "receita") entry.receitas += amt; else entry.despesas += amt;
      entry.count += 1;
    }

    for (const bi of biWithBenef) {
      if (fType !== "all" && bi.type !== fType) continue;
      const month = getBudgetItemMonth(bi);
      if (!monthlyData.has(month)) continue;
      const bId = bi.beneficiaryId!;
      activeBenefIds.add(bId);
      const mMap = monthlyData.get(month)!;
      if (!mMap.has(bId)) mMap.set(bId, { receitas: 0, despesas: 0, count: 0 });
      const entry = mMap.get(bId)!;
      const amt = Math.abs(parseFloat(String(bi.amount)));
      if (bi.type === "receita") entry.receitas += amt; else entry.despesas += amt;
      entry.count += 1;
    }

    const names = Array.from(activeBenefIds).map(id => benefMap.get(id) || `#${id}`);
    const sortedNames = [...names].sort();
    const colorMap = new Map<string, string>();
    sortedNames.forEach((name, i) => colorMap.set(name, BENEFICIARY_COLORS[i % BENEFICIARY_COLORS.length]));

    const data = sortedMonths.map(m => {
      const point: Record<string, number | string> = { month: getMonthLabel(m), _ym: m };
      const mMap = monthlyData.get(m)!;
      Array.from(mMap.entries()).forEach(([bId, vals]) => {
        const name = benefMap.get(bId) || `#${bId}`;
        const total = fType === "receita" ? vals.receitas : fType === "despesa" ? vals.despesas : vals.despesas + vals.receitas;
        if (total > 0) {
          point[name] = Math.round(total * 100) / 100;
          point[`_count_${name}`] = vals.count;
        }
      });
      return point;
    });

    const pctData = sortedMonths.map(m => {
      const point: Record<string, number | string> = { month: getMonthLabel(m), _ym: m };
      const mMap = monthlyData.get(m)!;
      let monthTotal = 0;
      Array.from(mMap.values()).forEach(vals => {
        monthTotal += fType === "receita" ? vals.receitas : fType === "despesa" ? vals.despesas : vals.despesas + vals.receitas;
      });
      if (monthTotal > 0) {
        Array.from(mMap.entries()).forEach(([bId, vals]) => {
          const name = benefMap.get(bId) || `#${bId}`;
          const total = fType === "receita" ? vals.receitas : fType === "despesa" ? vals.despesas : vals.despesas + vals.receitas;
          point[name] = Math.round((total / monthTotal) * 10000) / 100;
          point[`_count_${name}`] = vals.count;
        });
      }
      return point;
    });

    return { data, pctData, benefNames: sortedNames, colorMap, sortedMonths };
  };

  const barCombined = useMemo(() => buildBarData(transactions, budgetItems, filterChartType, statusFilter), [transactions, budgetItems, beneficiaries, filterChartType, currentYM, statusFilter]);

  const allBenefNames = barCombined.benefNames;

  const beneficiaryColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    allBenefNames.forEach((name, i) => colorMap.set(name, BENEFICIARY_COLORS[i % BENEFICIARY_COLORS.length]));
    return colorMap;
  }, [allBenefNames]);

  const buildDonutData = (months: string[], sFilter: "realizada" | "prevista" | "ambos"): DonutMonth[] => {
    const monthCatMap = new Map<string, Map<number, { total: number; count: number }>>();
    for (const m of months) monthCatMap.set(m, new Map());

    const txAll = transactions.filter(t => sFilter === "ambos" || t.status === sFilter);
    for (const t of txAll) {
      if (filterChartType !== "all" && t.type !== filterChartType) continue;
      if (selectedChartBenef) {
        const bName = benefMap.get(t.beneficiaryId!) || "";
        if (bName !== selectedChartBenef) continue;
      }
      const month = getTxMonth(t);
      if (!monthCatMap.has(month)) continue;
      const catId = t.categoryId;
      if (!catId) continue;
      const mMap = monthCatMap.get(month)!;
      const existing = mMap.get(catId) || { total: 0, count: 0 };
      existing.total += Math.abs(parseFloat(String(t.amount)));
      existing.count += 1;
      mMap.set(catId, existing);
    }

    const includeBudgetDonut = sFilter === "prevista" || sFilter === "ambos";
    if (includeBudgetDonut) {
      for (const bi of budgetItems) {
        if (filterChartType !== "all" && bi.type !== filterChartType) continue;
        if (selectedChartBenef) {
          const bName = benefMap.get(bi.beneficiaryId!) || "";
          if (bName !== selectedChartBenef) continue;
        }
        const month = getBudgetItemMonth(bi);
        if (!monthCatMap.has(month)) continue;
        const catId = bi.categoryId;
        if (!catId) continue;
        const mMap = monthCatMap.get(month)!;
        const existing = mMap.get(catId) || { total: 0, count: 0 };
        existing.total += Math.abs(parseFloat(String(bi.amount)));
        existing.count += 1;
        mMap.set(catId, existing);
      }
    }

    const result: DonutMonth[] = [];
    for (const m of months) {
      const mMap = monthCatMap.get(m)!;
      const entries = Array.from(mMap.entries())
        .map(([catId, { total, count }]) => {
          const cat = categories.find(c => c.id === catId);
          return { name: cat?.name || `#${catId}`, value: Math.round(total * 100) / 100, count, color: cat?.color || DONUT_COLORS[catId % DONUT_COLORS.length], catId };
        })
        .sort((a, b) => b.value - a.value);
      const total = entries.reduce((s, e) => s + e.value, 0);
      const totalCount = entries.reduce((s, e) => s + e.count, 0);
      result.push({ month: m, label: getMonthLabel(m), data: entries, total, totalCount });
    }
    return result;
  };

  const donutDataCombined = useMemo(() => buildDonutData(barCombined.sortedMonths, statusFilter), [transactions, budgetItems, categories, barCombined.sortedMonths, filterChartType, selectedChartBenef, currentYM, statusFilter]);

  const donutWindowSize = selectedChartBenef ? 6 : 3;

  const computeDonutNav = (donutData: DonutMonth[], offset: number | null) => {
    const months = donutData.map(d => d.month);
    if (months.length === 0) return { display: [] as string[], centerIdx: 0, maxNav: 0, effNav: 0, showAll: false };
    const showAll = !!selectedChartBenef && months.length <= donutWindowSize;
    if (showAll) return { display: months, centerIdx: 0, maxNav: 0, effNav: 0, showAll: true };
    let centerIdx = months.indexOf(currentYM);
    if (centerIdx === -1) {
      centerIdx = months.findIndex(m => m > currentYM);
      if (centerIdx === -1) centerIdx = months.length - 1;
      else if (centerIdx > 0) centerIdx = centerIdx - 1;
    }
    const maxNav = months.length - 1;
    const effNav = offset === null ? centerIdx : Math.max(0, Math.min(offset, maxNav));
    const half = Math.floor(donutWindowSize / 2);
    const startIdx = Math.max(0, effNav - half);
    const endIdx = Math.min(months.length, startIdx + donutWindowSize);
    const adjustedStart = Math.max(0, endIdx - donutWindowSize);
    return { display: months.slice(adjustedStart, endIdx), centerIdx, maxNav, effNav, showAll: false };
  };

  const donutDataWithData = selectedChartBenef ? donutDataCombined.filter(d => d.totalCount > 0) : donutDataCombined;

  const donutNav = useMemo(() => computeDonutNav(donutDataWithData, donutOffset), [donutDataWithData, currentYM, donutOffset, selectedChartBenef]);

  const currentDonuts = donutDataWithData.filter(d => donutNav.display.includes(d.month));

  const barWindowSize = 12;

  const computeBarNav = (data: Record<string, number | string>[], offset: number | null) => {
    const maxOff = Math.max(0, data.length - barWindowSize);
    const currentIdx = data.findIndex(d => d._ym === currentYM);
    const defaultOff = currentIdx === -1 ? maxOff : Math.max(0, Math.min(currentIdx - Math.floor(barWindowSize / 2), maxOff));
    const effOff = offset === null ? defaultOff : Math.min(offset, maxOff);
    return { maxOff, effOff };
  };

  const barNav = useMemo(() => computeBarNav(chartType === "absoluto" ? barCombined.data : barCombined.pctData, barOffset), [barCombined, chartType, barOffset, currentYM]);

  const displayData = (chartType === "absoluto" ? barCombined.data : barCombined.pctData).slice(barNav.effOff, barNav.effOff + barWindowSize);

  const handleBenefClick = (name: string) => {
    setSelectedChartBenef(selectedChartBenef === name ? null : name);
  };

  const customTooltip = (cType: string, dData: Record<string, number | string>[]) => ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const sorted = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
    const dataPoint = payload[0]?.payload || {};
    return (
      <div className="bg-popover border rounded-md p-2 shadow-md text-xs max-h-64 overflow-auto">
        <p className="font-medium mb-1">{label}</p>
        {sorted.map((entry: any) => {
          const cnt = dataPoint[`_count_${entry.dataKey}`] as number || 0;
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="flex-1 truncate">{entry.dataKey}</span>
              <span className="text-muted-foreground tabular-nums">{cnt} reg</span>
              <span className="font-medium tabular-nums">
                {cType === "percentual" ? `${entry.value?.toFixed(1)}%` : formatCurrency(entry.value || 0)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const donutTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-popover border rounded-md p-2 shadow-md text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d?.color }} />
          <span className="font-medium">{d?.name}</span>
        </div>
        <p className="mt-1">{formatCurrency(d?.value || 0)} ({d?.count || 0} reg.)</p>
      </div>
    );
  };

  const getBarLabel = (data: Record<string, number | string>[]) => {
    if (data.length === 0) return "";
    return `${data[0]?.month || ""} - ${data[data.length - 1]?.month || ""}`;
  };

  const getDonutLabel = (donuts: DonutMonth[]) => {
    if (donuts.length === 0) return "";
    const first = donuts[0]?.label || "";
    const last = donuts[donuts.length - 1]?.label || "";
    return first === last ? first : `${first} - ${last}`;
  };

  const renderBarChart = (
    title: string,
    displayData: Record<string, number | string>[],
    benefNames: string[],
    colorMap: Map<string, string>,
    navLabel: string,
    effOff: number,
    maxOff: number,
    setOffset: (v: number) => void,
    testPrefix: string
  ) => (
    <Card>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setOffset(Math.max(0, effOff - 12))} disabled={effOff <= 0} data-testid={`${testPrefix}-prev`}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[120px] text-center">{navLabel}</span>
            <Button size="icon" variant="ghost" onClick={() => setOffset(Math.min(maxOff, effOff + 12))} disabled={effOff >= maxOff} data-testid={`${testPrefix}-next`}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-1 pb-2">
        {displayData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={displayData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={chartType === "percentual" ? (v: number) => `${v}%` : (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                domain={chartType === "percentual" ? [0, 100] : undefined}
              />
              <RechartsTooltip content={customTooltip(chartType, displayData)} />
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
              {benefNames.map((name, idx) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="a"
                  fill={colorMap.get(name) || "#9CA3AF"}
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
                      const segCount = d[`_count_${name}`] as number || 0;
                      let monthTotal = 0;
                      for (const key of Object.keys(d)) {
                        if (key !== "month" && key !== "_ym" && !key.startsWith("_count_") && typeof d[key] === "number") monthTotal += d[key] as number;
                      }
                      const pct = monthTotal > 0 ? ((value as number / monthTotal) * 100).toFixed(0) : "0";
                      const valLabel = chartType === "percentual"
                        ? `${Number(value).toFixed(0)}%`
                        : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
                      const countLabel = `${segCount} reg`;
                      const cx = (x as number) + (width as number) / 2;
                      const cy = (y as number) + segH / 2;
                      if (chartType === "percentual") {
                        if (segH < 32) {
                          return <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={8} fontWeight={600}>{valLabel} ({countLabel})</text>;
                        }
                        return (
                          <g>
                            <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={600}>{valLabel}</text>
                            <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.8)" fontSize={8}>{countLabel}</text>
                          </g>
                        );
                      }
                      if (segH < 32) {
                        return <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={8} fontWeight={600}>{valLabel} ({countLabel})</text>;
                      }
                      if (segH < 44) {
                        return (
                          <g>
                            <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={600}>{valLabel}</text>
                            <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.8)" fontSize={8}>{pct}% | {countLabel}</text>
                          </g>
                        );
                      }
                      return (
                        <g>
                          <text x={cx} y={cy - 9} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={600}>{valLabel}</text>
                          <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.8)" fontSize={8}>{pct}%</text>
                          <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.7)" fontSize={7}>{countLabel}</text>
                        </g>
                      );
                    }}
                  />
                  {idx === benefNames.length - 1 && (
                    <LabelList
                      position="top"
                      content={({ x, y, width, index }: any) => {
                        if (index == null || !displayData[index]) return null;
                        const d = displayData[index];
                        let total = 0;
                        let totalCount = 0;
                        for (const key of Object.keys(d)) {
                          if (key.startsWith("_count_")) { totalCount += (d[key] as number); continue; }
                          if (key !== "month" && key !== "_ym" && typeof d[key] === "number") total += d[key] as number;
                        }
                        if (total <= 0) return null;
                        const valPart = chartType === "percentual"
                          ? `${Math.round(total)}%`
                          : total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(Math.round(total));
                        const label = `${valPart} (${totalCount})`;
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
  );

  const renderDonutCard = (donuts: DonutMonth[], navLabel: string, effNav: number, maxNav: number, setOffset: (v: number) => void, title: string, testPrefix: string, showAllMonths?: boolean, allDonutData?: DonutMonth[]) => {
    const totalSource = allDonutData || donuts;
    const donutTotal = totalSource.reduce((s, d) => s + d.total, 0);
    const donutTotalCount = totalSource.reduce((s, d) => s + d.totalCount, 0);
    const isCompact = donuts.length > 3;
    const pieH = isCompact ? 130 : 180;
    const innerR = isCompact ? 25 : 35;
    const outerR = isCompact ? 50 : 70;
    const gridCols = donuts.length <= 3 ? "grid-cols-3" : donuts.length <= 4 ? "grid-cols-4" : donuts.length <= 6 ? "grid-cols-3 xl:grid-cols-6" : "grid-cols-3 xl:grid-cols-6";
    return (
    <Card>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">
            {title}
            {selectedChartBenef && <span className="text-muted-foreground font-normal ml-2">({selectedChartBenef})</span>}
            {donuts.length > 0 && <span className="text-xs text-muted-foreground font-normal ml-2">- {formatCurrency(donutTotal)} ({donutTotalCount})</span>}
          </CardTitle>
          {!showAllMonths && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setOffset(Math.max(0, effNav - 1))} disabled={effNav <= 0} data-testid={`${testPrefix}-prev`}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[120px] text-center">{navLabel}</span>
            <Button size="icon" variant="ghost" onClick={() => setOffset(Math.min(maxNav, effNav + 1))} disabled={effNav >= maxNav} data-testid={`${testPrefix}-next`}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-1 pb-2">
        {donuts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
        ) : (
          <div className={`grid ${gridCols} gap-3`}>
            {donuts.map((donut) => (
              <div key={donut.month} className="rounded-md border p-3" data-testid={`${testPrefix}-card-${donut.month}`}>
                <div className="mb-1">
                  <p className="text-xs font-medium text-center">{donut.label}</p>
                  <p className="text-xs text-muted-foreground text-center">{formatCurrency(donut.total)} ({donut.totalCount})</p>
                </div>
                {donut.data.length === 0 ? (
                  <div style={{ height: pieH }} className="flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={pieH}>
                      <PieChart>
                        <Pie
                          data={donut.data}
                          cx="50%"
                          cy="50%"
                          innerRadius={innerR}
                          outerRadius={outerR}
                          dataKey="value"
                          nameKey="name"
                          stroke="none"
                          className="cursor-pointer"
                          onClick={(_: any, index: number) => {
                            const entry = donut.data[index];
                            if (entry && onDonutSliceClick) onDonutSliceClick(entry.catId, donut.month);
                          }}
                        >
                          {donut.data.map((entry: { color?: string }, i: number) => (
                            <Cell key={i} fill={entry.color || DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={donutTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-0.5 mt-1 px-2">
                      {donut.data.slice(0, isCompact ? 3 : 5).map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-[10px] cursor-pointer hover-elevate rounded-sm px-0.5"
                          onClick={() => onDonutSliceClick?.(entry.catId, donut.month)}
                          data-testid={`${testPrefix}-legend-${donut.month}-${entry.catId}`}
                        >
                          <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color || DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="flex-1 truncate">{entry.name}</span>
                          <span className="tabular-nums text-muted-foreground">{formatCurrency(entry.value)} ({entry.count})</span>
                        </div>
                      ))}
                      {donut.data.length > (isCompact ? 3 : 5) && (
                        <p className="text-[10px] text-muted-foreground text-center">+{donut.data.length - (isCompact ? 3 : 5)} mais</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
  };

  const typeLabel = filterChartType === "receita" ? "Receitas" : filterChartType === "despesa" ? "Despesas" : "Total";

  return (
    <div className="space-y-4">
      {selectedChartBenef && (
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-xs gap-1" style={{ borderColor: beneficiaryColorMap.get(selectedChartBenef) }}>
            {selectedChartBenef}
            <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedChartBenef(null)} />
          </Badge>
        </div>
      )}

      {allBenefNames.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {allBenefNames.map((name) => {
            const total = barCombined.data.reduce((sum, d) => sum + (typeof d[name] === "number" ? (d[name] as number) : 0), 0);
            const count = barCombined.data.reduce((sum, d) => sum + (typeof d[`_count_${name}`] === "number" ? (d[`_count_${name}`] as number) : 0), 0);
            const grandTotal = barCombined.data.reduce((sum, d) => {
              let rowTotal = 0;
              for (const key of Object.keys(d)) {
                if (key !== "month" && key !== "_ym" && !key.startsWith("_count_") && typeof d[key] === "number") rowTotal += d[key] as number;
              }
              return sum + rowTotal;
            }, 0);
            const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
            const isSelected = selectedChartBenef === name;
            return (
              <Card key={name} className={`cursor-pointer ${isSelected ? "ring-2 ring-primary" : ""}`} onClick={() => handleBenefClick(name)} data-testid={`card-beneficiary-chart-${name}`}>
                <CardContent className="py-2 px-3 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: beneficiaryColorMap.get(name) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% do total | {count} reg</p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{formatCurrency(total)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {renderBarChart(
        `${chartType === "absoluto" ? typeLabel : `% ${typeLabel}`} por Beneficiario`,
        displayData, barCombined.benefNames, beneficiaryColorMap,
        getBarLabel(displayData), barNav.effOff, barNav.maxOff,
        (v) => setBarOffset(v), "bar-combined"
      )}

      {renderDonutCard(
        currentDonuts, getDonutLabel(currentDonuts),
        donutNav.effNav, donutNav.maxNav,
        (v) => setDonutOffset(v),
        "Categorias por Mes", "donut-combined",
        donutNav.showAll, donutDataWithData
      )}
    </div>
  );
}

export default function Beneficiarios(props: { defaultTab?: "cadastro" | "visao-geral" } & Record<string, any>) {
  const defaultTab = props.defaultTab ?? "cadastro";
  const { toast } = useToast();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<string>(location === "/beneficiar" ? "visao-geral" : defaultTab);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);

  const [filterChartType, setFilterChartType] = useState<"despesa" | "receita" | "all">("all");
  const [selectedChartBenef, setSelectedChartBenef] = useState<string | null>(null);
  const [benefStatusFilter, setBenefStatusFilter] = useState<"realizada" | "prevista" | "ambos">("ambos");
  const [benefChartType, setBenefChartType] = useState<"absoluto" | "percentual">("absoluto");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBeneficiaryId, setBulkBeneficiaryId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const itemsPerPage = 10;

  const defaultColWidths = { checkbox: 36, dtTrans: 72, vencFat: 72, descricao: 0, orig: 44, pgto: 70, tipo: 44, status: 55, categoria: 90, subcategoria: 90, beneficiario: 130, acoes: 80, valor: 85 };
  const { colWidths, handleResizeStart } = useColumnWidths("beneficiarios", defaultColWidths);

  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "prevista" | "realizada">("all");
  const [filterSource, setFilterSource] = useState<"all" | "manual" | "cartao" | "conta_corrente">("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>("all");
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState<string>("all");
  const [filterBankAccountId, setFilterBankAccountId] = useState<string>("all");
  const currentYM = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(currentYM);
  const handleMonthChange = (month: string | null) => {
    setSelectedMonth(month);
    setCurrentPage(1);
  };

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

  const { data: budgetItems = [] } = useQuery<BudgetItem[]>({
    queryKey: ["/api/budget-items"],
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

  const updateBudgetBeneficiaryBatchMutation = useMutation({
    mutationFn: async ({ ids, beneficiaryId }: { ids: number[]; beneficiaryId: number | null }) => {
      return apiRequest("POST", "/api/budget-items/update-beneficiary-batch", { ids, beneficiaryId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-items"] });
      toast({ title: "Beneficiario atualizado nos itens de planejamento!" });
      setSelectedIds(new Set());
      setBulkBeneficiaryId("");
    },
    onError: () => {
      toast({ title: "Erro ao atualizar beneficiario nos itens de planejamento", variant: "destructive" });
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
      const allIds = new Set(unifiedRows.map((r) => r._id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectOne = (_id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(_id);
    } else {
      newSet.delete(_id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkBeneficiaryUpdate = () => {
    if (selectedIds.size === 0) {
      toast({ title: "Selecione pelo menos uma transacao", variant: "destructive" });
      return;
    }
    const txIds = Array.from(selectedIds)
      .filter(id => id.startsWith("t_"))
      .map(id => parseInt(id.slice(2)));
    const biIds = Array.from(selectedIds)
      .filter(id => id.startsWith("b_"))
      .map(id => parseInt(id.slice(2)));
    const beneficiaryId = bulkBeneficiaryId && bulkBeneficiaryId !== "none"
      ? parseInt(bulkBeneficiaryId)
      : null;
    if (txIds.length > 0) {
      updateBeneficiaryBatchMutation.mutate({
        ids: txIds,
        beneficiaryId
      });
    }
    if (biIds.length > 0) {
      updateBudgetBeneficiaryBatchMutation.mutate({
        ids: biIds,
        beneficiaryId
      });
    }
  };

  const visibleTransactions = filterCardBillPayments(transactions);
  const chartFilteredTransactions = benefStatusFilter === "prevista" ? [] : visibleTransactions
    .filter((t) => showAll || !t.beneficiaryId)
    .filter((t) => {
      if (filterChartType !== "all" && t.type !== filterChartType) return false;
      if (benefStatusFilter === "realizada" && t.status !== "realizada") return false;
      if (selectedChartBenef) {
        const bName = getBeneficiaryName(t.beneficiaryId);
        if (bName !== selectedChartBenef) return false;
      }
      return true;
    });
  const filteredTransactionsForAssignment = chartFilteredTransactions
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
      const matchesSource = filterSource === "all" || t.source === filterSource;
      const matchesCategory = filterCategoryId === "all" || (filterCategoryId === "empty" ? !t.categoryId : t.categoryId === Number(filterCategoryId));
      const matchesSubcategory = filterSubcategoryId === "all" || (filterSubcategoryId === "empty" ? !t.subcategoryId : t.subcategoryId === Number(filterSubcategoryId));
      const matchesBeneficiary = filterBeneficiaryId === "all" || (filterBeneficiaryId === "empty" ? !t.beneficiaryId : t.beneficiaryId === Number(filterBeneficiaryId));
      const matchesBankAccount = filterBankAccountId === "all" || t.bankAccountId === Number(filterBankAccountId);
      return matchesType && matchesStatus && matchesSource && matchesCategory && matchesSubcategory && matchesBeneficiary && matchesBankAccount;
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case "date":
          aVal = new Date(a.transactionDate || a.date).getTime();
          bVal = new Date(b.transactionDate || b.date).getTime();
          break;
        case "vencFat":
          aVal = a.paymentDate ? new Date(a.paymentDate).getTime() : 0;
          bVal = b.paymentDate ? new Date(b.paymentDate).getTime() : 0;
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
        case "bankAccount":
          aVal = (getBankAccountName(a.bankAccountId) || "").toLowerCase();
          bVal = (getBankAccountName(b.bankAccountId) || "").toLowerCase();
          break;
        case "category":
          aVal = (categories.find(c => c.id === a.categoryId)?.name || "").toLowerCase();
          bVal = (categories.find(c => c.id === b.categoryId)?.name || "").toLowerCase();
          break;
        case "subcategory":
          aVal = (subcategories.find(s => s.id === a.subcategoryId)?.name || "").toLowerCase();
          bVal = (subcategories.find(s => s.id === b.subcategoryId)?.name || "").toLowerCase();
          break;
        case "beneficiary":
          aVal = (getBeneficiaryName(a.beneficiaryId) || "").toLowerCase();
          bVal = (getBeneficiaryName(b.beneficiaryId) || "").toLowerCase();
          break;
        default:
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  const filteredBudgetItems = useMemo(() => {
    if (benefStatusFilter !== "prevista" && benefStatusFilter !== "ambos") return [];
    return budgetItems.filter(bi => {
      if (filterChartType !== "all" && bi.type !== filterChartType) return false;
      if (selectedChartBenef) {
        const bName = getBeneficiaryName(bi.beneficiaryId);
        if (bName !== selectedChartBenef) return false;
      }
      return true;
    });
  }, [budgetItems, filterChartType, selectedChartBenef, benefStatusFilter]);

  const allBenefTotals = useMemo(() => {
    const includeTx = benefStatusFilter !== "prevista";
    const includeBi = benefStatusFilter !== "realizada";
    const allMatchingTx = includeTx ? visibleTransactions.filter((t) => {
      if (filterChartType !== "all" && t.type !== filterChartType) return false;
      if (benefStatusFilter === "realizada" && t.status !== "realizada") return false;
      if (selectedChartBenef) {
        const bName = getBeneficiaryName(t.beneficiaryId);
        if (bName !== selectedChartBenef) return false;
      }
      return true;
    }) : [];
    const baseTx = selectedMonth
      ? allMatchingTx.filter(t => t.date.substring(0, 7) === selectedMonth)
      : allMatchingTx;
    const baseBi = includeBi ? (selectedMonth
      ? filteredBudgetItems.filter(bi => getBudgetItemMonth(bi) === selectedMonth)
      : filteredBudgetItems) : [];
    let receitas = 0, despesas = 0, countRec = 0, countDesp = 0;
    for (const t of baseTx) {
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : Math.abs(t.amount);
      if (t.type === "receita") { receitas += Math.abs(amount); countRec++; }
      else { despesas += Math.abs(amount); countDesp++; }
    }
    for (const bi of baseBi) {
      const amount = Math.abs(parseFloat(String(bi.amount)));
      if (bi.type === "receita") { receitas += amount; countRec++; }
      else { despesas += amount; countDesp++; }
    }
    return { receitas, despesas, saldo: receitas - despesas, countRec, countDesp, total: baseTx.length + baseBi.length };
  }, [visibleTransactions, filteredBudgetItems, selectedMonth, filterChartType, benefStatusFilter, selectedChartBenef]);

  const filteredBudgetForTable = useMemo(() => {
    if (filterStatus === "realizada") return [];
    if (filterSource !== "all" && filterSource !== "manual") return [];
    if (filterBankAccountId !== "all") return [];
    return filteredBudgetItems.filter(bi => {
      if (selectedMonth && getBudgetItemMonth(bi) !== selectedMonth) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const amountStr = Math.abs(Number(bi.amount)).toFixed(2);
        const amountFormatted = amountStr.replace(".", ",");
        if (!(bi.description.toLowerCase().includes(search) ||
          (bi.shortTitle && bi.shortTitle.toLowerCase().includes(search)) ||
          amountStr.includes(searchTerm) || amountFormatted.includes(searchTerm))) return false;
      }
      if (filterType !== "all" && bi.type !== filterType) return false;
      if (filterCategoryId !== "all" && (filterCategoryId === "empty" ? !!bi.categoryId : bi.categoryId !== Number(filterCategoryId))) return false;
      if (filterSubcategoryId !== "all" && (filterSubcategoryId === "empty" ? !!bi.subcategoryId : bi.subcategoryId !== Number(filterSubcategoryId))) return false;
      if (filterBeneficiaryId !== "all" && (filterBeneficiaryId === "empty" ? !!bi.beneficiaryId : bi.beneficiaryId !== Number(filterBeneficiaryId))) return false;
      return true;
    });
  }, [filteredBudgetItems, selectedMonth, searchTerm, filterType, filterStatus, filterSource, filterCategoryId, filterSubcategoryId, filterBeneficiaryId, filterBankAccountId]);

  const filteredTotals = useMemo(() => {
    let receitas = 0, despesas = 0, countRec = 0, countDesp = 0;
    for (const t of filteredTransactionsForAssignment) {
      const amount = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
      if (t.type === "receita") { receitas += Math.abs(amount); countRec++; }
      else { despesas += Math.abs(amount); countDesp++; }
    }
    for (const bi of filteredBudgetForTable) {
      const amount = Math.abs(parseFloat(String(bi.amount)));
      if (bi.type === "receita") { receitas += amount; countRec++; }
      else { despesas += amount; countDesp++; }
    }
    return { receitas, despesas, countRec, countDesp };
  }, [filteredTransactionsForAssignment, filteredBudgetForTable]);
  const filteredSaldo = filteredTotals.receitas - filteredTotals.despesas;
  const isFiltered = filterType !== "all" || filterStatus !== "all" || filterSource !== "all" || filterCategoryId !== "all" || filterSubcategoryId !== "all" || filterBeneficiaryId !== "all" || filterBankAccountId !== "all" || !!searchTerm;

  type UnifiedRow = {
    _kind: "transaction" | "budget";
    _id: string;
    id: number;
    date: string;
    transactionDate: string | null;
    paymentDate: string | null;
    shortTitle: string | null;
    description: string;
    originalDescription: string | null;
    type: string;
    status: string;
    source: string | null;
    categoryId: number | null;
    subcategoryId: number | null;
    beneficiaryId: number | null;
    bankAccountId: number | null;
    amount: string;
    installmentCurrent: number | null;
    installmentTotal: number | null;
    isRecurring: boolean;
    original: Transaction | BudgetItem;
  };

  const unifiedRows = useMemo(() => {
    const rows: UnifiedRow[] = [];
    for (const t of filteredTransactionsForAssignment) {
      rows.push({
        _kind: "transaction",
        _id: `t_${t.id}`,
        id: t.id,
        date: t.date,
        transactionDate: t.transactionDate || t.date,
        paymentDate: t.paymentDate || t.cardBillMonth || null,
        shortTitle: t.shortTitle,
        description: t.description,
        originalDescription: t.originalDescription,
        type: t.type,
        status: t.status || "realizada",
        source: t.source || "manual",
        categoryId: t.categoryId,
        subcategoryId: t.subcategoryId,
        beneficiaryId: t.beneficiaryId,
        bankAccountId: t.bankAccountId,
        amount: String(Math.abs(parseFloat(String(t.amount)))),
        installmentCurrent: t.installmentCurrent,
        installmentTotal: t.installmentTotal,
        isRecurring: t.isRecurring || false,
        original: t,
      });
    }
    for (const bi of filteredBudgetForTable) {
      rows.push({
        _kind: "budget",
        _id: `b_${bi.id}`,
        id: bi.id,
        date: bi.transactionDate || bi.yearMonth + "-01",
        transactionDate: bi.transactionDate,
        paymentDate: bi.billDueDate,
        shortTitle: bi.shortTitle,
        description: bi.description,
        originalDescription: null,
        type: bi.type,
        status: "prevista",
        source: bi.source || "manual",
        categoryId: bi.categoryId,
        subcategoryId: bi.subcategoryId,
        beneficiaryId: bi.beneficiaryId,
        bankAccountId: null,
        amount: String(Math.abs(parseFloat(String(bi.amount)))),
        installmentCurrent: bi.installmentCurrent,
        installmentTotal: bi.installmentTotal,
        isRecurring: bi.isRecurring || false,
        original: bi,
      });
    }

    rows.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case "date":
          aVal = a.transactionDate || a.date; bVal = b.transactionDate || b.date; break;
        case "vencFat":
          aVal = a.paymentDate || ""; bVal = b.paymentDate || ""; break;
        case "description":
          aVal = (a.shortTitle || a.description).toLowerCase();
          bVal = (b.shortTitle || b.description).toLowerCase(); break;
        case "source":
          aVal = a.source || ""; bVal = b.source || ""; break;
        case "bankAccount":
          aVal = getBankAccountName(a.bankAccountId) || ""; bVal = getBankAccountName(b.bankAccountId) || ""; break;
        case "type":
          aVal = a.type; bVal = b.type; break;
        case "status":
          aVal = a.status; bVal = b.status; break;
        case "category":
          aVal = categories.find(c => c.id === a.categoryId)?.name || "";
          bVal = categories.find(c => c.id === b.categoryId)?.name || ""; break;
        case "subcategory":
          aVal = subcategories.find(s => s.id === a.subcategoryId)?.name || "";
          bVal = subcategories.find(s => s.id === b.subcategoryId)?.name || ""; break;
        case "beneficiary":
          aVal = beneficiaries.find(bn => bn.id === a.beneficiaryId)?.name || "";
          bVal = beneficiaries.find(bn => bn.id === b.beneficiaryId)?.name || ""; break;
        case "amount":
          aVal = parseFloat(a.amount); bVal = parseFloat(b.amount); break;
        default:
          aVal = a.date; bVal = b.date;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [filteredTransactionsForAssignment, filteredBudgetForTable, sortColumn, sortDirection, categories, subcategories, beneficiaries]);

  const totalPages = Math.max(1, Math.ceil(unifiedRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return unifiedRows.slice(start, start + itemsPerPage);
  }, [unifiedRows, currentPage]);

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
        selectedMonth={activeTab === "visao-geral" ? selectedMonth : undefined}
        onMonthChange={activeTab === "visao-geral" ? handleMonthChange : undefined}
      >
        {activeTab === "visao-geral" && (
          <>
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] text-muted-foreground leading-none">Visao</label>
              <Select value={benefStatusFilter} onValueChange={(v) => setBenefStatusFilter(v as any)}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="select-benef-status-filter">
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
              <label className="text-[9px] text-muted-foreground leading-none">Visualizacao</label>
              <Select value={benefChartType} onValueChange={(v: "absoluto" | "percentual") => setBenefChartType(v)}>
                <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-benef-chart-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absoluto">Valores (R$)</SelectItem>
                  <SelectItem value="percentual">% Percentual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] text-muted-foreground leading-none">Tipo</label>
              <Select value={filterChartType} onValueChange={(v: "despesa" | "receita" | "all") => setFilterChartType(v)}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="select-benef-filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="despesa">Despesas</SelectItem>
                  <SelectItem value="receita">Receitas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={showAll ? "default" : "outline"}
              size="sm"
              onClick={() => { setShowAll(!showAll); setCurrentPage(1); }}
              data-testid="button-show-all"
            >
              {showAll ? "Todas" : "Sem Benef."}
            </Button>
          </>
        )}
      </PageHeader>
      <div className="px-4 py-3 space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList>
          <TabsTrigger value="cadastro" data-testid="tab-cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="visao-geral" data-testid="tab-visao-geral">
            Visao Geral
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

        <TabsContent value="visao-geral">
          <div className="space-y-3">
            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                    <span className="text-xs font-medium">Receitas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-success" data-testid="text-total-receitas">{formatCurrency(filteredTotals.receitas)}</span>
                    <span className="text-xs text-muted-foreground">({filteredTotals.countRec})</span>
                  </div>
                  {isFiltered && (
                    <div className="text-[10px] text-muted-foreground">de {formatCurrency(allBenefTotals.receitas)} ({allBenefTotals.countRec})</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-medium">Despesas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-destructive" data-testid="text-total-despesas">{formatCurrency(filteredTotals.despesas)}</span>
                    <span className="text-xs text-muted-foreground">({filteredTotals.countDesp})</span>
                  </div>
                  {isFiltered && (
                    <div className="text-[10px] text-muted-foreground">de {formatCurrency(allBenefTotals.despesas)} ({allBenefTotals.countDesp})</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">Saldo</span>
                  </div>
                  <span className={`text-lg font-bold ${filteredSaldo >= 0 ? "text-success" : "text-destructive"}`} data-testid="text-saldo">{formatCurrency(filteredSaldo)}</span>
                  {isFiltered && (
                    <div className="text-[10px] text-muted-foreground">de {formatCurrency(allBenefTotals.saldo)}</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">Transacoes</span>
                  </div>
                  <span className="text-lg font-bold" data-testid="text-count">{filteredTransactionsForAssignment.length + filteredBudgetForTable.length}</span>
                  {isFiltered && (
                    <span className="text-[10px] text-muted-foreground ml-1">de {allBenefTotals.total}</span>
                  )}
                </CardContent>
              </Card>
            </div>

            <BeneficiaryCharts
              transactions={transactions}
              beneficiaries={beneficiaries}
              categories={categories}
              budgetItems={budgetItems}
              subcategories={subcategories}
              currentYM={currentYM}
              filterChartType={filterChartType}
              setFilterChartType={setFilterChartType}
              selectedChartBenef={selectedChartBenef}
              setSelectedChartBenef={setSelectedChartBenef}
              statusFilter={benefStatusFilter}
              chartType={benefChartType}
              onDonutSliceClick={(categoryId, month) => {
                if (categoryId !== null) {
                  setFilterCategoryId(String(categoryId));
                }
                if (month) {
                  setSelectedMonth(month);
                }
                setCurrentPage(1);
              }}
            />

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
                    <Label className="text-xs text-muted-foreground">Origem</Label>
                    <Select value={filterSource} onValueChange={(v) => { setFilterSource(v as any); setCurrentPage(1); }}>
                      <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="filter-source">
                        <SelectValue placeholder="Origem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="cartao">Cartao</SelectItem>
                        <SelectItem value="conta_corrente">Cta Corrente</SelectItem>
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
                  {(filterSource !== "all" || filterCategoryId !== "all" || filterSubcategoryId !== "all" || filterBeneficiaryId !== "all" || filterBankAccountId !== "all") && (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setFilterSource("all"); setFilterCategoryId("all"); setFilterSubcategoryId("all"); setFilterBeneficiaryId("all"); setFilterBankAccountId("all"); setCurrentPage(1); }} data-testid="button-clear-filters">
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
                        disabled={updateBeneficiaryBatchMutation.isPending || updateBudgetBeneficiaryBatchMutation.isPending || !bulkBeneficiaryId}
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
                          <col style={{ width: colWidths.checkbox ? `${colWidths.checkbox}px` : "36px" }} />
                          <col style={{ width: colWidths.dtTrans ? `${colWidths.dtTrans}px` : "72px" }} />
                          <col style={{ width: colWidths.vencFat ? `${colWidths.vencFat}px` : "72px" }} />
                          <col style={colWidths.descricao ? { width: `${colWidths.descricao}px` } : undefined} />
                          <col style={{ width: colWidths.orig ? `${colWidths.orig}px` : "44px" }} />
                          <col style={{ width: colWidths.pgto ? `${colWidths.pgto}px` : "70px" }} />
                          <col style={{ width: colWidths.tipo ? `${colWidths.tipo}px` : "44px" }} />
                          <col style={{ width: colWidths.status ? `${colWidths.status}px` : "55px" }} />
                          <col style={{ width: colWidths.categoria ? `${colWidths.categoria}px` : "90px" }} />
                          <col style={{ width: colWidths.subcategoria ? `${colWidths.subcategoria}px` : "90px" }} />
                          <col style={{ width: colWidths.beneficiario ? `${colWidths.beneficiario}px` : "130px" }} />
                          <col style={{ width: colWidths.acoes ? `${colWidths.acoes}px` : "80px" }} />
                          <col style={{ width: colWidths.valor ? `${colWidths.valor}px` : "85px" }} />
                        </colgroup>
                        <TableHeader>
                          <TableRow className="h-7">
                            <TableHead className="py-1">
                              <Checkbox
                                checked={unifiedRows.length > 0 && unifiedRows.every((r) => selectedIds.has(r._id))}
                                onCheckedChange={toggleSelectAll}
                                data-testid="checkbox-select-all"
                              />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("date")}>
                              <div className="flex items-center">Dt.Trans.{getSortIcon("date")}</div>
                              <ResizeHandle col="dtTrans" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("vencFat")}>
                              <div className="flex items-center">Venc.Fat.{getSortIcon("vencFat")}</div>
                              <ResizeHandle col="vencFat" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("description")}>
                              <div className="flex items-center">Descricao{getSortIcon("description")}</div>
                              <ResizeHandle col="descricao" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("source")}>
                              <div className="flex items-center">Orig.{getSortIcon("source")}</div>
                              <ResizeHandle col="orig" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("bankAccount")}>
                              <div className="flex items-center">Pgto{getSortIcon("bankAccount")}</div>
                              <ResizeHandle col="pgto" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("type")}>
                              <div className="flex items-center">Tipo{getSortIcon("type")}</div>
                              <ResizeHandle col="tipo" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("status")}>
                              <div className="flex items-center">Visao{getSortIcon("status")}</div>
                              <ResizeHandle col="status" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("category")}>
                              <div className="flex items-center">Cat.{getSortIcon("category")}</div>
                              <ResizeHandle col="categoria" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("subcategory")}>
                              <div className="flex items-center">Subcateg.{getSortIcon("subcategory")}</div>
                              <ResizeHandle col="subcategoria" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative cursor-pointer hover:bg-muted/50" onClick={() => handleSort("beneficiary")}>
                              <div className="flex items-center">Beneficiario{getSortIcon("beneficiary")}</div>
                              <ResizeHandle col="beneficiario" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative">
                              Acoes
                              <ResizeHandle col="acoes" onResizeStart={handleResizeStart} />
                            </TableHead>
                            <TableHead className="py-1 relative text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort("amount")}>
                              <div className="flex items-center justify-end">Valor{getSortIcon("amount")}</div>
                              <ResizeHandle col="valor" onResizeStart={handleResizeStart} />
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRows.map((row) => {
                            const bankAccountName = getBankAccountName(row.bankAccountId);
                            return (
                              <TableRow key={row._id} className="h-8">
                                <TableCell className="py-0.5">
                                  <Checkbox
                                    checked={selectedIds.has(row._id)}
                                    onCheckedChange={(checked) => toggleSelectOne(row._id, !!checked)}
                                    data-testid={`checkbox-select-${row._id}`}
                                  />
                                </TableCell>
                                <TableCell className="py-0.5 text-xs whitespace-nowrap">
                                  {formatDate(row.transactionDate || row.date)}
                                </TableCell>
                                <TableCell className="py-0.5 text-xs whitespace-nowrap">
                                  {row.paymentDate ? formatDate(row.paymentDate) : "-"}
                                </TableCell>
                                <TableCell className="py-0.5 overflow-hidden truncate">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help text-xs">
                                        {row.shortTitle || row.description}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="max-w-[300px]">{row.originalDescription || row.description}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                                <TableCell className="py-0.5">
                                  {getSourceIcon(row.source)}
                                </TableCell>
                                <TableCell className="py-0.5 text-xs truncate overflow-hidden">
                                  {bankAccountName || "-"}
                                </TableCell>
                                <TableCell className="py-0.5">
                                  <Badge variant={row.type === "receita" ? "default" : "secondary"} className="text-xs">
                                    {row.type === "receita" ? "R" : "D"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-0.5">
                                  {row._kind === "budget" ? (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950">
                                      Plan
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950">
                                      Real
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="py-0.5 text-xs truncate overflow-hidden">
                                  {categories.find(c => c.id === row.categoryId)?.name || "-"}
                                </TableCell>
                                <TableCell className="py-0.5 text-xs truncate overflow-hidden">
                                  {subcategories.find(s => s.id === row.subcategoryId)?.name || "-"}
                                </TableCell>
                                <TableCell className="py-0.5 overflow-hidden">
                                  {row._kind === "transaction" ? (
                                    <Select
                                      value={selectedBeneficiaries[row.id] ?? (row.beneficiaryId ? String(row.beneficiaryId) : "")}
                                      onValueChange={(v) => setSelectedBeneficiaries((prev) => ({ ...prev, [row.id]: v }))}
                                    >
                                      <SelectTrigger className="w-full h-8 text-xs" data-testid={`select-beneficiary-${row._id}`}>
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
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {beneficiaries.find(bn => bn.id === row.beneficiaryId)?.name || "-"}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="py-0.5">
                                  {row._kind === "transaction" ? (
                                    <div className="flex items-center gap-0.5">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleSingleBeneficiaryUpdate(row.id)}
                                        disabled={updateSingleBeneficiaryMutation.isPending || !selectedBeneficiaries[row.id]}
                                        data-testid={`button-update-beneficiary-${row._id}`}
                                      >
                                        <Check className="w-3.5 h-3.5 text-success" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleEditTx(row.original as Transaction)}
                                        data-testid={`button-edit-tx-${row._id}`}
                                      >
                                        <Pencil className="w-3.5 h-3.5 text-primary" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => { if (confirm("Excluir esta transacao?")) deleteTransactionMutation.mutate(row.id); }}
                                        data-testid={`button-delete-tx-${row._id}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className={`py-0.5 text-right font-medium text-sm whitespace-nowrap ${row.type === "receita" ? "text-success" : "text-destructive"}`}>
                                  {row.type === "receita" ? "+" : "-"}{formatCurrency(row.amount)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="h-7 bg-muted/50 font-medium">
                            <TableCell className="py-0.5"></TableCell>
                            <TableCell colSpan={3} className="py-0.5 text-xs">
                              Pag. {currentPage}/{totalPages} ({unifiedRows.length} registros, {filteredTotals.countRec} receitas, {filteredTotals.countDesp} despesas)
                            </TableCell>
                            <TableCell colSpan={8} className="py-0.5"></TableCell>
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

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, unifiedRows.length)} de {unifiedRows.length}
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
          </div>
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
