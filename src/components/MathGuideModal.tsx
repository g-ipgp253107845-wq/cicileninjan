import { X } from "lucide-react";

interface MathGuideModalProps {
  open: boolean;
  onClose: () => void;
}

const MATH_CONCEPTS = [
  {
    title: "1. Length, Width & Height Measurement",
    formula: "L, W, H (cm) · Linear Sum = L + W + H",
    explanation:
      "Airlines evaluate luggage using both individual orthogonal axes and linear dimension sum (e.g., 55 + 40 + 20 = 115 cm).",
  },
  {
    title: "2. 2D & 3D Geometry",
    formula: "Rectangular Prism & Circular Cylinder Models",
    explanation:
      "Items are approximated as 3D rectangular prisms (clothes, laptops, shoes) or cylinders (toiletry bottles, rolled towels).",
  },
  {
    title: "3. Volume Calculation",
    formula: "V_prism = L × W × H · V_cylinder = π × r² × h",
    explanation:
      "Theoretical suitcase volume uses external bounding edges, while usable packing capacity deducts wall thickness and internal wheel/handle rails.",
  },
  {
    title: "4. Surface Area Calculation",
    formula: "A = 2(LW + LH + WH)",
    explanation:
      "Computes outer shell surface area (cm²) to quantify polycarbonate casing material and shell loss ratio.",
  },
  {
    title: "5. Mass & Weight Measurement",
    formula: "W_total = W_suitcase + Σ(w_item × quantity)",
    explanation:
      "Combines empty luggage mass with every packed item unit in kilograms and grams to compare against airline weight allowances.",
  },
  {
    title: "6. Unit Conversion",
    formula: "1 m = 100 cm · 1 L = 1,000 cm³ · 1 kg = 1,000 g",
    explanation:
      "Translates cubic centimeters into liters for capacity intuition and kilograms into grams for compact accessories.",
  },
  {
    title: "7. Estimation & Approximation",
    formula: "V_compressed = l × w × h × (1 − c)",
    explanation:
      "Camera measurements include perspective uncertainty (confidence %), and soft clothing models fabric compression factor c (15–30%).",
  },
  {
    title: "8. Spatial Reasoning & 3D Positioning",
    formula: "Coordinate Anchor (x, y, z) ∈ [0..L_int] × [0..H_int] × [0..W_int]",
    explanation:
      "Every packed item occupies an exact non-overlapping 3D coordinate bounding box verified via Axis-Aligned Bounding Box (AABB) intersection tests.",
  },
  {
    title: "9. Mathematical Optimization (AutoPack)",
    formula: "min (Height Y + Cavity Waste) across 6 orthogonal rotations",
    explanation:
      "Smart AutoPack evaluates extreme-point anchor candidates and 6 orientation permutations to maximize volume efficiency and keep center-of-gravity low.",
  },
];

export default function MathGuideModal({ open, onClose }: MathGuideModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a1a12]/55 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="math-guide-title"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-[#f6f0e7] p-6 shadow-2xl border border-white/75">
        <div className="flex items-start justify-between gap-4 border-b border-[#2a1a12]/10 pb-4">
          <div>
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-[#8d7b6f]">
              Formula Reference
            </span>
            <h2
              id="math-guide-title"
              className="editorial-h2 mt-1 text-xl sm:text-2xl"
            >
              Mathematics Applied in SmartPack
            </h2>
            <p className="mt-0.5 text-xs text-[#5b4a3f]">
              Geometry, Measurement, and 3D Spatial Optimization Formulas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close math guide"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-[#ece3d7] text-[#2a1a12] hover:bg-[#e3d6c6] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {MATH_CONCEPTS.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl bg-[#fffdf9]/90 p-4 border border-[#2a1a12]/10"
            >
              <h3 className="text-sm font-medium text-[#2a1a12]">{c.title}</h3>
              <p className="mt-1 font-mono text-xs font-medium text-[#d4612f]">
                {c.formula}
              </p>
              <p className="mt-1 text-xs text-[#5b4a3f] leading-relaxed">
                {c.explanation}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-dark-pill min-h-[42px] px-6 py-2 text-xs font-medium"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
