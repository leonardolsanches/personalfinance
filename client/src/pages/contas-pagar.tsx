import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Receipt, Check, AlertCircle, Calendar } from "lucide-react";
import type { Payable, Category, Subcategory } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/page-header";
import { useColumnWidths } from "@/hooks/use-column-widths";
import { ResizeHandle } from "@/components/resize-handle";

const payableFormSchema = z.object({
  description: z.string().min(1, "Descricao e obrigatoria"),
  amount: z.string().min(1, "Valor e obrigatorio"),
  dueDate: z.string().min(1, "Data de vencimento e obrigatoria"),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  isInstallment: z.boolean().default(false),
  totalInstallments: z.string().optional(),
  notes: z.string().optional(),
});

type PayableFormValues = z.infer<typeof payableFormSchema>;

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

function getStatusVariant(status: string, dueDate: string) {
  if (status === "pago") return "default";
  const today = new Date();
  const due = new Date(dueDate);
  if (due < today) return "destructive";
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  if (due <= sevenDaysFromNow) return "secondary";
  return "outline";
}

function getStatusLabel(status: string, dueDate: string) {
  if (status === "pago") return "Pago";
  const today = new Date();
  const due = new Date(dueDate);
  if (due < today) return "Vencido";
  return "Pendente";
}

export default function ContasPagar() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pendente" | "pago" | "vencido">("all");

  const defaultColWidths = { vencimento: 80, descricao: 0, categoria: 100, parcela: 60, status: 80, valor: 90, acoes: 80 };
  const { colWidths, handleResizeStart } = useColumnWidths("contas-pagar", defaultColWidths);

  const { data: payables = [], isLoading } = useQuery<Payable[]>({
    queryKey: ["/api/payables"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const form = useForm<PayableFormValues>({
    resolver: zodResolver(payableFormSchema),
    defaultValues: {
      description: "",
      amount: "",
      dueDate: new Date().toISOString().split("T")[0],
      categoryId: "",
      subcategoryId: "",
      isInstallment: false,
      totalInstallments: "",
      notes: "",
    },
  });

  const selectedCategoryId = form.watch("categoryId");
  const isInstallment = form.watch("isInstallment");

  const expenseCategories = categories.filter((c) => c.active);
  const filteredSubcategories = subcategories.filter(
    (s) => s.categoryId === Number(selectedCategoryId) && s.active
  );

  const createMutation = useMutation({
    mutationFn: async (data: PayableFormValues) => {
      return apiRequest("POST", "/api/payables", {
        ...data,
        amount: data.amount,
        categoryId: data.categoryId ? Number(data.categoryId) : null,
        subcategoryId: data.subcategoryId ? Number(data.subcategoryId) : null,
        totalInstallments: data.totalInstallments ? Number(data.totalInstallments) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Conta a pagar criada com sucesso!" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar conta a pagar", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PayableFormValues> }) => {
      return apiRequest("PATCH", `/api/payables/${id}`, {
        ...data,
        amount: data.amount,
        categoryId: data.categoryId ? Number(data.categoryId) : null,
        subcategoryId: data.subcategoryId ? Number(data.subcategoryId) : null,
        totalInstallments: data.totalInstallments ? Number(data.totalInstallments) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Conta a pagar atualizada com sucesso!" });
      setDialogOpen(false);
      setEditingPayable(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar conta a pagar", variant: "destructive" });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("PATCH", `/api/payables/${id}/pay`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Conta marcada como paga!" });
    },
    onError: () => {
      toast({ title: "Erro ao marcar como paga", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/payables/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Conta a pagar excluida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir conta a pagar", variant: "destructive" });
    },
  });

  const handleOpenDialog = (payable?: Payable) => {
    if (payable) {
      setEditingPayable(payable);
      form.reset({
        description: payable.description,
        amount: String(payable.amount),
        dueDate: payable.dueDate,
        categoryId: payable.categoryId ? String(payable.categoryId) : "",
        subcategoryId: payable.subcategoryId ? String(payable.subcategoryId) : "",
        isInstallment: payable.isInstallment || false,
        totalInstallments: payable.totalInstallments ? String(payable.totalInstallments) : "",
        notes: payable.notes || "",
      });
    } else {
      setEditingPayable(null);
      form.reset();
    }
    setDialogOpen(true);
  };

  const onSubmit = (data: PayableFormValues) => {
    if (editingPayable) {
      updateMutation.mutate({ id: editingPayable.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredPayables = payables.filter((p) => {
    const matchesSearch = p.description.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "vencido") {
      const today = new Date();
      const due = new Date(p.dueDate);
      return matchesSearch && p.status !== "pago" && due < today;
    }
    return matchesSearch && p.status === filterStatus;
  });

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "-";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "-";
  };

  const totalPendente = payables
    .filter((p) => p.status !== "pago")
    .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

  const totalVencido = payables
    .filter((p) => {
      if (p.status === "pago") return false;
      const today = new Date();
      const due = new Date(p.dueDate);
      return due < today;
    })
    .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Contas a Pagar" subtitle="Gerencie suas contas e parcelamentos" />
        <div className="px-4 py-3 space-y-6">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Contas a Pagar" subtitle="Gerencie suas contas e parcelamentos">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-new-payable">
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingPayable ? "Editar Conta" : "Nova Conta a Pagar"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descricao</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Aluguel, Internet..." {...field} data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0,00" {...field} data-testid="input-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vencimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-due-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {expenseCategories.map((cat) => (
                              <SelectItem key={cat.id} value={String(cat.id)}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subcategoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCategoryId}>
                          <FormControl>
                            <SelectTrigger data-testid="select-subcategory">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredSubcategories.map((sub) => (
                              <SelectItem key={sub.id} value={String(sub.id)}>
                                {sub.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isInstallment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-installment"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">E parcelamento?</FormLabel>
                    </FormItem>
                  )}
                />

                {isInstallment && (
                  <FormField
                    control={form.control}
                    name="totalInstallments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numero de parcelas</FormLabel>
                        <FormControl>
                          <Input type="number" min="2" placeholder="Ex: 12" {...field} data-testid="input-installments" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observacoes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Observacoes opcionais..." {...field} data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-payable"
                  >
                    {editingPayable ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="px-4 py-3 space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Calendar className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pendente</p>
                <p className="text-xl font-bold">{formatCurrency(totalPendente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={totalVencido > 0 ? "border-destructive" : ""}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Vencido</p>
                <p className="text-xl font-bold text-destructive">{formatCurrency(totalVencido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar contas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="w-[150px]" data-testid="filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPayables.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma conta encontrada</p>
              <p className="text-sm">Clique em "Nova Conta" para comecar</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <Table className="text-sm table-fixed w-full">
                <colgroup>
                  <col style={colWidths.vencimento ? { width: `${colWidths.vencimento}px` } : undefined} />
                  <col style={colWidths.descricao ? { width: `${colWidths.descricao}px` } : undefined} />
                  <col style={colWidths.categoria ? { width: `${colWidths.categoria}px` } : undefined} />
                  <col style={colWidths.parcela ? { width: `${colWidths.parcela}px` } : undefined} />
                  <col style={colWidths.status ? { width: `${colWidths.status}px` } : undefined} />
                  <col style={colWidths.valor ? { width: `${colWidths.valor}px` } : undefined} />
                  <col style={colWidths.acoes ? { width: `${colWidths.acoes}px` } : undefined} />
                </colgroup>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead className="py-1.5 relative">Vencimento<ResizeHandle col="vencimento" onResizeStart={handleResizeStart} /></TableHead>
                    <TableHead className="py-1.5 relative">Descricao<ResizeHandle col="descricao" onResizeStart={handleResizeStart} /></TableHead>
                    <TableHead className="py-1.5 relative">Categoria<ResizeHandle col="categoria" onResizeStart={handleResizeStart} /></TableHead>
                    <TableHead className="py-1.5 relative">Parcela<ResizeHandle col="parcela" onResizeStart={handleResizeStart} /></TableHead>
                    <TableHead className="py-1.5 relative">Status<ResizeHandle col="status" onResizeStart={handleResizeStart} /></TableHead>
                    <TableHead className="py-1.5 text-right relative">Valor<ResizeHandle col="valor" onResizeStart={handleResizeStart} /></TableHead>
                    <TableHead className="py-1.5 relative">Acoes<ResizeHandle col="acoes" onResizeStart={handleResizeStart} /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayables.map((payable) => (
                    <TableRow key={payable.id} className="h-10" data-testid={`row-payable-${payable.id}`}>
                      <TableCell className="py-1.5 text-xs">{formatDate(payable.dueDate)}</TableCell>
                      <TableCell className="py-1.5 font-medium overflow-hidden truncate">{payable.description}</TableCell>
                      <TableCell className="py-1.5 overflow-hidden truncate text-xs">{getCategoryName(payable.categoryId)}</TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {payable.isInstallment && payable.installmentNumber && payable.totalInstallments
                          ? `${payable.installmentNumber}/${payable.totalInstallments}`
                          : "-"}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant={getStatusVariant(payable.status, payable.dueDate) as any} className="text-xs">
                          {getStatusLabel(payable.status, payable.dueDate)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 text-right font-medium text-destructive whitespace-nowrap">
                        {formatCurrency(payable.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {payable.status !== "pago" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => markAsPaidMutation.mutate(payable.id)}
                              data-testid={`button-pay-${payable.id}`}
                              title="Marcar como pago"
                            >
                              <Check className="w-4 h-4 text-success" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(payable)}
                            data-testid={`button-edit-${payable.id}`}
                          >
                            <Pencil className="w-4 h-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(payable.id)}
                            data-testid={`button-delete-${payable.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
