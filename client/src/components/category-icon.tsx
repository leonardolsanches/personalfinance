import {
  Briefcase, Wallet, TrendingUp, Gift, RotateCcw, DollarSign,
  Utensils, Wifi, GraduationCap, Heart, Gamepad2, Home, Car,
  ShoppingBag, CreditCard, Receipt, Truck, Baby, AlertTriangle,
  Handshake, Globe, Scissors, Sparkles, Wrench, Landmark,
  Smartphone, Zap, Plane, Music, Dumbbell, PawPrint, Cigarette,
  BookOpen, Shirt, Droplets, Fuel, Stethoscope, Scale, Hammer,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  briefcase: { icon: Briefcase, label: "Trabalho" },
  wallet: { icon: Wallet, label: "Carteira" },
  trending_up: { icon: TrendingUp, label: "Investimentos" },
  gift: { icon: Gift, label: "Presentes" },
  rotate_ccw: { icon: RotateCcw, label: "Estorno" },
  dollar: { icon: DollarSign, label: "Dinheiro" },
  utensils: { icon: Utensils, label: "Alimentacao" },
  wifi: { icon: Wifi, label: "Internet/Comunicacao" },
  graduation: { icon: GraduationCap, label: "Educacao" },
  heart: { icon: Heart, label: "Saude" },
  gamepad: { icon: Gamepad2, label: "Lazer" },
  home: { icon: Home, label: "Moradia" },
  car: { icon: Car, label: "Transporte" },
  shopping: { icon: ShoppingBag, label: "Compras" },
  credit_card: { icon: CreditCard, label: "Cartao" },
  receipt: { icon: Receipt, label: "Impostos" },
  truck: { icon: Truck, label: "Motorhome" },
  baby: { icon: Baby, label: "Crianca" },
  alert: { icon: AlertTriangle, label: "Fraude" },
  handshake: { icon: Handshake, label: "Freelance" },
  globe: { icon: Globe, label: "Internet" },
  scissors: { icon: Scissors, label: "Servicos" },
  sparkles: { icon: Sparkles, label: "Extra" },
  wrench: { icon: Wrench, label: "Manutencao" },
  landmark: { icon: Landmark, label: "Banco" },
  smartphone: { icon: Smartphone, label: "Tecnologia" },
  zap: { icon: Zap, label: "Energia" },
  plane: { icon: Plane, label: "Viagem" },
  music: { icon: Music, label: "Entretenimento" },
  dumbbell: { icon: Dumbbell, label: "Academia" },
  paw: { icon: PawPrint, label: "Pet" },
  cigarette: { icon: Cigarette, label: "Habitos" },
  book: { icon: BookOpen, label: "Leitura" },
  shirt: { icon: Shirt, label: "Vestuario" },
  droplets: { icon: Droplets, label: "Agua" },
  fuel: { icon: Fuel, label: "Combustivel" },
  stethoscope: { icon: Stethoscope, label: "Medico" },
  scale: { icon: Scale, label: "Juridico" },
  hammer: { icon: Hammer, label: "Construcao" },
};

export const ICON_KEYS = Object.keys(CATEGORY_ICONS);

interface CategoryIconProps {
  iconName?: string | null;
  color?: string | null;
  categoryName?: string;
  size?: "sm" | "md";
}

export function CategoryIcon({ iconName, color, categoryName, size = "sm" }: CategoryIconProps) {
  const entry = iconName ? CATEGORY_ICONS[iconName] : null;
  const IconComp = entry?.icon || ShoppingBag;
  const bgColor = color || "#3B82F6";

  const sizeClasses = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  const iconElement = (
    <div
      className={`${sizeClasses} rounded-md flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: bgColor }}
      data-testid={`icon-category-${categoryName?.toLowerCase().replace(/\s/g, "-") || "unknown"}`}
    >
      <IconComp className={`${iconSize} text-white`} />
    </div>
  );

  if (categoryName) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {iconElement}
        </TooltipTrigger>
        <TooltipContent>
          <p>{categoryName}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return iconElement;
}
