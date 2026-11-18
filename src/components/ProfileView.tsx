import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FolderOpen,
  Plane,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import type {
  AirlinePolicy,
  BelongingItem,
  ComplianceReport,
  LuggageType,
  PackedUnitPlacement,
  SavedPackingSession,
  SuitcaseConfig,
} from "../types";
import { AIRLINE_PRESETS } from "../data/presets";

interface ProfileViewProps {
  suitcase: SuitcaseConfig;
  items: BelongingItem[];
  placements: PackedUnitPlacement[];
  policy: AirlinePolicy;
  onUpdatePolicy: (policy: AirlinePolicy) => void;
  compliance: ComplianceReport;
  sessions: SavedPackingSession[];
  onSaveSession: (sessionName: string) => void;
  onLoadSession: (session: SavedPackingSession) => void;
  onDeleteSession: (id: string) => void;
  onResetDemo: () => void;
  onOpenMathGuide: () => void;
}

export default function ProfileView({
  policy,
  onUpdatePolicy,
  compliance,
  sessions,
  onSaveSession,
  onLoadSession,
  onDeleteSession,
  onResetDemo,
  onOpenMathGuide,
}: ProfileViewProps) {
  const [sessionTitle, setSessionTitle] = useState("Tokyo 5-Day Cabin Pack");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const badgeStyle = {
    COMPLIANT: {
      text: "COMPLIANT",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
      Icon: CheckCircle2,
    },
    WARNING: {
      text: "WARNING",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
      Icon: AlertTriangle,
    },
    EXCEEDED: {
      text: "EXCEEDED",
      cls: "bg-rose-50 text-rose-800 border-rose-200",
      Icon: XCircle,
    },
  }[compliance.overallStatus];

  const OverallIcon = badgeStyle.Icon;

  function handleSaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSaveSession(sessionTitle.trim() || "Saved Trip");
    setSaveNotice("Packing session saved to browser storage.");
    window.setTimeout(() => setSaveNotice(null), 3000);
  }

  return (
    <div className="space-y-8 pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-white/70 border border-white/80 px-3 py-1 text-[10.5px] uppercase tracking-[0.12em] text-[#5b4a3f]">
            Airline Compliance &amp; Saved Trips
          </span>
          <h1 className="editorial-h2 mt-2 text-[clamp(26px,3.4vw,42px)]">
            Airline Restrictions &amp; Sessions
          </h1>
          <p className="mt-1 text-xs text-[#5b4a3f] sm:text-sm">
            Verify baggage dimensions, weight, and liquid limits, or save and load trips.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenMathGuide}
          className="pill-nav min-h-[42px] self-start inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap"
        >
          <BookOpen className="h-4 w-4 text-[#d4612f]" />
          <span>Mathematics Information</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Airline Restriction Checker */}
        <section className="lg:col-span-7 glass-card rounded-[28px] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-[#d4612f]" />
              <h2 className="text-lg font-normal tracking-tight text-[#2a1a12]">
                Airline Restriction Checker
              </h2>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badgeStyle.cls}`}
            >
              <OverallIcon className="h-4 w-4" />
              {badgeStyle.text}
            </span>
          </div>

          <p className="text-xs text-[#5b4a3f] leading-relaxed">{compliance.summaryText}</p>

          {/* Airline Presets */}
          <div>
            <p className="text-xs font-medium text-[#8d7b6f] mb-2">
              Select Airline Preset (all fields editable below because policies vary):
            </p>
            <div className="flex flex-wrap gap-2">
              {AIRLINE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onUpdatePolicy({ ...preset })}
                  className={`min-h-[36px] rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap ${
                    policy.id === preset.id
                      ? "bg-[#3b2116] text-[#f6ede2] border-[#3b2116]"
                      : "bg-[#fffdf9]/80 text-[#5b4a3f] border-[#2a1a12]/12 hover:bg-[#ece3d7] hover:text-[#2a1a12]"
                  }`}
                >
                  {preset.airlineName}
                </button>
              ))}
            </div>
          </div>

          {/* Editable Airline Policy Inputs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 rounded-2xl bg-[#fffdf9]/85 p-4 border border-[#2a1a12]/10">
            <label className="col-span-2 sm:col-span-2 text-xs font-medium text-[#5b4a3f]">
              Airline Name
              <input
                type="text"
                value={policy.airlineName}
                onChange={(e) =>
                  onUpdatePolicy({ ...policy, id: "custom", airlineName: e.target.value })
                }
                className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 text-sm text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
              />
            </label>
            <label className="col-span-2 sm:col-span-1 text-xs font-medium text-[#5b4a3f]">
              Baggage Category
              <select
                value={policy.category}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    id: "custom",
                    category: e.target.value as LuggageType,
                  })
                }
                className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 text-sm text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
              >
                <option value="carry-on">Carry-On (Cabin)</option>
                <option value="checked">Checked Baggage</option>
              </select>
            </label>

            <label className="text-xs font-medium text-[#5b4a3f]">
              Max Length (cm)
              <input
                type="number"
                value={policy.maxLengthCm}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    id: "custom",
                    maxLengthCm: Math.max(20, Number(e.target.value) || 55),
                  })
                }
                className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
              />
            </label>
            <label className="text-xs font-medium text-[#5b4a3f]">
              Max Width (cm)
              <input
                type="number"
                value={policy.maxWidthCm}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    id: "custom",
                    maxWidthCm: Math.max(15, Number(e.target.value) || 40),
                  })
                }
                className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
              />
            </label>
            <label className="text-xs font-medium text-[#5b4a3f]">
              Max Depth (cm)
              <input
                type="number"
                value={policy.maxHeightCm}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    id: "custom",
                    maxHeightCm: Math.max(10, Number(e.target.value) || 20),
                  })
                }
                className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
              />
            </label>

            <label className="text-xs font-medium text-[#5b4a3f]">
              Max Linear Sum (cm)
              <input
                type="number"
                value={policy.maxLinearSumCm}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    id: "custom",
                    maxLinearSumCm: Math.max(50, Number(e.target.value) || 115),
                  })
                }
                className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
              />
            </label>
            <label className="text-xs font-medium text-[#5b4a3f]">
              Max Weight (kg)
              <input
                type="number"
                step="0.5"
                value={policy.maxWeightKg}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    id: "custom",
                    maxWeightKg: Math.max(1, Number(e.target.value) || 7),
                  })
                }
                className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
              />
            </label>
            <label className="text-xs font-medium text-[#5b4a3f]">
              Max Container Liquid (ml)
              <input
                type="number"
                step="10"
                value={policy.maxSingleLiquidMl}
                onChange={(e) =>
                  onUpdatePolicy({
                    ...policy,
                    id: "custom",
                    maxSingleLiquidMl: Math.max(0, Number(e.target.value) || 100),
                  })
                }
                className="mt-1 w-full rounded-xl bg-[#f6f0e7] px-3 py-1.5 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
              />
            </label>
          </div>

          <p className="text-xs text-[#8d7b6f]">
            Liquid rule: {policy.liquidPolicyNote}
          </p>

          {/* Detailed Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#2a1a12]/12 text-[#8d7b6f]">
                  <th className="py-2 pr-3 font-medium">Restriction Metric</th>
                  <th className="py-2 pr-3 font-medium">Your Measurement</th>
                  <th className="py-2 pr-3 font-medium">Airline Limit</th>
                  <th className="py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a1a12]/8">
                {compliance.rows.map((row) => {
                  const RowIcon =
                    row.status === "EXCEEDED"
                      ? XCircle
                      : row.status === "WARNING"
                      ? AlertTriangle
                      : CheckCircle2;
                  const rowTextColor =
                    row.status === "EXCEEDED"
                      ? "text-rose-700"
                      : row.status === "WARNING"
                      ? "text-amber-700"
                      : "text-emerald-700";

                  return (
                    <tr key={row.metric}>
                      <td className="py-2.5 pr-3 font-medium text-[#2a1a12]">
                        {row.metric}
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-[#5b4a3f]">
                        {row.actualLabel}
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-[#8d7b6f]">
                        {row.limitLabel}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${rowTextColor}`}
                        >
                          <RowIcon className="h-3.5 w-3.5" />
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Save & Load Packing Sessions */}
        <section className="lg:col-span-5 space-y-5">
          <form
            onSubmit={handleSaveSubmit}
            className="glass-card rounded-[28px] p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-[#d4612f]" />
              <h2 className="text-lg font-normal tracking-tight text-[#2a1a12]">
                Save Current Packing Session
              </h2>
            </div>

            <label className="block text-xs font-medium text-[#5b4a3f]">
              Session Name
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="e.g., Tokyo 5-Day Carry-On"
                className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 text-sm text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="submit"
                className="btn-dark-pill min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap"
              >
                <Save className="h-4 w-4 text-[#f2c94c]" />
                <span>Save Session</span>
              </button>

              <button
                type="button"
                onClick={onResetDemo}
                className="pill-nav min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Starter Trip</span>
              </button>
            </div>

            {saveNotice && (
              <p className="text-xs font-semibold text-emerald-700">{saveNotice}</p>
            )}
          </form>

          <div className="glass-card rounded-[28px] p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-[#d4612f]" />
              <h2 className="text-lg font-normal tracking-tight text-[#2a1a12]">
                Saved Sessions ({sessions.length})
              </h2>
            </div>

            {sessions.length === 0 ? (
              <p className="text-xs text-[#5b4a3f]">
                No saved sessions yet. Save your current suitcase, items, and 3D layout above.
              </p>
            ) : (
              <div className="space-y-2.5">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[#fffdf9]/85 p-3.5 border border-[#2a1a12]/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#2a1a12]">
                        {sess.trip.tripName}
                      </p>
                      <p className="text-[11px] text-[#5b4a3f] truncate font-mono tabular-nums">
                        {sess.suitcase.lengthCm}×{sess.suitcase.widthCm}×
                        {sess.suitcase.heightCm} cm · {sess.items.length} items ·{" "}
                        {new Date(sess.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onLoadSession(sess)}
                        className="min-h-[36px] rounded-full bg-[#f2c94c] px-3.5 py-1 text-xs font-semibold text-[#2a1a12] hover:bg-[#e7be3f] transition-colors"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        aria-label="Delete saved session"
                        onClick={() => onDeleteSession(sess.id)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-[#8d7b6f] hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
