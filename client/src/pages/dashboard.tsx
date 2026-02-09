import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Wallet,
  Receipt,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CreditCard,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  PenLine,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CategoryIcon } from "@/components/category-icon";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, LineChart, Line, LabelList } from "recharts";
import type { Transaction, Category, Subcategory } from "@shared/schema";

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

function shiftMonth(refMonth: string, offset: number): string {
  const [year, month] = refMonth.split('-').map(Number);
  let newMonth = month - 1 + offset;
  let newYear = year;
  while (newMonth < 0) { newMonth += 12; newYear--; }
  while (newMonth > 11) { newMonth -= 12; newYear++; }
  return `${newYear}-${String(newMonth + 1).padStart(2, '0')}`;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function SummaryCard({
  title,
  icon: Icon,
  items,
  variant,
}: {
  title: string;
  icon: React.ElementType;
  items: { label: string; value: number; isPrimary?: boolean }[];
  variant: "success" | "danger";
}) {
  const iconColor = variant === "success" ? "text-success" : "text-destructive";
  const primaryColor = variant === "success" ? "text-success" : "text-destructive";

  return (
    <Card>
      <CardContent className="p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          <span className="text-xs font-medium">{title}</span>
        </div>
        <div className="space-y-0.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className={`text-xs font-semibold ${item.isPrimary ? primaryColor : ""}`}>
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: "up" | "down";
  trendValue?: string;
  variant?: "default" | "success" | "danger" | "warning";
}) {
  const variantStyles = {
    default: "text-primary",
    success: "text-success",
    danger: "text-destructive",
    warning: "text-warning",
  };

  return (
    <Card>
      <CardContent className="p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon className={`w-3.5 h-3.5 ${variantStyles[variant]}`} />
            <span className="text-xs text-muted-foreground">{title}</span>
          </div>
          <span className={`text-sm font-bold ${variantStyles[variant]}`}>{value}</span>
        </div>
      </CardContent>
    </Card>
  );
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
  const [refMonth, setRefMonth] = useState(defaultRefMonth);

  const statsUrl = `/api/dashboard/stats?refMonth=${refMonth}`;
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: [statsUrl],
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
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

  // Extrair mês/ano de um label do gráfico (ex: "Jan", "Jan/2025")
  const parseMonthLabel = (label: string): { monthIndex: number; year: number } | null => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const parts = label.split('/');
    const monthName = parts[0];
    const monthIdx = monthNames.indexOf(monthName);
    if (monthIdx < 0) return null;
    const year = parts.length > 1 ? parseInt(parts[1]) : parseInt(refMonth.split('-')[0]);
    return { monthIndex: monthIdx, year };
  };

  // Filtrar transações baseado na seleção do gráfico
  const filteredTransactions = transactions.filter((t) => {
    if (!selectedFilter.type) return false;
    if (t.isCardBillPayment) return false;
    
    if (selectedFilter.type === "category" && selectedFilter.category) {
      const category = categories.find((c) => c.name === selectedFilter.category);
      return category && t.categoryId === category.id && t.type === "despesa";
    }
    
    if (selectedFilter.type === "month" && selectedFilter.month) {
      const parsed = parseMonthLabel(selectedFilter.month);
      if (!parsed) return false;
      
      const targetYM = `${parsed.year}-${String(parsed.monthIndex + 1).padStart(2, '0')}`;
      
      if (t.source === "cartao" && t.cardBillMonth) {
        return t.cardBillMonth === targetYM;
      } else {
        const date = new Date(t.date);
        return date.getMonth() === parsed.monthIndex && date.getFullYear() === parsed.year;
      }
    }
    
    return false;
  });

  const monthTransactions = transactions.filter((t) => {
    if (t.isCardBillPayment) return false;
    if (t.source === "cartao" && t.cardBillMonth) {
      return t.cardBillMonth === refMonth;
    }
    const date = new Date(t.date);
    const [y, m] = refMonth.split('-').map(Number);
    return date.getFullYear() === y && date.getMonth() === m - 1;
  });

  const displayTransactions = selectedFilter.type ? filteredTransactions : monthTransactions;

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "-";
    return categories.find((c) => c.id === categoryId)?.name || "-";
  };

  const getSubcategoryName = (subcategoryId: number | null) => {
    if (!subcategoryId) return "-";
    return subcategories.find((s) => s.id === subcategoryId)?.name || "-";
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR");

  const handlePieClick = (data: { name: string }) => {
    setSelectedFilter({ type: "category", category: data.name });
  };

  const handleLineClick = (month: string, category?: string) => {
    if (category) {
      setSelectedFilter({ type: "category", category, month });
    } else {
      setSelectedFilter({ type: "month", month });
    }
  };

  const clearFilter = () => {
    setSelectedFilter({ type: null });
  };

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

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Visao Realizado" subtitle="Visao geral das suas financas" />
        <div className="px-4 py-3 grid gap-2 grid-cols-2 lg:grid-cols-5">
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
      <PageHeader title="Visao Realizado" subtitle="Visao geral das suas financas">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setRefMonth(shiftMonth(refMonth, -1))}
          data-testid="button-prev-month"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Badge variant="outline" className="text-xs min-w-[140px] justify-center">
          <Calendar className="w-3 h-3 mr-1" />
          {getRefMonthLabel(refMonth)}
        </Badge>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setRefMonth(shiftMonth(refMonth, 1))}
          data-testid="button-next-month"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        {!isCurrentMonth && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefMonth(defaultRefMonth)}
            data-testid="button-current-month"
          >
            Hoje
          </Button>
        )}
      </PageHeader>
      <div className="px-4 py-3 space-y-3">

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          title="Receitas"
          icon={TrendingUp}
          variant="success"
          items={[
            { label: "Previstas", value: data.receitasPrevistas || 0 },
            { label: "Realizadas", value: data.receitasRealizadas || data.totalReceitas, isPrimary: true },
          ]}
        />
        <SummaryCard
          title="Despesas"
          icon={TrendingDown}
          variant="danger"
          items={[
            { label: "Previstas", value: data.despesasPrevistas || 0 },
            { label: "Realizadas", value: data.despesasRealizadas || data.totalDespesas, isPrimary: true },
          ]}
        />
        <Card>
          <CardContent className="p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">Saldo Acumulado</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-center">
                <span data-testid="text-saldo-acumulado" className={`text-sm font-bold ${data.saldoAcumulado >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(data.saldoAcumulado)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-0.5 bg-muted/50 -mx-2 px-2 py-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">Saldo Anterior</span>
                <span data-testid="text-saldo-anterior" className={`text-[10px] font-semibold ${data.saldoAnterior >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(data.saldoAnterior)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Resultado Mes</span>
                <span data-testid="text-saldo-mes" className={`text-[10px] font-semibold ${data.saldo >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(data.saldo)}
                </span>
              </div>
              {data.saldoExtrato !== null && (
                <div className="flex items-center justify-between border-t pt-0.5">
                  <span className="text-[10px] text-muted-foreground">Saldo Extrato</span>
                  <span data-testid="text-saldo-extrato" className={`text-[10px] font-semibold ${data.saldoExtrato >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(data.saldoExtrato)}
                  </span>
                </div>
              )}
              {pendingImportCount > 0 && (
                <Link href="/pendencias-importacao">
                  <div className="flex items-center justify-center gap-1 border-t pt-0.5 cursor-pointer" data-testid="link-import-pendencies">
                    <AlertTriangle className="w-3 h-3 text-warning" />
                    <span className="text-[10px] text-warning font-medium">{pendingImportCount} importacao(oes) pendente(s)</span>
                  </div>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
        <StatCard
          title="Pendentes"
          value={String(data.contasPendentes)}
          icon={Receipt}
          variant={data.contasVencidas > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Vencidas"
          value={String(data.contasVencidas)}
          icon={AlertCircle}
          variant={data.contasVencidas > 0 ? "danger" : "default"}
        />
      </div>

      {data.contasVencidas > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="p-2 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
            <p className="text-xs">
              <strong>{data.contasVencidas}</strong> conta(s) vencida(s) - regularize para evitar juros.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2 grid-cols-2">
        <Card data-testid="card-planejamento">
          <CardContent className="p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Planejamento (Previsto)</span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Receitas</span>
                <span className="text-xs font-semibold text-success">+ {formatCurrency(data.receitasPrevistas || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Despesas</span>
                <span className="text-xs font-semibold text-destructive">- {formatCurrency(data.despesasPrevistas || 0)}</span>
              </div>
              <div className="border-t pt-0.5 flex items-center justify-between">
                <span className="text-xs font-medium">Saldo</span>
                <span className={`text-xs font-bold ${(data.receitasPrevistas - data.despesasPrevistas) >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency((data.receitasPrevistas || 0) - (data.despesasPrevistas || 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-realizacao">
          <CardContent className="p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Realizacao (Efetivo)</span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Receitas</span>
                <span className="text-xs font-semibold text-success">+ {formatCurrency(data.receitasRealizadas || data.totalReceitas)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Despesas</span>
                <span className="text-xs font-semibold text-destructive">- {formatCurrency(data.despesasRealizadas || data.totalDespesas)}</span>
              </div>
              <div className="border-t pt-0.5 flex items-center justify-between">
                <span className="text-xs font-medium">Saldo</span>
                <span className={`text-xs font-bold ${((data.receitasRealizadas || data.totalReceitas) - (data.despesasRealizadas || data.totalDespesas)) >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency((data.receitasRealizadas || data.totalReceitas) - (data.despesasRealizadas || data.totalDespesas))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Card>
          <CardContent className="p-2">
            <span className="text-xs font-medium mb-1 block">Receitas x Despesas</span>
            {data.transacoesPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.transacoesPorMes} margin={{ top: 16, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `R$${v/1000}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "11px",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="receitas" position="top" fontSize={8} fill="#10B981" formatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v > 0 ? v.toFixed(0) : ''} />
                  </Bar>
                  <Bar dataKey="despesas" name="Despesas" fill="#EF4444" radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="despesas" position="top" fontSize={8} fill="#EF4444" formatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v > 0 ? v.toFixed(0) : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">
                Nenhum dado disponivel
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2">
            <span className="text-xs font-medium mb-1 block">Despesas por Categoria ({getRefMonthLabel(refMonth)})</span>
            {data.despesasPorCategoria.length > 0 ? (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.despesasPorCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={75}
                      dataKey="value"
                      paddingAngle={2}
                      onClick={(_, index) => handlePieClick(data.despesasPorCategoria[index])}
                      style={{ cursor: "pointer" }}
                    >
                      {data.despesasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {data.despesasPorCategoria.slice(0, 6).map((cat, index) => (
                    <div key={cat.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color || COLORS[index % COLORS.length] }}
                        />
                        <span className="truncate max-w-[100px]">{cat.name}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">
                Nenhum dado disponivel
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>

      <Card className="sticky top-[40px] z-40 rounded-none border-x-0">
        <CardContent className="p-2">
          <span className="text-[10px] font-medium mb-0.5 block">
            Evolucao Mensal por Categoria
            <span className="text-muted-foreground ml-1">(pontilhado = previsto)</span>
          </span>
          {data.despesasPorCategoriaPorMes && Object.keys(data.categoryColors).length > 0 ? (
            (() => {
              const chartData = data.despesasPorCategoriaPorMes.map((monthData) => {
                const newData: { month: string; [key: string]: number | string | undefined } = { month: monthData.month };
                const isFuture = monthData.isFuture === 1;
                let totalDespesas = 0;
                
                Object.entries(data.categoryColors).forEach(([categoryName]) => {
                  const value = monthData[categoryName];
                  if (typeof value === 'number' && value > 0) {
                    totalDespesas += value;
                    if (isFuture) {
                      newData[`${categoryName}_futuro`] = value;
                    } else {
                      newData[`${categoryName}_passado`] = value;
                    }
                  }
                });

                if (totalDespesas > 0) {
                  if (isFuture) {
                    newData['_total_futuro'] = totalDespesas;
                  } else {
                    newData['_total_passado'] = totalDespesas;
                  }
                }
                
                return newData;
              });
              
              const currentMonthIdx = data.currentMonthIndex ?? new Date().getMonth();
              chartData.forEach((monthData, idx) => {
                if (idx === currentMonthIdx) {
                  Object.entries(data.categoryColors).forEach(([categoryName]) => {
                    const passadoValue = monthData[`${categoryName}_passado`];
                    if (typeof passadoValue === 'number') {
                      monthData[`${categoryName}_futuro`] = passadoValue;
                    }
                  });
                  const totalPassado = monthData['_total_passado'];
                  if (typeof totalPassado === 'number') {
                    monthData['_total_futuro'] = totalPassado;
                  }
                }
              });

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
              
              return (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart 
                    data={chartData}
                    onClick={(e) => {
                      if (e && e.activeLabel) {
                        handleLineClick(e.activeLabel);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                    margin={{ top: 16, right: 10, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" fontSize={9} stroke="hsl(var(--muted-foreground))" />
                    <YAxis 
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      fontSize={9}
                      stroke="hsl(var(--muted-foreground))"
                      width={35}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'Total Despesas' || name === 'Total Despesas (prev)') {
                          return [formatCurrency(value), name];
                        }
                        const cleanName = name.replace(/_passado$|_futuro$/, '');
                        const isFuturo = name.endsWith('_futuro');
                        return [formatCurrency(value), `${cleanName}${isFuturo ? ' (previsto)' : ''}`];
                      }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '10px',
                      }}
                    />
                    <Legend 
                      formatter={(value: string) => {
                        if (value === 'Total Despesas' || value === 'Total Despesas (prev)') return value === 'Total Despesas' ? 'Total' : '';
                        return value.replace(/_passado$|_futuro$/, '');
                      }}
                      wrapperStyle={{ fontSize: '8px', paddingTop: '2px' }}
                      iconSize={8}
                    />
                    {Object.entries(data.categoryColors).flatMap(([categoryName, color]) => [
                      <Line
                        key={`${categoryName}_passado`}
                        type="monotone"
                        dataKey={`${categoryName}_passado`}
                        name={categoryName}
                        stroke={color}
                        strokeWidth={1.5}
                        dot={{ fill: color, strokeWidth: 1, r: 2 }}
                        activeDot={{ r: 4, cursor: "pointer" }}
                        connectNulls
                        legendType="line"
                      />,
                      <Line
                        key={`${categoryName}_futuro`}
                        type="monotone"
                        dataKey={`${categoryName}_futuro`}
                        name={`${categoryName} (prev)`}
                        stroke={color}
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={{ fill: color, strokeWidth: 1, r: 2, strokeDasharray: '' }}
                        activeDot={{ r: 4, cursor: "pointer" }}
                        connectNulls
                        legendType="none"
                      />
                    ])}
                    <Line
                      key="_total_passado"
                      type="monotone"
                      dataKey="_total_passado"
                      name="Total Despesas"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2.5}
                      dot={{ fill: 'hsl(var(--foreground))', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, cursor: "pointer" }}
                      connectNulls
                      legendType="line"
                    >
                      <LabelList content={renderTotalLabel} />
                    </Line>
                    <Line
                      key="_total_futuro"
                      type="monotone"
                      dataKey="_total_futuro"
                      name="Total Despesas (prev)"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2.5}
                      strokeDasharray="5 5"
                      dot={{ fill: 'hsl(var(--foreground))', strokeWidth: 0, r: 3, strokeDasharray: '' }}
                      activeDot={{ r: 5, cursor: "pointer" }}
                      connectNulls
                      legendType="none"
                    >
                      <LabelList content={renderTotalLabel} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              );
            })()
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">
              Nenhum dado disponivel
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex-1 overflow-auto px-4 py-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium">
            Transacoes {selectedFilter.type 
              ? (selectedFilter.type === "category" ? `- ${selectedFilter.category}` : `- ${selectedFilter.month}`)
              : `- ${getRefMonthLabel(refMonth)}`}
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
                <TableHead className="text-[10px] py-0.5 px-1">Data</TableHead>
                <TableHead className="text-[10px] py-0.5 px-1">Descricao</TableHead>
                <TableHead className="text-[10px] py-0.5 px-1">Cat</TableHead>
                <TableHead className="text-[10px] py-0.5 px-1">Tipo</TableHead>
                <TableHead className="text-[10px] py-0.5 px-1">Status</TableHead>
                <TableHead className="text-[10px] py-0.5 px-1">Origem</TableHead>
                <TableHead className="text-[10px] py-0.5 px-1 text-right">Valor</TableHead>
                <TableHead className="text-[10px] py-0.5 px-1 text-center">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayTransactions.map((transaction) => {
                const cat = categories.find(c => c.id === transaction.categoryId);
                return (
                  <TableRow key={transaction.id} className="text-[10px]">
                    <TableCell className="py-0.5 px-1">{formatDate(transaction.date)}</TableCell>
                    <TableCell className="py-0.5 px-1 max-w-[200px] truncate" title={transaction.originalDescription || transaction.description}>
                      {transaction.shortTitle || transaction.description}
                    </TableCell>
                    <TableCell className="py-0.5 px-1">
                      {cat ? <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} size="sm" /> : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="py-0.5 px-1">
                      <Badge variant={transaction.type === "receita" ? "default" : "destructive"} className="text-[9px] px-1 py-0 leading-tight">
                        {transaction.type === "receita" ? "R" : "D"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-0.5 px-1">
                      <Badge variant={transaction.status === "realizada" ? "default" : "secondary"} className="text-[9px] px-1 py-0 leading-tight">
                        {transaction.status === "realizada" ? "Real" : "Prev"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-0.5 px-1">
                      {transaction.source === "cartao" && <CreditCard className="w-3 h-3" />}
                      {transaction.source === "conta_corrente" && <Building2 className="w-3 h-3" />}
                      {transaction.source === "manual" && <PenLine className="w-3 h-3" />}
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
            </TableBody>
          </Table>
        ) : (
          <div className="py-4 text-center text-muted-foreground text-xs">
            Nenhuma transacao encontrada
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
