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
import { useToast } from "@/hooks/use-toast";
import { CreditCard, AlertTriangle, CheckCircle, Clock, RotateCcw, ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight, Building2, PenLine, Repeat } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import type { Transaction, Category } from "@shared/schema";
import { PageHeader } from "@/components/page-header";

function formatCurrency(value: number | string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

function getMonthName(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${monthNames[parseInt(m) - 1]}/${year}`;
}

export default function Faturas() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<"date" | "description" | "category" | "status" | "amount">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<{ id: number; name: string; categoryId: number }[]>({
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

  const cardTransactions = transactions.filter((t) => t.source === "cartao");
  
  const billMonths = Array.from(new Set(cardTransactions.map((t) => t.cardBillMonth).filter(Boolean)))
    .sort((a, b) => (a || "").localeCompare(b || ""));

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const SortableHeader = ({ column, children, className = "" }: { column: typeof sortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={`cursor-pointer select-none ${className}`}
      onClick={() => handleSort(column)}
      data-testid={`header-sort-${column}`}
    >
      <div className={`flex items-center gap-1 ${className.includes("text-right") ? "justify-end" : ""}`}>
        {children}
        {sortColumn === column ? (
          sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : null}
      </div>
    </TableHead>
  );

  const getCategory = (categoryId: number | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId) || null;
  };

  const getCategoryName = (categoryId: number | null) => {
    return getCategory(categoryId)?.name || "-";
  };

  const getSubcategoryName = (subcategoryId: number | null) => {
    if (!subcategoryId) return "-";
    const subcategory = subcategories.find((s) => s.id === subcategoryId);
    return subcategory?.name || "-";
  };

  const getSourceIcon = (source: string | null) => {
    switch (source) {
      case "cartao":
        return <CreditCard className="w-3 h-3" />;
      case "conta_corrente":
        return <Building2 className="w-3 h-3" />;
      default:
        return <PenLine className="w-3 h-3" />;
    }
  };

  const getSourceLabel = (source: string | null) => {
    switch (source) {
      case "cartao":
        return "Cartao de Credito";
      case "conta_corrente":
        return "Conta Corrente";
      default:
        return "Manual";
    }
  };

  const filteredTransactions = (selectedMonth === "all"
    ? cardTransactions
    : cardTransactions.filter((t) => t.cardBillMonth === selectedMonth))
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
          aVal = getCategoryName(a.categoryId).toLowerCase();
          bVal = getCategoryName(b.categoryId).toLowerCase();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
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
      if (t.type === "receita") {
        acc.receitas += amount;
      } else {
        acc.despesas += amount;
      }
      return acc;
    },
    { receitas: 0, despesas: 0 }
  );
  const filteredSaldo = filteredTotals.receitas - filteredTotals.despesas;

  const billsByMonth = billMonths.reduce((acc, month) => {
    if (!month) return acc;
    const monthTxs = cardTransactions.filter((t) => t.cardBillMonth === month);
    // Total da fatura = despesas - estornos (estornos sao receitas como contestacoes de fraude)
    const totalDespesas = monthTxs
      .filter((t) => t.type === "despesa")
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
    const totalEstornos = monthTxs
      .filter((t) => t.type === "receita" || t.isRefund)
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
    const isPast = monthTxs.every((t) => t.status === "realizada");
    // Valor liquido da fatura = despesas - estornos
    acc[month] = { total: totalDespesas - totalEstornos, estornos: totalEstornos, count: monthTxs.length, isPast };
    return acc;
  }, {} as Record<string, { total: number; estornos: number; count: number; isPast: boolean }>);

  // Calcular totais considerando estornos
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

  // Parcelamentos futuros: agrupar por installmentGroupId e mostrar resumo
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
      <PageHeader title="Visao Cartao" subtitle="Visualize e gerencie suas faturas de cartao de credito">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]" data-testid="select-month">
            <SelectValue placeholder="Selecione o mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Faturas</SelectItem>
            {billMonths.map((month) => (
              <SelectItem key={month} value={month || ""}>
                {getMonthName(month || "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>
      <div className="px-4 py-3 space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Realizado</p>
                <p className="text-xl font-bold text-success">{formatCurrency(totalRealized)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Previsto</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalPlanned)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Faturas</p>
                <p className="text-xl font-bold">{billMonths.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${fraudSuspectCount > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                <AlertTriangle className={`w-5 h-5 ${fraudSuspectCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Analise Fraude</p>
                <p className={`text-xl font-bold ${fraudSuspectCount > 0 ? "text-destructive" : ""}`}>{fraudSuspectCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Evolução Mensal das Faturas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Evolução das Faturas
            <span className="text-xs font-normal text-muted-foreground">(linha pontilhada = previsto)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {billMonths.length > 0 ? (
            (() => {
              // Preparar dados do gráfico separando realizados e previstos
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
              
              // Encontrar o índice do último mês realizado para conectar as linhas
              const lastRealizedIdx = chartData.findIndex(d => d?.valorPrevisto !== undefined) - 1;
              if (lastRealizedIdx >= 0 && chartData[lastRealizedIdx] && chartData[lastRealizedIdx + 1]) {
                // Copiar o valor realizado para o primeiro previsto para conectar
                chartData[lastRealizedIdx + 1]!.valorPrevisto = chartData[lastRealizedIdx]!.valorRealizado;
              }
              
              return (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <RechartsTooltip 
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          valorRealizado: 'Fatura Realizada',
                          valorPrevisto: 'Fatura Prevista',
                          estornos: 'Estornos',
                        };
                        return [formatCurrency(value), labels[name] || name];
                      }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend 
                      formatter={(value: string) => {
                        const labels: Record<string, string> = {
                          valorRealizado: 'Realizado',
                          valorPrevisto: 'Previsto',
                          estornos: 'Estornos',
                        };
                        return labels[value] || value;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="valorRealizado"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="valorPrevisto"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4, strokeDasharray: '' }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="estornos"
                      stroke="#F59E0B"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      dot={{ fill: '#F59E0B', strokeWidth: 1, r: 3 }}
                      connectNulls
                      legendType="line"
                    />
                  </LineChart>
                </ResponsiveContainer>
              );
            })()
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              <p>Nenhum dado disponivel</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
        {billMonths.map((month) => {
          const info = billsByMonth[month || ""];
          if (!info) return null;
          return (
            <Card
              key={month}
              className={`cursor-pointer transition-colors ${selectedMonth === month ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedMonth(month || "all")}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{getMonthName(month || "")}</span>
                  <Badge variant={info.isPast ? "default" : "outline"} className="text-xs">
                    {info.isPast ? "Pago" : "Aberto"}
                  </Badge>
                </div>
                <p className="text-lg font-bold">{formatCurrency(info.total)}</p>
                <p className="text-xs text-muted-foreground">{info.count} itens</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {selectedMonth === "all" ? "Todas as Transacoes" : `Fatura ${getMonthName(selectedMonth)}`}
            </CardTitle>
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Filtrar por descricao..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10"
                data-testid="input-search-faturas"
              />
            </div>
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
                  <col style={{ width: "44px" }} />
                  <col style={{ width: "72px" }} />
                  <col />
                  <col style={{ width: "44px" }} />
                  <col style={{ width: "44px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "55px" }} />
                  <col style={{ width: "90px" }} />
                </colgroup>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead>Fraude</TableHead>
                    <SortableHeader column="date">Data</SortableHeader>
                    <SortableHeader column="description">Descricao</SortableHeader>
                    <TableHead>Orig.</TableHead>
                    <TableHead>Tipo</TableHead>
                    <SortableHeader column="category">Categoria</SortableHeader>
                    <TableHead>Subcateg.</TableHead>
                    <SortableHeader column="status">Status</SortableHeader>
                    <SortableHeader column="amount" className="text-right">Valor</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((t) => (
                    <TableRow
                      key={t.id}
                      className={`h-10 ${t.isFraudSuspect ? "bg-red-50 dark:bg-red-950" : ""}`}
                      data-testid={`row-fatura-${t.id}`}
                    >
                      <TableCell className="py-1.5">
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
                      </TableCell>
                      <TableCell className="py-1.5 text-xs whitespace-nowrap">{formatDate(t.date)}</TableCell>
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
                          <TooltipContent>
                            <p className="max-w-[300px]">{t.originalDescription || t.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">{getSourceIcon(t.source)}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{getSourceLabel(t.source)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant={t.type === "receita" ? "default" : "secondary"} className="text-xs">
                          {t.type === "receita" ? "R" : "D"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5">
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
                      <TableCell className="py-1.5">
                        <Badge variant={t.status === "realizada" ? "default" : "outline"} className="text-xs">
                          {t.status === "realizada" ? "Pago" : "Prev"}
                        </Badge>
                      </TableCell>
                      <TableCell className={`py-1.5 text-right font-medium text-sm whitespace-nowrap ${t.type === "receita" ? "text-success" : "text-destructive"}`}>
                        {t.type === "receita" ? "+" : "-"}{formatCurrency(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="h-9 bg-muted/50 font-medium">
                    <TableCell colSpan={2} className="py-1.5 text-xs">
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
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  {filteredTransactions.length} transacao(oes)
                </span>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
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
