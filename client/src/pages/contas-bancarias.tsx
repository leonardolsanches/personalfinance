import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Wallet, CreditCard, Building2 } from "lucide-react";
import type { BankAccount } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/page-header";

const bankAccountFormSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio"),
  bankName: z.string().optional(),
  accountType: z.string().optional(),
  balance: z.string().default("0"),
});

type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;

function formatCurrency(value: number | string) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

const ACCOUNT_TYPES = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Poupanca" },
  { value: "cartao", label: "Cartao de Credito" },
  { value: "investimento", label: "Investimento" },
  { value: "outro", label: "Outro" },
];

const BANKS = [
  "Banco do Brasil",
  "Bradesco",
  "Caixa Economica",
  "Itau",
  "Nubank",
  "Inter",
  "Santander",
  "C6 Bank",
  "BTG Pactual",
  "XP Investimentos",
  "Outro",
];

export default function ContasBancarias() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const { data: bankAccounts = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: {
      name: "",
      bankName: "",
      accountType: "",
      balance: "0",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BankAccountFormValues) => {
      return apiRequest("POST", "/api/bank-accounts", {
        ...data,
        balance: data.balance,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Conta bancaria criada com sucesso!" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar conta bancaria", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BankAccountFormValues }) => {
      return apiRequest("PATCH", `/api/bank-accounts/${id}`, {
        ...data,
        balance: data.balance,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Conta bancaria atualizada com sucesso!" });
      setDialogOpen(false);
      setEditingAccount(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar conta bancaria", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/bank-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Conta bancaria excluida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir conta bancaria", variant: "destructive" });
    },
  });

  const handleOpenDialog = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account);
      form.reset({
        name: account.name,
        bankName: account.bankName || "",
        accountType: account.accountType || "",
        balance: String(account.balance || 0),
      });
    } else {
      setEditingAccount(null);
      form.reset();
    }
    setDialogOpen(true);
  };

  const onSubmit = (data: BankAccountFormValues) => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const totalBalance = bankAccounts
    .filter((a) => a.active)
    .reduce((sum, a) => sum + parseFloat(String(a.balance || 0)), 0);

  const getAccountIcon = (type: string | null) => {
    switch (type) {
      case "cartao":
        return CreditCard;
      case "investimento":
        return Building2;
      default:
        return Wallet;
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Contas Bancarias" subtitle="Gerencie suas contas e cartoes" />
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
      <PageHeader title="Contas Bancarias" subtitle="Gerencie suas contas e cartoes">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-new-account">
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Editar Conta" : "Nova Conta Bancaria"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Conta Principal, Cartao Nubank..." {...field} data-testid="input-account-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bank">
                            <SelectValue placeholder="Selecione o banco" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BANKS.map((bank) => (
                            <SelectItem key={bank} value={bank}>
                              {bank}
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
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-account-type">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
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
                  name="balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saldo Inicial</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0,00" {...field} data-testid="input-balance" />
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
                    data-testid="button-save-account"
                  >
                    {editingAccount ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="px-4 py-3 space-y-6">
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo Total</p>
              <p className={`text-xl font-bold ${totalBalance >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(totalBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suas Contas</CardTitle>
        </CardHeader>
        <CardContent>
          {bankAccounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma conta cadastrada</p>
              <p className="text-sm">Clique em "Nova Conta" para comecar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="w-[100px]">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map((account) => {
                  const Icon = getAccountIcon(account.accountType);
                  return (
                    <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium">{account.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{account.bankName || "-"}</TableCell>
                      <TableCell>
                        {ACCOUNT_TYPES.find((t) => t.value === account.accountType)?.label || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.active ? "default" : "outline"}>
                          {account.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${parseFloat(String(account.balance || 0)) >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(account.balance || 0)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(account)}
                            data-testid={`button-edit-${account.id}`}
                          >
                            <Pencil className="w-4 h-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(account.id)}
                            data-testid={`button-delete-${account.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
