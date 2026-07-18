/** Calibration helpers and readiness checks — Stage 2/7. */

export type CalibrationStep = "one_hand" | "two_hands" | "ready";

export function nextCalibrationStep(current: CalibrationStep): CalibrationStep {
  if (current === "one_hand") return "two_hands";
  if (current === "two_hands") return "ready";
  return "ready";
}
