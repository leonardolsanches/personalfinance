import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { MonthNavigator } from "@/components/month-navigator";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  selectedMonth?: string | null;
  onMonthChange?: (month: string | null) => void;
}

export function PageHeader({ title, subtitle, children, selectedMonth, onMonthChange }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-50 bg-background border-b px-3 py-1.5 flex items-center gap-3 min-h-[40px]">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-sm font-bold whitespace-nowrap" data-testid="text-page-title">{title}</h1>
        {subtitle && (
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {children}
        {onMonthChange !== undefined && (
          <MonthNavigator selectedMonth={selectedMonth ?? null} onMonthChange={onMonthChange} />
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
