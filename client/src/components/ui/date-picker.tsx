import * as React from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  syncDate?: string;
  "data-testid"?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecione uma data",
  className,
  syncDate,
  "data-testid": testId,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = value ? parseISO(value) : undefined;
  
  const defaultMonth = React.useMemo(() => {
    if (value) {
      return parseISO(value);
    }
    if (syncDate) {
      return parseISO(syncDate);
    }
    return new Date();
  }, [value, syncDate]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
    } else {
      onChange("");
    }
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative flex items-center", className)}>
          <Input
            type="date"
            value={value}
            onChange={handleInputChange}
            className="pr-8"
            data-testid={testId}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 h-full px-2 hover:bg-transparent"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={defaultMonth}
          locale={ptBR}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
