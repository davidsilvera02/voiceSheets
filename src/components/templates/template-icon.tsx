import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  DollarSign,
  Factory,
  FileText,
  FlaskConical,
  LayoutTemplate,
  Package,
  Receipt,
  ShoppingCart,
  Store,
  Tag,
  Truck,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Curated icon set offered in the template editor. Stored as the icon name. */
export const TEMPLATE_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "ShoppingCart", Icon: ShoppingCart },
  { name: "Package", Icon: Package },
  { name: "Boxes", Icon: Boxes },
  { name: "Warehouse", Icon: Warehouse },
  { name: "Building2", Icon: Building2 },
  { name: "Store", Icon: Store },
  { name: "Factory", Icon: Factory },
  { name: "Truck", Icon: Truck },
  { name: "Receipt", Icon: Receipt },
  { name: "CreditCard", Icon: CreditCard },
  { name: "DollarSign", Icon: DollarSign },
  { name: "ClipboardList", Icon: ClipboardList },
  { name: "FileText", Icon: FileText },
  { name: "Tag", Icon: Tag },
  { name: "Users", Icon: Users },
  { name: "Wrench", Icon: Wrench },
  { name: "FlaskConical", Icon: FlaskConical },
  { name: "BarChart3", Icon: BarChart3 },
];

const BY_NAME = new Map(TEMPLATE_ICONS.map((i) => [i.name, i.Icon]));

// Back-compat: map legacy emoji icons (from earlier seeds) to lucide icons.
const EMOJI_FALLBACK: Record<string, LucideIcon> = {
  "🛒": ShoppingCart,
  "🏢": Building2,
  "📦": Package,
  "💰": DollarSign,
  "🧾": Receipt,
  "📊": BarChart3,
  "🚚": Truck,
  "🔧": Wrench,
  "🧪": FlaskConical,
  "📄": FileText,
};

export function resolveTemplateIcon(value: string | null | undefined): LucideIcon {
  if (!value) return LayoutTemplate;
  return BY_NAME.get(value) ?? EMOJI_FALLBACK[value] ?? LayoutTemplate;
}

/** Render a template's icon from its stored name (or legacy emoji). */
export function TemplateIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = resolveTemplateIcon(name);
  return <Icon className={className} />;
}
