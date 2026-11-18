import { useState } from "react";
import {
  BookOpen,
  Calculator,
  FoldVertical,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type {
  AirlinePolicy,
  AppTab,
  BelongingItem,
  ItemCategory,
  PackedUnitPlacement,
  SuitcaseConfig,
} from "../types";
import { ITEM_CATEGORIES } from "../data/presets";
import {
  calculatePackingSummary,
  calculateSingleItemVolumeCm3,
  cm3ToLitres,
  cmToM,
  getEffectiveItemDimensions,
  kgToG,
  round2,
} from "../utils/mathEngine";

interface ItemsMathViewProps {
  suitcase: SuitcaseConfig;
  items: BelongingItem[];
  placements: PackedUnitPlacement[];
  policy: AirlinePolicy;
  onUpdateItem: (item: BelongingItem) => void;
  onDeleteItem: (id: string) => void;
  onNavigate: (tab: AppTab) => void;
  onOpenMathGuide: () => void;
}

export default function ItemsMathView({
  suitcase,
  items,
  placements,
  policy,
  onUpdateItem,
  onDeleteItem,
  onNavigate,
  onOpenMathGuide,
}: ItemsMathViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Interactive Unit Converter State
  const [convCm, setConvCm] = useState<number>(55);
  const [convCm3, setConvCm3] = useState<number>(44000);
  const [convKg, setConvKg] = useState<number>(7.0);

  const summary = calculatePackingSummary(suitcase, items, placements);

  const filteredItems =
    selectedCategory === "All"
      ? items
      : items.filter((item) => item.category === selectedCategory);

  const packedCountByItem = new Map<string, number>();
  for (const p of placements) {
    packedCountByItem.set(p.itemId, (packedCountByItem.get(p.itemId) || 0) + 1);
  }

  return (
    <div className="space-y-8 pb-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-white/70 border border-white/80 px-3 py-1 text-[10.5px] uppercase tracking-[0.12em] text-[#5b4a3f]">
            Inventory &amp; Applied Mathematics
          </span>
          <h1 className="editorial-h2 mt-2 text-[clamp(26px,3.4vw,42px)]">
            My Packing List &amp; Calculator
          </h1>
          <p className="mt-1 text-xs text-[#5b4a3f] sm:text-sm tabular-nums">
            {summary.totalItemsUnits} total item units across {items.length} entries ·{" "}
            {summary.totalInventoryVolumeLitres.toFixed(2)} L inventory volume
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenMathGuide}
            className="pill-nav min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap"
          >
            <BookOpen className="h-4 w-4 text-[#d4612f]" />
            <span>Math Formulas Guide</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("scanner")}
            className="btn-dark-pill min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap"
          >
            <Plus className="h-4 w-4 text-[#f2c94c]" />
            <span>Scan or Add Item</span>
          </button>
        </div>
      </div>

      {/* Category Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {["All", ...ITEM_CATEGORIES].map((cat) => {
          const count =
            cat === "All"
              ? items.length
              : items.filter((i) => i.category === cat).length;
          if (cat !== "All" && count === 0) return null;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[36px] shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-[#3b2116] text-[#f6ede2]"
                  : "bg-white/75 text-[#5b4a3f] border border-white/80 hover:bg-[#ece3d7] hover:text-[#2a1a12]"
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Item Inventory List */}
        <div className="lg:col-span-7 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="glass-card rounded-[28px] p-8 text-center">
              <p className="text-base font-normal text-[#2a1a12]">
                No belongings in this category
              </p>
              <p className="mt-1 text-xs text-[#5b4a3f]">
                Use the Smart Item Scanner or Quick Add catalog to add items.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("scanner")}
                className="btn-dark-pill mt-4 min-h-[42px] px-5 py-2 text-xs font-medium"
              >
                Open Item Scanner
              </button>
            </div>
          ) : (
            filteredItems.map((item) => {
              const effDims = getEffectiveItemDimensions(item);
              const unitVol = calculateSingleItemVolumeCm3(item);
              const totalVol = unitVol * item.quantity;
              const packedQty = packedCountByItem.get(item.id) || 0;
              const isEditing = editingId === item.id;

              return (
                <div
                  key={item.id}
                  className="glass-card rounded-[24px] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="mt-0.5 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white text-xs font-medium shadow-sm"
                        style={{ backgroundColor: item.colorHex }}
                      >
                        {item.quantity}×
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-[#2a1a12]">
                          {item.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#5b4a3f]">
                          {item.category} · {item.shape === "cylinder" ? "Cylinder" : "Prism"} ·{" "}
                          {packedQty}/{item.quantity} packed in 3D
                        </p>
                        <p className="mt-1 font-mono text-xs tabular-nums text-[#3b2116]">
                          {effDims[0]}×{effDims[1]}×{effDims[2]} cm ·{" "}
                          {Math.round(totalVol).toLocaleString()} cm³ (
                          {cm3ToLitres(totalVol).toFixed(2)} L) ·{" "}
                          {(item.weightKg * item.quantity).toFixed(2)} kg
                          {item.liquidMl > 0 ? ` · ${item.liquidMl} ml liquid` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Quantity Stepper & Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name} quantity`}
                        onClick={() =>
                          onUpdateItem({
                            ...item,
                            quantity: Math.max(1, item.quantity - 1),
                          })
                        }
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full bg-[#ece3d7] text-[#2a1a12] hover:bg-[#e3d6c6] transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums text-[#2a1a12]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name} quantity`}
                        onClick={() =>
                          onUpdateItem({ ...item, quantity: item.quantity + 1 })
                        }
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full bg-[#ece3d7] text-[#2a1a12] hover:bg-[#e3d6c6] transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      {item.compressibility > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateItem({ ...item, compressed: !item.compressed })
                          }
                          title="Toggle fabric fold compression"
                          className={`min-h-[38px] inline-flex items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                            item.compressed
                              ? "bg-[#f2c94c] text-[#2a1a12]"
                              : "bg-[#fffdf9]/85 text-[#5b4a3f] border border-[#2a1a12]/12 hover:bg-[#ece3d7]"
                          }`}
                        >
                          <FoldVertical className="h-3.5 w-3.5" />
                          <span>{item.compressed ? "Rolled" : "Fold"}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : item.id)}
                        className="min-h-[38px] rounded-full bg-[#fffdf9]/85 px-3 text-xs font-medium text-[#2a1a12] border border-[#2a1a12]/12 hover:bg-[#ece3d7] transition-colors"
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>

                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => onDeleteItem(item.id)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[#8d7b6f] hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Manual Dimension & Weight Editor */}
                  {isEditing && (
                    <div className="mt-3.5 pt-3.5 border-t border-[#2a1a12]/10 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                      <label className="text-[11px] font-medium text-[#5b4a3f]">
                        Length (cm)
                        <input
                          type="number"
                          step="0.5"
                          min={2}
                          value={item.lengthCm}
                          onChange={(e) =>
                            onUpdateItem({
                              ...item,
                              lengthCm: Math.max(2, Number(e.target.value) || 2),
                            })
                          }
                          className="mt-1 w-full rounded-xl bg-[#fffdf9] px-2.5 py-1.5 font-mono text-xs text-[#2a1a12] border border-[#2a1a12]/12"
                        />
                      </label>
                      <label className="text-[11px] font-medium text-[#5b4a3f]">
                        Width (cm)
                        <input
                          type="number"
                          step="0.5"
                          min={2}
                          value={item.widthCm}
                          onChange={(e) =>
                            onUpdateItem({
                              ...item,
                              widthCm: Math.max(2, Number(e.target.value) || 2),
                            })
                          }
                          className="mt-1 w-full rounded-xl bg-[#fffdf9] px-2.5 py-1.5 font-mono text-xs text-[#2a1a12] border border-[#2a1a12]/12"
                        />
                      </label>
                      <label className="text-[11px] font-medium text-[#5b4a3f]">
                        Height (cm)
                        <input
                          type="number"
                          step="0.5"
                          min={1}
                          value={item.heightCm}
                          onChange={(e) =>
                            onUpdateItem({
                              ...item,
                              heightCm: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="mt-1 w-full rounded-xl bg-[#fffdf9] px-2.5 py-1.5 font-mono text-xs text-[#2a1a12] border border-[#2a1a12]/12"
                        />
                      </label>
                      <label className="text-[11px] font-medium text-[#5b4a3f]">
                        Unit Weight (kg)
                        <input
                          type="number"
                          step="0.05"
                          min={0.02}
                          value={item.weightKg}
                          onChange={(e) =>
                            onUpdateItem({
                              ...item,
                              weightKg: Math.max(0.02, Number(e.target.value) || 0.05),
                            })
                          }
                          className="mt-1 w-full rounded-xl bg-[#fffdf9] px-2.5 py-1.5 font-mono text-xs text-[#2a1a12] border border-[#2a1a12]/12"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-[#5b4a3f] pt-4">
                        <input
                          type="checkbox"
                          checked={item.essential}
                          onChange={(e) =>
                            onUpdateItem({ ...item, essential: e.target.checked })
                          }
                          className="h-4 w-4 accent-[#d4612f]"
                        />
                        Essential
                      </label>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Integrated Mathematical Calculation System + Unit Converter */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live Mathematical Calculation Breakdown */}
          <div className="glass-card rounded-[28px] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[#d4612f]" />
              <h2 className="text-lg font-normal tracking-tight text-[#2a1a12]">
                Live Mathematical Calculations
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              {/* A. Luggage Volume */}
              <div className="rounded-2xl bg-[#fffdf9]/85 p-3.5 border border-[#2a1a12]/10">
                <p className="font-medium text-[#2a1a12]">
                  A. Luggage Volume (Theoretical vs Usable)
                </p>
                <p className="mt-1 font-mono text-[#5b4a3f] tabular-nums">
                  V_theoretical = {suitcase.lengthCm} × {suitcase.widthCm} ×{" "}
                  {suitcase.heightCm} ={" "}
                  <span className="font-semibold text-[#2a1a12]">
                    {Math.round(summary.luggage.theoreticalVolumeCm3).toLocaleString()} cm³ (
                    {summary.luggage.theoreticalVolumeLitres.toFixed(2)} L)
                  </span>
                </p>
                <p className="mt-1 font-mono text-[#5b4a3f] tabular-nums">
                  V_usable = ({summary.luggage.internalL} × {summary.luggage.internalW} ×{" "}
                  {summary.luggage.internalH}) × {suitcase.usableEfficiency} ={" "}
                  <span className="font-semibold text-[#d4612f]">
                    {Math.round(summary.luggage.usableVolumeCm3).toLocaleString()} cm³ (
                    {summary.luggage.usableVolumeLitres.toFixed(2)} L)
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-[#8d7b6f]">
                  Shell walls, telescoping handle rails, and wheel wells reduce theoretical
                  volume by{" "}
                  {Math.round(summary.luggage.shellLossVolumeCm3).toLocaleString()} cm³.
                </p>
              </div>

              {/* B & C. Item & Total Volume */}
              <div className="rounded-2xl bg-[#fffdf9]/85 p-3.5 border border-[#2a1a12]/10">
                <p className="font-medium text-[#2a1a12]">
                  B &amp; C. Item &amp; Total Inventory Volume
                </p>
                <p className="mt-1 font-mono text-[#5b4a3f]">
                  Prism: V = l × w × h · Cylinder: V = π × r² × h
                </p>
                <p className="mt-1 font-mono text-[#5b4a3f] tabular-nums">
                  Σ V_items ={" "}
                  <span className="font-semibold text-[#2a1a12]">
                    {Math.round(summary.totalInventoryVolumeCm3).toLocaleString()} cm³ (
                    {summary.totalInventoryVolumeLitres.toFixed(2)} L)
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-[#8d7b6f] tabular-nums">
                  Inventory occupies {summary.inventoryToUsablePct}% of usable capacity.
                </p>
              </div>

              {/* D. Remaining Capacity */}
              <div className="rounded-2xl bg-[#fffdf9]/85 p-3.5 border border-[#2a1a12]/10">
                <p className="font-medium text-[#2a1a12]">
                  D. Remaining Usable Packing Capacity
                </p>
                <p className="mt-1 font-mono text-[#5b4a3f] tabular-nums">
                  V_remaining = {Math.round(summary.luggage.usableVolumeCm3).toLocaleString()} −{" "}
                  {Math.round(summary.packedVolumeCm3).toLocaleString()} ={" "}
                  <span className="font-semibold text-[#d4612f]">
                    {Math.round(summary.remainingUsableCm3).toLocaleString()} cm³ (
                    {summary.remainingUsableLitres.toFixed(2)} L)
                  </span>
                </p>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#ece3d7]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, summary.utilizationPct)}%`,
                      background: "linear-gradient(90deg, #e2875c 0%, #d4612f 100%)",
                    }}
                  />
                </div>
              </div>

              {/* E. Luggage Weight */}
              <div className="rounded-2xl bg-[#fffdf9]/85 p-3.5 border border-[#2a1a12]/10">
                <p className="font-medium text-[#2a1a12]">
                  E. Total Luggage Weight vs {policy.airlineName}
                </p>
                <p className="mt-1 font-mono text-[#5b4a3f] tabular-nums">
                  W_total = {summary.emptySuitcaseWeightKg.toFixed(2)} +{" "}
                  {summary.itemsWeightKg.toFixed(2)} ={" "}
                  <span className="font-semibold text-[#2a1a12]">
                    {summary.totalEstimatedWeightKg.toFixed(2)} kg
                  </span>{" "}
                  ({Math.round(kgToG(summary.totalEstimatedWeightKg)).toLocaleString()} g)
                </p>
                <p className="mt-0.5 text-[11px] text-[#8d7b6f] tabular-nums">
                  Allowance: {policy.maxWeightKg.toFixed(1)} kg · Margin:{" "}
                  {round2(policy.maxWeightKg - summary.totalEstimatedWeightKg).toFixed(2)} kg
                </p>
              </div>
            </div>
          </div>

          {/* F. Interactive Unit Conversion Tool */}
          <div className="rounded-[28px] bg-[#3b2116] p-5 sm:p-6 text-[#f6ede2] shadow-[0_20px_40px_-28px_rgba(40,30,20,0.45)] space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-normal tracking-tight text-white">
                F. Mathematical Unit Converter
              </h2>
              <RefreshCw className="h-4 w-4 text-[#e29f5f]" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={convCm}
                    onChange={(e) => setConvCm(Number(e.target.value) || 0)}
                    className="w-20 rounded-xl bg-[#2a1a12] px-2.5 py-1.5 font-mono text-xs tabular-nums text-white border border-white/15 focus:outline-none"
                  />
                  <span className="text-[#f6ede2]/75">cm</span>
                </div>
                <span className="font-mono font-medium tabular-nums text-[#f2c94c]">
                  = {cmToM(convCm).toFixed(3)} m
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={convCm3}
                    onChange={(e) => setConvCm3(Number(e.target.value) || 0)}
                    className="w-24 rounded-xl bg-[#2a1a12] px-2.5 py-1.5 font-mono text-xs tabular-nums text-white border border-white/15 focus:outline-none"
                  />
                  <span className="text-[#f6ede2]/75">cm³</span>
                </div>
                <span className="font-mono font-medium tabular-nums text-[#f2c94c]">
                  = {cm3ToLitres(convCm3).toFixed(2)} L
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={convKg}
                    onChange={(e) => setConvKg(Number(e.target.value) || 0)}
                    className="w-20 rounded-xl bg-[#2a1a12] px-2.5 py-1.5 font-mono text-xs tabular-nums text-white border border-white/15 focus:outline-none"
                  />
                  <span className="text-[#f6ede2]/75">kg</span>
                </div>
                <span className="font-mono font-medium tabular-nums text-[#f2c94c]">
                  = {Math.round(kgToG(convKg)).toLocaleString()} g
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
