import type {
  AirlinePolicy,
  BelongingItem,
  ComplianceCheckRow,
  ComplianceReport,
  ComplianceStatus,
  PackedUnitPlacement,
  PackingRecommendation,
  SuitcaseConfig,
  UnfittedItemInfo,
} from "../types";
import { calculatePackingSummary, round1, round2 } from "./mathEngine";

function statusFromRatio(ratio: number): ComplianceStatus {
  if (ratio > 1.0) return "EXCEEDED";
  if (ratio >= 0.9) return "WARNING";
  return "COMPLIANT";
}

export function evaluateAirlineCompliance(
  suitcase: SuitcaseConfig,
  items: BelongingItem[],
  placements: PackedUnitPlacement[],
  policy: AirlinePolicy
): ComplianceReport {
  const summary = calculatePackingSummary(suitcase, items, placements);
  const rows: ComplianceCheckRow[] = [];

  const lengthRatio = suitcase.lengthCm / Math.max(1, policy.maxLengthCm);
  rows.push({
    metric: "Suitcase Length",
    actualLabel: `${suitcase.lengthCm} cm`,
    limitLabel: `${policy.maxLengthCm} cm max`,
    ratio: lengthRatio,
    status: statusFromRatio(lengthRatio),
  });

  const widthRatio = suitcase.widthCm / Math.max(1, policy.maxWidthCm);
  rows.push({
    metric: "Suitcase Width",
    actualLabel: `${suitcase.widthCm} cm`,
    limitLabel: `${policy.maxWidthCm} cm max`,
    ratio: widthRatio,
    status: statusFromRatio(widthRatio),
  });

  const heightRatio = suitcase.heightCm / Math.max(1, policy.maxHeightCm);
  rows.push({
    metric: "Suitcase Depth",
    actualLabel: `${suitcase.heightCm} cm`,
    limitLabel: `${policy.maxHeightCm} cm max`,
    ratio: heightRatio,
    status: statusFromRatio(heightRatio),
  });

  const sumRatio = summary.luggage.linearSumCm / Math.max(1, policy.maxLinearSumCm);
  rows.push({
    metric: "Linear Sum (L+W+H)",
    actualLabel: `${summary.luggage.linearSumCm} cm`,
    limitLabel: `${policy.maxLinearSumCm} cm max`,
    ratio: sumRatio,
    status: statusFromRatio(sumRatio),
  });

  const weightRatio = summary.totalEstimatedWeightKg / Math.max(0.1, policy.maxWeightKg);
  rows.push({
    metric: "Total Estimated Weight",
    actualLabel: `${summary.totalEstimatedWeightKg.toFixed(2)} kg`,
    limitLabel: `${policy.maxWeightKg.toFixed(1)} kg max`,
    ratio: weightRatio,
    status: statusFromRatio(weightRatio),
  });

  const singleLiquidRatio =
    summary.maxSingleLiquidMl / Math.max(1, policy.maxSingleLiquidMl);
  rows.push({
    metric: "Single Liquid Container",
    actualLabel: `${summary.maxSingleLiquidMl} ml`,
    limitLabel: `${policy.maxSingleLiquidMl} ml max`,
    ratio: singleLiquidRatio,
    status: statusFromRatio(singleLiquidRatio),
  });

  const totalLiquidRatio =
    summary.totalLiquidMl / Math.max(1, policy.maxTotalCabinLiquidMl);
  rows.push({
    metric: "Total Liquid Volume",
    actualLabel: `${summary.totalLiquidMl} ml`,
    limitLabel: `${policy.maxTotalCabinLiquidMl} ml max`,
    ratio: totalLiquidRatio,
    status: statusFromRatio(totalLiquidRatio),
  });

  let overallStatus: ComplianceStatus = "COMPLIANT";
  if (rows.some((r) => r.status === "EXCEEDED")) {
    overallStatus = "EXCEEDED";
  } else if (rows.some((r) => r.status === "WARNING")) {
    overallStatus = "WARNING";
  }

  let summaryText = `All luggage dimensions, estimated weight, and liquid volumes comply with ${policy.airlineName} (${policy.category}) limits.`;
  if (overallStatus === "WARNING") {
    const warns = rows.filter((r) => r.status === "WARNING").map((r) => r.metric);
    summaryText = `Approaching ${policy.airlineName} limit on: ${warns.join(", ")}. Leave a small margin for airport scales.`;
  } else if (overallStatus === "EXCEEDED") {
    const fails = rows.filter((r) => r.status === "EXCEEDED").map((r) => r.metric);
    summaryText = `Exceeded ${policy.airlineName} limit on: ${fails.join(", ")}. Adjust items or switch to checked baggage.`;
  }

  return { overallStatus, rows, summaryText };
}

export function generateSmartRecommendations(
  suitcase: SuitcaseConfig,
  items: BelongingItem[],
  placements: PackedUnitPlacement[],
  policy: AirlinePolicy,
  unfitted: UnfittedItemInfo[] = []
): PackingRecommendation[] {
  const summary = calculatePackingSummary(suitcase, items, placements);
  const recs: PackingRecommendation[] = [];

  // 1. Weight comparison
  const weightDiff = round2(summary.totalEstimatedWeightKg - policy.maxWeightKg);
  if (weightDiff > 0) {
    const nonEssentials = items.filter((i) => !i.essential && i.quantity > 0);
    const suggestion =
      nonEssentials.length > 0
        ? `Consider removing non-essential items such as ${nonEssentials
            .slice(0, 2)
            .map((i) => i.name)
            .join(" or ")}.`
        : "Consider transferring heavier items (shoes or electronics) to your personal item or checked bag.";

    recs.push({
      id: "weight-exceeded",
      severity: "critical",
      title: `Estimated weight exceeds ${policy.airlineName} limit by ${weightDiff.toFixed(2)} kg`,
      detail: `Your luggage + items weigh ${summary.totalEstimatedWeightKg.toFixed(
        2
      )} kg against a ${policy.maxWeightKg.toFixed(1)} kg allowance. ${suggestion}`,
      actionTab: "items",
      actionLabel: "Review Item Weights",
    });
  } else if (summary.totalEstimatedWeightKg >= policy.maxWeightKg * 0.9) {
    recs.push({
      id: "weight-warning",
      severity: "warning",
      title: "Approaching airline weight limit",
      detail: `Only ${round2(
        policy.maxWeightKg - summary.totalEstimatedWeightKg
      ).toFixed(2)} kg of weight margin remains under ${policy.airlineName}'s ${policy.maxWeightKg} kg limit.`,
      actionTab: "profile",
      actionLabel: "Check Airline Rules",
    });
  }

  // 2. Suitcase dimension check against airline policy
  if (
    suitcase.lengthCm > policy.maxLengthCm ||
    suitcase.widthCm > policy.maxWidthCm ||
    suitcase.heightCm > policy.maxHeightCm ||
    summary.luggage.linearSumCm > policy.maxLinearSumCm
  ) {
    recs.push({
      id: "dim-exceeded",
      severity: "critical",
      title: `Luggage dimensions exceed ${policy.airlineName} ${policy.category} policy`,
      detail: `Measured ${suitcase.lengthCm}×${suitcase.widthCm}×${suitcase.heightCm} cm (sum ${summary.luggage.linearSumCm} cm) vs permitted ${policy.maxLengthCm}×${policy.maxWidthCm}×${policy.maxHeightCm} cm (sum ${policy.maxLinearSumCm} cm).`,
      actionTab: "scanner",
      actionLabel: "Adjust Suitcase",
    });
  }

  // 3. Remaining usable space & compression opportunities
  if (summary.utilizationPct > 88) {
    const compressibleUncompressed = items.filter(
      (i) => i.compressibility > 0 && !i.compressed && i.quantity > 0
    );
    recs.push({
      id: "space-tight",
      severity: "warning",
      title: `Your suitcase has limited remaining space (${summary.remainingUsableLitres.toFixed(
        1
      )} L left)`,
      detail:
        compressibleUncompressed.length > 0
          ? `Fold or roll compressible garments (${compressibleUncompressed
              .slice(0, 3)
              .map((i) => i.name)
              .join(", ")}) to reclaim up to 25% thickness.`
          : "Try rotating rigid items in 3D Virtual Pack or removing duplicate outfits.",
      actionTab: "virtual",
      actionLabel: "Open 3D Virtual Pack",
    });
  } else if (summary.packedUnitsCount === 0 && summary.totalItemsUnits > 0) {
    recs.push({
      id: "pack-not-started",
      severity: "info",
      title: "Items ready for 3D packing simulation",
      detail: `You have ${summary.totalItemsUnits} item units (${summary.totalInventoryVolumeLitres.toFixed(
        1
      )} L) in your inventory. Run Smart AutoPack to compute an optimal non-overlapping 3D arrangement.`,
      actionTab: "virtual",
      actionLabel: "Run AutoPack",
    });
  }

  // 4. Unfitted items diagnosis
  if (unfitted.length > 0) {
    recs.push({
      id: "unfitted-items",
      severity: "critical",
      title: `${unfitted.length} item unit(s) could not fit inside rigid boundaries`,
      detail: `${unfitted[0].name}: ${unfitted[0].reason} Try enabling Compressed Roll & Fold mode in AutoPack or rotating adjacent objects.`,
      actionTab: "virtual",
      actionLabel: "Compare AutoPack Layouts",
    });
  }

  // 5. Liquid restrictions check
  if (
    policy.category === "carry-on" &&
    summary.maxSingleLiquidMl > policy.maxSingleLiquidMl
  ) {
    recs.push({
      id: "liquid-limit",
      severity: "critical",
      title: `Cabin liquid container (${summary.maxSingleLiquidMl} ml) exceeds ${policy.maxSingleLiquidMl} ml limit`,
      detail:
        "Transfer liquids into travel-sized <= 100 ml bottles inside a clear 1 L bag, or switch to checked baggage.",
      actionTab: "items",
      actionLabel: "Edit Toiletries",
    });
  }

  // 6. Compressible fabric educational tip if everything fits comfortably
  if (recs.length === 0) {
    recs.push({
      id: "optimal-balance",
      severity: "info",
      title: "Packing volume and weight are well balanced",
      detail: `You are using ${round1(summary.utilizationPct)}% of usable capacity (${summary.remainingUsableLitres.toFixed(
        1
      )} L spare) and staying ${(
        policy.maxWeightKg - summary.totalEstimatedWeightKg
      ).toFixed(2)} kg under your airline weight allowance.`,
      actionTab: "virtual",
      actionLabel: "Inspect 3D Layout",
    });
  }

  return recs;
}
