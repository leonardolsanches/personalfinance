import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Building2, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Search, ArrowUpDown } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
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

function getMonthKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${monthNames[parseInt(m) - 1]}/${year}`;
}

type SortColumn = "date" | "description" | "category" | "type" | "amount";

export default function Extrato() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
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

  const ccTransactions = transactions.filter((t) => t.source === "conta_corrente" && !t.isCardBillPayment);

  const months = Array.from(new Set(ccTransactions.map((t) => getMonthKey(t.date)))).sort();

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const SortableHeader = ({ column, children, className = "" }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
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
    return subcategories.find((s) => s.id === subcategoryId)?.name || "-";
  };

  const filteredTransactions = (selectedMonth === "all"
    ? ccTransactions
    : ccTransactions.filter((t) => getMonthKey(t.date) === selectedMonth))
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

  const monthlyData = months.map((month) => {
    const monthTxs = ccTransactions.filter((t) => getMonthKey(t.date) === month);
    const receitas = monthTxs
      .filter((t) => t.type === "receita")
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
    const despesas = monthTxs
      .filter((t) => t.type === "despesa")
      .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
    return { month: getMonthName(month), key: month, receitas, despesas, count: monthTxs.length };
  });

  const totalReceitas = ccTransactions
    .filter((t) => t.type === "receita")
    .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
  const totalDespesas = ccTransactions
    .filter((t) => t.type === "despesa")
    .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);
  const saldo = totalReceitas - totalDespesas;

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
      <PageHeader title="Visao Conta Corrente" subtitle="Visualize movimentacoes do extrato bancario">
        <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-month">
            <SelectValue placeholder="Selecione o mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Meses</SelectItem>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {getMonthName(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>
      <div className="px-4 py-3 space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Receitas</p>
                <p className="text-lg font-bold text-success" data-testid="text-receitas">{formatCurrency(totalReceitas)}</p>
              </div>
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="text-lg font-bold text-destructive" data-testid="text-despesas">{formatCurrency(totalDespesas)}</p>
              </div>
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={`text-lg font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`} data-testid="text-saldo">{formatCurrency(saldo)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <ArrowUpDown className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Meses</p>
                <p className="text-lg font-bold" data-testid="text-meses">{months.length}</p>
                <p className="text-xs text-muted-foreground">{ccTransactions.length} lancamentos</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Movimentacao Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
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
                  formatter={(value: string) => {
                    const labels: Record<string, string> = { receitas: "Receitas", despesas: "Despesas" };
                    return labels[value] || value;
                  }}
                />
                <Bar dataKey="receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              <p>Nenhum dado disponivel</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
        {months.map((month) => {
          const data = monthlyData.find((d) => d.key === month);
          if (!data) return null;
          const saldoMes = data.receitas - data.despesas;
          return (
            <Card
              key={month}
              className={`cursor-pointer transition-colors ${selectedMonth === month ? "ring-2 ring-primary" : ""}`}
              onClick={() => { setSelectedMonth(month); setCurrentPage(1); }}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{getMonthName(month)}</span>
                  <Badge variant={saldoMes >= 0 ? "default" : "destructive"} className="text-xs">
                    {saldoMes >= 0 ? "+" : ""}{formatCurrency(saldoMes)}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-success">{formatCurrency(data.receitas)}</span>
                  <span className="text-destructive">{formatCurrency(data.despesas)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{data.count} itens</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {selectedMonth === "all" ? "Todos os Lancamentos" : `Extrato ${getMonthName(selectedMonth)}`}
            </CardTitle>
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Filtrar por descricao..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10"
                data-testid="input-search-extrato"
              />
            </div>
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
              <div className="overflow-hidden">
                <Table className="text-sm table-fixed w-full">
                  <colgroup>
                    <col style={{ width: "80px" }} />
                    <col />
                    <col style={{ width: "70px" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "70px" }} />
                    <col style={{ width: "90px" }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="h-9">
                      <SortableHeader column="date">Data</SortableHeader>
                      <SortableHeader column="description">Descricao</SortableHeader>
                      <SortableHeader column="type">Tipo</SortableHeader>
                      <SortableHeader column="category">Categoria</SortableHeader>
                      <TableHead className="py-1.5">Subcateg.</TableHead>
                      <TableHead className="py-1.5">Status</TableHead>
                      <SortableHeader column="amount" className="text-right">Valor</SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((t) => (
                      <TableRow key={t.id} className="h-10" data-testid={`row-extrato-${t.id}`}>
                        <TableCell className="py-1.5 text-xs truncate overflow-hidden">{formatDate(t.date)}</TableCell>
                        <TableCell className="py-1.5 overflow-hidden">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-medium text-sm truncate block">
                                {t.shortTitle || t.description}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-[400px]">{t.originalDescription || t.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant={t.type === "receita" ? "default" : "destructive"} className="text-xs">
                            {t.type === "receita" ? "Receita" : "Despesa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 overflow-hidden">
                          {(() => {
                            const cat = getCategory(t.categoryId);
                            return cat ? (
                              <CategoryIcon iconName={cat.icon} color={cat.color} categoryName={cat.name} />
                            ) : <span className="text-xs text-muted-foreground">-</span>;
                          })()}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs truncate overflow-hidden">{getSubcategoryName(t.subcategoryId)}</TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant={t.status === "realizada" ? "default" : "outline"} className="text-xs">
                            {t.status === "realizada" ? "Realizada" : "Prevista"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`py-1.5 text-right font-medium whitespace-nowrap ${t.type === "receita" ? "text-success" : "text-destructive"}`}>
                          {t.type === "receita" ? "+" : "-"}{formatCurrency(parseFloat(String(t.amount)))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {filteredTransactions.length} lancamentos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      data-testid="button-prev-page"
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
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
    </div>
  );
}
