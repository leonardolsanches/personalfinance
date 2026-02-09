import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, FileText, Eye, ArrowLeft, TrendingUp, TrendingDown, Tag, Repeat, RotateCcw, Settings, RefreshCw, FileDown } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import type { BankAccount } from "@shared/schema";
import { PageHeader } from "@/components/page-header";

interface PreviewTransaction {
  date: string;
  description: string;
  shortTitle: string;
  amount: string;
  type: string;
  isRefund: boolean;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  categoryName: string | null;
  subcategoryName: string | null;
  hasRule: boolean;
}

interface ColumnMapping {
  dateCol: number;
  descCol: number;
  amountCol: number;
  startRow: number;
}

interface PreviewResult {
  success: boolean;
  transactions: PreviewTransaction[];
  summary: {
    totalTransactions: number;
    totalReceitas: number;
    totalDespesas: number;
    withCategory: number;
    withoutCategory: number;
    withInstallments: number;
    refunds: number;
  };
  errors: string[];
  columnMapping?: ColumnMapping;
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
}

export default function Importar() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"extrato" | "cartao">("extrato");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [customDateCol, setCustomDateCol] = useState<string>("");
  const [customDescCol, setCustomDescCol] = useState<string>("");
  const [customAmountCol, setCustomAmountCol] = useState<string>("");
  const [customStartRow, setCustomStartRow] = useState<string>("");
  const [errorsIgnored, setErrorsIgnored] = useState(false);

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const previewMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Erro ao processar arquivo");
      }
      return response.json();
    },
    onSuccess: (data: PreviewResult) => {
      setPreviewData(data);
      if (!data.success) {
        toast({ title: "Alguns erros foram encontrados no arquivo", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Erro ao processar arquivo", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/import/excel", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Erro ao importar arquivo");
      }
      return response.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      setPreviewData(null);
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions/uncategorized"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        toast({ title: `${data.imported} transacoes importadas com sucesso!` });
      } else {
        toast({ title: "Erro ao importar algumas transacoes", variant: "destructive" });
      }
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: () => {
      toast({ title: "Erro ao importar arquivo", variant: "destructive" });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
      ];
      if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.name.endsWith(".csv")) {
        toast({ title: "Formato invalido. Use arquivos Excel (.xlsx, .xls) ou CSV", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
      setPreviewData(null);
      setErrorsIgnored(false);
    }
  };

  const handlePreview = (useCustomMapping = false) => {
    if (!selectedFile) {
      toast({ title: "Selecione um arquivo", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("type", importType);
    
    if (useCustomMapping) {
      if (customDateCol) formData.append("dateCol", customDateCol);
      if (customDescCol) formData.append("descCol", customDescCol);
      if (customAmountCol) formData.append("amountCol", customAmountCol);
      if (customStartRow) formData.append("startRow", customStartRow);
    }

    previewMutation.mutate(formData);
  };
  
  const colIndexToLetter = (idx: number) => String.fromCharCode(65 + idx);

  const handleConfirmImport = () => {
    if (!selectedFile) {
      toast({ title: "Selecione um arquivo", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("type", importType);
    if (bankAccountId && bankAccountId !== "none") {
      formData.append("bankAccountId", bankAccountId);
    }
    
    // Usar mapeamento de colunas se configurado
    if (customDateCol) formData.append("dateCol", customDateCol);
    if (customDescCol) formData.append("descCol", customDescCol);
    if (customAmountCol) formData.append("amountCol", customAmountCol);
    if (customStartRow) formData.append("startRow", customStartRow);

    importMutation.mutate(formData);
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
      setPreviewData(null);
      setErrorsIgnored(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("pt-BR");
  };

  if (previewData) {
    return (
      <div>
        <PageHeader title="Importar Extrato" subtitle="Revise as transacoes antes de confirmar">
          <Button variant="outline" onClick={handleCancelPreview} data-testid="button-cancel-preview">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </PageHeader>
        <div className="px-4 py-3 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{previewData.summary.totalTransactions}</p>
                  <p className="text-xs text-muted-foreground">Total de Transacoes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(previewData.summary.totalReceitas)}</p>
                  <p className="text-xs text-muted-foreground">Total Receitas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(previewData.summary.totalDespesas)}</p>
                  <p className="text-xs text-muted-foreground">Total Despesas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Tag className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{previewData.summary.withCategory}</p>
                  <p className="text-xs text-muted-foreground">Auto-categorizadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-muted-foreground">Sem categoria:</span>
              <Badge variant="secondary">{previewData.summary.withoutCategory}</Badge>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm">
              <Repeat className="w-4 h-4 text-blue-600" />
              <span className="text-muted-foreground">Parcelamentos:</span>
              <Badge variant="secondary">{previewData.summary.withInstallments}</Badge>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm">
              <RotateCcw className="w-4 h-4 text-purple-600" />
              <span className="text-muted-foreground">Estornos:</span>
              <Badge variant="secondary">{previewData.summary.refunds}</Badge>
            </div>
          </Card>
        </div>

        {previewData.errors.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  Erros Encontrados ({previewData.errors.length})
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnConfig(!showColumnConfig)}
                  data-testid="button-toggle-column-config"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Ajustar Colunas
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {previewData.columnMapping && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  <p className="font-medium mb-2">Mapeamento detectado automaticamente:</p>
                  <div className="grid grid-cols-4 gap-2 text-muted-foreground">
                    <span>Data: Coluna {colIndexToLetter(previewData.columnMapping.dateCol)}</span>
                    <span>Descricao: Coluna {colIndexToLetter(previewData.columnMapping.descCol)}</span>
                    <span>Valor: Coluna {colIndexToLetter(previewData.columnMapping.amountCol)}</span>
                    <span>Inicio: Linha {previewData.columnMapping.startRow + 1}</span>
                  </div>
                </div>
              )}
              
              {showColumnConfig && (
                <Card className="p-4 bg-muted/50">
                  <p className="text-sm font-medium mb-3">Configure manualmente as colunas do arquivo:</p>
                  <div className="grid grid-cols-5 gap-3 items-end">
                    <div>
                      <Label className="text-xs">Coluna Data (0=A)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ex: 0"
                        value={customDateCol}
                        onChange={(e) => setCustomDateCol(e.target.value)}
                        className="h-9"
                        data-testid="input-date-col"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Coluna Descricao</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ex: 1"
                        value={customDescCol}
                        onChange={(e) => setCustomDescCol(e.target.value)}
                        className="h-9"
                        data-testid="input-desc-col"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Coluna Valor</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ex: 3"
                        value={customAmountCol}
                        onChange={(e) => setCustomAmountCol(e.target.value)}
                        className="h-9"
                        data-testid="input-amount-col"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Linha Inicial (0=1)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ex: 10"
                        value={customStartRow}
                        onChange={(e) => setCustomStartRow(e.target.value)}
                        className="h-9"
                        data-testid="input-start-row"
                      />
                    </div>
                    <Button
                      onClick={() => handlePreview(true)}
                      disabled={previewMutation.isPending}
                      data-testid="button-reprocess"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reprocessar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Dica: No seu arquivo, Data esta na coluna A (0), Descricao na B (1), Valor na D (3), e os dados comecam na linha 11 (indice 10).
                  </p>
                </Card>
              )}
              
              <ul className="text-sm space-y-1">
                {previewData.errors.slice(0, 10).map((error, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-destructive">-</span>
                    {error}
                  </li>
                ))}
                {previewData.errors.length > 10 && (
                  <li className="text-muted-foreground">... e mais {previewData.errors.length - 10} erro(s)</li>
                )}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Transacoes a Importar</CardTitle>
              <CardDescription>
                {previewData.transactions.length} transacoes serao importadas
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const exportData = previewData.transactions.map(tx => ({
                  Data: formatDate(tx.date),
                  Descricao: tx.description,
                  TituloBreve: tx.shortTitle,
                  Tipo: tx.type === "receita" ? "Receita" : "Despesa",
                  Valor: tx.type === "despesa" ? -Math.abs(parseFloat(tx.amount)) : Math.abs(parseFloat(tx.amount)),
                  Categoria: tx.categoryName || "",
                  Subcategoria: tx.subcategoryName || "",
                  Estorno: tx.isRefund ? "Sim" : "Nao",
                  Parcela: tx.installmentCurrent ? `${tx.installmentCurrent}/${tx.installmentTotal}` : "",
                  TemRegra: tx.hasRule ? "Sim" : "Nao",
                }));
                exportToExcel(exportData, `preview_import_${new Date().toISOString().split('T')[0]}`, 'Preview');
                toast({ title: "Exportado!", description: "Dados de preview exportados para Excel." });
              }}
              data-testid="button-export-preview"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Exportar Preview
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Data</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead className="text-right w-28">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.transactions.map((tx, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs">{formatDate(tx.date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{tx.shortTitle}</span>
                          {tx.installmentTotal && (
                            <Badge variant="outline" className="text-xs">
                              {tx.installmentCurrent}/{tx.installmentTotal}
                            </Badge>
                          )}
                          {tx.isRefund && (
                            <Badge variant="secondary" className="text-xs">Estorno</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tx.hasRule ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">{tx.categoryName}</span>
                            {tx.subcategoryName && (
                              <span className="text-xs text-muted-foreground">{tx.subcategoryName}</span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs text-yellow-600">
                            Sem categoria
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.type === "receita" ? "default" : "secondary"} className="text-xs">
                          {tx.type === "receita" ? "Receita" : "Despesa"}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${tx.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                        {tx.type === "receita" ? "+" : "-"}{formatCurrency(parseFloat(tx.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={handleCancelPreview} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmImport} 
            disabled={importMutation.isPending || previewData.transactions.length === 0}
            data-testid="button-confirm-import"
          >
            {importMutation.isPending ? (
              <>Importando...</>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Importacao ({previewData.transactions.length} transacoes)
              </>
            )}
          </Button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Importar Extrato" subtitle="Importe extratos bancarios em formato Excel" />
      <div className="px-4 py-3 space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload de Arquivo
            </CardTitle>
            <CardDescription>
              Arraste um arquivo ou clique para selecionar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Tipo de Importacao</Label>
                <Select value={importType} onValueChange={(v) => setImportType(v as any)}>
                  <SelectTrigger data-testid="select-import-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="extrato">Extrato de Conta Corrente</SelectItem>
                    <SelectItem value="cartao">Fatura de Cartao de Credito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conta Bancaria (opcional)</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger data-testid="select-bank-account">
                    <SelectValue placeholder="Vincular a uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {bankAccounts.filter(b => b.active).map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary hover:bg-muted/50"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file"
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-success" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Arraste um arquivo aqui</p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: .xlsx, .xls, .csv
                  </p>
                </div>
              )}
            </div>

            {previewMutation.isPending && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                <Progress value={50} className="animate-pulse" />
              </div>
            )}

            <Button
              className="w-full"
              onClick={handlePreview}
              disabled={!selectedFile || previewMutation.isPending}
              data-testid="button-preview"
            >
              <Eye className="w-4 h-4 mr-2" />
              Visualizar Antes de Importar
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {importResult && (
            <Card className={(importResult.success || errorsIgnored) ? "border-success" : "border-warning"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {(importResult.success || errorsIgnored) ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-warning" />
                  )}
                  Resultado da Importacao
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Transacoes importadas:</span>
                  <Badge variant="default">{importResult.imported}</Badge>
                </div>
                {importResult.errors.length > 0 && !errorsIgnored && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">Erros encontrados:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {importResult.errors.slice(0, 5).map((error, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-destructive">-</span>
                          {error}
                        </li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li className="text-muted-foreground">
                          ... e mais {importResult.errors.length - 5} erro(s)
                        </li>
                      )}
                    </ul>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setErrorsIgnored(true);
                        toast({ title: "Erros ignorados. Importacao concluida com sucesso!" });
                      }}
                      className="mt-2"
                      data-testid="button-ignore-errors"
                    >
                      Ignorar Erros
                    </Button>
                  </div>
                )}
                {errorsIgnored && importResult.errors.length > 0 && (
                  <p className="text-sm text-success">Erros ignorados - Importacao concluida com sucesso!</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Formato Esperado
              </CardTitle>
              <CardDescription>
                {importType === "cartao" ? "Formato CSV de fatura Itau" : "Formato XLS do Itau"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {importType === "cartao" ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Arquivo CSV de fatura de cartao Itau:</p>
                  <div className="bg-muted p-3 rounded-md text-xs font-mono">
                    data,lancamento,valor<br/>
                    2026-02-02,FARMACIA EXEMPLO,150.00<br/>
                    2026-02-01,RESTAURANTE ABC 03/12,89.90
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>- Valores negativos sao tratados como estornos</p>
                    <p>- Parcelamentos sao detectados automaticamente (ex: 03/12)</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Arquivo XLS de extrato Itau:</p>
                  <div className="bg-muted p-3 rounded-md text-xs font-mono">
                    data | lancamento | ag./origem | valor (R$)<br/>
                    06/12/2025 | SALDO ANTERIOR | - | 1000.00<br/>
                    08/12/2025 | PIX TRANSF JOAO08/12 | - | -150.00
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>- Valores negativos sao despesas</p>
                    <p>- Valores positivos sao receitas</p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Apos importar, as transacoes aparecerao na tela de Categorizacao
                  para classificacao.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/import/template" download data-testid="button-download-template">
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Modelo
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
