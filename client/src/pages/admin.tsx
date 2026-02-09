import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Database,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  HardDrive,
  Table2,
  FileJson,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DbStats {
  categories: number;
  subcategories: number;
  bankAccounts: number;
  beneficiaries: number;
  transactions: number;
  payables: number;
  categorizationRules: number;
  budgetItems: number;
}

const TABLE_LABELS: Record<string, string> = {
  categories: "Categorias",
  subcategories: "Subcategorias",
  bankAccounts: "Contas Bancarias",
  beneficiaries: "Beneficiarios",
  transactions: "Transacoes",
  payables: "Contas a Pagar",
  categorizationRules: "Regras Auto",
  budgetItems: "Planejamento",
};

export default function Admin() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, number> | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<DbStats>({
    queryKey: ["/api/admin/stats"],
  });

  const totalRecords = stats
    ? Object.values(stats).reduce((sum, val) => sum + Number(val), 0)
    : 0;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/admin/export");
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `personal-finance-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportacao concluida",
        description: `${totalRecords} registros exportados com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportacao",
        description: "Nao foi possivel exportar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.tables) {
        toast({
          title: "Arquivo invalido",
          description: "O arquivo selecionado nao e um backup valido.",
          variant: "destructive",
        });
        return;
      }

      const preview: Record<string, number> = {};
      for (const [key, rows] of Object.entries(data.tables)) {
        if (Array.isArray(rows)) {
          preview[key] = rows.length;
        }
      }

      setSelectedFile(file);
      setImportPreview(preview);
      setShowImportDialog(true);
    } catch {
      toast({
        title: "Erro ao ler arquivo",
        description: "O arquivo selecionado nao pode ser lido como JSON.",
        variant: "destructive",
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setShowImportDialog(false);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      const importedTotal = Object.values(result.imported as Record<string, number>).reduce(
        (sum, val) => sum + val,
        0
      );

      queryClient.invalidateQueries();

      toast({
        title: "Importacao concluida",
        description: `${importedTotal} registros importados com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro na importacao",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
      setImportPreview(null);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    setShowResetDialog(false);

    try {
      await apiRequest("POST", "/api/admin/reset");

      queryClient.invalidateQueries();

      toast({
        title: "Banco zerado",
        description: "Todos os dados foram removidos com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao zerar banco",
        description: "Nao foi possivel zerar o banco de dados.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Administracao" />
      <div className="px-4 py-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              Banco de Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HardDrive className="w-4 h-4" />
                <span>PostgreSQL (Neon)</span>
                <Badge variant="outline" className="text-xs">
                  {statsLoading ? "..." : `${totalRecords} registros`}
                </Badge>
              </div>

              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(stats).map(([key, count]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <span className="text-xs text-muted-foreground">
                        {TABLE_LABELS[key] || key}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {Number(count)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-4 h-4" />
                Exportar Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Gera um arquivo JSON com todos os dados do banco. Use para criar
                uma copia de seguranca ou transferir dados para outro ambiente.
              </p>
              <Button
                onClick={handleExport}
                disabled={isExporting || statsLoading}
                className="w-full"
                data-testid="button-export"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {isExporting ? "Exportando..." : "Exportar Dados"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Importar Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Carrega dados de um arquivo JSON de backup. Substitui todos os
                dados existentes no banco.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-import-file"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full"
                data-testid="button-import"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {isImporting ? "Importando..." : "Selecionar Arquivo"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Zerar Banco de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Remove todos os dados do banco de dados. Use para iniciar do
                zero com dados de outro usuario.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowResetDialog(true)}
                disabled={isResetting || totalRecords === 0}
                className="w-full"
                data-testid="button-reset"
              >
                {isResetting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {isResetting ? "Zerando..." : "Zerar Banco"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar Zerar Banco de Dados
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Esta acao ira remover permanentemente todos os{" "}
                <strong>{totalRecords} registros</strong> do banco de dados:
              </span>
              {stats && (
                <span className="block text-xs space-y-1">
                  {Object.entries(stats)
                    .filter(([, count]) => Number(count) > 0)
                    .map(([key, count]) => (
                      <span key={key} className="block">
                        - {TABLE_LABELS[key] || key}: {Number(count)} registros
                      </span>
                    ))}
                </span>
              )}
              <span className="block font-semibold text-destructive">
                Esta acao nao pode ser desfeita. Recomendamos exportar um backup antes.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reset-cancel">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-reset-confirm"
            >
              Sim, Zerar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              Confirmar Importacao
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Arquivo: <strong>{selectedFile?.name}</strong>
              </span>
              <span className="block">
                A importacao ira <strong>substituir todos os dados existentes</strong> pelos dados do arquivo:
              </span>
              {importPreview && (
                <span className="block text-xs space-y-1">
                  {Object.entries(importPreview).map(([key, count]) => (
                    <span key={key} className="block">
                      - {TABLE_LABELS[key] || key}: {count} registros
                    </span>
                  ))}
                </span>
              )}
              <span className="block font-semibold text-destructive">
                Os dados atuais serao perdidos. Recomendamos exportar um backup antes.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-import-cancel">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImport}
              data-testid="button-import-confirm"
            >
              Sim, Importar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
