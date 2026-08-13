// Shared oil/filter change math for the Vehicles program.
// nextChangeMileage = lastOilChangeMileage + oilChangeIntervalMiles.
// When currentMileage crosses that threshold, the vehicle needs an
// immediate change and milesExceeded is set (milesRemaining is null);
// otherwise milesRemaining is set (milesExceeded is null) — mirroring the
// source spreadsheet's blank-vs-filled columns.

export interface MaintenanceStatusInput {
  currentMileage: number;
  lastOilChangeMileage: number;
  oilChangeIntervalMiles: number;
}

export interface MaintenanceStatusResult {
  nextChangeMileage: number;
  milesRemaining: number | null;
  milesExceeded: number | null;
  immediateChangeRequired: boolean;
}

export function computeMaintenanceStatus({
  currentMileage,
  lastOilChangeMileage,
  oilChangeIntervalMiles,
}: MaintenanceStatusInput): MaintenanceStatusResult {
  const nextChangeMileage = lastOilChangeMileage + oilChangeIntervalMiles;
  const diff = currentMileage - nextChangeMileage;

  if (diff >= 0) {
    return {
      nextChangeMileage,
      milesRemaining: null,
      milesExceeded: diff,
      immediateChangeRequired: true,
    };
  }

  return {
    nextChangeMileage,
    milesRemaining: -diff,
    milesExceeded: null,
    immediateChangeRequired: false,
  };
}

export type VehicleStatusLevel = "immediate" | "dueSoon" | "ok";

export function classifyVehicleStatus(
  vehicle: {
    needsImmediateChange: boolean;
    milesRemaining: number | null;
  },
  dueSoonThresholdMiles: number,
): VehicleStatusLevel {
  if (vehicle.needsImmediateChange) return "immediate";
  if (
    vehicle.milesRemaining !== null &&
    vehicle.milesRemaining <= dueSoonThresholdMiles
  ) {
    return "dueSoon";
  }
  return "ok";
}

export const VEHICLE_STATUS_STYLES: Record<
  VehicleStatusLevel,
  { label: string; badgeClasses: string; accentClasses: string }
> = {
  immediate: {
    label: "Immediate Change Required",
    badgeClasses:
      "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    accentClasses: "border-l-4 border-red-500",
  },
  dueSoon: {
    label: "Due Soon",
    badgeClasses:
      "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
    accentClasses: "border-l-4 border-yellow-500",
  },
  ok: {
    label: "OK",
    badgeClasses:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    accentClasses: "border-l-4 border-green-500",
  },
};
