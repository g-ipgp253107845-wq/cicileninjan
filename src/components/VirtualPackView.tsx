import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Eye,
  Hand,
  Layers,
  ListOrdered,
  PackageMinus,
  PackagePlus,
  RefreshCw,
  RotateCw,
  Trash2,
  Wand2,
} from "lucide-react";
import type {
  AutoPackArrangement,
  BelongingItem,
  PackedUnitPlacement,
  SuitcaseConfig,
} from "../types";
import {
  canPlaceBox,
  findFirstValidSpotForItem,
  generateAutoPackArrangements,
  rotatePlacement90,
} from "../utils/autoPackEngine";
import {
  calculateLuggageMath,
  calculatePackingSummary,
  round1,
} from "../utils/mathEngine";
import VirtualPacking3D from "./VirtualPacking3D";

interface VirtualPackViewProps {
  suitcase: SuitcaseConfig;
  items: BelongingItem[];
  placements: PackedUnitPlacement[];
  onSetPlacements: (next: PackedUnitPlacement[]) => void;
  arrangements: AutoPackArrangement[];
  activeArrangementId: string | null;
  onSelectArrangement: (arr: AutoPackArrangement) => void;
  onRunAutoPack: () => void;
  mode: "manual" | "autopack";
  onChangeMode: (mode: "manual" | "autopack") => void;
}

export default function VirtualPackView({
  suitcase,
  items,
  placements,
  onSetPlacements,
  arrangements,
  activeArrangementId,
  onSelectArrangement,
  onRunAutoPack,
  mode,
  onChangeMode,
}: VirtualPackViewProps) {
  const [selectedUnitKey, setSelectedUnitKey] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<"iso" | "top" | "front" | "side">("iso");
  const [lidOpen, setLidOpen] = useState(true);
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  const summary = calculatePackingSummary(suitcase, items, placements);
  const luggageMath = calculateLuggageMath(suitcase);

  const selectedPlacement = useMemo(
    () => placements.find((p) => p.unitKey === selectedUnitKey) || null,
    [placements, selectedUnitKey]
  );

  // Determine which item units are currently unpacked
  const unpackedUnits = useMemo(() => {
    const packedKeys = new Set(placements.map((p) => p.unitKey));
    const list: Array<{ item: BelongingItem; unitIndex: number; unitKey: string }> = [];
    for (const item of items) {
      for (let i = 0; i < item.quantity; i++) {
        const key = `${item.id}#${i}`;
        if (!packedKeys.has(key)) {
          list.push({ item, unitIndex: i, unitKey: key });
        }
      }
    }
    return list;
  }, [items, placements]);

  const activeArrangement = useMemo(
    () =>
      arrangements.find((a) => a.id === activeArrangementId) ||
      arrangements[0] ||
      null,
    [arrangements, activeArrangementId]
  );

  function handleMoveUnit(unitKey: string, newX: number, newY: number, newZ: number) {
    onSetPlacements(
      placements.map((p) =>
        p.unitKey === unitKey ? { ...p, x: newX, y: newY, z: newZ } : p
      )
    );
  }

  function handleRotateSelected(axis: "x" | "y" | "z") {
    if (!selectedPlacement) return;
    const rotated = rotatePlacement90(selectedPlacement, axis, placements, suitcase);
    if (!rotated) {
      setFeedbackMsg(
        `Cannot rotate "${selectedPlacement.name}" on ${axis.toUpperCase()}-axis here without overlapping or exceeding boundaries.`
      );
      return;
    }
    setFeedbackMsg(null);
    onSetPlacements(
      placements.map((p) => (p.unitKey === rotated.unitKey ? rotated : p))
    );
  }

  function handleNudgeVertical(deltaY: number) {
    if (!selectedPlacement) return;
    const idx = placements.findIndex((p) => p.unitKey === selectedPlacement.unitKey);
    const nextY = round1(
      Math.max(
        0,
        Math.min(luggageMath.internalH - selectedPlacement.dimY, selectedPlacement.y + deltaY)
      )
    );
    const candidate = {
      x: selectedPlacement.x,
      y: nextY,
      z: selectedPlacement.z,
      dimX: selectedPlacement.dimX,
      dimY: selectedPlacement.dimY,
      dimZ: selectedPlacement.dimZ,
    };
    if (
      canPlaceBox(
        candidate,
        placements,
        luggageMath.internalL,
        luggageMath.internalH,
        luggageMath.internalW,
        idx
      )
    ) {
      setFeedbackMsg(null);
      handleMoveUnit(selectedPlacement.unitKey, selectedPlacement.x, nextY, selectedPlacement.z);
    } else {
      setFeedbackMsg("Vertical move blocked by another object or suitcase depth limit.");
    }
  }

  function handleUnpackSelected() {
    if (!selectedPlacement) return;
    onSetPlacements(placements.filter((p) => p.unitKey !== selectedPlacement.unitKey));
    setSelectedUnitKey(null);
    setFeedbackMsg(null);
  }

  function handlePackUnpackedUnit(item: BelongingItem, unitIndex: number) {
    const placed = findFirstValidSpotForItem(item, unitIndex, placements, suitcase);
    if (!placed) {
      setFeedbackMsg(
        `No valid non-overlapping 3D space left for "${item.name}". Try AutoPack Compressed mode or rotate existing items.`
      );
      return;
    }
    setFeedbackMsg(null);
    onSetPlacements([...placements, placed]);
    setSelectedUnitKey(placed.unitKey);
  }

  // Fallback arrangement preview if user switched directly to AutoPack tab before running
  const displayedArrangements = useMemo(() => {
    if (arrangements.length > 0) return arrangements;
    return generateAutoPackArrangements(suitcase, items);
  }, [arrangements, suitcase, items]);

  return (
    <div className="space-y-6 pb-4">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-white/70 border border-white/80 px-3 py-1 text-[10.5px] uppercase tracking-[0.12em] text-[#5b4a3f]">
            Interactive Spatial Simulation
          </span>
          <h1 className="editorial-h2 mt-2 text-[clamp(26px,3.4vw,42px)]">
            3D Virtual Packing &amp; AutoPack
          </h1>
          <p className="mt-1 text-xs text-[#5b4a3f] sm:text-sm tabular-nums">
            {suitcase.name} · Internal cavity {luggageMath.internalL} × {luggageMath.internalW} ×{" "}
            {luggageMath.internalH} cm · {summary.utilizationPct}% filled (
            {summary.remainingUsableLitres.toFixed(1)} L left)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Manual vs AutoPack Mode Toggle */}
          <div className="inline-flex rounded-full bg-[#ece3d7] p-1 border border-white/60">
            <button
              type="button"
              onClick={() => onChangeMode("manual")}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === "manual"
                  ? "bg-white text-[#2a1a12] shadow-sm"
                  : "text-[#5b4a3f] hover:text-[#2a1a12]"
              }`}
            >
              <Hand className="h-3.5 w-3.5" />
              <span>Manual Mode</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeMode("autopack")}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === "autopack"
                  ? "bg-[#3b2116] text-[#f6ede2] shadow-sm"
                  : "text-[#5b4a3f] hover:text-[#2a1a12]"
              }`}
            >
              <Wand2 className="h-3.5 w-3.5 text-[#f2c94c]" />
              <span>AutoPack Mode</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onRunAutoPack();
              setFeedbackMsg(null);
            }}
            className="btn-dark-pill min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap"
          >
            <Wand2 className="h-4 w-4 text-[#e29f5f]" />
            <span>AutoPack My Luggage</span>
          </button>
        </div>
      </div>

      {/* Unobstructed 3D Suitcase Viewport + Bottom Control Dock (Uses warm-surface, no backdrop-blur over WebGL) */}
      <div className="warm-surface rounded-[34px] p-3.5 sm:p-4 space-y-3">
        <div className="relative h-[380px] sm:h-[460px] w-full overflow-hidden rounded-[26px]">
          <VirtualPacking3D
            suitcase={suitcase}
            placements={placements}
            selectedUnitKey={selectedUnitKey}
            onSelectUnit={setSelectedUnitKey}
            onMoveUnit={handleMoveUnit}
            manualDragEnabled={mode === "manual"}
            explodeFactor={explodeFactor}
            lidOpen={lidOpen}
            cameraPreset={cameraPreset}
            onCollisionFeedback={setFeedbackMsg}
          />

          {/* Minimal Top-Left Viewport Info (Non-obstructive, no backdrop-filter over WebGL) */}
          <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-[#3b2116]/95 px-3.5 py-1.5 text-xs text-[#f6ede2] shadow-sm border border-white/15">
            <span className="font-mono tabular-nums font-medium">
              {placements.length}/{summary.totalItemsUnits} packed ·{" "}
              {summary.packedVolumeLitres.toFixed(1)} L /{" "}
              {summary.luggage.usableVolumeLitres.toFixed(1)} L
            </span>
          </div>
        </div>

        {/* Unified Bottom Viewport Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f6f0e7]/90 px-4 py-2.5 border border-[#2a1a12]/10">
          {/* Camera Angles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8d7b6f] mr-1">
              View:
            </span>
            {(
              [
                { id: "iso", label: "Isometric" },
                { id: "top", label: "Top-Down" },
                { id: "front", label: "Front" },
                { id: "side", label: "Side" },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => setCameraPreset(cam.id)}
                className={`min-h-[34px] rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  cameraPreset === cam.id
                    ? "bg-[#3b2116] text-[#f6ede2]"
                    : "bg-white text-[#5b4a3f] border border-[#2a1a12]/10 hover:text-[#2a1a12]"
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          {/* Layer Explode + Lid Toggle + Clear */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-[#5b4a3f]">
              <Layers className="h-3.5 w-3.5 text-[#d4612f]" />
              <span>Layers</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={explodeFactor}
                onChange={(e) => setExplodeFactor(Number(e.target.value))}
                className="w-20 accent-[#d4612f]"
              />
            </label>

            <button
              type="button"
              onClick={() => setLidOpen(!lidOpen)}
              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-medium text-[#2a1a12] border border-[#2a1a12]/12 hover:bg-[#ece3d7] transition-colors whitespace-nowrap"
            >
              <Eye className="h-3.5 w-3.5 text-[#d4612f]" />
              <span>{lidOpen ? "Close Lid" : "Open Lid"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSetPlacements([]);
                setSelectedUnitKey(null);
              }}
              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-medium text-rose-700 border border-rose-200 hover:bg-rose-50 transition-colors whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Empty Bag</span>
            </button>
          </div>
        </div>

        {/* Collision / Boundary Feedback Banner */}
        {feedbackMsg && (
          <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 border border-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Selected 3D Item Manipulation Bar */}
        {selectedPlacement && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#3b2116] px-4 py-3 text-[#f6ede2]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#e29f5f]">
                Selected 3D Object ·{" "}
                {mode === "manual"
                  ? "Drag directly inside suitcase or use controls"
                  : "Switch to Manual Mode to drag"}
              </p>
              <p className="text-sm font-medium text-white">
                {selectedPlacement.name} ·{" "}
                <span className="font-mono text-xs font-normal text-[#f6ede2]/80 tabular-nums">
                  {selectedPlacement.dimX}×{selectedPlacement.dimZ}×{selectedPlacement.dimY} cm at
                  ({selectedPlacement.x}, {selectedPlacement.z}, y={selectedPlacement.y})
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleRotateSelected("y")}
                className="min-h-[38px] inline-flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-medium hover:bg-white/25 whitespace-nowrap"
              >
                <RotateCw className="h-3.5 w-3.5 text-[#f2c94c]" />
                <span>Rotate 90°</span>
              </button>
              <button
                type="button"
                onClick={() => handleRotateSelected("x")}
                className="min-h-[38px] rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25 whitespace-nowrap"
              >
                Flip Edge
              </button>
              <button
                type="button"
                onClick={() => handleNudgeVertical(1.5)}
                title="Raise layer"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleNudgeVertical(-1.5)}
                title="Lower layer"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleUnpackSelected}
                className="min-h-[38px] inline-flex items-center gap-1 rounded-full bg-[#d4612f] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#be5223] whitespace-nowrap"
              >
                <PackageMinus className="h-3.5 w-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mode-Specific Lower Workspace: Smart AutoPack Layouts & Guide OR Manual Tray */}
      {mode === "autopack" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Alternative AutoPack Arrangements Comparison */}
          <div className="lg:col-span-7 glass-card rounded-[28px] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-normal tracking-tight text-[#2a1a12]">
                  AutoPack Arrangements Comparison
                </h2>
                <p className="text-xs text-[#5b4a3f]">
                  Every layout respects real object dimensions with zero overlap inside cavity
                  bounds
                </p>
              </div>
              <button
                type="button"
                onClick={onRunAutoPack}
                className="pill-nav min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#d4612f]" />
                <span>Regenerate</span>
              </button>
            </div>

            <div className="space-y-3">
              {displayedArrangements.map((arr) => {
                const isActive = activeArrangement?.id === arr.id;
                return (
                  <div
                    key={arr.id}
                    className={`rounded-2xl p-4 border transition-colors ${
                      isActive
                        ? "bg-[#fffdf9]/95 border-[#d4612f]"
                        : "bg-[#faf5ee]/80 border-[#2a1a12]/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-[#2a1a12]">
                            {arr.strategyName}
                          </h3>
                          {arr.recommended && (
                            <span className="text-[11px] font-semibold text-[#d4612f]">
                              · Recommended
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[#5b4a3f]">
                          {arr.strategySummary}
                        </p>
                        <p className="mt-2 font-mono text-xs tabular-nums text-[#2a1a12]">
                          Fitted: {arr.totalUnitsPlaced}/{arr.totalUnitsRequested} units ·
                          Utilization: {arr.utilizationPct}% · Base Gravity Y:{" "}
                          {arr.centerOfGravityRatioY}%
                        </p>
                        {arr.unfitted.length > 0 && (
                          <p className="mt-1 text-xs text-amber-800">
                            Did not fit: {arr.unfitted.map((u) => u.name).join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectArrangement(arr)}
                          className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                            isActive
                              ? "bg-[#3b2116] text-[#f6ede2]"
                              : "bg-white text-[#2a1a12] border border-[#2a1a12]/12 hover:bg-[#ece3d7]"
                          }`}
                        >
                          {isActive ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-[#f2c94c]" />
                              <span>Active in 3D</span>
                            </>
                          ) : (
                            <span>Preview &amp; Accept</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#2a1a12]/10 text-xs text-[#5b4a3f]">
              <span>
                Note: Irregular clothing uses simplified folded prism geometry; actual fabric
                can compress slightly further around curved corners.
              </span>
              <button
                type="button"
                onClick={() => onChangeMode("manual")}
                className="pill-nav min-h-[38px] px-4 py-1.5 text-xs font-medium whitespace-nowrap"
              >
                Modify Layout Manually
              </button>
            </div>
          </div>

          {/* Step-by-Step Packing Guide */}
          <div className="lg:col-span-5 glass-card rounded-[28px] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-[#d4612f]" />
                <h2 className="text-lg font-normal tracking-tight text-[#2a1a12]">
                  Step-by-Step Packing Guide
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="pill-nav px-3 py-1 text-xs font-medium"
              >
                {showGuide ? "Hide" : "Show"}
              </button>
            </div>

            {showGuide && activeArrangement && (
              <div className="space-y-3">
                {activeArrangement.guideSteps.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="rounded-2xl bg-[#fffdf9]/85 p-3.5 border border-[#2a1a12]/10"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4612f]">
                      Step {step.stepNumber}
                    </p>
                    <h3 className="mt-0.5 text-sm font-medium text-[#2a1a12]">{step.title}</h3>
                    <p className="mt-0.5 text-xs text-[#5b4a3f]">{step.description}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-[#3b2116]">
                      Items: {step.itemsIncluded.join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Manual Packing Mode: Unpacked Items Tray */
        <div className="glass-card rounded-[28px] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-normal tracking-tight text-[#2a1a12]">
                Unpacked Belongings Tray ({unpackedUnits.length} remaining)
              </h2>
              <p className="text-xs text-[#5b4a3f]">
                Click any item below to place it into an open spot inside the 3D suitcase, then
                drag or rotate it directly in the 3D view.
              </p>
            </div>
            {unpackedUnits.length === 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                All inventory items packed!
              </span>
            )}
          </div>

          {unpackedUnits.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {unpackedUnits.map(({ item, unitIndex, unitKey }) => (
                <button
                  key={unitKey}
                  type="button"
                  onClick={() => handlePackUnpackedUnit(item, unitIndex)}
                  className="min-h-[56px] flex items-center justify-between rounded-2xl bg-[#fffdf9]/85 px-3.5 py-2.5 text-left border border-[#2a1a12]/10 hover:bg-[#ece3d7]/70 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: item.colorHex }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#2a1a12]">
                        {item.name} #{unitIndex + 1}
                      </p>
                      <p className="font-mono text-[11px] text-[#5b4a3f] tabular-nums">
                        {item.lengthCm}×{item.widthCm}×{item.heightCm} cm · {item.weightKg} kg
                      </p>
                    </div>
                  </div>
                  <PackagePlus className="h-4 w-4 shrink-0 text-[#d4612f]" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
