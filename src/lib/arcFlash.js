const ELECTRODE_CONFIGURATIONS = ["VCB", "VCBB", "HCB", "VOA", "HOA"];

const ARC_CURRENT_COEFFICIENTS = {
  VCB: {
    0.6: [-0.04287, 1.035, -0.083, 0, 0, -4.783e-9, 1.962e-6, -0.000229, 0.003141, 1.092],
    2.7: [0.0065, 1.001, -0.024, -1.557e-12, 4.556e-10, -4.186e-8, 8.346e-7, 5.482e-5, -0.003191, 0.9729],
    14.3: [0.005795, 1.015, -0.011, -1.557e-12, 4.556e-10, -4.186e-8, 8.346e-7, 5.482e-5, -0.003191, 0.9729],
  },
  VCBB: {
    0.6: [-0.017432, 0.98, -0.05, 0, 0, -5.767e-9, 2.524e-6, -0.00034, 0.01187, 1.013],
    2.7: [0.002823, 0.995, -0.0125, 0, -9.204e-11, 2.901e-8, -3.262e-6, 0.0001569, -0.004003, 0.9825],
    14.3: [0.014827, 1.01, -0.01, 0, -9.204e-11, 2.901e-8, -3.262e-6, 0.0001569, -0.004003, 0.9825],
  },
  HCB: {
    0.6: [0.054922, 0.988, -0.11, 0, 0, -5.382e-9, 2.316e-6, -0.000302, 0.0091, 0.9725],
    2.7: [0.001011, 1.003, -0.0249, 0, 0, 4.859e-10, -1.814e-7, -9.128e-6, -0.0007, 0.9881],
    14.3: [0.008693, 0.999, -0.02, 0, -5.043e-11, 2.233e-8, -3.046e-6, 0.000116, -0.001145, 0.9839],
  },
  VOA: {
    0.6: [0.043785, 1.04, -0.18, 0, 0, -4.783e-9, 1.962e-6, -0.000229, 0.003141, 1.092],
    2.7: [-0.02395, 1.006, -0.0188, -1.557e-12, 4.556e-10, -4.186e-8, 8.346e-7, 5.482e-5, -0.003191, 0.9729],
    14.3: [0.005371, 1.0102, -0.029, -1.557e-12, 4.556e-10, -4.186e-8, 8.346e-7, 5.482e-5, -0.003191, 0.9729],
  },
  HOA: {
    0.6: [0.111147, 1.008, -0.24, 0, 0, -3.895e-9, 1.641e-6, -0.000197, 0.002615, 1.1],
    2.7: [0.000435, 1.006, -0.038, 0, 0, 7.859e-10, -1.914e-7, -9.128e-6, -0.0007, 0.9981],
    14.3: [0.000904, 0.999, -0.02, 0, 0, 7.859e-10, -1.914e-7, -9.128e-6, -0.0007, 0.9981],
  },
};

const ARC_VARIATION_COEFFICIENTS = {
  VCB: [0, -1.4269e-6, 0.000083137, -0.0019382, 0.022366, -0.12645, 0.30226],
  VCBB: [1.138e-6, -6.0287e-5, 0.0012758, -0.013778, 0.080217, -0.24066, 0.33524],
  HCB: [0, -3.097e-6, 0.00016405, -0.0033609, 0.033308, -0.16182, 0.34627],
  VOA: [9.5606e-7, -5.1543e-5, 0.0011161, -0.01242, 0.075125, -0.23584, 0.33696],
  HOA: [0, -3.1555e-6, 0.0001682, -0.0034607, 0.034124, -0.1599, 0.34629],
};

const INCIDENT_ENERGY_COEFFICIENTS = {
  0.6: {
    VCB: [0.753364, 0.566, 1.752636, 0, 0, -4.783e-9, 1.962e-6, -0.000229, 0.003141, 1.092, 0, -1.598, 0.957],
    VCBB: [3.068459, 0.26, -0.098107, 0, 0, -5.767e-9, 2.524e-6, -0.00034, 0.01187, 1.013, -0.06, -1.809, 1.19],
    HCB: [4.073745, 0.344, -0.370259, 0, 0, -5.382e-9, 2.316e-6, -0.000302, 0.0091, 0.9725, 0, -2.03, 1.036],
    VOA: [0.679294, 0.746, 1.222636, 0, 0, -4.783e-9, 1.962e-6, -0.000229, 0.003141, 1.092, 0, -1.598, 0.997],
    HOA: [3.470417, 0.465, -0.261863, 0, 0, -3.895e-9, 1.641e-6, -0.000197, 0.002615, 1.1, 0, -1.99, 1.04],
  },
  2.7: {
    VCB: [2.40021, 0.165, 0.354202, -1.557e-12, 4.556e-10, -4.186e-8, 8.346e-7, 5.482e-5, -0.003191, 0.9729, 0, -1.569, 0.9778],
    VCBB: [3.870592, 0.185, -0.736618, 0, -9.204e-11, 2.901e-8, -3.262e-6, 0.0001569, -0.004003, 0.9825, 0, -1.742, 1.09],
    HCB: [3.486391, 0.177, -0.193101, 0, 0, 4.859e-10, -1.814e-7, -9.128e-6, -0.0007, 0.9881, 0.027, -1.723, 1.055],
    VOA: [3.880724, 0.105, -1.906033, -1.557e-12, 4.556e-10, -4.186e-8, 8.346e-7, 5.482e-5, -0.003191, 0.9729, 0, -1.515, 1.115],
    HOA: [3.616266, 0.149, -0.761561, 0, 0, 7.859e-10, -1.914e-7, -9.128e-6, -0.0007, 0.9981, 0, -1.639, 1.078],
  },
  14.3: {
    VCB: [3.825917, 0.11, -0.999749, -1.557e-12, 4.556e-10, -4.186e-8, 8.346e-7, 5.482e-5, -0.003191, 0.9729, 0, -1.568, 0.99],
    VCBB: [3.644309, 0.215, -0.585522, 0, -9.204e-11, 2.901e-8, -3.262e-6, 0.0001569, -0.004003, 0.9825, 0, -1.677, 1.06],
    HCB: [3.044516, 0.125, 0.245106, 0, -5.043e-11, 2.233e-8, -3.046e-6, 0.000116, -0.001145, 0.9839, 0, -1.655, 1.084],
    VOA: [3.405454, 0.12, -0.93245, -1.557e-12, 4.556e-10, -4.186e-8, 8.346e-7, 5.482e-5, -0.003191, 0.9729, 0, -1.534, 0.979],
    HOA: [2.04049, 0.177, 1.005092, 0, 0, 7.859e-10, -1.914e-7, -9.128e-6, -0.0007, 0.9981, -0.05, -1.633, 1.151],
  },
};

const ENCLOSURE_CORRECTION_COEFFICIENTS = {
  typical: {
    VCB: [-0.000302, 0.03441, 0.4325],
    VCBB: [-0.0002976, 0.032, 0.479],
    HCB: [-0.0001923, 0.01935, 0.6899],
  },
  shallow: {
    VCB: [0.002222, -0.02556, 0.6222],
    VCBB: [-0.002778, 0.1194, -0.2778],
    HCB: [-0.0005556, 0.03722, 0.4778],
  },
};

const ENCLOSURE_DIMENSION_FACTORS = {
  VCB: { a: 4, b: 20 },
  VCBB: { a: 10, b: 24 },
  HCB: { a: 10, b: 22 },
};

const REFERENCE_VOLTAGES_KV = [0.6, 2.7, 14.3];
const JOULES_PER_CALORIE = 4.184;

function polynomial(coefficients, value, highestPower) {
  return coefficients.reduce(
    (sum, coefficient, index) => sum + coefficient * value ** (highestPower - index),
    0,
  );
}

function interpolate(voltageKv, at600, at2700, at14300) {
  const first = ((at2700 - at600) / 2.1) * (voltageKv - 2.7) + at2700;
  const second = ((at14300 - at2700) / 11.6) * (voltageKv - 14.3) + at14300;
  const between = (first * (2.7 - voltageKv)) / 2.1
    + (second * (voltageKv - 0.6)) / 2.1;

  return voltageKv <= 2.7 ? between : second;
}

function intermediateArcCurrent(voltageKv, faultCurrentKa, gapMm, configuration) {
  const coefficients = ARC_CURRENT_COEFFICIENTS[configuration][voltageKv];
  const logCurrentTerm = coefficients[0]
    + coefficients[1] * Math.log10(faultCurrentKa)
    + coefficients[2] * Math.log10(gapMm);
  const currentPolynomial = polynomial(coefficients.slice(3), faultCurrentKa, 6);
  const currentKa = (10 ** logCurrentTerm) * currentPolynomial;

  if (!Number.isFinite(currentKa) || currentKa <= 0) {
    throw new RangeError("A corrente de arco calculada ficou fora do domínio válido do modelo.");
  }

  return currentKa;
}

function correctLowVoltageArcCurrent(voltageKv, currentAt600Ka, faultCurrentKa) {
  const first = (0.6 / voltageKv) ** 2;
  const second = 1 / currentAt600Ka ** 2;
  const third = (0.6 ** 2 - voltageKv ** 2) / (0.6 ** 2 * faultCurrentKa ** 2);
  const radicand = first * (second - third);

  if (!Number.isFinite(radicand) || radicand <= 0) {
    throw new RangeError("A correção da corrente para baixa tensão não é válida para estes dados.");
  }

  return 1 / Math.sqrt(radicand);
}

function getEnclosureCorrectionFactor(input) {
  if (input.electrodeConfiguration === "VOA" || input.electrodeConfiguration === "HOA") {
    return 1;
  }

  const { voltageKv, enclosureHeightMm, enclosureWidthMm, enclosureDepthMm } = input;
  const enclosureType = voltageKv < 0.6
    && enclosureHeightMm < 508
    && enclosureWidthMm < 508
    && enclosureDepthMm <= 203.2
    ? "shallow"
    : "typical";
  const { a, b } = ENCLOSURE_DIMENSION_FACTORS[input.electrodeConfiguration];

  const adjustedDimensionInches = (dimensionMm) => {
    const limitedDimension = Math.min(dimensionMm, 1244.6);
    if (limitedDimension < 508) {
      return enclosureType === "typical" ? 20 : limitedDimension / 25.4;
    }
    if (limitedDimension <= 660.4) {
      return limitedDimension / 25.4;
    }
    if (input.electrodeConfiguration === "VCB" && dimensionMm > 1244.6) {
      return 49;
    }
    return (660.4 + (limitedDimension - 660.4) * ((voltageKv + a) / b)) / 25.4;
  };

  const widthInches = adjustedDimensionInches(enclosureWidthMm);
  const heightInches = adjustedDimensionInches(enclosureHeightMm);
  const equivalentEnclosureSizeInches = (widthInches + heightInches) / 2;
  const coefficients = ENCLOSURE_CORRECTION_COEFFICIENTS[enclosureType][input.electrodeConfiguration];
  const [b1, b2, b3] = coefficients;
  const sizeFactor = b1 * equivalentEnclosureSizeInches ** 2
    + b2 * equivalentEnclosureSizeInches
    + b3;
  const correctionFactor = enclosureType === "shallow" ? 1 / sizeFactor : sizeFactor;

  if (!Number.isFinite(correctionFactor) || correctionFactor <= 0 || correctionFactor > 3) {
    throw new RangeError("O fator de correção do invólucro ficou fora da faixa válida do modelo.");
  }

  return correctionFactor;
}

function intermediateIncidentEnergy({
  coefficients,
  gapMm,
  faultCurrentKa,
  arcCurrentKa,
  arcCurrent600Ka,
  workingDistanceMm,
  correctionFactor,
  arcTimeMs,
}) {
  const denominator = polynomial(coefficients.slice(3, 10), faultCurrentKa, 7);
  const numeratorCurrentKa = arcCurrent600Ka ?? arcCurrentKa;

  if (!Number.isFinite(denominator) || denominator <= 0) {
    throw new RangeError("A equação de energia incidente não é válida para estes dados.");
  }

  const exponent = coefficients[0]
    + coefficients[1] * Math.log10(gapMm)
    + (coefficients[2] * numeratorCurrentKa) / denominator
    + coefficients[10] * Math.log10(faultCurrentKa)
    + coefficients[12] * Math.log10(arcCurrentKa)
    + Math.log10(1 / correctionFactor)
    + coefficients[11] * Math.log10(workingDistanceMm);
  const energyJoulesPerCm2 = (12.552 / 50) * arcTimeMs * (10 ** exponent);

  if (!Number.isFinite(energyJoulesPerCm2) || energyJoulesPerCm2 <= 0) {
    throw new RangeError("A energia incidente calculada ficou fora do domínio válido do modelo.");
  }

  return energyJoulesPerCm2;
}

function intermediateArcFlashBoundary({
  coefficients,
  gapMm,
  faultCurrentKa,
  nominalArcCurrentKa,
  reducedArcCurrentKa,
  correctionFactor,
  arcTimeMs,
}) {
  const denominator = polynomial(coefficients.slice(3, 10), faultCurrentKa, 7);
  const exponentNumerator = coefficients[0]
    + coefficients[1] * Math.log10(gapMm)
    + (coefficients[2] * nominalArcCurrentKa) / denominator
    + coefficients[10] * Math.log10(faultCurrentKa)
    + coefficients[12] * Math.log10(reducedArcCurrentKa)
    + Math.log10(1 / correctionFactor)
    - Math.log10(20 / arcTimeMs);
  const distanceMm = 10 ** (exponentNumerator / -coefficients[11]);

  if (!Number.isFinite(distanceMm) || distanceMm <= 0) {
    throw new RangeError("A fronteira de arco calculada ficou fora do domínio válido do modelo.");
  }

  return distanceMm;
}

function buildScenario(input, currents, reducedCurrents, correctionFactor, arcTimeMs, isLowVoltage) {
  const { voltageKv, faultCurrentKa, gapMm, workingDistanceMm, electrodeConfiguration } = input;
  let energyJoulesPerCm2;
  let arcFlashBoundaryMm;

  if (isLowVoltage) {
    const coefficients = INCIDENT_ENERGY_COEFFICIENTS[0.6][electrodeConfiguration];
    energyJoulesPerCm2 = intermediateIncidentEnergy({
      coefficients,
      gapMm,
      faultCurrentKa,
      arcCurrentKa: currents.final,
      arcCurrent600Ka: currents.at600,
      workingDistanceMm,
      correctionFactor,
      arcTimeMs,
    });
    arcFlashBoundaryMm = intermediateArcFlashBoundary({
      coefficients,
      gapMm,
      faultCurrentKa,
      nominalArcCurrentKa: currents.final,
      reducedArcCurrentKa: reducedCurrents.final,
      correctionFactor,
      arcTimeMs,
    });
  } else {
    const energies = REFERENCE_VOLTAGES_KV.map((referenceVoltage) => intermediateIncidentEnergy({
      coefficients: INCIDENT_ENERGY_COEFFICIENTS[referenceVoltage][electrodeConfiguration],
      gapMm,
      faultCurrentKa,
      arcCurrentKa: currents[referenceVoltage],
      workingDistanceMm,
      correctionFactor,
      arcTimeMs,
    }));
    const boundaries = REFERENCE_VOLTAGES_KV.map((referenceVoltage) => intermediateArcFlashBoundary({
      coefficients: INCIDENT_ENERGY_COEFFICIENTS[referenceVoltage][electrodeConfiguration],
      gapMm,
      faultCurrentKa,
      nominalArcCurrentKa: currents[referenceVoltage],
      reducedArcCurrentKa: reducedCurrents[referenceVoltage],
      correctionFactor,
      arcTimeMs,
    }));

    energyJoulesPerCm2 = interpolate(voltageKv, energies[0], energies[1], energies[2]);
    arcFlashBoundaryMm = interpolate(voltageKv, boundaries[0], boundaries[1], boundaries[2]);
  }

  return {
    arcTimeMs,
    energyJoulesPerCm2,
    energyCaloriesPerCm2: energyJoulesPerCm2 / JOULES_PER_CALORIE,
    arcFlashBoundaryMm,
  };
}

export function validateArcFlashInputs(input) {
  const errors = {};
  const numericFields = [
    "voltageKv",
    "faultCurrentKa",
    "gapMm",
    "workingDistanceMm",
    "arcTimeMs",
    "reducedArcTimeMs",
  ];

  for (const field of numericFields) {
    if (!Number.isFinite(Number(input[field]))) {
      errors[field] = "Informe um valor numérico válido.";
    }
  }

  if (!ELECTRODE_CONFIGURATIONS.includes(input.electrodeConfiguration)) {
    errors.electrodeConfiguration = "Selecione uma configuração de eletrodos válida.";
  }

  if (Object.keys(errors).length > 0) {
    return errors;
  }

  const { voltageKv, faultCurrentKa, gapMm, workingDistanceMm } = input;
  const enclosed = input.electrodeConfiguration !== "VOA" && input.electrodeConfiguration !== "HOA";

  if (voltageKv < 0.208 || voltageKv > 15) {
    errors.voltageKv = "A faixa do modelo é de 0,208 kV a 15 kV.";
  }

  const faultCurrentRange = voltageKv <= 0.6 ? [0.7, 106] : [0.2, 65];
  if (faultCurrentKa < faultCurrentRange[0] || faultCurrentKa > faultCurrentRange[1]) {
    errors.faultCurrentKa = `Para esta tensão, a corrente de falta deve estar entre ${faultCurrentRange[0]} e ${faultCurrentRange[1]} kA.`;
  }

  const gapRange = voltageKv <= 0.6 ? [6.35, 76.2] : [19.05, 254];
  if (gapMm < gapRange[0] || gapMm > gapRange[1]) {
    errors.gapMm = `Para esta tensão, o espaçamento deve estar entre ${gapRange[0]} e ${gapRange[1]} mm.`;
  }

  if (workingDistanceMm < 305) {
    errors.workingDistanceMm = "A distância de trabalho mínima do modelo é 305 mm.";
  }

  if (input.arcTimeMs <= 0) {
    errors.arcTimeMs = "O tempo de eliminação deve ser maior que zero.";
  }

  if (input.reducedArcTimeMs <= 0) {
    errors.reducedArcTimeMs = "O tempo para corrente reduzida deve ser maior que zero.";
  }

  if (enclosed) {
    for (const field of ["enclosureHeightMm", "enclosureWidthMm", "enclosureDepthMm"]) {
      if (!Number.isFinite(Number(input[field])) || Number(input[field]) <= 0) {
        errors[field] = "Informe uma dimensão maior que zero.";
      }
    }

    if (Number.isFinite(Number(input.enclosureWidthMm))
      && Number(input.enclosureWidthMm) < 4 * gapMm) {
      errors.enclosureWidthMm = "A largura do invólucro deve ser pelo menos quatro vezes o espaçamento.";
    }
  }

  return errors;
}

export function calculateArcFlash(input) {
  const errors = validateArcFlashInputs(input);
  if (Object.keys(errors).length > 0) {
    throw new RangeError(Object.values(errors)[0]);
  }

  const correctionFactor = getEnclosureCorrectionFactor(input);
  const variationFactor = polynomial(
    ARC_VARIATION_COEFFICIENTS[input.electrodeConfiguration],
    input.voltageKv,
    6,
  );
  const isLowVoltage = input.voltageKv <= 0.6;
  const nominalCurrentsAtReferenceVoltages = {};
  const reducedCurrentsAtReferenceVoltages = {};

  for (const referenceVoltage of REFERENCE_VOLTAGES_KV) {
    const nominalCurrent = intermediateArcCurrent(
      referenceVoltage,
      input.faultCurrentKa,
      input.gapMm,
      input.electrodeConfiguration,
    );
    nominalCurrentsAtReferenceVoltages[referenceVoltage] = nominalCurrent;
    reducedCurrentsAtReferenceVoltages[referenceVoltage] = nominalCurrent * (1 - 0.5 * variationFactor);
  }

  const nominalArcCurrentKa = isLowVoltage
    ? correctLowVoltageArcCurrent(input.voltageKv, nominalCurrentsAtReferenceVoltages[0.6], input.faultCurrentKa)
    : interpolate(
      input.voltageKv,
      nominalCurrentsAtReferenceVoltages[0.6],
      nominalCurrentsAtReferenceVoltages[2.7],
      nominalCurrentsAtReferenceVoltages[14.3],
    );
  const reducedArcCurrentKa = isLowVoltage
    ? correctLowVoltageArcCurrent(input.voltageKv, reducedCurrentsAtReferenceVoltages[0.6], input.faultCurrentKa)
    : interpolate(
      input.voltageKv,
      reducedCurrentsAtReferenceVoltages[0.6],
      reducedCurrentsAtReferenceVoltages[2.7],
      reducedCurrentsAtReferenceVoltages[14.3],
    );

  const nominalCurrents = isLowVoltage
    ? { at600: nominalCurrentsAtReferenceVoltages[0.6], final: nominalArcCurrentKa }
    : nominalCurrentsAtReferenceVoltages;
  const reducedCurrents = isLowVoltage
    ? { at600: reducedCurrentsAtReferenceVoltages[0.6], final: reducedArcCurrentKa }
    : reducedCurrentsAtReferenceVoltages;

  const scenarios = [
    buildScenario(
      input,
      nominalCurrents,
      reducedCurrents,
      correctionFactor,
      input.arcTimeMs,
      isLowVoltage,
    ),
    buildScenario(
      input,
      reducedCurrents,
      reducedCurrents,
      correctionFactor,
      input.reducedArcTimeMs,
      isLowVoltage,
    ),
  ];
  const worstCase = scenarios.reduce((highest, scenario) => (
    scenario.energyJoulesPerCm2 > highest.energyJoulesPerCm2 ? scenario : highest
  ));

  return {
    nominalArcCurrentKa,
    reducedArcCurrentKa,
    variationFactor,
    enclosureCorrectionFactor: correctionFactor,
    scenarios,
    worstCase,
  };
}
