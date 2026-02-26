import { BrandName, BRAND_LOGIC } from "@/lib/npd-engine";
import { Beaker, Heart, Baby } from "lucide-react";

const brandConfig: Record<BrandName, { icon: React.ElementType; tagline: string; bgClass: string; lightClass: string }> = {
  "Man Matters": {
    icon: Beaker,
    tagline: "Hair · Performance · Beard",
    bgClass: "brand-mm",
    lightClass: "brand-mm-light",
  },
  "Be Bodywise": {
    icon: Heart,
    tagline: "Skin · PCOS · Body Care",
    bgClass: "brand-bw",
    lightClass: "brand-bw-light",
  },
  "Little Joys": {
    icon: Baby,
    tagline: "Kids Nutrition · Moms Health",
    bgClass: "brand-lj",
    lightClass: "brand-lj-light",
  },
};

interface BrandSelectorProps {
  selected: BrandName | null;
  onSelect: (brand: BrandName) => void;
}

export default function BrandSelector({ selected, onSelect }: BrandSelectorProps) {
  const brands = Object.keys(BRAND_LOGIC) as BrandName[];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {brands.map((brand) => {
        const config = brandConfig[brand];
        const Icon = config.icon;
        const isSelected = selected === brand;

        return (
          <button
            key={brand}
            onClick={() => onSelect(brand)}
            className={`group relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all duration-300 ${
              isSelected
                ? `${config.bgClass} border-transparent shadow-lg scale-[1.02]`
                : `${config.lightClass} border-border hover:border-muted-foreground/30 hover:shadow-md`
            }`}
          >
            <div className={`inline-flex items-center justify-center w-11 h-11 rounded-lg mb-4 ${
              isSelected ? "bg-white/20" : config.bgClass
            }`}>
              <Icon className={`w-5 h-5 ${isSelected ? "text-white" : ""}`} />
            </div>
            <h3 className={`font-display text-lg font-bold mb-1 ${isSelected ? "" : "text-foreground"}`}>
              {brand}
            </h3>
            <p className={`text-sm ${isSelected ? "opacity-80" : "text-muted-foreground"}`}>
              {config.tagline}
            </p>
            {isSelected && (
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/25 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
