import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Home,
  ListChecks,
  ScanLine,
  UserCheck,
  Wand2,
} from "lucide-react";
import type {
  AirlinePolicy,
  AppTab,
  AutoPackArrangement,
  BelongingItem,
  PackedUnitPlacement,
  SavedPackingSession,
  SuitcaseConfig,
  TripInfo,
} from "./types";
import {
  AIRLINE_PRESETS,
  INITIAL_ITEMS,
  INITIAL_TRIP_INFO,
  SUITCASE_PRESETS,
} from "./data/presets";
import {
  generateAutoPackArrangements,
  verifyLayoutNoOverlap,
} from "./utils/autoPackEngine";
import {
  evaluateAirlineCompliance,
  generateSmartRecommendations,
} from "./utils/complianceEngine";
import DashboardView from "./components/DashboardView";
import ScannerView from "./components/ScannerView";
import ItemsMathView from "./components/ItemsMathView";
import VirtualPackView from "./components/VirtualPackView";
import ProfileView from "./components/ProfileView";
import MathGuideModal from "./components/MathGuideModal";

const STORAGE_ACTIVE_KEY = "smartpack_active_state_v1";
const STORAGE_SESSIONS_KEY = "smartpack_saved_sessions_v1";

interface PersistedState {
  trip: TripInfo;
  suitcase: SuitcaseConfig;
  items: BelongingItem[];
  placements: PackedUnitPlacement[];
  policy: AirlinePolicy;
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.suitcase && Array.isArray(parsed.items) && parsed.policy && parsed.trip) {
        return {
          trip: parsed.trip,
          suitcase: parsed.suitcase,
          items: parsed.items,
          placements: Array.isArray(parsed.placements) ? parsed.placements : [],
          policy: parsed.policy,
        };
      }
    }
  } catch {
    // Fall back to starter demo
  }

  const starterSuitcase = { ...SUITCASE_PRESETS[0] };
  const starterItems = INITIAL_ITEMS.map((i) => ({ ...i }));
  const starterArrangements = generateAutoPackArrangements(
    starterSuitcase,
    starterItems
  );

  return {
    trip: { ...INITIAL_TRIP_INFO },
    suitcase: starterSuitcase,
    items: starterItems,
    placements: starterArrangements[0]?.placements || [],
    policy: { ...AIRLINE_PRESETS[0] },
  };
}

function loadSavedSessions(): SavedPackingSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore parse error
  }
  return [];
}

const NAV_ITEMS: Array<{ id: AppTab; label: string; Icon: typeof Home }> = [
  { id: "home", label: "Home", Icon: Home },
  { id: "scanner", label: "Scanner", Icon: ScanLine },
  { id: "items", label: "My Items", Icon: ListChecks },
  { id: "virtual", label: "Virtual Pack", Icon: Box },
  { id: "profile", label: "Profile", Icon: UserCheck },
];

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);

  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [trip, setTrip] = useState<TripInfo>(initial.trip);
  const [suitcase, setSuitcase] = useState<SuitcaseConfig>(initial.suitcase);
  const [items, setItems] = useState<BelongingItem[]>(initial.items);
  const [placements, setPlacements] = useState<PackedUnitPlacement[]>(
    initial.placements
  );
  const [policy, setPolicy] = useState<AirlinePolicy>(initial.policy);
  const [sessions, setSessions] = useState<SavedPackingSession[]>(() =>
    loadSavedSessions()
  );

  const [packMode, setPackMode] = useState<"manual" | "autopack">("autopack");
  const [arrangements, setArrangements] = useState<AutoPackArrangement[]>(() =>
    generateAutoPackArrangements(initial.suitcase, initial.items)
  );
  const [activeArrangementId, setActiveArrangementId] = useState<string | null>(
    "weight-balanced"
  );
  const [mathGuideOpen, setMathGuideOpen] = useState(false);

  // Persist active working state
  useEffect(() => {
    try {
      const payload: PersistedState = { trip, suitcase, items, placements, policy };
      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [trip, suitcase, items, placements, policy]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
    } catch {
      // Ignore storage quota errors
    }
  }, [sessions]);

  // Keep placements consistent when suitcase shrinks or items change
  function syncPlacementsAfterEdit(
    nextSuitcase: SuitcaseConfig,
    nextItems: BelongingItem[],
    currentPlacements: PackedUnitPlacement[]
  ) {
    const validUnitKeys = new Set<string>();
    const itemMap = new Map<string, BelongingItem>();
    for (const it of nextItems) {
      itemMap.set(it.id, it);
      for (let i = 0; i < it.quantity; i++) {
        validUnitKeys.add(`${it.id}#${i}`);
      }
    }

    const filtered = currentPlacements.filter((p) => validUnitKeys.has(p.unitKey));
    if (!verifyLayoutNoOverlap(filtered, nextSuitcase)) {
      const regenerated = generateAutoPackArrangements(nextSuitcase, nextItems);
      setArrangements(regenerated);
      setPlacements(regenerated[0]?.placements || []);
      setActiveArrangementId(regenerated[0]?.id || null);
    } else {
      setPlacements(filtered);
    }
  }

  function handleUpdateSuitcase(nextSuitcase: SuitcaseConfig) {
    setSuitcase(nextSuitcase);
    syncPlacementsAfterEdit(nextSuitcase, items, placements);
  }

  function handleAddItem(newItem: BelongingItem) {
    const nextItems = [...items, newItem];
    setItems(nextItems);
    const nextArrangements = generateAutoPackArrangements(suitcase, nextItems);
    setArrangements(nextArrangements);
  }

  function handleUpdateItem(updated: BelongingItem) {
    const nextItems = items.map((i) => (i.id === updated.id ? updated : i));
    setItems(nextItems);
    // Re-sync dimensions or quantity changes
    const regenerated = generateAutoPackArrangements(suitcase, nextItems);
    setArrangements(regenerated);
    if (packMode === "autopack") {
      const matched =
        regenerated.find((a) => a.id === activeArrangementId) || regenerated[0];
      if (matched) {
        setPlacements(matched.placements);
      }
    } else {
      syncPlacementsAfterEdit(suitcase, nextItems, placements);
    }
  }

  function handleDeleteItem(id: string) {
    const nextItems = items.filter((i) => i.id !== id);
    setItems(nextItems);
    syncPlacementsAfterEdit(suitcase, nextItems, placements);
    setArrangements(generateAutoPackArrangements(suitcase, nextItems));
  }

  function handleRunAutoPack() {
    const generated = generateAutoPackArrangements(suitcase, items);
    setArrangements(generated);
    const chosen = generated[0];
    if (chosen) {
      setActiveArrangementId(chosen.id);
      setPlacements(chosen.placements);
    }
    setPackMode("autopack");
    setActiveTab("virtual");
  }

  function handleSelectArrangement(arr: AutoPackArrangement) {
    setActiveArrangementId(arr.id);
    setPlacements(arr.placements);
  }

  function handleStartNewPacking() {
    setPlacements([]);
    setActiveArrangementId(null);
    setActiveTab("scanner");
  }

  function handleSaveSession(sessionName: string) {
    const newSession: SavedPackingSession = {
      id: `sess-${Date.now()}`,
      savedAt: new Date().toISOString(),
      trip: { ...trip, tripName: sessionName },
      suitcase: { ...suitcase },
      items: items.map((i) => ({ ...i })),
      placements: placements.map((p) => ({ ...p })),
      airlinePolicy: { ...policy },
    };
    setSessions([newSession, ...sessions]);
  }

  function handleLoadSession(sess: SavedPackingSession) {
    setTrip(sess.trip);
    setSuitcase(sess.suitcase);
    setItems(sess.items);
    setPlacements(sess.placements);
    setPolicy(sess.airlinePolicy);
    setArrangements(generateAutoPackArrangements(sess.suitcase, sess.items));
    setActiveTab("home");
  }

  function handleDeleteSession(id: string) {
    setSessions(sessions.filter((s) => s.id !== id));
  }

  function handleResetDemo() {
    const starterSuitcase = { ...SUITCASE_PRESETS[0] };
    const starterItems = INITIAL_ITEMS.map((i) => ({ ...i }));
    const starterArrangements = generateAutoPackArrangements(
      starterSuitcase,
      starterItems
    );
    setTrip({ ...INITIAL_TRIP_INFO });
    setSuitcase(starterSuitcase);
    setItems(starterItems);
    setPlacements(starterArrangements[0]?.placements || []);
    setPolicy({ ...AIRLINE_PRESETS[0] });
    setArrangements(starterArrangements);
    setActiveArrangementId("weight-balanced");
    setPackMode("autopack");
  }

  const activeArrangement = useMemo(
    () =>
      arrangements.find((a) => a.id === activeArrangementId) ||
      arrangements[0] ||
      null,
    [arrangements, activeArrangementId]
  );

  const compliance = useMemo(
    () => evaluateAirlineCompliance(suitcase, items, placements, policy),
    [suitcase, items, placements, policy]
  );

  const recommendations = useMemo(
    () =>
      generateSmartRecommendations(
        suitcase,
        items,
        placements,
        policy,
        packMode === "autopack" && activeArrangement ? activeArrangement.unfitted : []
      ),
    [suitcase, items, placements, policy, packMode, activeArrangement]
  );

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f0e7] text-[#2a1a12]">
      {/* Editorial Top Bar: Left pill nav links (desktop) — Center 4-quadrant mark — Right AutoPack pill */}
      <header
        className={`sticky top-0 z-30 transition-all duration-300 ${
          scrolled
            ? "bg-[#f6f0e7]/85 backdrop-blur-md border-b border-[#2a1a12]/8"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 lg:h-20 grid grid-cols-2 lg:grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Desktop Left: Soft Sand Pill Navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-1.5"
          >
            {NAV_ITEMS.map(({ id, label }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`min-h-[36px] px-3.5 py-1.5 text-[11.5px] font-medium uppercase tracking-[0.04em] transition-all whitespace-nowrap shrink-0 ${
                    isActive ? "pill-nav-active" : "pill-nav"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Center (Left on mobile): SmartPack 4-Quadrant Geometric Mark + Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className="group inline-flex items-center justify-self-start lg:justify-self-center gap-2.5 whitespace-nowrap shrink-0"
            aria-label="SmartPack Home"
          >
            <svg
              viewBox="0 0 40 40"
              className="h-8 w-8 text-[#2a1a12] transition-transform duration-500 ease-out group-hover:rotate-90"
              aria-hidden="true"
            >
              <circle cx="14" cy="14" r="6.5" fill="currentColor" />
              <circle cx="26" cy="14" r="6.5" fill="currentColor" opacity="0.55" />
              <circle cx="14" cy="26" r="6.5" fill="currentColor" opacity="0.55" />
              <circle cx="26" cy="26" r="6.5" fill="#d4612f" />
            </svg>
            <span className="font-display text-lg font-medium tracking-[-0.03em] text-[#2a1a12]">
              SmartPack
            </span>
          </button>

          {/* Right: Dark Espresso AutoPack CTA */}
          <div className="flex items-center justify-self-end shrink-0">
            <button
              type="button"
              onClick={handleRunAutoPack}
              className="btn-dark-pill min-h-[38px] lg:min-h-[42px] inline-flex items-center gap-1.5 px-4 lg:px-5 py-2 text-[11.5px] font-medium uppercase tracking-[0.04em] whitespace-nowrap shrink-0"
            >
              <Wand2 className="h-3.5 w-3.5 text-[#f2c94c]" />
              <span>AutoPack</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 pb-24 lg:px-8 lg:py-6 lg:pb-12">
        {activeTab === "home" && (
          <DashboardView
            trip={trip}
            onUpdateTrip={setTrip}
            suitcase={suitcase}
            items={items}
            placements={placements}
            policy={policy}
            compliance={compliance}
            recommendations={recommendations}
            onNavigate={setActiveTab}
            onRunAutoPackFromDashboard={handleRunAutoPack}
            onStartNewPacking={handleStartNewPacking}
            onOpenMathGuide={() => setMathGuideOpen(true)}
          />
        )}

        {activeTab === "scanner" && (
          <ScannerView
            suitcase={suitcase}
            onUpdateSuitcase={handleUpdateSuitcase}
            onAddItem={handleAddItem}
          />
        )}

        {activeTab === "items" && (
          <ItemsMathView
            suitcase={suitcase}
            items={items}
            placements={placements}
            policy={policy}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onNavigate={setActiveTab}
            onOpenMathGuide={() => setMathGuideOpen(true)}
          />
        )}

        {activeTab === "virtual" && (
          <VirtualPackView
            suitcase={suitcase}
            items={items}
            placements={placements}
            onSetPlacements={setPlacements}
            arrangements={arrangements}
            activeArrangementId={activeArrangementId}
            onSelectArrangement={handleSelectArrangement}
            onRunAutoPack={handleRunAutoPack}
            mode={packMode}
            onChangeMode={setPackMode}
          />
        )}

        {activeTab === "profile" && (
          <ProfileView
            suitcase={suitcase}
            items={items}
            placements={placements}
            policy={policy}
            onUpdatePolicy={setPolicy}
            compliance={compliance}
            sessions={sessions}
            onSaveSession={handleSaveSession}
            onLoadSession={handleLoadSession}
            onDeleteSession={handleDeleteSession}
            onResetDemo={handleResetDemo}
            onOpenMathGuide={() => setMathGuideOpen(true)}
          />
        )}
      </main>

      {/* Editorial Desktop Footer */}
      <footer className="hidden lg:block border-t border-[#2a1a12]/8 bg-[#efe5d5]/40">
        <div className="mx-auto max-w-7xl px-8 py-6 flex items-center justify-between text-xs text-[#8d7b6f]">
          <div className="flex items-center gap-3">
            <span className="font-medium text-[#2a1a12]">SmartPack</span>
            <span>·</span>
            <span>Pack Smart. Travel Easy.</span>
          </div>
          <div className="flex items-center gap-5">
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className="hover:text-[#2a1a12] transition-colors"
              >
                {label}
              </button>
            ))}
            <span className="text-[#8d7b6f]/75">© SmartPack 2026</span>
          </div>
        </div>
      </footer>

      {/* Fixed 5-Section Mobile & Tablet Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#f6f0e7]/95 backdrop-blur-md border-t border-[#2a1a12]/10 pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-16">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? "text-[#2a1a12]" : "text-[#8d7b6f] hover:text-[#2a1a12]"
                }`}
              >
                <div
                  className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                    isActive ? "bg-[#3b2116] text-[#f6ede2]" : ""
                  }`}
                >
                  <Icon className="h-4 w-4 stroke-[2]" />
                </div>
                <span className="text-[10px] font-medium tracking-tight whitespace-nowrap">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mathematics Information Modal */}
      <MathGuideModal
        open={mathGuideOpen}
        onClose={() => setMathGuideOpen(false)}
      />
    </div>
  );
}
