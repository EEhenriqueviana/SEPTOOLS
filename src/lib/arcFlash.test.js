import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateArcFlash, validateArcFlashInputs } from "./arcFlash.js";
import { getNr10ZoneDistances } from "./nr10.js";

const mapleReferenceCase = {
  voltageKv: 13.8,
  faultCurrentKa: 18.241,
  gapMm: 152,
  workingDistanceMm: 914,
  enclosureHeightMm: 1244.6,
  enclosureWidthMm: 1244.6,
  enclosureDepthMm: 1143,
  arcTimeMs: 191,
  reducedArcTimeMs: 191,
  electrodeConfiguration: "HCB",
};

test("matches the supplied IEEE 1584-2018 example within its displayed precision", () => {
  const result = calculateArcFlash(mapleReferenceCase);
  const relativeError = (actual, expected) => Math.abs(actual - expected) / expected;

  assert.ok(relativeError(result.reducedArcCurrentKa, 16.31) < 0.001);
  assert.ok(relativeError(result.worstCase.energyJoulesPerCm2, 37.217) < 0.001);
  assert.ok(relativeError(result.worstCase.arcFlashBoundaryMm, 3037) < 0.001);
  assert.ok(relativeError(result.enclosureCorrectionFactor, 1.177) < 0.001);
});

test("rejects values outside the model range and invalid enclosure geometry", () => {
  const errors = validateArcFlashInputs({
    ...mapleReferenceCase,
    voltageKv: 15.1,
    gapMm: 300,
    enclosureWidthMm: 400,
    workingDistanceMm: 250,
  });

  assert.ok(errors.voltageKv);
  assert.ok(errors.gapMm);
  assert.ok(errors.enclosureWidthMm);
  assert.ok(errors.workingDistanceMm);
});

test("calculates low-voltage faults above 65 kA up to the 106 kA model limit", () => {
  const lowVoltageCase = {
    ...mapleReferenceCase,
    voltageKv: 0.48,
    faultCurrentKa: 70,
    gapMm: 25,
    enclosureHeightMm: 600,
    enclosureWidthMm: 500,
    enclosureDepthMm: 200,
    electrodeConfiguration: "VCB",
  };

  assert.deepEqual(validateArcFlashInputs(lowVoltageCase), {});
  assert.ok(Number.isFinite(calculateArcFlash(lowVoltageCase).worstCase.energyCaloriesPerCm2));
  assert.deepEqual(
    validateArcFlashInputs({ ...lowVoltageCase, faultCurrentKa: 106 }),
    {},
  );
  assert.ok(validateArcFlashInputs({ ...lowVoltageCase, faultCurrentKa: 106.1 }).faultCurrentKa);
});

test("uses a correction factor of one for open-air electrode configurations", () => {
  const result = calculateArcFlash({
    ...mapleReferenceCase,
    electrodeConfiguration: "VOA",
    enclosureHeightMm: 0,
    enclosureWidthMm: 0,
    enclosureDepthMm: 0,
  });

  assert.equal(result.enclosureCorrectionFactor, 1);
});

test("uses the attached NR-10 table for risk and controlled zones", () => {
  assert.deepEqual(getNr10ZoneDistances(0.48), { rr: 0.20, rc: 0.70 });
  assert.deepEqual(getNr10ZoneDistances(13.8), { rr: 0.38, rc: 1.38 });
  assert.deepEqual(getNr10ZoneDistances(480), { rr: 5.20, rc: 7.20 });
});
