import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, Tags, FolderTree, ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryIcon, CATEGORY_ICONS, ICON_KEYS } from "@/components/category-icon";
import type { Category, Subcategory } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/page-header";

const categoryFormSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio"),
  type: z.enum(["receita", "despesa"]).default("despesa"),
  color: z.string().default("#3B82F6"),
  icon: z.string().optional(),
});

const subcategoryFormSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio"),
  categoryId: z.string().min(1, "Categoria e obrigatoria"),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;
type SubcategoryFormValues = z.infer<typeof subcategoryFormSchema>;

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

export default function Categorias() {
  const { toast } = useToast();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [categoryPage, setCategoryPage] = useState(1);
  const [subcategoryPage, setSubcategoryPage] = useState(1);
  const itemsPerPage = 10;

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories = [], isLoading: subcategoriesLoading } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const paginatedCategories = categories.slice((categoryPage - 1) * itemsPerPage, categoryPage * itemsPerPage);
  const totalCategoryPages = Math.ceil(categories.length / itemsPerPage);
  const paginatedSubcategories = subcategories.slice((subcategoryPage - 1) * itemsPerPage, subcategoryPage * itemsPerPage);
  const totalSubcategoryPages = Math.ceil(subcategories.length / itemsPerPage);

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      type: "despesa",
      color: "#3B82F6",
      icon: "shopping",
    },
  });

  const subcategoryForm = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategoryFormSchema),
    defaultValues: {
      name: "",
      categoryId: "",
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      return apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Categoria criada com sucesso!" });
      setCategoryDialogOpen(false);
      categoryForm.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar categoria", variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CategoryFormValues }) => {
      return apiRequest("PATCH", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Categoria atualizada com sucesso!" });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar categoria", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Categoria excluida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir categoria", variant: "destructive" });
    },
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: async (data: SubcategoryFormValues) => {
      return apiRequest("POST", "/api/subcategories", {
        ...data,
        categoryId: Number(data.categoryId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      toast({ title: "Subcategoria criada com sucesso!" });
      setSubcategoryDialogOpen(false);
      subcategoryForm.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar subcategoria", variant: "destructive" });
    },
  });

  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: SubcategoryFormValues }) => {
      return apiRequest("PATCH", `/api/subcategories/${id}`, {
        ...data,
        categoryId: Number(data.categoryId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      toast({ title: "Subcategoria atualizada com sucesso!" });
      setSubcategoryDialogOpen(false);
      setEditingSubcategory(null);
      subcategoryForm.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar subcategoria", variant: "destructive" });
    },
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/subcategories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      toast({ title: "Subcategoria excluida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir subcategoria", variant: "destructive" });
    },
  });

  const handleOpenCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      categoryForm.reset({
        name: category.name,
        type: category.type,
        color: category.color || "#3B82F6",
        icon: category.icon || "shopping",
      });
    } else {
      setEditingCategory(null);
      categoryForm.reset();
    }
    setCategoryDialogOpen(true);
  };

  const handleOpenSubcategoryDialog = (subcategory?: Subcategory) => {
    if (subcategory) {
      setEditingSubcategory(subcategory);
      subcategoryForm.reset({
        name: subcategory.name,
        categoryId: String(subcategory.categoryId),
      });
    } else {
      setEditingSubcategory(null);
      subcategoryForm.reset();
    }
    setSubcategoryDialogOpen(true);
  };

  const onCategorySubmit = (data: CategoryFormValues) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const onSubcategorySubmit = (data: SubcategoryFormValues) => {
    if (editingSubcategory) {
      updateSubcategoryMutation.mutate({ id: editingSubcategory.id, data });
    } else {
      createSubcategoryMutation.mutate(data);
    }
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "-";
  };

  const isLoading = categoriesLoading || subcategoriesLoading;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Categorias" subtitle="Gerencie categorias e subcategorias" />
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
      <PageHeader title="Categorias" subtitle="Gerencie categorias e subcategorias" />
      <div className="px-4 py-3 space-y-6">
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tags className="w-4 h-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="subcategories" className="flex items-center gap-2">
            <FolderTree className="w-4 h-4" />
            Subcategorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Categorias</CardTitle>
              <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenCategoryDialog()} data-testid="button-new-category">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...categoryForm}>
                    <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
                      <FormField
                        control={categoryForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Alimentacao, Transporte..." {...field} data-testid="input-category-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={categoryForm.control}
                        name="color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cor</FormLabel>
                            <FormControl>
                              <div className="flex gap-2 flex-wrap">
                                {COLORS.map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    className={`w-8 h-8 rounded-full transition-transform ${field.value === color ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => field.onChange(color)}
                                    data-testid={`color-${color}`}
                                  />
                                ))}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={categoryForm.control}
                        name="icon"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Icone</FormLabel>
                            <FormControl>
                              <div className="grid grid-cols-10 gap-1">
                                {ICON_KEYS.map((key) => {
                                  const { icon: IconComp, label } = CATEGORY_ICONS[key];
                                  return (
                                    <Tooltip key={key}>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className={`w-8 h-8 rounded-md flex items-center justify-center transition-transform ${field.value === key ? "ring-2 ring-offset-2 ring-primary scale-110 bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                                          onClick={() => field.onChange(key)}
                                          data-testid={`icon-picker-${key}`}
                                        >
                                          <IconComp className="w-4 h-4" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>{label}</p></TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                          data-testid="button-save-category"
                        >
                          {editingCategory ? "Atualizar" : "Criar"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Tags className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma categoria cadastrada</p>
                </div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-1.5 w-[50px]">Icone</TableHead>
                      <TableHead className="py-1.5">Nome</TableHead>
                      <TableHead className="py-1.5">Status</TableHead>
                      <TableHead className="w-[80px] py-1.5">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCategories.map((category) => (
                      <TableRow key={category.id} data-testid={`row-category-${category.id}`} className="text-xs">
                        <TableCell className="py-1.5">
                          <CategoryIcon
                            iconName={category.icon}
                            color={category.color}
                            categoryName={category.name}
                          />
                        </TableCell>
                        <TableCell className="font-medium py-1.5">{category.name}</TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant={category.active ? "default" : "outline"}>
                            {category.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenCategoryDialog(category)}
                              data-testid={`button-edit-category-${category.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteCategoryMutation.mutate(category.id)}
                              data-testid={`button-delete-category-${category.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalCategoryPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-muted-foreground">
                      Mostrando {(categoryPage - 1) * itemsPerPage + 1} a {Math.min(categoryPage * itemsPerPage, categories.length)} de {categories.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCategoryPage(p => Math.max(1, p - 1))} disabled={categoryPage === 1}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm">{categoryPage} / {totalCategoryPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setCategoryPage(p => Math.min(totalCategoryPages, p + 1))} disabled={categoryPage === totalCategoryPages}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subcategories" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Subcategorias</CardTitle>
              <Dialog open={subcategoryDialogOpen} onOpenChange={setSubcategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenSubcategoryDialog()} data-testid="button-new-subcategory">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Subcategoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingSubcategory ? "Editar Subcategoria" : "Nova Subcategoria"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...subcategoryForm}>
                    <form onSubmit={subcategoryForm.handleSubmit(onSubcategorySubmit)} className="space-y-4">
                      <FormField
                        control={subcategoryForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Restaurantes, Uber..." {...field} data-testid="input-subcategory-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={subcategoryForm.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categoria</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-parent-category">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories.filter(c => c.active).map((cat) => (
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

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setSubcategoryDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={createSubcategoryMutation.isPending || updateSubcategoryMutation.isPending}
                          data-testid="button-save-subcategory"
                        >
                          {editingSubcategory ? "Atualizar" : "Criar"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {subcategories.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderTree className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma subcategoria cadastrada</p>
                </div>
              ) : (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-1.5">Nome</TableHead>
                      <TableHead className="py-1.5">Categoria</TableHead>
                      <TableHead className="py-1.5">Status</TableHead>
                      <TableHead className="w-[80px] py-1.5">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSubcategories.map((subcategory) => (
                      <TableRow key={subcategory.id} data-testid={`row-subcategory-${subcategory.id}`} className="text-xs">
                        <TableCell className="font-medium py-1.5">{subcategory.name}</TableCell>
                        <TableCell className="py-1.5">{getCategoryName(subcategory.categoryId)}</TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant={subcategory.active ? "default" : "outline"}>
                            {subcategory.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenSubcategoryDialog(subcategory)}
                              data-testid={`button-edit-subcategory-${subcategory.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteSubcategoryMutation.mutate(subcategory.id)}
                              data-testid={`button-delete-subcategory-${subcategory.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalSubcategoryPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-muted-foreground">
                      Mostrando {(subcategoryPage - 1) * itemsPerPage + 1} a {Math.min(subcategoryPage * itemsPerPage, subcategories.length)} de {subcategories.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSubcategoryPage(p => Math.max(1, p - 1))} disabled={subcategoryPage === 1}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm">{subcategoryPage} / {totalSubcategoryPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setSubcategoryPage(p => Math.min(totalSubcategoryPages, p + 1))} disabled={subcategoryPage === totalSubcategoryPages}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
