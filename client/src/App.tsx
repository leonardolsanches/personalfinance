import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Transacoes from "@/pages/transacoes";
import ContasPagar from "@/pages/contas-pagar";
import Categorias from "@/pages/categorias";
import ContasBancarias from "@/pages/contas-bancarias";
import Categorizacao from "@/pages/categorizacao";
import Importar from "@/pages/importar";
import Regras from "@/pages/regras";
import Faturas from "@/pages/faturas";
import Beneficiarios from "@/pages/beneficiarios";
import Parcelamentos from "@/pages/parcelamentos";
import Planejamento from "@/pages/planejamento";
import ConsultaPlanejamento from "@/pages/consulta-planejamento";
import ManutencaoDados from "@/pages/manutencao-dados";
import Extrato from "@/pages/extrato";
import PendenciasImportacao from "@/pages/pendencias-importacao";
import Admin from "@/pages/admin";
import MediaCategorias from "@/pages/media-categorias";

function BeneficiarPage() {
  return <Beneficiarios defaultTab="visao-geral" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/transacoes" component={Transacoes} />
      <Route path="/faturas" component={Faturas} />
      <Route path="/extrato" component={Extrato} />
      <Route path="/parcelamentos" component={Parcelamentos} />
      <Route path="/planejamento" component={ConsultaPlanejamento} />
      <Route path="/consulta-planejamento" component={Planejamento} />
      <Route path="/contas-pagar" component={ContasPagar} />
      <Route path="/categorias" component={Categorias} />
      <Route path="/contas-bancarias" component={ContasBancarias} />
      <Route path="/beneficiarios" component={Beneficiarios} />
      <Route path="/beneficiar" component={BeneficiarPage} />
      <Route path="/categorizacao" component={Categorizacao} />
      <Route path="/importar" component={Importar} />
      <Route path="/regras" component={Regras} />
      <Route path="/manutencao" component={ManutencaoDados} />
      <Route path="/pendencias-importacao" component={PendenciasImportacao} />
      <Route path="/media-categorias" component={MediaCategorias} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <main className="flex flex-col flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
