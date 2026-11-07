import { Bean, Carrot, Flower2, Leaf, Sprout, Wheat, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, { icon: LucideIcon; bg: string; fg: string }> = {
  Maize: { icon: Wheat, bg: "from-harvest-100 to-harvest-200", fg: "text-harvest-700" },
  Wheat: { icon: Wheat, bg: "from-harvest-50 to-harvest-200", fg: "text-harvest-700" },
  Rice: { icon: Wheat, bg: "from-forest-50 to-forest-100", fg: "text-forest-700" },
  Soybeans: { icon: Bean, bg: "from-lime-50 to-lime-100", fg: "text-lime-700" },
  Groundnuts: { icon: Bean, bg: "from-orange-50 to-orange-100", fg: "text-orange-700" },
  Beans: { icon: Bean, bg: "from-rose-50 to-rose-100", fg: "text-rose-700" },
  Sunflower: { icon: Flower2, bg: "from-yellow-50 to-yellow-100", fg: "text-yellow-700" },
  Tomatoes: { icon: Carrot, bg: "from-red-50 to-red-100", fg: "text-red-600" },
  Vegetables: { icon: Carrot, bg: "from-forest-50 to-emerald-100", fg: "text-forest-700" },
  Cassava: { icon: Sprout, bg: "from-amber-50 to-amber-100", fg: "text-amber-700" },
  Cotton: { icon: Leaf, bg: "from-slate-50 to-slate-100", fg: "text-slate-600" },
  Tobacco: { icon: Leaf, bg: "from-emerald-50 to-emerald-100", fg: "text-emerald-700" },
};

/** Consistent illustrated tile used when a listing has no photo. */
export function CropArt({ crop, className, iconClassName }: { crop: string; className?: string; iconClassName?: string }) {
  const m = MAP[crop] ?? { icon: Sprout, bg: "from-forest-50 to-forest-100", fg: "text-forest-700" };
  const Icon = m.icon;
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-gradient-to-br", m.bg, className)} aria-hidden="true">
      <svg className="absolute inset-0 size-full opacity-[0.18]" viewBox="0 0 200 120" preserveAspectRatio="none">
        <path d="M0 90 Q50 70 100 85 T200 80 V120 H0Z" fill="currentColor" className={m.fg} />
        <path d="M0 105 Q60 90 120 102 T200 98 V120 H0Z" fill="currentColor" className={m.fg} />
      </svg>
      <Icon className={cn("relative size-12", m.fg, iconClassName)} strokeWidth={1.5} />
    </div>
  );
}
