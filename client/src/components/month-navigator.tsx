import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatYearMonth(ym: string) {
  const [year, month] = ym.split("-");
  return `${MONTH_NAMES[parseInt(month) - 1]}/${year}`;
}

function navigateMonth(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface MonthNavigatorProps {
  selectedMonth: string | null;
  onMonthChange: (month: string | null) => void;
}

export function MonthNavigator({ selectedMonth, onMonthChange }: MonthNavigatorProps) {
  const current = selectedMonth || getCurrentYearMonth();

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onMonthChange(navigateMonth(current, -1))}
        data-testid="button-month-prev"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant={selectedMonth ? "secondary" : "ghost"}
        size="sm"
        className="h-7 text-xs px-2 min-w-[70px]"
        onClick={() => onMonthChange(selectedMonth ? null : getCurrentYearMonth())}
        data-testid="button-month-label"
      >
        {selectedMonth ? formatYearMonth(selectedMonth) : "Todos"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onMonthChange(navigateMonth(current, 1))}
        data-testid="button-month-next"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export { getCurrentYearMonth, navigateMonth, formatYearMonth };
