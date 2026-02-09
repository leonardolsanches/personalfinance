import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ArrowUpDown,
  Receipt,
  Tags,
  Upload,
  Settings,
  Wallet,
  TrendingUp,
  TrendingDown,
  Wand2,
  CreditCard,
  Users,
  UserPlus,
  Repeat,
  CalendarDays,
  Search,
  Wrench,
  Building2,
  ClipboardCheck,
  Database,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainMenuItems = [
  {
    title: "Visao Realizado",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Realizar",
    url: "/transacoes",
    icon: ArrowUpDown,
  },
  {
    title: "Planejar",
    url: "/planejamento",
    icon: CalendarDays,
  },
  {
    title: "Visao Planejado",
    url: "/consulta-planejamento",
    icon: Search,
  },
  {
    title: "Categorizar",
    url: "/categorizacao",
    icon: Tags,
  },
  {
    title: "Visao Parcelado",
    url: "/parcelamentos",
    icon: Repeat,
  },
  {
    title: "Beneficiar",
    url: "/beneficiar",
    icon: UserPlus,
  },
  {
    title: "Visao Cartao",
    url: "/faturas",
    icon: CreditCard,
  },
  {
    title: "Visao Conta Corrente",
    url: "/extrato",
    icon: Building2,
  },
  {
    title: "Contas a Pagar",
    url: "/contas-pagar",
    icon: Receipt,
  },
];

const settingsMenuItems = [
  {
    title: "Importar",
    url: "/importar",
    icon: Upload,
  },
  {
    title: "Categorias",
    url: "/categorias",
    icon: Tags,
  },
  {
    title: "Contas Bancarias",
    url: "/contas-bancarias",
    icon: Wallet,
  },
  {
    title: "Beneficiarios",
    url: "/beneficiarios",
    icon: Users,
  },
  {
    title: "Manutencao Dados",
    url: "/manutencao",
    icon: Wrench,
  },
  {
    title: "Pendencias Import",
    url: "/pendencias-importacao",
    icon: ClipboardCheck,
  },
  {
    title: "Regras Auto",
    url: "/regras",
    icon: Wand2,
  },
  {
    title: "Administracao",
    url: "/admin",
    icon: Database,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-sidebar-foreground">Personal Finance</h1>
            <p className="text-xs text-muted-foreground">Controle Financeiro</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "") || "dashboard"}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuracoes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-success" />
            <span>Receitas</span>
          </div>
          <span>/</span>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-destructive" />
            <span>Despesas</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
