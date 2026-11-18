import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Calculator,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ListChecks,
  Luggage,
  MapPin,
  Wand2,
  XCircle,
} from "lucide-react";
import type {
  AirlinePolicy,
  AppTab,
  BelongingItem,
  ComplianceReport,
  PackedUnitPlacement,
  PackingRecommendation,
  SuitcaseConfig,
  TripInfo,
} from "../types";
import { calculatePackingSummary } from "../utils/mathEngine";

interface DashboardViewProps {
  trip: TripInfo;
  onUpdateTrip: (trip: TripInfo) => void;
  suitcase: SuitcaseConfig;
  items: BelongingItem[];
  placements: PackedUnitPlacement[];
  policy: AirlinePolicy;
  compliance: ComplianceReport;
  recommendations: PackingRecommendation[];
  onNavigate: (tab: AppTab) => void;
  onRunAutoPackFromDashboard: () => void;
  onStartNewPacking: () => void;
  onOpenMathGuide: () => void;
}

export default function DashboardView({
  trip,
  onUpdateTrip,
  suitcase,
  items,
  placements,
  policy,
  compliance,
  recommendations,
  onNavigate,
  onRunAutoPackFromDashboard,
  onStartNewPacking,
  onOpenMathGuide,
}: DashboardViewProps) {
  const [editingTrip, setEditingTrip] = useState(false);
  const [imgError, setImgError] = useState(false);
  const summary = calculatePackingSummary(suitcase, items, placements);

  const packedPct =
    summary.totalItemsUnits > 0
      ? Math.round((summary.packedUnitsCount / summary.totalItemsUnits) * 100)
      : 0;

  const weightRatio = Math.min(
    1,
    summary.totalEstimatedWeightKg / Math.max(0.1, policy.maxWeightKg)
  );
  const weightPct = Math.round(weightRatio * 100);

  const gaugeRatio = Math.min(1, summary.utilizationPct / 100);
  const gaugeDashOffset = 252 * (1 - gaugeRatio);
  const ringDashOffset = 163.4 * (1 - weightRatio);

  const statusConfig = {
    COMPLIANT: {
      label: "COMPLIANT",
      textClass: "text-emerald-800",
      bgClass: "bg-emerald-50/90 border-emerald-200",
      Icon: CheckCircle2,
    },
    WARNING: {
      label: "WARNING",
      textClass: "text-amber-800",
      bgClass: "bg-amber-50/90 border-amber-200",
      Icon: AlertTriangle,
    },
    EXCEEDED: {
      label: "EXCEEDED",
      textClass: "text-rose-800",
      bgClass: "bg-rose-50/90 border-rose-200",
      Icon: XCircle,
    },
  }[compliance.overallStatus];

  const StatusIcon = statusConfig.Icon;

  return (
    <div className="space-y-16 pb-6">
      {/* SECTION 1 — EDITORIAL HERO + FROSTED LUGGAGE STUDIO */}
      <section className="pt-2 sm:pt-4">
        <div className="mx-auto max-w-4xl text-center px-2">
          <h1 className="editorial-display text-[clamp(44px,7vw,96px)] text-balance">
            SmartPack,
            <br />
            Redesigned
          </h1>
          <p className="mt-4 italic text-[clamp(16px,1.5vw,20px)] text-[#5b4a3f]">
            Pack Smart. Travel Easy. Shape belongings into calibrated 3D packing blueprints.
          </p>
        </div>

        {/* Sweeping Rounded-34px Hero Studio Shell */}
        <div className="shell-hero relative mt-8 rounded-[34px] p-4 sm:p-8 lg:p-10 shadow-[0_40px_80px_-50px_rgba(59,33,22,0.45)] overflow-hidden">
          <div className="mx-auto max-w-[1040px] glass-card rounded-[26px] overflow-hidden grid grid-cols-1 lg:grid-cols-[1.55fr_1fr]">
            {/* Left Column: Trip Brief, Live Capacity Progress & Recommendations */}
            <div className="p-5 sm:p-7 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-[0.1em] text-[#5b4a3f] font-medium">
                    Upcoming Journey · {policy.airlineName} ({policy.category})
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingTrip(!editingTrip)}
                    className="min-h-[34px] pill-nav px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.04em] whitespace-nowrap"
                  >
                    {editingTrip ? "Close Editor" : "Edit Trip"}
                  </button>
                </div>

                {editingTrip ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-2xl bg-white/75 p-4 border border-[#2a1a12]/10">
                    <label className="block text-xs text-[#5b4a3f]">
                      Destination
                      <input
                        type="text"
                        value={trip.destination}
                        onChange={(e) =>
                          onUpdateTrip({ ...trip, destination: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 text-sm text-[#2a1a12] border border-[#2a1a12]/15 focus:outline-none"
                      />
                    </label>
                    <label className="block text-xs text-[#5b4a3f]">
                      Departure Date
                      <input
                        type="date"
                        value={trip.departureDate}
                        onChange={(e) =>
                          onUpdateTrip({ ...trip, departureDate: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 text-sm text-[#2a1a12] border border-[#2a1a12]/15 focus:outline-none"
                      />
                    </label>
                    <label className="block text-xs text-[#5b4a3f]">
                      Duration (days)
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={trip.durationDays}
                        onChange={(e) =>
                          onUpdateTrip({
                            ...trip,
                            durationDays: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 text-sm text-[#2a1a12] border border-[#2a1a12]/15 focus:outline-none"
                      />
                    </label>
                    <div className="sm:col-span-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingTrip(false)}
                        className="btn-dark-pill min-h-[38px] px-4 py-1.5 text-xs font-medium uppercase tracking-[0.04em]"
                      >
                        Save Trip
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#5b4a3f]">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#2a1a12] text-sm">
                      <MapPin className="h-3.5 w-3.5 text-[#d4612f]" />
                      {trip.destination}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Calendar className="h-3.5 w-3.5 text-[#8d7b6f]" />
                      {trip.departureDate} ({trip.durationDays} days)
                    </span>
                  </div>
                )}

                {/* Conversational / Editorial Smart Recommendation Bubbles */}
                <div className="space-y-2.5 pt-1">
                  <div className="ml-auto max-w-[85%] rounded-2xl bg-[#fffdf9]/90 px-4 py-2.5 text-xs text-[#3b2a20] shadow-[0_6px_18px_-10px_rgba(40,20,10,0.22)]">
                    Check capacity, weight, and 3D arrangement for{" "}
                    <span className="font-medium">{suitcase.name}</span> (
                    {suitcase.lengthCm}×{suitcase.widthCm}×{suitcase.heightCm} cm).
                  </div>

                  {recommendations.slice(0, 2).map((rec) => {
                    const Icon =
                      rec.severity === "critical"
                        ? XCircle
                        : rec.severity === "warning"
                        ? AlertTriangle
                        : CheckCircle2;
                    const iconColor =
                      rec.severity === "critical"
                        ? "text-rose-700"
                        : rec.severity === "warning"
                        ? "text-[#d4612f]"
                        : "text-emerald-700";

                    return (
                      <div
                        key={rec.id}
                        className="max-w-[92%] flex items-start gap-2.5 rounded-2xl bg-[#faf5ee]/80 px-3.5 py-2.5 border border-white/75"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90">
                          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#2a1a12]">{rec.title}</p>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#5b4a3f]">
                            {rec.detail}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Creative Blueprint / Capacity Bar + Three Primary Action Buttons */}
              <div className="space-y-4 pt-2 border-t border-[#2a1a12]/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <small className="block text-[10.5px] uppercase tracking-[0.08em] text-[#6a594d]">
                      Packing Blueprint
                    </small>
                    <strong className="mt-0.5 block text-lg font-normal tracking-tight text-[#2a1a12] tabular-nums">
                      {summary.packedUnitsCount}/{summary.totalItemsUnits} packed ·{" "}
                      {summary.remainingUsableLitres.toFixed(1)} L free
                    </strong>
                  </div>

                  <div className="w-full sm:w-[46%] text-left sm:text-right">
                    <small className="text-[11.5px] text-[#5b4a3f] tabular-nums">
                      {summary.utilizationPct}% space used ({packedPct}% items)
                    </small>
                    <div className="relative mt-2 h-2 w-full rounded-full bg-white/65">
                      <div
                        className="relative h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(4, Math.min(100, summary.utilizationPct))}%`,
                          background: "linear-gradient(90deg, #e2875c 0%, #d4612f 100%)",
                        }}
                      >
                        <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white border-2 border-[#d4612f] shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Three Main Dashboard Buttons */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={onStartNewPacking}
                    className="pill-nav min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap"
                  >
                    <Luggage className="h-3.5 w-3.5 text-[#5b4a3f]" />
                    <span>Start New Packing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("items")}
                    className="pill-nav min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap"
                  >
                    <ListChecks className="h-3.5 w-3.5 text-[#5b4a3f]" />
                    <span>My Packing List</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRunAutoPackFromDashboard}
                    className="btn-dark-pill min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>AutoPack My Luggage</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Suitcase Suite */}
            <div className="border-t lg:border-t-0 lg:border-l border-white/50 p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-[#4b3a30]">
                <span>Visual Luggage Suite</span>
                <span className="font-mono text-[11px] tabular-nums">
                  {suitcase.type === "carry-on" ? "Carry-On" : "Checked"}
                </span>
              </div>

              <div className="relative flex-1 min-h-[220px] overflow-hidden rounded-[18px] bg-[#ece3d7]">
                {!imgError ? (
                  <img
                    src="/src/assets/images/hero_suitcase_studio_1794964792858.jpg"
                    alt="SmartPack matte polycarbonate suitcase with dimensional measurement grid"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-[#3b2116] text-[#f6ede2]">
                    <Luggage className="h-10 w-10 text-[#e29f5f]" />
                    <span className="mt-2 text-xs">{suitcase.name}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#2a1a12]">
                    {suitcase.name}
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-[#5b4a3f]">
                    {summary.luggage.usableVolumeLitres.toFixed(1)} L usable ·{" "}
                    {summary.totalEstimatedWeightKg.toFixed(2)} kg total
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("scanner")}
                  className="pill-nav min-h-[38px] shrink-0 px-3.5 py-1.5 text-xs font-medium whitespace-nowrap"
                >
                  Measure Bag
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — BENTO MATHEMATICAL & PACKING INTELLIGENCE SHELL */}
      <section className="shell-bento rounded-[34px] px-4 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full bg-white/65 border border-white/80 px-3 py-1.5 text-[10.5px] uppercase tracking-[0.14em] text-[#5b4a3f]">
            From measurement to spatial balance
          </span>
          <h2 className="editorial-h2 mt-4 text-[clamp(30px,4.2vw,54px)] text-balance">
            Packing Gets Smarter with
            <br />
            <span className="font-light text-[#8d7b6f]">A Mathematical Direction</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#5b4a3f] leading-relaxed">
            SmartPack unites suitcase geometry, item approximation, and 3D bin-packing so
            every trip fits cleanly within airline allowances.
          </p>
        </div>

        {/* 5-Card Bento Grid */}
        <div className="mt-10 grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr]">
          {/* 1. Tall Feature Card: Smart AutoPack */}
          <div className="relative md:col-span-2 lg:col-span-1 lg:row-span-2 min-h-[420px] rounded-[24px] overflow-hidden p-7 text-white flex flex-col justify-between bg-[#3b2116] border border-white/35 shadow-[0_20px_40px_-30px_rgba(40,30,20,0.45)]">
            <div
              className="pointer-events-none absolute inset-0 opacity-35"
              style={{
                background:
                  "radial-gradient(circle at 80% 20%, #e9a77d 0%, transparent 55%), radial-gradient(circle at 20% 85%, #a9c6e6 0%, transparent 55%)",
              }}
            />
            <div className="relative z-10">
              <h3 className="text-[clamp(26px,2.4vw,34px)] font-normal leading-[1.06] tracking-[-0.03em]">
                Pack with precision,
                <br />
                <span className="opacity-75">never guess space.</span>
              </h3>
              <p className="mt-3 max-w-[290px] text-xs leading-relaxed text-[#f6ede2]/85">
                AutoPack evaluates 6 orthogonal rotations and extreme-point anchors to fit
                your gear inside internal boundaries with zero overlap.
              </p>
            </div>

            <div className="relative z-10 space-y-3.5 pt-6">
              <div className="flex items-center justify-between text-xs text-[#f6ede2]/85 border-t border-white/15 pt-3.5">
                <span>Usable Volume</span>
                <span className="font-mono tabular-nums font-medium text-white">
                  {Math.round(summary.luggage.usableVolumeCm3).toLocaleString()} cm³ (
                  {summary.luggage.usableVolumeLitres.toFixed(1)} L)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#f6ede2]/85">
                <span>Remaining Capacity</span>
                <span className="font-mono tabular-nums font-medium text-white">
                  {summary.remainingUsableLitres.toFixed(1)} L free
                </span>
              </div>

              <button
                type="button"
                onClick={onRunAutoPackFromDashboard}
                className="w-full min-h-[44px] rounded-full bg-white py-3 text-center text-xs font-medium text-[#2a1a12] hover:-translate-y-0.5 transition-transform"
              >
                Launch 3D AutoPack Now
              </button>
            </div>
          </div>

          {/* 2. Card: Smart Scanner Quick Access */}
          <div className="glass-card glass-card-interactive rounded-[24px] p-4 flex flex-col justify-between min-h-[250px]">
            <div className="rounded-[16px] bg-[#ece3d7]/75 p-4 flex flex-col justify-between flex-1">
              <div className="flex items-center justify-between">
                <Camera className="h-5 w-5 text-[#3b2116]" />
                <span className="font-mono text-[11px] tabular-nums text-[#5b4a3f]">
                  {suitcase.confidencePct}% confidence
                </span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.08em] text-[#8d7b6f]">
                  Measured Dimensions
                </p>
                <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[#2a1a12]">
                  {suitcase.lengthCm} × {suitcase.widthCm} × {suitcase.heightCm} cm
                </p>
              </div>
            </div>
            <div className="px-2 pt-3.5 pb-1 flex items-end justify-between gap-2">
              <div>
                <h4 className="text-base font-normal text-[#2a1a12]">Smart Scanner</h4>
                <p className="mt-1 text-xs text-[#5b4a3f]">
                  Camera recognition & manual L×W×H calibration.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("scanner")}
                className="pill-nav min-h-[36px] shrink-0 px-3 py-1 text-xs font-medium whitespace-nowrap"
              >
                Scan
              </button>
            </div>
          </div>

          {/* 3. Card: Capacity Arc Gauge */}
          <div className="glass-card glass-card-interactive rounded-[24px] p-4 flex flex-col justify-between min-h-[250px]">
            <div className="relative flex-1 grid place-items-center min-h-[145px]">
              <svg
                viewBox="0 0 180 100"
                className="w-[180px] h-[108px] overflow-visible"
              >
                <defs>
                  <linearGradient id="smartpack-gauge" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a9c6e6" />
                    <stop offset="100%" stopColor="#e9a77d" />
                  </linearGradient>
                </defs>
                <path
                  d="M10 95 A80 80 0 0 1 170 95"
                  fill="none"
                  stroke="rgba(42,26,18,0.1)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M10 95 A80 80 0 0 1 170 95"
                  fill="none"
                  stroke="url(#smartpack-gauge)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="252"
                  strokeDashoffset={gaugeDashOffset}
                  style={{ transition: "stroke-dashoffset 0.9s var(--ease)" }}
                />
              </svg>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[15%] font-display text-[30px] font-normal tracking-[-0.03em] tabular-nums text-[#2a1a12]">
                {Math.round(summary.utilizationPct)}%
              </div>
              <div className="absolute bottom-1 left-3 right-3 flex justify-between text-[10px] text-[#7a6a5e]">
                <span>Empty</span>
                <span>Full Capacity</span>
              </div>
            </div>
            <div className="px-2 pt-3 pb-1">
              <h4 className="text-base font-normal text-[#2a1a12]">
                Space Utilization
              </h4>
              <p className="mt-1 text-xs text-[#5b4a3f]">
                {summary.packedVolumeLitres.toFixed(1)} L packed of{" "}
                {summary.luggage.usableVolumeLitres.toFixed(1)} L usable cavity.
              </p>
            </div>
          </div>

          {/* 4. Card: Coherent Item Rows */}
          <div className="glass-card glass-card-interactive rounded-[24px] p-4 flex flex-col justify-between min-h-[250px]">
            <div className="flex flex-col gap-1.5">
              {items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 rounded-xl bg-white/70 px-2.5 py-2 text-xs"
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-medium text-white"
                    style={{ backgroundColor: item.colorHex }}
                  >
                    {item.quantity}×
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate font-medium text-[#2a1a12]">
                      {item.name}
                    </b>
                    <em className="not-italic text-[10.5px] text-[#8a7a6e] font-mono tabular-nums">
                      {item.lengthCm}×{item.widthCm}×{item.heightCm} cm ·{" "}
                      {(item.weightKg * item.quantity).toFixed(2)} kg
                    </em>
                  </div>
                  <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#2a1a12] text-white">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                </div>
              ))}
            </div>
            <div className="px-2 pt-3 pb-1 flex items-end justify-between gap-2">
              <div>
                <h4 className="text-base font-normal text-[#2a1a12]">
                  My Packing List
                </h4>
                <p className="mt-1 text-xs text-[#5b4a3f]">
                  {summary.totalItemsUnits} units across {items.length} categories.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("items")}
                className="pill-nav min-h-[36px] shrink-0 px-3 py-1 text-xs font-medium whitespace-nowrap"
              >
                Edit
              </button>
            </div>
          </div>

          {/* 5. Card: Weight & Airline Ring Card */}
          <div className="glass-card glass-card-interactive rounded-[24px] p-4 flex flex-col justify-between min-h-[250px]">
            <div className="flex items-center justify-between gap-3 rounded-[16px] bg-white/60 p-3.5">
              <div className="relative h-[66px] w-[66px] shrink-0">
                <svg
                  viewBox="0 0 62 62"
                  className="h-full w-full -rotate-90"
                >
                  <circle
                    cx="31"
                    cy="31"
                    r="26"
                    fill="none"
                    stroke="rgba(42,26,18,0.08)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="31"
                    cy="31"
                    r="26"
                    fill="none"
                    stroke={
                      compliance.overallStatus === "EXCEEDED" ? "#d4612f" : "#f2c94c"
                    }
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="163.4"
                    strokeDashoffset={ringDashOffset}
                    style={{ transition: "stroke-dashoffset 0.9s var(--ease)" }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums text-[#2a1a12]">
                  {weightPct}%
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium ${statusConfig.bgClass} ${statusConfig.textClass}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </span>
                <p className="mt-1.5 font-mono text-sm font-medium tabular-nums text-[#2a1a12]">
                  {summary.totalEstimatedWeightKg.toFixed(2)} / {policy.maxWeightKg.toFixed(1)} kg
                </p>
                <p className="truncate text-[11px] text-[#5b4a3f]">
                  {policy.airlineName}
                </p>
              </div>
            </div>

            <div className="px-2 pt-3 pb-1 flex items-end justify-between gap-2">
              <div>
                <h4 className="text-base font-normal text-[#2a1a12]">
                  Airline Compliance
                </h4>
                <p className="mt-1 text-xs text-[#5b4a3f]">
                  Bag {summary.emptySuitcaseWeightKg.toFixed(1)} kg + items{" "}
                  {summary.itemsWeightKg.toFixed(2)} kg.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("profile")}
                className="pill-nav min-h-[36px] shrink-0 px-3 py-1 text-xs font-medium whitespace-nowrap"
              >
                Check
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — QUICK WORKFLOWS & MATHEMATICAL TRANSPARENCY STRIP */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate("virtual")}
          className="glass-card glass-card-interactive rounded-[24px] p-5 text-left flex items-center justify-between gap-3"
        >
          <div>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#8d7b6f]">
              Interactive 3D
            </span>
            <h3 className="mt-1 text-base font-medium text-[#2a1a12]">
              3D Virtual Packing Simulator
            </h3>
            <p className="mt-1 text-xs text-[#5b4a3f]">
              Rotate, zoom, and drag-and-drop items inside the suitcase.
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ece3d7] text-[#2a1a12]">
            <Box className="h-4 w-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("items")}
          className="glass-card glass-card-interactive rounded-[24px] p-5 text-left flex items-center justify-between gap-3"
        >
          <div>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#8d7b6f]">
              Geometry & Units
            </span>
            <h3 className="mt-1 text-base font-medium text-[#2a1a12]">
              Mathematical Calculator
            </h3>
            <p className="mt-1 text-xs text-[#5b4a3f]">
              Explore V = L×W×H, πr²h, usable vs theoretical capacity, and unit conversions.
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ece3d7] text-[#2a1a12]">
            <Calculator className="h-4 w-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenMathGuide}
          className="glass-card glass-card-interactive rounded-[24px] p-5 text-left flex items-center justify-between gap-3"
        >
          <div>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#8d7b6f]">
              Formula Reference
            </span>
            <h3 className="mt-1 text-base font-medium text-[#2a1a12]">
              Mathematics Information
            </h3>
            <p className="mt-1 text-xs text-[#5b4a3f]">
              Review all 9 Geometry, Measurement & Optimization principles applied.
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2c94c] text-[#3b2116]">
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      </section>
    </div>
  );
}
