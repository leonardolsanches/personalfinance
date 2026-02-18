import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Trash2, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, CreditCard, Building2, Pencil, ChevronDown, ChevronRight, ChevronUp, CalendarIcon, X, FileSpreadsheet, Upload, CheckCircle, CheckCircle2, AlertCircle, FileText, Eye, TrendingUp, TrendingDown, Tag, Repeat, RotateCcw, Loader2, Settings } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Transaction, Category, Subcategory, BankAccount, Beneficiary } from "@shared/schema";
import { PageHeader } from "@/components/page-header";

interface DuplicateGroup {
  date: string;
  description: string;
  amount: string;
  type: string;
  count: number;
  ids: number[];
  sources: string[];
  importedFromList: string[];
}

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
}

interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  duplicates?: number;
  fileName?: string;
}

export default function ManutencaoDados() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState("duplicatas");
  
  // Estados de importação
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importType, setImportType] = useState<"extrato" | "cartao">("extrato");
  const [importBankAccountId, setImportBankAccountId] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [multiPreviewData, setMultiPreviewData] = useState<{ file: File; preview: PreviewResult | null; error?: string }[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; results: ImportResult[] } | null>(null);
  const [previewProgress, setPreviewProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorsIgnored, setErrorsIgnored] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [columnConfig, setColumnConfig] = useState({
    dateCol: -1,
    descCol: -1,
    amountCol: -1,
    startRow: -1,
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [groupDetails, setGroupDetails] = useState<Record<number, Transaction[]>>({});

  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("all");
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<string>("all");
  const [bankAccountFilter, setBankAccountFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [sortColumn, setSortColumn] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <th 
      className="p-2 text-left cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => toggleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column ? (
          sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </th>
  );

  const { data: duplicates = [], isLoading: loadingDuplicates, refetch: refetchDuplicates } = useQuery<DuplicateGroup[]>({
    queryKey: ["/api/maintenance/duplicates"],
  });

  const { data: wrongSignTransactions = [], isLoading: loadingWrongSign, refetch: refetchWrongSign } = useQuery<Transaction[]>({
    queryKey: ["/api/maintenance/wrong-sign"],
  });

  const { data: allTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const { data: beneficiaries = [] } = useQuery<Beneficiary[]>({
    queryKey: ["/api/beneficiaries"],
  });

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return apiRequest("POST", "/api/maintenance/consolidate", { ids });
    },
    onSuccess: (_, deletedIds) => {
      toast({ title: "Sucesso", description: `${deletedIds.length} registros removidos` });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/wrong-sign"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setSelectedIds(new Set());
      setGroupDetails({});
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao remover registros", variant: "destructive" });
    },
  });

  // Mutations de importação
  const previewMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Erro ao processar arquivo");
      return response.json();
    },
    onSuccess: (data: PreviewResult) => {
      setPreviewData(data);
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
      if (!response.ok) throw new Error("Erro ao importar");
      return response.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      setPreviewData(null);
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions/uncategorized"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      }
    },
    onError: () => {
      toast({ title: "Erro ao importar arquivo", variant: "destructive" });
    },
  });

  const fixSignMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return apiRequest("POST", "/api/maintenance/fix-sign", { ids });
    },
    onSuccess: (_, fixedIds) => {
      toast({ title: "Sucesso", description: `Tipo invertido em ${fixedIds.length} registros` });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/wrong-sign"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setSelectedIds(new Set());
      setGroupDetails({});
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao inverter sinais", variant: "destructive" });
    },
  });

  const fetchGroupDetails = async (groupIdx: number, ids: number[]) => {
    if (groupDetails[groupIdx]) return;
    try {
      const response = await apiRequest("POST", "/api/maintenance/transactions-by-ids", { ids });
      const data = await response.json();
      setGroupDetails(prev => ({ ...prev, [groupIdx]: data as Transaction[] }));
    } catch (err) {
      console.error("Error fetching details:", err);
    }
  };

  const toggleGroup = (idx: number, ids: number[]) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
      fetchGroupDetails(idx, ids);
    }
    setExpandedGroups(newExpanded);
  };

  // Funções de importação
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"];
      const validFiles: File[] = [];
      for (let i = 0; i < e.target.files!.length; i++) {
        const f = e.target.files![i];
        if (validTypes.includes(f.type) || f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv")) {
          validFiles.push(f);
        }
      }
      if (validFiles.length === 0) {
        toast({ title: "Formato invalido. Use arquivos Excel (.xlsx, .xls) ou CSV", variant: "destructive" });
        return;
      }
      setSelectedFiles(validFiles);
      setImportResult(null);
      setPreviewData(null);
      setMultiPreviewData([]);
      setImportProgress(null);
      setErrorsIgnored(false);
    }
  };

  const handlePreview = () => {
    if (selectedFiles.length === 0) {
      toast({ title: "Selecione um arquivo", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFiles[0]);
    formData.append("type", importType);
    if (columnConfig.dateCol >= 0) formData.append("dateCol", String(columnConfig.dateCol));
    if (columnConfig.descCol >= 0) formData.append("descCol", String(columnConfig.descCol));
    if (columnConfig.amountCol >= 0) formData.append("amountCol", String(columnConfig.amountCol));
    if (columnConfig.startRow >= 0) formData.append("startRow", String(columnConfig.startRow));
    previewMutation.mutate(formData);
  };

  const getFileType = (file: File): "extrato" | "cartao" => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) return "cartao";
    return "extrato";
  };

  const handleMultiPreview = async () => {
    if (selectedFiles.length === 0) return;
    
    setPreviewProgress({ current: 0, total: selectedFiles.length });
    const previews: { file: File; preview: PreviewResult | null; error?: string }[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setPreviewProgress({ current: i + 1, total: selectedFiles.length });
      
      const fileType = getFileType(file);
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", fileType);
        if (columnConfig.dateCol >= 0) formData.append("dateCol", String(columnConfig.dateCol));
        if (columnConfig.descCol >= 0) formData.append("descCol", String(columnConfig.descCol));
        if (columnConfig.amountCol >= 0) formData.append("amountCol", String(columnConfig.amountCol));
        if (columnConfig.startRow >= 0) formData.append("startRow", String(columnConfig.startRow));
        
        const response = await fetch("/api/import/preview", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          previews.push({ file, preview: null, error: "Erro ao processar arquivo" });
        } else {
          const data = await response.json();
          previews.push({ file, preview: data });
        }
      } catch {
        previews.push({ file, preview: null, error: "Erro de conexão" });
      }
    }
    
    setPreviewProgress(null);
    setMultiPreviewData(previews);
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) return;
    
    setImportProgress({ current: 0, total: selectedFiles.length, results: [] });
    const results: ImportResult[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setImportProgress(prev => prev ? { ...prev, current: i + 1 } : null);
      
      const fileType = selectedFiles.length === 1 ? importType : getFileType(file);
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", fileType);
        if (importBankAccountId && importBankAccountId !== "none") {
          formData.append("bankAccountId", importBankAccountId);
        }
        if (columnConfig.dateCol >= 0) formData.append("dateCol", String(columnConfig.dateCol));
        if (columnConfig.descCol >= 0) formData.append("descCol", String(columnConfig.descCol));
        if (columnConfig.amountCol >= 0) formData.append("amountCol", String(columnConfig.amountCol));
        if (columnConfig.startRow >= 0) formData.append("startRow", String(columnConfig.startRow));
        
        const response = await fetch("/api/import/excel", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          results.push({ success: false, imported: 0, errors: [`${file.name}: ${errorText || "Erro desconhecido"}`], duplicates: 0 });
        } else {
          const data = await response.json();
          results.push({ ...data, fileName: file.name });
        }
      } catch (err) {
        results.push({ success: false, imported: 0, errors: [`${file.name}: ${err instanceof Error ? err.message : "Erro de conexão"}`], duplicates: 0 });
      }
    }
    
    setImportProgress(prev => prev ? { ...prev, results } : null);
    
    const totalImported = results.reduce((sum, r) => sum + (r.imported || 0), 0);
    const totalDuplicates = results.reduce((sum, r) => sum + (r.duplicates || 0), 0);
    
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions/uncategorized"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/maintenance/import-groups"] });
    
    if (totalImported > 0 || totalDuplicates > 0) {
      toast({ title: `${totalImported} transacoes importadas, ${totalDuplicates} duplicadas ignoradas` });
    } else {
      toast({ title: "Nenhuma transacao importada", variant: "destructive" });
    }
    
    setSelectedFiles([]);
    setMultiPreviewData([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []);
    const validTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"];
    const validFiles = files.filter(f => 
      validTypes.includes(f.type) || f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv")
    );
    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setImportResult(null);
      setPreviewData(null);
      setMultiPreviewData([]);
      setImportProgress(null);
      setErrorsIgnored(false);
    }
  };

  const toggleId = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleGroupIds = (ids: number[], keepFirst: boolean = false) => {
    const idsToToggle = keepFirst ? ids.slice(1) : ids;
    const newSelected = new Set(selectedIds);
    const allSelected = idsToToggle.every(id => newSelected.has(id));
    
    if (allSelected) {
      idsToToggle.forEach(id => newSelected.delete(id));
    } else {
      idsToToggle.forEach(id => newSelected.add(id));
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      deleteMutation.mutate(ids);
    }
  };

  const handleFixSign = () => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      fixSignMutation.mutate(ids);
    }
  };

  const handleConsolidateAll = () => {
    const idsToDelete: number[] = [];
    filteredDuplicates.forEach(group => {
      idsToDelete.push(...group.ids.slice(1));
    });
    if (idsToDelete.length > 0) {
      deleteMutation.mutate(idsToDelete);
    }
  };

  const selectAllDuplicates = () => {
    const allIds = new Set<number>();
    filteredDuplicates.forEach(group => {
      group.ids.slice(1).forEach(id => allIds.add(id));
    });
    setSelectedIds(allIds);
  };

  const selectAllWrongSign = () => {
    const allIds = new Set(filteredWrongSign.map(t => t.id));
    setSelectedIds(allIds);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const clearFilters = () => {
    setSourceFilter("all");
    setTypeFilter("all");
    setSearchTerm("");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
    setBeneficiaryFilter("all");
    setBankAccountFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = sourceFilter !== "all" || typeFilter !== "all" || searchTerm !== "" || 
    categoryFilter !== "all" || subcategoryFilter !== "all" || beneficiaryFilter !== "all" || 
    bankAccountFilter !== "all" || dateFrom !== "" || dateTo !== "";

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatCurrencyBR = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(2)}`;
  };

  const getSourceIcon = (source: string | null) => {
    if (source === "cartao") return <CreditCard className="h-3 w-3" />;
    if (source === "conta_corrente") return <Building2 className="h-3 w-3" />;
    return <Pencil className="h-3 w-3" />;
  };

  const getSourceLabel = (source: string | null) => {
    if (source === "cartao") return "Cartão";
    if (source === "conta_corrente") return "Conta";
    return "Manual";
  };

  const getCategoryName = (id: number | null) => {
    if (!id) return "-";
    return categories.find(c => c.id === id)?.name || "-";
  };

  const getSubcategoryName = (id: number | null) => {
    if (!id) return "-";
    return subcategories.find(s => s.id === id)?.name || "-";
  };

  const getBeneficiaryName = (id: number | null) => {
    if (!id) return "-";
    return beneficiaries.find(b => b.id === id)?.name || "-";
  };

  const matchesSearch = (text: string) => {
    if (!searchTerm) return true;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  };

  const filteredDuplicates = duplicates.filter(group => {
    if (sourceFilter !== "all" && !group.sources?.includes(sourceFilter)) return false;
    if (typeFilter !== "all" && group.type !== typeFilter) return false;
    if (!matchesSearch(group.description)) return false;
    if (dateFrom && group.date < dateFrom) return false;
    if (dateTo && group.date > dateTo) return false;
    return true;
  });

  const sortTransactions = (txs: Transaction[]) => {
    return [...txs].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "date":
          comparison = a.date.localeCompare(b.date);
          break;
        case "description":
          comparison = (a.shortTitle || a.description).localeCompare(b.shortTitle || b.description);
          break;
        case "amount":
          comparison = parseFloat(a.amount) - parseFloat(b.amount);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "source":
          comparison = (a.source || "").localeCompare(b.source || "");
          break;
        case "category":
          comparison = (a.categoryId || 0) - (b.categoryId || 0);
          break;
        case "importedFrom":
          comparison = (a.importedFrom || "").localeCompare(b.importedFrom || "");
          break;
        default:
          comparison = 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  const filteredWrongSign = sortTransactions(wrongSignTransactions.filter(tx => {
    if (sourceFilter !== "all" && tx.source !== sourceFilter) return false;
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    if (!matchesSearch(tx.description) && !matchesSearch(tx.shortTitle || "")) return false;
    if (categoryFilter !== "all" && tx.categoryId?.toString() !== categoryFilter) return false;
    if (subcategoryFilter !== "all" && tx.subcategoryId?.toString() !== subcategoryFilter) return false;
    if (beneficiaryFilter !== "all" && tx.beneficiaryId?.toString() !== beneficiaryFilter) return false;
    if (bankAccountFilter !== "all" && tx.bankAccountId?.toString() !== bankAccountFilter) return false;
    if (dateFrom && tx.date < dateFrom) return false;
    if (dateTo && tx.date > dateTo) return false;
    return true;
  }));

  const filteredTransactionsForReview = sortTransactions(allTransactions.filter(tx => {
    if (sourceFilter !== "all" && tx.source !== sourceFilter) return false;
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    if (!matchesSearch(tx.description) && !matchesSearch(tx.shortTitle || "") && !matchesSearch(tx.originalDescription || "")) return false;
    if (categoryFilter !== "all" && tx.categoryId?.toString() !== categoryFilter) return false;
    if (subcategoryFilter !== "all" && tx.subcategoryId?.toString() !== subcategoryFilter) return false;
    if (beneficiaryFilter !== "all" && tx.beneficiaryId?.toString() !== beneficiaryFilter) return false;
    if (bankAccountFilter !== "all" && tx.bankAccountId?.toString() !== bankAccountFilter) return false;
    if (dateFrom && tx.date < dateFrom) return false;
    if (dateTo && tx.date > dateTo) return false;
    return true;
  }));

  const filteredSubcategories = subcategories.filter(sub => 
    categoryFilter === "all" || sub.categoryId?.toString() === categoryFilter
  );

  const totalDuplicateRecords = filteredDuplicates.reduce((sum, g) => sum + (g.count - 1), 0);

  // Agrupar transações por arquivo de importação
  interface ImportGroup {
    fileName: string;
    count: number;
    firstDate: string;
    lastDate: string;
    receitas: number;
    despesas: number;
    totalAmount: number;
    ids: number[];
  }
  
  const importGroups: ImportGroup[] = (() => {
    const groups: Record<string, ImportGroup> = {};
    
    allTransactions.forEach(tx => {
      if (!tx.importedFrom) return;
      
      if (!groups[tx.importedFrom]) {
        groups[tx.importedFrom] = {
          fileName: tx.importedFrom,
          count: 0,
          firstDate: tx.date,
          lastDate: tx.date,
          receitas: 0,
          despesas: 0,
          totalAmount: 0,
          ids: [],
        };
      }
      
      const group = groups[tx.importedFrom];
      group.count++;
      group.ids.push(tx.id);
      if (tx.date < group.firstDate) group.firstDate = tx.date;
      if (tx.date > group.lastDate) group.lastDate = tx.date;
      
      const amount = parseFloat(tx.amount);
      if (tx.type === "receita") {
        group.receitas += amount;
      } else {
        group.despesas += amount;
      }
      group.totalAmount += amount;
    });
    
    return Object.values(groups).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  })();

  const [selectedImportFiles, setSelectedImportFiles] = useState<Set<string>>(new Set());
  const [importSortColumn, setImportSortColumn] = useState<"fileName" | "count" | "firstDate" | "receitas" | "despesas">("firstDate");
  const [importSortDirection, setImportSortDirection] = useState<"asc" | "desc">("desc");

  const sortedImportGroups = [...importGroups].sort((a, b) => {
    let comparison = 0;
    switch (importSortColumn) {
      case "fileName":
        comparison = a.fileName.localeCompare(b.fileName);
        break;
      case "count":
        comparison = a.count - b.count;
        break;
      case "firstDate":
        comparison = a.firstDate.localeCompare(b.firstDate);
        break;
      case "receitas":
        comparison = a.receitas - b.receitas;
        break;
      case "despesas":
        comparison = a.despesas - b.despesas;
        break;
    }
    return importSortDirection === "asc" ? comparison : -comparison;
  });

  const handleImportSort = (column: typeof importSortColumn) => {
    if (importSortColumn === column) {
      setImportSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setImportSortColumn(column);
      setImportSortDirection("desc");
    }
  };

  const ImportSortIcon = ({ column }: { column: typeof importSortColumn }) => {
    if (importSortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return importSortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const toggleImportFile = (fileName: string) => {
    const newSet = new Set(selectedImportFiles);
    if (newSet.has(fileName)) {
      newSet.delete(fileName);
    } else {
      newSet.add(fileName);
    }
    setSelectedImportFiles(newSet);
  };

  const selectAllImportFiles = () => {
    setSelectedImportFiles(new Set(importGroups.map(g => g.fileName)));
  };

  const deleteSelectedImports = () => {
    const idsToDelete: number[] = [];
    importGroups.forEach(group => {
      if (selectedImportFiles.has(group.fileName)) {
        idsToDelete.push(...group.ids);
      }
    });
    if (idsToDelete.length > 0) {
      deleteMutation.mutate(idsToDelete, {
        onSuccess: () => {
          setSelectedImportFiles(new Set());
        }
      });
    }
  };

  const totalSelectedImportRecords = importGroups
    .filter(g => selectedImportFiles.has(g.fileName))
    .reduce((sum, g) => sum + g.count, 0);

  return (
    <div>
      <PageHeader title="Manutencao de Dados" subtitle="Identifique e corrija problemas nos registros" />
      <div className="px-4 py-3 space-y-4">
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <Input
                placeholder="Descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9"
                data-testid="input-search"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Origem</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-9" data-testid="select-source-filter">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="conta_corrente">Conta Corrente</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9" data-testid="select-type-filter">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setSubcategoryFilter("all"); }}>
                <SelectTrigger className="h-9" data-testid="select-category-filter">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Subcategoria</Label>
              <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
                <SelectTrigger className="h-9" data-testid="select-subcategory-filter">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {filteredSubcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id.toString()}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Beneficiário</Label>
              <Select value={beneficiaryFilter} onValueChange={setBeneficiaryFilter}>
                <SelectTrigger className="h-9" data-testid="select-beneficiary-filter">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {beneficiaries.map(b => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Conta</Label>
              <Select value={bankAccountFilter} onValueChange={setBankAccountFilter}>
                <SelectTrigger className="h-9" data-testid="select-bank-filter">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {bankAccounts.map(ba => (
                    <SelectItem key={ba.id} value={ba.id.toString()}>{ba.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Data De</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 justify-start text-left font-normal" data-testid="button-date-from">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(parseISO(dateFrom), "dd/MM/yy", { locale: ptBR }) : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom ? parseISO(dateFrom) : undefined}
                    onSelect={(date) => setDateFrom(date ? format(date, "yyyy-MM-dd") : "")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Data Até</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 justify-start text-left font-normal" data-testid="button-date-to">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(parseISO(dateTo), "dd/MM/yy", { locale: ptBR }) : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo ? parseISO(dateTo) : undefined}
                    onSelect={(date) => setDateTo(date ? format(date, "yyyy-MM-dd") : "")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {hasActiveFilters && (
              <div className="flex flex-col gap-1 justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9" data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              </div>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Badge variant="secondary">{selectedIds.size} selecionados</Badge>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Limpar Seleção
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-selected"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleFixSign}
                disabled={fixSignMutation.isPending}
                data-testid="button-fix-sign-selected"
              >
                <ArrowUpDown className="h-4 w-4 mr-1" />
                Inverter Tipo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); setExpandedGroups(new Set()); }}>
        <TabsList>
          <TabsTrigger value="duplicatas" data-testid="tab-duplicatas">
            Duplicatas {filteredDuplicates.length > 0 && <Badge variant="destructive" className="ml-2">{filteredDuplicates.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sinais" data-testid="tab-sinais">
            Sinais Suspeitos {filteredWrongSign.length > 0 && <Badge variant="destructive" className="ml-2">{filteredWrongSign.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="revisao" data-testid="tab-revisao">
            Revisão Geral ({filteredTransactionsForReview.length})
          </TabsTrigger>
          <TabsTrigger value="importacoes" data-testid="tab-importacoes">
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Por Importação ({importGroups.length})
          </TabsTrigger>
          <TabsTrigger value="importar" data-testid="tab-importar">
            <Upload className="h-4 w-4 mr-1" />
            Importar Extrato
          </TabsTrigger>
        </TabsList>

        <TabsContent value="duplicatas" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-lg">Registros Duplicados</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => refetchDuplicates()} data-testid="button-refresh-duplicates">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Atualizar
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectAllDuplicates} disabled={filteredDuplicates.length === 0} data-testid="button-select-all-duplicates">
                    Selecionar Duplicados
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleConsolidateAll} disabled={filteredDuplicates.length === 0 || deleteMutation.isPending} data-testid="button-consolidate-all">
                    Consolidar Todos ({totalDuplicateRecords})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDuplicates ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : filteredDuplicates.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhuma duplicata encontrada</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-4">
                    Clique em um grupo para expandir e ver os detalhes de cada registro. Selecione os que deseja excluir.
                  </p>
                  <div className="max-h-[600px] overflow-y-auto space-y-1">
                    {filteredDuplicates.map((group, idx) => {
                      const duplicateIds = group.ids.slice(1);
                      const allDupsSelected = duplicateIds.length > 0 && duplicateIds.every(id => selectedIds.has(id));
                      const isExpanded = expandedGroups.has(idx);
                      const details = groupDetails[idx] || [];

                      return (
                        <div key={idx} className="border rounded-md">
                          <div
                            className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleGroup(idx, group.ids)}
                          >
                            <div onClick={e => e.stopPropagation()}>
                              <Checkbox
                                checked={allDupsSelected}
                                onCheckedChange={() => toggleGroupIds(group.ids, true)}
                                data-testid={`checkbox-duplicate-${idx}`}
                                title="Selecionar duplicados (mantém primeiro)"
                              />
                            </div>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="text-sm font-mono">{formatDate(group.date)}</span>
                            <span className="text-sm flex-1 truncate" title={group.description}>{group.description}</span>
                            <div className="flex gap-1">
                              {(group.sources || []).map((src, i) => (
                                <Badge key={i} variant="outline" className="text-xs flex items-center gap-1">
                                  {getSourceIcon(src)}
                                  {getSourceLabel(src)}
                                </Badge>
                              ))}
                            </div>
                            <Badge variant={group.type === "receita" ? "default" : "secondary"}>
                              {group.type === "receita" ? "Receita" : "Despesa"}
                            </Badge>
                            <span className={`text-sm font-mono ${group.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(group.amount)}
                            </span>
                            <Badge variant="destructive">{group.count}x</Badge>
                          </div>

                          {isExpanded && (
                            <div className="border-t bg-muted/30 p-2">
                              {details.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2 text-center">Carregando detalhes...</p>
                              ) : (() => {
                                const first = details[0];
                                const hasDiff = (field: keyof Transaction) => {
                                  const values = details.map(tx => {
                                    const val = tx[field];
                                    if (val === null || val === undefined) return "";
                                    return String(val);
                                  });
                                  return new Set(values).size > 1;
                                };
                                const diffClass = "bg-yellow-100 dark:bg-yellow-900/40";
                                
                                return (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="p-1 text-left w-8"></th>
                                      <th className="p-1 text-left">ID</th>
                                      <th className={`p-1 text-left ${hasDiff("transactionDate") ? diffClass : ""}`}>Data Trans.</th>
                                      <th className={`p-1 text-left ${hasDiff("paymentDate") ? diffClass : ""}`}>Data Pgto.</th>
                                      <th className="p-1 text-left">Origem</th>
                                      <th className={`p-1 text-left ${hasDiff("importedFrom") ? diffClass : ""}`}>Arquivo</th>
                                      <th className={`p-1 text-left ${hasDiff("importedFromRow") ? diffClass : ""}`}>Linha</th>
                                      <th className={`p-1 text-left ${hasDiff("originalDescription") ? diffClass : ""}`}>Descrição Original</th>
                                      <th className={`p-1 text-left ${hasDiff("shortTitle") ? diffClass : ""}`}>Título Breve</th>
                                      <th className={`p-1 text-left ${hasDiff("installmentCurrent") ? diffClass : ""}`}>Parcela</th>
                                      <th className={`p-1 text-left ${hasDiff("cardBillMonth") ? diffClass : ""}`}>Mês Fatura</th>
                                      <th className={`p-1 text-left ${hasDiff("categoryId") ? diffClass : ""}`}>Categoria</th>
                                      <th className={`p-1 text-left ${hasDiff("status") ? diffClass : ""}`}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {details.map((tx, i) => {
                                      const isDiff = (field: keyof Transaction) => {
                                        const firstVal = first[field] ?? "";
                                        const txVal = tx[field] ?? "";
                                        return String(firstVal) !== String(txVal);
                                      };
                                      
                                      return (
                                      <tr key={tx.id} className={`border-b ${i === 0 ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
                                        <td className="p-1">
                                          {i === 0 ? (
                                            <Badge variant="outline" className="text-[10px]">1º</Badge>
                                          ) : (
                                            <Checkbox
                                              checked={selectedIds.has(tx.id)}
                                              onCheckedChange={() => toggleId(tx.id)}
                                              data-testid={`checkbox-detail-${tx.id}`}
                                            />
                                          )}
                                        </td>
                                        <td className="p-1 font-mono text-muted-foreground">{tx.id}</td>
                                        <td className={`p-1 font-mono ${i > 0 && isDiff("transactionDate") ? diffClass : ""}`}>
                                          {formatDate(tx.transactionDate || tx.date)}
                                        </td>
                                        <td className={`p-1 font-mono ${i > 0 && isDiff("paymentDate") ? diffClass : ""}`}>
                                          {formatDate(tx.paymentDate || tx.date)}
                                        </td>
                                        <td className="p-1">
                                          <Badge variant="outline" className="text-[10px] flex items-center gap-1 w-fit">
                                            {getSourceIcon(tx.source)}
                                            {getSourceLabel(tx.source)}
                                          </Badge>
                                        </td>
                                        <td className={`p-1 max-w-[120px] truncate text-muted-foreground ${i > 0 && isDiff("importedFrom") ? diffClass : ""}`} title={tx.importedFrom || ""}>
                                          {tx.importedFrom || "-"}
                                        </td>
                                        <td className={`p-1 font-mono text-center ${i > 0 && isDiff("importedFromRow") ? diffClass : ""}`}>
                                          {(tx as any).importedFromRow || "-"}
                                        </td>
                                        <td className={`p-1 max-w-[160px] truncate ${i > 0 && isDiff("originalDescription") ? diffClass : ""}`} title={tx.originalDescription || tx.description}>
                                          {tx.originalDescription || tx.description}
                                        </td>
                                        <td className={`p-1 ${i > 0 && isDiff("shortTitle") ? diffClass : ""}`}>
                                          {tx.shortTitle || "-"}
                                        </td>
                                        <td className={`p-1 ${i > 0 && isDiff("installmentCurrent") ? diffClass : ""}`}>
                                          {tx.installmentCurrent && tx.installmentTotal
                                            ? `${tx.installmentCurrent}/${tx.installmentTotal}`
                                            : "-"}
                                        </td>
                                        <td className={`p-1 font-mono ${i > 0 && isDiff("cardBillMonth") ? diffClass : ""}`}>
                                          {tx.cardBillMonth || "-"}
                                        </td>
                                        <td className={`p-1 ${i > 0 && isDiff("categoryId") ? diffClass : ""}`}>
                                          {getCategoryName(tx.categoryId)}
                                          {tx.subcategoryId && ` > ${getSubcategoryName(tx.subcategoryId)}`}
                                        </td>
                                        <td className={`p-1 ${i > 0 && isDiff("status") ? diffClass : ""}`}>
                                          <Badge variant={tx.status === "realizada" ? "default" : "secondary"} className="text-[10px]">
                                            {tx.status}
                                          </Badge>
                                        </td>
                                      </tr>
                                    )})}
                                  </tbody>
                                </table>
                              )})()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sinais" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-lg">Transações com Sinal Possivelmente Incorreto</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => refetchWrongSign()} data-testid="button-refresh-wrong-sign">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingWrongSign ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : filteredWrongSign.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhuma transação com sinal suspeito encontrada
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-4">
                    Transações de cartão marcadas como receita mas que não são estornos.
                  </p>
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background border-b z-10">
                        <tr>
                          <th className="p-2 text-left w-10">
                            <Checkbox
                              checked={filteredWrongSign.length > 0 && filteredWrongSign.every(tx => selectedIds.has(tx.id))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  selectAllWrongSign();
                                } else {
                                  clearSelection();
                                }
                              }}
                              data-testid="checkbox-select-all-wrong-sign"
                            />
                          </th>
                          <SortHeader column="date">Data</SortHeader>
                          <SortHeader column="description">Descrição</SortHeader>
                          <SortHeader column="source">Origem</SortHeader>
                          <SortHeader column="type">Tipo</SortHeader>
                          <th className="p-2">Categoria</th>
                          <th className="p-2 text-right cursor-pointer hover:bg-muted/50 select-none" onClick={() => toggleSort("amount")}>
                            <div className="flex items-center justify-end gap-1">
                              Valor
                              {sortColumn === "amount" ? (
                                sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                              )}
                            </div>
                          </th>
                          <SortHeader column="importedFrom">Arquivo</SortHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWrongSign.map((tx) => (
                          <tr key={tx.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">
                              <Checkbox
                                checked={selectedIds.has(tx.id)}
                                onCheckedChange={() => toggleId(tx.id)}
                                data-testid={`checkbox-wrong-sign-${tx.id}`}
                              />
                            </td>
                            <td className="p-2 whitespace-nowrap">{formatDate(tx.date)}</td>
                            <td className="p-2 max-w-[250px] truncate" title={tx.originalDescription || tx.description}>
                              {tx.shortTitle || tx.description}
                            </td>
                            <td className="p-2">
                              <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                {getSourceIcon(tx.source)}
                                {getSourceLabel(tx.source)}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <Badge variant={tx.type === "receita" ? "default" : "secondary"}>
                                {tx.type === "receita" ? "Receita" : "Despesa"}
                              </Badge>
                            </td>
                            <td className="p-2 text-xs">
                              {tx.categoryId ? (
                                <Badge variant="outline" className="text-xs">
                                  {categories.find(c => c.id === tx.categoryId)?.name || "-"}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className={`p-2 text-right font-mono ${tx.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground max-w-[150px] truncate" title={tx.importedFrom || ""}>
                              {tx.importedFrom || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revisao" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-lg">Revisão Geral de Transações</CardTitle>
                <Badge variant="outline">{filteredTransactionsForReview.length} registros</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Use os filtros acima para encontrar transações específicas. Selecione e use as ações em massa.
              </p>
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background border-b z-10">
                    <tr>
                      <th className="p-1.5 text-left w-8">
                        <Checkbox
                          checked={filteredTransactionsForReview.slice(0, 100).length > 0 && 
                                   filteredTransactionsForReview.slice(0, 100).every(tx => selectedIds.has(tx.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const allIds = new Set(filteredTransactionsForReview.slice(0, 100).map(t => t.id));
                              setSelectedIds(allIds);
                            } else {
                              clearSelection();
                            }
                          }}
                          data-testid="checkbox-select-all-review"
                        />
                      </th>
                      <SortHeader column="date">Data</SortHeader>
                      <SortHeader column="source">Origem</SortHeader>
                      <th className="p-1.5 text-left">Descrição Original</th>
                      <SortHeader column="description">Título</SortHeader>
                      <SortHeader column="type">Tipo</SortHeader>
                      <th className="p-1.5 text-right cursor-pointer hover:bg-muted/50 select-none" onClick={() => toggleSort("amount")}>
                        <div className="flex items-center justify-end gap-1">
                          Valor
                          {sortColumn === "amount" ? (
                            sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </div>
                      </th>
                      <SortHeader column="category">Categoria</SortHeader>
                      <SortHeader column="importedFrom">Arquivo</SortHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactionsForReview.slice(0, 100).map((tx) => (
                      <tr key={tx.id} className="border-b hover:bg-muted/50">
                        <td className="p-1.5">
                          <Checkbox
                            checked={selectedIds.has(tx.id)}
                            onCheckedChange={() => toggleId(tx.id)}
                            data-testid={`checkbox-review-${tx.id}`}
                          />
                        </td>
                        <td className="p-1.5 whitespace-nowrap font-mono">{formatDate(tx.date)}</td>
                        <td className="p-1.5">
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1 w-fit">
                            {getSourceIcon(tx.source)}
                            {getSourceLabel(tx.source)}
                          </Badge>
                        </td>
                        <td className="p-1.5 max-w-[200px] truncate" title={tx.originalDescription || tx.description}>
                          {tx.originalDescription || tx.description}
                        </td>
                        <td className="p-1.5 max-w-[120px] truncate">{tx.shortTitle || "-"}</td>
                        <td className="p-1.5">
                          <Badge variant={tx.type === "receita" ? "default" : "secondary"} className="text-[10px]">
                            {tx.type === "receita" ? "R" : "D"}
                          </Badge>
                        </td>
                        <td className={`p-1.5 text-right font-mono ${tx.type === "receita" ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="p-1.5 text-muted-foreground max-w-[100px] truncate">
                          {getCategoryName(tx.categoryId)}
                        </td>
                        <td className="p-1.5 text-muted-foreground max-w-[100px] truncate" title={tx.importedFrom || ""}>
                          {tx.importedFrom?.replace(/^(fatura-|extrato-)/, '').replace(/\.(csv|xls)$/, '') || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTransactionsForReview.length > 100 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    Mostrando 100 de {filteredTransactionsForReview.length} registros. Use os filtros para refinar.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importacoes" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Registros por Arquivo de Importação</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllImportFiles}
                    disabled={importGroups.length === 0}
                    data-testid="button-select-all-imports"
                  >
                    Selecionar Todos
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={deleteSelectedImports}
                    disabled={selectedImportFiles.size === 0 || deleteMutation.isPending}
                    data-testid="button-delete-imports"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir Selecionados ({totalSelectedImportRecords})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione arquivos de importação para excluir todos os registros associados de uma vez.
              </p>
              {importGroups.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum registro importado encontrado</p>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background border-b z-10">
                      <tr>
                        <th className="p-2 text-left w-10">
                          <Checkbox
                            checked={importGroups.length > 0 && importGroups.every(g => selectedImportFiles.has(g.fileName))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                selectAllImportFiles();
                              } else {
                                setSelectedImportFiles(new Set());
                              }
                            }}
                            data-testid="checkbox-select-all-imports"
                          />
                        </th>
                        <th 
                          className="p-2 text-left cursor-pointer hover:bg-muted/50"
                          onClick={() => handleImportSort("fileName")}
                        >
                          <div className="flex items-center">
                            Arquivo
                            <ImportSortIcon column="fileName" />
                          </div>
                        </th>
                        <th 
                          className="p-2 text-center cursor-pointer hover:bg-muted/50"
                          onClick={() => handleImportSort("count")}
                        >
                          <div className="flex items-center justify-center">
                            Registros
                            <ImportSortIcon column="count" />
                          </div>
                        </th>
                        <th 
                          className="p-2 text-left cursor-pointer hover:bg-muted/50"
                          onClick={() => handleImportSort("firstDate")}
                        >
                          <div className="flex items-center">
                            Período
                            <ImportSortIcon column="firstDate" />
                          </div>
                        </th>
                        <th 
                          className="p-2 text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleImportSort("receitas")}
                        >
                          <div className="flex items-center justify-end">
                            Receitas
                            <ImportSortIcon column="receitas" />
                          </div>
                        </th>
                        <th 
                          className="p-2 text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleImportSort("despesas")}
                        >
                          <div className="flex items-center justify-end">
                            Despesas
                            <ImportSortIcon column="despesas" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedImportGroups.map((group) => (
                        <tr 
                          key={group.fileName} 
                          className={`border-b hover:bg-muted/50 ${selectedImportFiles.has(group.fileName) ? 'bg-destructive/10' : ''}`}
                        >
                          <td className="p-2">
                            <Checkbox
                              checked={selectedImportFiles.has(group.fileName)}
                              onCheckedChange={() => toggleImportFile(group.fileName)}
                              data-testid={`checkbox-import-${group.fileName}`}
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{group.fileName}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="outline">{group.count}</Badge>
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {formatDate(group.firstDate)} - {formatDate(group.lastDate)}
                          </td>
                          <td className="p-2 text-right text-success">
                            {group.receitas > 0 && `+${formatCurrencyBR(group.receitas)}`}
                          </td>
                          <td className="p-2 text-right text-destructive">
                            {group.despesas > 0 && `-${formatCurrencyBR(group.despesas)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Importação */}
        <TabsContent value="importar" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importar Extrato Bancário
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Importe extratos de conta corrente (XLS) ou faturas de cartão de crédito (CSV) do Itaú
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tipo de Importação */}
              <div className="grid gap-4 md:grid-cols-2">
                {selectedFiles.length <= 1 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de Arquivo</label>
                    <Select value={importType} onValueChange={(v) => setImportType(v as "extrato" | "cartao")}>
                      <SelectTrigger data-testid="select-import-type">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="extrato">Extrato de Conta Corrente (XLS)</SelectItem>
                        <SelectItem value="cartao">Fatura de Cartão de Crédito (CSV)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedFiles.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de Arquivo</label>
                    <p className="text-sm text-muted-foreground py-2">
                      Detectado automaticamente (XLS=Extrato, CSV=Fatura)
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Conta Bancária (opcional)</label>
                  <Select value={importBankAccountId} onValueChange={setImportBankAccountId}>
                    <SelectTrigger data-testid="select-import-bank-account">
                      <SelectValue placeholder="Selecione uma conta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {bankAccounts.map((acc: BankAccount) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Área de Upload */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                data-testid="drop-zone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file"
                />
                {selectedFiles.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{selectedFiles.length} arquivo(s) selecionado(s)</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFiles([]);
                          setPreviewData(null);
                          setMultiPreviewData([]);
                          setImportResult(null);
                          setImportProgress(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        data-testid="button-clear-files"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Limpar
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedFiles.map((file, idx) => {
                        const detectedType = getFileType(file);
                        return (
                          <div key={idx} className="flex items-center gap-2 text-left text-sm bg-muted/50 rounded px-2 py-1">
                            <FileSpreadsheet className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="truncate flex-1">{file.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {detectedType === "cartao" ? "Fatura" : "Extrato"}
                            </Badge>
                            <span className="text-muted-foreground text-xs">{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Clique ou arraste arquivos para importar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      XLS = Extrato | CSV = Fatura (detectado automaticamente)
                    </p>
                  </div>
                )}
              </div>

              {/* Configuração Avançada */}
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                  className="text-xs text-muted-foreground"
                  data-testid="button-toggle-advanced"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  {showAdvancedConfig ? "Ocultar" : "Mostrar"} Configuração de Colunas
                </Button>
                
                {showAdvancedConfig && (
                  <div className="grid grid-cols-4 gap-2 p-3 bg-muted/50 rounded-md">
                    <div className="space-y-1">
                      <Label className="text-xs">Linha Inicial (0 = auto)</Label>
                      <Input
                        type="number"
                        min="-1"
                        value={columnConfig.startRow < 0 ? "" : columnConfig.startRow}
                        onChange={(e) => setColumnConfig(prev => ({
                          ...prev,
                          startRow: e.target.value === "" ? -1 : parseInt(e.target.value)
                        }))}
                        placeholder="Auto"
                        className="h-8 text-xs"
                        data-testid="input-start-row"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coluna Data (0 = A)</Label>
                      <Input
                        type="number"
                        min="-1"
                        value={columnConfig.dateCol < 0 ? "" : columnConfig.dateCol}
                        onChange={(e) => setColumnConfig(prev => ({
                          ...prev,
                          dateCol: e.target.value === "" ? -1 : parseInt(e.target.value)
                        }))}
                        placeholder="Auto"
                        className="h-8 text-xs"
                        data-testid="input-date-col"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coluna Descrição (1 = B)</Label>
                      <Input
                        type="number"
                        min="-1"
                        value={columnConfig.descCol < 0 ? "" : columnConfig.descCol}
                        onChange={(e) => setColumnConfig(prev => ({
                          ...prev,
                          descCol: e.target.value === "" ? -1 : parseInt(e.target.value)
                        }))}
                        placeholder="Auto"
                        className="h-8 text-xs"
                        data-testid="input-desc-col"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coluna Valor (3 = D)</Label>
                      <Input
                        type="number"
                        min="-1"
                        value={columnConfig.amountCol < 0 ? "" : columnConfig.amountCol}
                        onChange={(e) => setColumnConfig(prev => ({
                          ...prev,
                          amountCol: e.target.value === "" ? -1 : parseInt(e.target.value)
                        }))}
                        placeholder="Auto"
                        className="h-8 text-xs"
                        data-testid="input-amount-col"
                      />
                    </div>
                    <div className="col-span-4">
                      <p className="text-[10px] text-muted-foreground">
                        Deixe vazio para detecção automática. Use 0 para coluna A, 1 para B, etc.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-2">
                {/* Botão Visualizar - sempre disponível */}
                <Button
                  onClick={selectedFiles.length === 1 ? handlePreview : handleMultiPreview}
                  disabled={selectedFiles.length === 0 || previewMutation.isPending || previewProgress !== null}
                  variant="outline"
                  data-testid="button-preview"
                >
                  {previewMutation.isPending || previewProgress !== null ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {previewProgress ? `Validando ${previewProgress.current}/${previewProgress.total}...` : "Processando..."}
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Validar {selectedFiles.length > 1 ? `(${selectedFiles.length})` : ""}
                    </>
                  )}
                </Button>
                
                {/* Botão Importar - só após validação */}
                <Button
                  onClick={handleImport}
                  disabled={
                    selectedFiles.length === 0 || 
                    importProgress !== null || 
                    (selectedFiles.length === 1 && !previewData) ||
                    (selectedFiles.length > 1 && multiPreviewData.length === 0)
                  }
                  data-testid="button-import"
                >
                  {importProgress !== null ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando {importProgress.current}/{importProgress.total}...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar {selectedFiles.length > 1 ? `(${selectedFiles.length})` : ""}
                    </>
                  )}
                </Button>
              </div>

              {/* Preview */}
              {previewData && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Prévia da Importação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold">{previewData.summary.totalTransactions}</p>
                        <p className="text-xs text-muted-foreground">Total de Linhas</p>
                      </div>
                      <div className="p-3 bg-green-500/10 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">{formatCurrencyBR(previewData.summary.totalReceitas)}</p>
                        <p className="text-xs text-muted-foreground">Receitas</p>
                      </div>
                      <div className="p-3 bg-red-500/10 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-600">{formatCurrencyBR(previewData.summary.totalDespesas)}</p>
                        <p className="text-xs text-muted-foreground">Despesas</p>
                      </div>
                      <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600">{previewData.summary.withInstallments}</p>
                        <p className="text-xs text-muted-foreground">Parcelamentos</p>
                      </div>
                    </div>
                    {previewData.transactions.length > 0 && (
                      <div className="max-h-[200px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background">
                            <tr className="border-b">
                              <th className="p-2 text-left">Data</th>
                              <th className="p-2 text-left">Descrição</th>
                              <th className="p-2 text-right">Valor</th>
                              <th className="p-2 text-center">Tipo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.transactions.slice(0, 10).map((item: PreviewTransaction, idx: number) => (
                              <tr key={idx} className="border-b">
                                <td className="p-2">{formatDate(item.date)}</td>
                                <td className="p-2 truncate max-w-[200px]">{item.description}</td>
                                <td className={`p-2 text-right ${item.type === "despesa" ? "text-destructive" : "text-green-600"}`}>
                                  {formatCurrency(item.amount)}
                                </td>
                                <td className="p-2 text-center">
                                  <Badge variant={item.type === "receita" ? "secondary" : "destructive"}>
                                    {item.type}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Preview de Múltiplos Arquivos */}
              {multiPreviewData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Prévia da Importação ({multiPreviewData.length} arquivos)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-2xl font-bold">
                          {multiPreviewData.reduce((sum, p) => sum + (p.preview?.summary.totalTransactions || 0), 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total de Linhas</p>
                      </div>
                      <div className="p-3 bg-green-500/10 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrencyBR(multiPreviewData.reduce((sum, p) => sum + (p.preview?.summary.totalReceitas || 0), 0))}
                        </p>
                        <p className="text-xs text-muted-foreground">Receitas</p>
                      </div>
                      <div className="p-3 bg-red-500/10 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {formatCurrencyBR(multiPreviewData.reduce((sum, p) => sum + (p.preview?.summary.totalDespesas || 0), 0))}
                        </p>
                        <p className="text-xs text-muted-foreground">Despesas</p>
                      </div>
                      <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {multiPreviewData.reduce((sum, p) => sum + (p.preview?.summary.withInstallments || 0), 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Parcelamentos</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {multiPreviewData.map((item, idx) => {
                        const detectedType = getFileType(item.file);
                        return (
                          <div key={idx} className={`flex items-center justify-between p-2 rounded text-sm ${item.error ? "bg-destructive/10" : "bg-muted/50"}`}>
                            <div className="flex items-center gap-2">
                              {item.error ? (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                              <span className="truncate max-w-[200px]">{item.file.name}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {detectedType === "cartao" ? "Fatura" : "Extrato"}
                              </Badge>
                            </div>
                            {item.preview ? (
                              <span className="text-muted-foreground">
                                {item.preview.summary.totalTransactions} transações
                              </span>
                            ) : (
                              <span className="text-destructive">{item.error}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {multiPreviewData.some(p => p.error) && (
                      <div className="mt-3 pt-3 border-t flex items-center justify-between">
                        <span className="text-sm text-destructive">
                          {multiPreviewData.filter(p => p.error).length} arquivo(s) com erro
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setErrorsIgnored(true)}
                        >
                          Ignorar erros e continuar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Resultado da Importação em Lote */}
              {importProgress && importProgress.results.length > 0 && (
                <Card className="border-primary/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Resultado da Importação ({importProgress.results.length} arquivo(s))
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {importProgress.results.map((result, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-2 rounded text-sm ${result.success ? "bg-green-500/10" : "bg-destructive/10"}`}>
                          <div className="flex items-center gap-2">
                            {result.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span>{result.fileName || `Arquivo ${idx + 1}`}</span>
                          </div>
                          <span className={result.success ? "text-green-600" : "text-destructive"}>
                            {result.imported} importado(s)
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t text-sm font-medium">
                      Total: {importProgress.results.reduce((sum, r) => sum + (r.imported || 0), 0)} transações importadas
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resultado da Importação */}
              {importResult && (
                <Card className={importResult.success ? "border-green-500/50" : "border-destructive/50"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {importResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                      Resultado da Importação
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium mb-2">
                      {importResult.imported} transações importadas
                    </p>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-destructive font-medium">
                          Erros ({importResult.errors.length}):
                        </p>
                        <div className="max-h-[150px] overflow-y-auto bg-muted p-2 rounded text-xs">
                          {importResult.errors.map((err, idx) => (
                            <p key={idx} className="text-destructive">{err}</p>
                          ))}
                        </div>
                        {!errorsIgnored && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setErrorsIgnored(true);
                              toast({ title: "Erros ignorados. Importação marcada como bem-sucedida." });
                            }}
                            data-testid="button-ignore-errors"
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Ignorar Erros
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
