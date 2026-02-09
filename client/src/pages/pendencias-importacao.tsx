import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  CreditCard,
  Upload,
  Building2,
} from "lucide-react";
import { Link } from "wouter";

interface ImportPendency {
  month: string;
  hasExtrato: boolean;
  hasFatura: boolean;
  hasBillPayment: boolean;
  extratoCount: number;
  faturaCount: number;
  extratoNet: number;
  faturaTotal: number;
  isFuture: boolean;
  pendingExtrato: boolean;
  pendingFatura: boolean;
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[parseInt(month) - 1]}/${year}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function StatusIcon({ ok, pending, label }: { ok: boolean; pending: boolean; label: string }) {
  if (ok) {
    return (
      <div className="flex items-center gap-1.5" data-testid={`status-${label}-ok`}>
        <CheckCircle2 className="w-4 h-4 text-success" />
        <span className="text-xs text-success font-medium">Importado</span>
      </div>
    );
  }
  if (pending) {
    return (
      <div className="flex items-center gap-1.5" data-testid={`status-${label}-pending`}>
        <AlertTriangle className="w-4 h-4 text-warning" />
        <span className="text-xs text-warning font-medium">Pendente</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5" data-testid={`status-${label}-na`}>
      <XCircle className="w-4 h-4 text-muted-foreground/40" />
      <span className="text-xs text-muted-foreground">N/A</span>
    </div>
  );
}

export default function PendenciasImportacao() {
  const { data: pendencies, isLoading } = useQuery<ImportPendency[]>({
    queryKey: ["/api/import/pendencies"],
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <PageHeader title="Pendencias de Importacao" subtitle="Status de importacao por mes" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const data = pendencies || [];
  const pendingCount = data.filter(m => m.pendingExtrato || m.pendingFatura).length;
  const totalExtrato = data.filter(m => m.hasExtrato).length;
  const totalFatura = data.filter(m => m.hasFatura).length;

  return (
    <div className="p-4 space-y-3">
      <PageHeader
        title="Pendencias de Importacao"
        subtitle="Status de importacao de extrato e fatura por mes"
      />

      <div className="grid gap-2 grid-cols-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Extratos Importados</span>
            </div>
            <span className="text-lg font-bold" data-testid="text-total-extratos">{totalExtrato}</span>
            <span className="text-xs text-muted-foreground ml-1">meses</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Faturas Importadas</span>
            </div>
            <span className="text-lg font-bold" data-testid="text-total-faturas">{totalFatura}</span>
            <span className="text-xs text-muted-foreground ml-1">meses</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <AlertTriangle className={`w-4 h-4 ${pendingCount > 0 ? "text-warning" : "text-success"}`} />
              <span className="text-xs font-medium">Pendencias</span>
            </div>
            <span className={`text-lg font-bold ${pendingCount > 0 ? "text-warning" : "text-success"}`} data-testid="text-pending-count">
              {pendingCount}
            </span>
            <span className="text-xs text-muted-foreground ml-1">meses</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Mes</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Extrato</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Qtd</span>
                  </div>
                </TableHead>
                <TableHead className="text-right">Saldo Extrato</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Fatura</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Qtd</span>
                  </div>
                </TableHead>
                <TableHead className="text-right">Total Fatura</TableHead>
                <TableHead className="text-center">Pag. Fatura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={row.month}
                  className={
                    row.isFuture
                      ? "opacity-50"
                      : row.pendingExtrato || row.pendingFatura
                        ? "bg-warning/5"
                        : ""
                  }
                  data-testid={`row-month-${row.month}`}
                >
                  <TableCell className="font-medium text-xs">
                    <div className="flex items-center gap-1.5">
                      {formatMonth(row.month)}
                      {row.isFuture && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1">Futuro</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIcon ok={row.hasExtrato} pending={row.pendingExtrato} label={`extrato-${row.month}`} />
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {row.extratoCount > 0 ? row.extratoCount : "-"}
                  </TableCell>
                  <TableCell className={`text-right text-xs ${row.extratoNet >= 0 ? "text-success" : "text-destructive"}`}>
                    {row.hasExtrato ? formatCurrency(row.extratoNet) : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIcon ok={row.hasFatura} pending={row.pendingFatura} label={`fatura-${row.month}`} />
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {row.faturaCount > 0 ? row.faturaCount : "-"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-destructive">
                    {row.hasFatura ? formatCurrency(row.faturaTotal) : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.hasBillPayment ? (
                      <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                    ) : row.hasFatura && !row.isFuture ? (
                      <AlertTriangle className="w-4 h-4 text-warning mx-auto" />
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pendingCount > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-xs">
                <strong>{pendingCount}</strong> mes(es) com importacao pendente. Importe os arquivos para ter saldos mais precisos.
              </p>
            </div>
            <Link href="/importar">
              <Button size="sm" data-testid="button-go-import">
                <Upload className="w-3.5 h-3.5 mr-1" />
                Importar
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
