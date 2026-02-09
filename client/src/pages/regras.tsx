import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Tag } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

import type { Category, Subcategory, CategorizationRule } from "@shared/schema";
import { PageHeader } from "@/components/page-header";

export default function Regras() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  const { data: rules = [], isLoading: rulesLoading } = useQuery<CategorizationRule[]>({
    queryKey: ["/api/categorization-rules"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { pattern: string; categoryId: number; subcategoryId?: number }) => {
      return apiRequest("POST", "/api/categorization-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categorization-rules"] });
      toast({ title: "Regra criada com sucesso" });
      setIsOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao criar regra", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/categorization-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categorization-rules"] });
      toast({ title: "Regra removida" });
    },
    onError: () => {
      toast({ title: "Erro ao remover regra", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setPattern("");
    setCategoryId("");
    setSubcategoryId("");
  };

  const handleSubmit = () => {
    if (!pattern.trim() || !categoryId) {
      toast({ title: "Preencha o padrao e a categoria", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      pattern: pattern.trim(),
      categoryId: parseInt(categoryId),
      subcategoryId: subcategoryId ? parseInt(subcategoryId) : undefined,
    });
  };

  const filteredSubcategories = subcategories.filter(
    (s) => s.categoryId === parseInt(categoryId)
  );

  const getCategoryName = (catId: number) => {
    const cat = categories.find((c) => c.id === catId);
    return cat?.name || "Sem categoria";
  };

  const getSubcategoryName = (subId: number | null) => {
    if (!subId) return "-";
    const sub = subcategories.find((s) => s.id === subId);
    return sub?.name || "-";
  };

  return (
    <div>
      <PageHeader title="Regras Auto" subtitle="Configure regras para categorizar transacoes importadas automaticamente">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-rule">
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Regra de Categorizacao</DialogTitle>
              <DialogDescription>
                Defina um padrao de texto e a categoria que sera aplicada automaticamente
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pattern">Padrao (texto a procurar)</Label>
                <Input
                  id="pattern"
                  data-testid="input-pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="Ex: UBER, MERCADO, PIX"
                />
                <p className="text-xs text-muted-foreground">
                  A regra sera aplicada se a descricao da transacao contiver este texto
                </p>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(""); }}>
                  <SelectTrigger data-testid="select-rule-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subcategoria (opcional)</Label>
                <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!categoryId}>
                  <SelectTrigger data-testid="select-rule-subcategory">
                    <SelectValue placeholder="Selecione a subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {filteredSubcategories.map((sub) => (
                      <SelectItem key={sub.id} value={String(sub.id)}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="w-full"
                data-testid="button-save-rule"
              >
                {createMutation.isPending ? "Salvando..." : "Salvar Regra"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="px-4 py-3 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Regras Ativas
          </CardTitle>
          <CardDescription>
            Quando uma transacao for importada, a descricao sera comparada com os padroes abaixo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rulesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma regra configurada. Crie uma regra para categorizar transacoes automaticamente.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Padrao</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Subcategoria</TableHead>
                  <TableHead className="w-[80px]">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                    <TableCell className="font-medium">{rule.pattern}</TableCell>
                    <TableCell>{getCategoryName(rule.categoryId)}</TableCell>
                    <TableCell>{getSubcategoryName(rule.subcategoryId)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(rule.id)}
                        data-testid={`button-delete-rule-${rule.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Crie regras com padroes de texto que aparecem nas suas transacoes bancarias</p>
          <p>2. Quando voce importar um extrato Excel, as transacoes serao comparadas com esses padroes</p>
          <p>3. Se uma transacao combinar com uma regra, a categoria sera aplicada automaticamente</p>
          <p>4. Transacoes que nao combinarem com nenhuma regra precisarao ser categorizadas manualmente</p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
