import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Plus,
  Ruler,
  ScanLine,
  Upload,
  VideoOff,
} from "lucide-react";
import type {
  BelongingItem,
  GeometricShape,
  ItemCategory,
  LuggageType,
  SuitcaseConfig,
} from "../types";
import {
  CATEGORY_COLORS,
  ITEM_CATALOG_TEMPLATES,
  ITEM_CATEGORIES,
  SUITCASE_PRESETS,
} from "../data/presets";
import {
  calculateLuggageMath,
  calculateSingleItemVolumeCm3,
  cm3ToLitres,
  round1,
  round2,
} from "../utils/mathEngine";
import LuggageDimension3D from "./LuggageDimension3D";

interface ScannerViewProps {
  suitcase: SuitcaseConfig;
  onUpdateSuitcase: (cfg: SuitcaseConfig) => void;
  onAddItem: (item: BelongingItem) => void;
}

interface LuggageScanResult {
  detectedName: string;
  luggageType: LuggageType;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  emptyWeightKg: number;
  confidencePct: number;
  shellNotes: string;
  measurementNote: string;
}

interface ItemScanResult {
  name: string;
  category: ItemCategory;
  quantity: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  shape: GeometricShape;
  compressibility: number;
  liquidMl: number;
  confidencePct: number;
  estimationNote: string;
}

export default function ScannerView({
  suitcase,
  onUpdateSuitcase,
  onAddItem,
}: ScannerViewProps) {
  const [mode, setMode] = useState<"luggage" | "item">("luggage");

  // Shared Camera & Capture State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [arSupported, setArSupported] = useState<boolean | null>(null);

  // Scan Status
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [luggageNote, setLuggageNote] = useState<string | null>(null);

  // Scanned / Manual Item Draft
  const [itemDraft, setItemDraft] = useState<{
    name: string;
    category: ItemCategory;
    quantity: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightKg: number;
    shape: GeometricShape;
    compressibility: number;
    liquidMl: number;
    confidencePct?: number;
    note?: string;
    source: "manual" | "camera" | "preset";
  }>({
    name: "Folded Polo Shirt",
    category: "T-shirts & Shirts",
    quantity: 1,
    lengthCm: 25,
    widthCm: 19,
    heightCm: 4,
    weightKg: 0.22,
    shape: "compressible_prism",
    compressibility: 0.25,
    liquidMl: 0,
    source: "manual",
  });
  const [itemAddedToast, setItemAddedToast] = useState<string | null>(null);

  useEffect(() => {
    if ("xr" in navigator && (navigator as Navigator & { xr?: { isSessionSupported?: (m: string) => Promise<boolean> } }).xr?.isSessionSupported) {
      (navigator as Navigator & { xr: { isSessionSupported: (m: string) => Promise<boolean> } }).xr
        .isSessionSupported("immersive-ar")
        .then((supported) => setArSupported(supported))
        .catch(() => setArSupported(false));
    } else {
      setArSupported(false);
    }

    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    setCameraError(null);
    setCapturedPreview(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Live camera access is unavailable in this browser context. Upload an image or adjust dimensions manually."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraError(
        "Camera permission was denied or no camera device was found. You can upload a photo instead."
      );
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function captureFrameFromCamera() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedPreview(dataUrl);
    stopCamera();
    analyzeImage(dataUrl);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCapturedPreview(reader.result);
        stopCamera();
        analyzeImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function analyzeImage(imageBase64: string) {
    setScanning(true);
    setScanError(null);

    try {
      if (mode === "luggage") {
        const res = await fetch("/api/scan-luggage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64, hintType: suitcase.type }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Luggage recognition failed.");
        }
        const parsed = data as LuggageScanResult;
        onUpdateSuitcase({
          ...suitcase,
          name: parsed.detectedName || suitcase.name,
          type: parsed.luggageType === "checked" ? "checked" : "carry-on",
          lengthCm: Math.max(25, Math.min(95, round1(parsed.lengthCm || suitcase.lengthCm))),
          widthCm: Math.max(20, Math.min(70, round1(parsed.widthCm || suitcase.widthCm))),
          heightCm: Math.max(12, Math.min(45, round1(parsed.heightCm || suitcase.heightCm))),
          emptyWeightKg: Math.max(
            1,
            Math.min(8, round2(parsed.emptyWeightKg || suitcase.emptyWeightKg))
          ),
          measurementSource: "camera-ar",
          confidencePct: Math.max(30, Math.min(92, Math.round(parsed.confidencePct || 70))),
        });
        setLuggageNote(
          `${parsed.shellNotes} ${parsed.measurementNote} Always verify camera estimates manually with a measuring tape.`
        );
      } else {
        const res = await fetch("/api/scan-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64 }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Item recognition failed.");
        }
        const parsed = data as ItemScanResult;
        setItemDraft({
          name: parsed.name || "Scanned Item",
          category: ITEM_CATEGORIES.includes(parsed.category)
            ? parsed.category
            : "Other Personal Belongings",
          quantity: Math.max(1, Math.round(parsed.quantity || 1)),
          lengthCm: Math.max(3, round1(parsed.lengthCm || 20)),
          widthCm: Math.max(3, round1(parsed.widthCm || 15)),
          heightCm: Math.max(1.5, round1(parsed.heightCm || 5)),
          weightKg: Math.max(0.05, round2(parsed.weightKg || 0.25)),
          shape: parsed.shape || "box",
          compressibility: Math.max(0, Math.min(0.35, parsed.compressibility ?? 0)),
          liquidMl: Math.max(0, Math.round(parsed.liquidMl || 0)),
          confidencePct: Math.max(40, Math.min(94, Math.round(parsed.confidencePct || 76))),
          note: parsed.estimationNote,
          source: "camera",
        });
      }
    } catch (err: unknown) {
      setScanError(
        err instanceof Error ? err.message : "Could not analyze image. Edit measurements manually."
      );
    } finally {
      setScanning(false);
    }
  }

  function handleAddDraftItem(e: React.FormEvent) {
    e.preventDefault();
    const newItem: BelongingItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: itemDraft.name.trim() || "Unnamed Item",
      category: itemDraft.category,
      quantity: Math.max(1, Math.round(itemDraft.quantity)),
      lengthCm: Math.max(2, round1(itemDraft.lengthCm)),
      widthCm: Math.max(2, round1(itemDraft.widthCm)),
      heightCm: Math.max(1.2, round1(itemDraft.heightCm)),
      weightKg: Math.max(0.02, round2(itemDraft.weightKg)),
      shape: itemDraft.shape,
      compressibility: itemDraft.compressibility,
      compressed: false,
      colorHex: CATEGORY_COLORS[itemDraft.category],
      essential: true,
      liquidMl: Math.max(0, Math.round(itemDraft.liquidMl)),
      source: itemDraft.source,
      confidencePct: itemDraft.confidencePct,
    };
    onAddItem(newItem);
    setItemAddedToast(`Added "${newItem.name}" (×${newItem.quantity}) to My Items.`);
    window.setTimeout(() => setItemAddedToast(null), 3500);
  }

  const luggageMath = calculateLuggageMath(suitcase);
  const draftVolumeCm3 = calculateSingleItemVolumeCm3({
    id: "preview",
    name: itemDraft.name,
    category: itemDraft.category,
    quantity: 1,
    lengthCm: itemDraft.lengthCm,
    widthCm: itemDraft.widthCm,
    heightCm: itemDraft.heightCm,
    weightKg: itemDraft.weightKg,
    shape: itemDraft.shape,
    compressibility: itemDraft.compressibility,
    compressed: false,
    colorHex: CATEGORY_COLORS[itemDraft.category],
    essential: true,
    liquidMl: itemDraft.liquidMl,
    source: "manual",
  });

  return (
    <div className="space-y-8 pb-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-white/70 border border-white/80 px-3 py-1 text-[10.5px] uppercase tracking-[0.12em] text-[#5b4a3f]">
            Geometry & Camera Calibration
          </span>
          <h1 className="editorial-h2 mt-2 text-[clamp(26px,3.4vw,42px)]">
            Smart Scanner &amp; Measurement
          </h1>
          <p className="mt-1 text-xs text-[#5b4a3f] sm:text-sm">
            Capture with camera or upload a photo to estimate dimensions, or calibrate manually.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#ece3d7] p-1.5 self-start border border-white/60">
          <button
            type="button"
            onClick={() => {
              setMode("luggage");
              setScanError(null);
            }}
            className={`min-h-[38px] rounded-full px-4 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
              mode === "luggage"
                ? "bg-[#3b2116] text-[#f6ede2] shadow-sm"
                : "text-[#5b4a3f] hover:text-[#2a1a12]"
            }`}
          >
            Luggage Scanner
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("item");
              setScanError(null);
            }}
            className={`min-h-[38px] rounded-full px-4 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
              mode === "item"
                ? "bg-[#3b2116] text-[#f6ede2] shadow-sm"
                : "text-[#5b4a3f] hover:text-[#2a1a12]"
            }`}
          >
            Item Scanner
          </button>
        </div>
      </div>

      {/* Camera / Upload Capture Stage */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5 glass-card rounded-[28px] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-normal tracking-tight text-[#2a1a12]">
              {mode === "luggage" ? "Camera & AR Suitcase Capture" : "Camera Item Recognition"}
            </h2>
            <span className="rounded-full bg-[#ece3d7] px-2.5 py-0.5 text-[11px] font-medium text-[#5b4a3f]">
              {arSupported ? "WebXR AR ready" : "2D Camera + Manual"}
            </span>
          </div>

          {/* Viewfinder */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[22px] bg-[#2a1a12] text-[#f6ede2] border border-white/25">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {/* AR Measurement Reticle Overlay */}
                <div className="pointer-events-none absolute inset-4 rounded-2xl border-2 border-dashed border-[#e29f5f]/85 flex items-center justify-center">
                  <div className="rounded-full bg-[#2a1a12]/80 px-3.5 py-1.5 text-xs font-mono text-[#f2c94c]">
                    Align {mode === "luggage" ? "suitcase edges" : "item"} inside frame
                  </div>
                </div>
              </>
            ) : capturedPreview ? (
              <img
                src={capturedPreview}
                alt="Captured preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full flex-col items-center justify-center p-6 text-center"
                style={{
                  background:
                    "radial-gradient(circle at 75% 25%, rgba(226,159,95,0.28) 0%, rgba(42,26,18,1) 70%)",
                }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 border border-white/15">
                  <ScanLine className="h-7 w-7 text-[#e29f5f]" />
                </div>
                <p className="mt-3.5 text-sm font-medium text-[#f6ede2]">
                  {mode === "luggage"
                    ? "Capture your suitcase or upload an image"
                    : "Capture clothing, shoes, toiletries, or electronics"}
                </p>
                <p className="mt-1.5 text-xs text-[#f6ede2]/70 max-w-xs leading-relaxed">
                  Camera measurements are geometric estimates. You can refine every centimeter
                  manually.
                </p>
              </div>
            )}

            {scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#2a1a12]/85 text-[#f6ede2]">
                <Loader2 className="h-8 w-8 animate-spin text-[#f2c94c]" />
                <p className="mt-2.5 text-xs font-medium tracking-wide">
                  Analyzing geometry &amp; category...
                </p>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Action Buttons */}
          <div className="flex flex-wrap gap-2.5">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="btn-dark-pill min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium whitespace-nowrap"
              >
                <Camera className="h-4 w-4 text-[#e29f5f]" />
                <span>Activate Camera</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={captureFrameFromCamera}
                  className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#f2c94c] px-4 py-2 text-xs font-semibold text-[#2a1a12] hover:bg-[#e7be3f] transition-colors whitespace-nowrap"
                >
                  <Camera className="h-4 w-4" />
                  <span>Capture &amp; Measure</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="pill-nav min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap"
                >
                  <VideoOff className="h-4 w-4" />
                  <span>Stop</span>
                </button>
              </>
            )}

            <label className="pill-nav min-h-[44px] flex-1 cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium whitespace-nowrap">
              <Upload className="h-4 w-4 text-[#d4612f]" />
              <span>Upload Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {cameraError && (
            <div className="flex items-start gap-2 rounded-2xl bg-amber-50/90 p-3.5 text-xs text-amber-900 border border-amber-200/80">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>{cameraError}</span>
            </div>
          )}

          {scanError && (
            <div className="flex items-start gap-2 rounded-2xl bg-rose-50/90 p-3.5 text-xs text-rose-900 border border-rose-200/80">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
              <span>{scanError}</span>
            </div>
          )}

          {mode === "luggage" && luggageNote && (
            <div className="rounded-2xl bg-[#fffdf9]/85 p-3.5 text-xs text-[#5b4a3f] border border-[#2a1a12]/10 leading-relaxed">
              {luggageNote}
            </div>
          )}
        </div>

        {/* Right Side: Luggage Calibration + 3D Preview OR Item Verification Form */}
        {mode === "luggage" ? (
          <div className="lg:col-span-7 space-y-5">
            {/* Dimensions & Formula Card */}
            <div className="glass-card rounded-[28px] p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-normal tracking-tight text-[#2a1a12]">
                    Suitcase Dimensions &amp; Volume
                  </h2>
                  <p className="text-xs text-[#5b4a3f] tabular-nums">
                    Confidence: {suitcase.confidencePct}% · Source:{" "}
                    {suitcase.measurementSource === "camera-ar"
                      ? "Camera Estimate (editable)"
                      : suitcase.measurementSource === "preset"
                      ? "Standard Preset"
                      : "Manual Calibration"}
                  </p>
                </div>

                {/* Carry-On vs Checked Switch */}
                <div className="inline-flex rounded-full bg-[#ece3d7] p-1 border border-white/60">
                  {(["carry-on", "checked"] as LuggageType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onUpdateSuitcase({ ...suitcase, type: t })}
                      className={`min-h-[34px] rounded-full px-3.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                        suitcase.type === t
                          ? "bg-[#3b2116] text-[#f6ede2]"
                          : "text-[#5b4a3f] hover:text-[#2a1a12]"
                      }`}
                    >
                      {t === "carry-on" ? "Carry-On" : "Checked"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset Selector */}
              <div className="flex flex-wrap gap-2">
                {SUITCASE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onUpdateSuitcase({ ...preset })}
                    className={`min-h-[36px] rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap ${
                      suitcase.id === preset.id && suitcase.measurementSource === "preset"
                        ? "bg-[#3b2116] border-[#3b2116] text-[#f6ede2]"
                        : "bg-white/75 border-[#2a1a12]/10 text-[#5b4a3f] hover:bg-[#ece3d7] hover:text-[#2a1a12]"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* L, W, H Sliders + Numeric Inputs */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                {[
                  {
                    label: "Length (cm)",
                    key: "lengthCm" as const,
                    min: 35,
                    max: 90,
                    val: suitcase.lengthCm,
                  },
                  {
                    label: "Width (cm)",
                    key: "widthCm" as const,
                    min: 22,
                    max: 65,
                    val: suitcase.widthCm,
                  },
                  {
                    label: "Depth / Height (cm)",
                    key: "heightCm" as const,
                    min: 14,
                    max: 40,
                    val: suitcase.heightCm,
                  },
                ].map((dim) => (
                  <div
                    key={dim.key}
                    className="rounded-2xl bg-[#fffdf9]/85 p-3.5 border border-[#2a1a12]/10"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#5b4a3f]">{dim.label}</span>
                      <input
                        type="number"
                        step="0.5"
                        min={dim.min}
                        max={dim.max}
                        value={dim.val}
                        onChange={(e) =>
                          onUpdateSuitcase({
                            ...suitcase,
                            [dim.key]: Math.max(
                              dim.min,
                              Math.min(dim.max, Number(e.target.value) || dim.min)
                            ),
                            measurementSource: "manual",
                            confidencePct: 100,
                          })
                        }
                        className="w-16 rounded-lg bg-[#f6f0e7] px-2 py-1 text-right font-mono text-xs font-semibold tabular-nums text-[#2a1a12] border border-[#2a1a12]/15 focus:outline-none focus:border-[#d4612f]"
                      />
                    </div>
                    <input
                      type="range"
                      min={dim.min}
                      max={dim.max}
                      step="0.5"
                      value={dim.val}
                      onChange={(e) =>
                        onUpdateSuitcase({
                          ...suitcase,
                          [dim.key]: Number(e.target.value),
                          measurementSource: "manual",
                          confidencePct: 100,
                        })
                      }
                      className="mt-3 w-full accent-[#d4612f]"
                    />
                  </div>
                ))}
              </div>

              {/* Empty Weight + Name */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Suitcase Label
                  <input
                    type="text"
                    value={suitcase.name}
                    onChange={(e) =>
                      onUpdateSuitcase({ ...suitcase, name: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 text-sm text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>
                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Empty Suitcase Weight (kg)
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="10"
                    value={suitcase.emptyWeightKg}
                    onChange={(e) =>
                      onUpdateSuitcase({
                        ...suitcase,
                        emptyWeightKg: Math.max(0.5, Number(e.target.value) || 2.5),
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>
              </div>

              {/* Mathematical Volume Output */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-2xl bg-[#3b2116] p-4 text-[#f6ede2]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-[#e29f5f]">
                    Theoretical Volume (V = L × W × H)
                  </p>
                  <p className="mt-1 font-mono text-lg font-medium tabular-nums text-white">
                    {Math.round(luggageMath.theoreticalVolumeCm3).toLocaleString()} cm³ (
                    {luggageMath.theoreticalVolumeLitres.toFixed(1)} L)
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#f6ede2]/75 tabular-nums">
                    {suitcase.lengthCm} × {suitcase.widthCm} × {suitcase.heightCm} cm
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-[#f2c94c]">
                    Usable Internal Capacity (after shell &amp; rails)
                  </p>
                  <p className="mt-1 font-mono text-lg font-medium tabular-nums text-white">
                    {Math.round(luggageMath.usableVolumeCm3).toLocaleString()} cm³ (
                    {luggageMath.usableVolumeLitres.toFixed(1)} L)
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#f6ede2]/75 tabular-nums">
                    Internal cavity: {luggageMath.internalL} × {luggageMath.internalW} ×{" "}
                    {luggageMath.internalH} cm
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive 3D Suitcase Dimension Model (No backdrop-blur over WebGL) */}
            <div className="h-[300px] sm:h-[340px] rounded-[28px] warm-surface p-3 overflow-hidden">
              <LuggageDimension3D suitcase={suitcase} />
            </div>
          </div>
        ) : (
          /* Item Scanner Verification & Quick Manual Entry */
          <div className="lg:col-span-7 space-y-5">
            <form
              onSubmit={handleAddDraftItem}
              className="glass-card rounded-[28px] p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-normal tracking-tight text-[#2a1a12]">
                    Item Measurement &amp; Details
                  </h2>
                  <p className="text-xs text-[#5b4a3f]">
                    {itemDraft.confidencePct
                      ? `Camera recognition confidence: ${itemDraft.confidencePct}% · Editable before adding`
                      : "Enter item dimensions manually or select a quick template below"}
                  </p>
                </div>
                <span className="rounded-full bg-[#ece3d7] px-3 py-1 font-mono text-xs font-medium tabular-nums text-[#2a1a12]">
                  Est. Volume: {Math.round(draftVolumeCm3).toLocaleString()} cm³ (
                  {cm3ToLitres(draftVolumeCm3).toFixed(2)} L)
                </span>
              </div>

              {itemDraft.note && (
                <div className="rounded-2xl bg-[#fffdf9]/90 px-3.5 py-2.5 text-xs text-[#3b2116] border border-[#2a1a12]/10">
                  {itemDraft.note}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Item Name
                  <input
                    type="text"
                    required
                    value={itemDraft.name}
                    onChange={(e) =>
                      setItemDraft({ ...itemDraft, name: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 text-sm text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>

                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Category (10 supported)
                  <select
                    value={itemDraft.category}
                    onChange={(e) =>
                      setItemDraft({
                        ...itemDraft,
                        category: e.target.value as ItemCategory,
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 text-sm text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  >
                    {ITEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Qty
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={itemDraft.quantity}
                    onChange={(e) =>
                      setItemDraft({
                        ...itemDraft,
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>
                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Length (cm)
                  <input
                    type="number"
                    step="0.5"
                    min={2}
                    max={80}
                    value={itemDraft.lengthCm}
                    onChange={(e) =>
                      setItemDraft({
                        ...itemDraft,
                        lengthCm: Number(e.target.value) || 5,
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>
                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Width (cm)
                  <input
                    type="number"
                    step="0.5"
                    min={2}
                    max={60}
                    value={itemDraft.widthCm}
                    onChange={(e) =>
                      setItemDraft({
                        ...itemDraft,
                        widthCm: Number(e.target.value) || 5,
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>
                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Height (cm)
                  <input
                    type="number"
                    step="0.5"
                    min={1}
                    max={40}
                    value={itemDraft.heightCm}
                    onChange={(e) =>
                      setItemDraft({
                        ...itemDraft,
                        heightCm: Number(e.target.value) || 2,
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>
                <label className="block text-xs font-medium text-[#5b4a3f] col-span-2 sm:col-span-1">
                  Weight (kg)
                  <input
                    type="number"
                    step="0.05"
                    min={0.02}
                    max={15}
                    value={itemDraft.weightKg}
                    onChange={(e) =>
                      setItemDraft({
                        ...itemDraft,
                        weightKg: Number(e.target.value) || 0.1,
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Geometric Approximation
                  <select
                    value={itemDraft.shape}
                    onChange={(e) =>
                      setItemDraft({
                        ...itemDraft,
                        shape: e.target.value as GeometricShape,
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 text-sm text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  >
                    <option value="compressible_prism">Folded Prism (Compressible)</option>
                    <option value="box">Rigid Rectangular Prism</option>
                    <option value="cylinder">Cylinder (Bottle / Rolled)</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Fabric Compressibility (%)
                  <input
                    type="number"
                    min={0}
                    max={35}
                    value={Math.round(itemDraft.compressibility * 100)}
                    onChange={(e) =>
                      setItemDraft({
                        ...itemDraft,
                        compressibility: Math.max(
                          0,
                          Math.min(0.35, (Number(e.target.value) || 0) / 100)
                        ),
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>

                <label className="block text-xs font-medium text-[#5b4a3f]">
                  Liquid Volume (ml, if toiletry)
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    step={10}
                    value={itemDraft.liquidMl}
                    onChange={(e) =>
                      setItemDraft({
                        ...itemDraft,
                        liquidMl: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="mt-1 w-full rounded-xl bg-[#fffdf9]/85 px-3 py-2 font-mono text-sm tabular-nums text-[#2a1a12] border border-[#2a1a12]/12 focus:outline-none focus:border-[#d4612f]"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {itemAddedToast ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {itemAddedToast}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#5b4a3f] tabular-nums">
                    <Ruler className="h-3.5 w-3.5 text-[#d4612f]" />
                    Total batch: {(itemDraft.weightKg * itemDraft.quantity).toFixed(2)} kg ·{" "}
                    {round2(cm3ToLitres(draftVolumeCm3 * itemDraft.quantity)).toFixed(2)} L
                  </span>
                )}

                <button
                  type="submit"
                  className="btn-dark-pill min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-medium whitespace-nowrap"
                >
                  <Plus className="h-4 w-4 text-[#f2c94c]" />
                  <span>Add to My Packing List</span>
                </button>
              </div>
            </form>

            {/* Quick Add Without Camera */}
            <div className="glass-card rounded-[28px] p-5 sm:p-6">
              <h3 className="text-base font-normal tracking-tight text-[#2a1a12]">
                Quick Add Belongings (No Camera Needed)
              </h3>
              <p className="mt-0.5 text-xs text-[#5b4a3f]">
                Tap any standard travel item to load its measured template
              </p>

              <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ITEM_CATALOG_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() =>
                      setItemDraft({
                        ...tpl,
                        source: "preset",
                        confidencePct: undefined,
                        note: `Loaded standard dimensions for ${tpl.name}. Adjust if needed.`,
                      })
                    }
                    className="min-h-[50px] flex items-center justify-between rounded-2xl bg-[#fffdf9]/80 px-3.5 py-2.5 text-left border border-[#2a1a12]/10 hover:bg-[#ece3d7]/75 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#2a1a12]">
                        {tpl.name}
                      </p>
                      <p className="text-[11px] text-[#5b4a3f] truncate font-mono tabular-nums">
                        {tpl.category} · {tpl.lengthCm}×{tpl.widthCm}×{tpl.heightCm} cm ·{" "}
                        {tpl.weightKg} kg
                      </p>
                    </div>
                    <Plus className="h-4 w-4 shrink-0 text-[#d4612f]" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
