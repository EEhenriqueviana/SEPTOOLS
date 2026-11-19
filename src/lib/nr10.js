export function getNr10ZoneDistances(voltageKv) {
  const voltage = Number(voltageKv);

  if (!Number.isFinite(voltage) || voltage < 0) {
    throw new RangeError("Tensão nominal inválida para a determinação das zonas da NR-10.");
  }

  if (voltage < 1) return { rr: 0.20, rc: 0.70 };
  if (voltage < 3) return { rr: 0.22, rc: 1.22 };
  if (voltage < 6) return { rr: 0.25, rc: 1.25 };
  if (voltage < 10) return { rr: 0.35, rc: 1.35 };
  if (voltage < 15) return { rr: 0.38, rc: 1.38 };
  if (voltage < 20) return { rr: 0.40, rc: 1.40 };
  if (voltage < 30) return { rr: 0.56, rc: 1.56 };
  if (voltage < 36) return { rr: 0.58, rc: 1.58 };
  if (voltage < 45) return { rr: 0.63, rc: 1.63 };
  if (voltage < 60) return { rr: 0.83, rc: 1.83 };
  if (voltage < 70) return { rr: 0.90, rc: 1.90 };
  if (voltage < 110) return { rr: 1.00, rc: 2.00 };
  if (voltage < 132) return { rr: 1.10, rc: 3.10 };
  if (voltage < 150) return { rr: 1.20, rc: 3.20 };
  if (voltage < 220) return { rr: 1.60, rc: 3.60 };
  if (voltage < 275) return { rr: 1.80, rc: 3.80 };
  if (voltage < 380) return { rr: 2.50, rc: 4.50 };
  if (voltage < 480) return { rr: 3.20, rc: 5.20 };
  if (voltage < 700) return { rr: 5.20, rc: 7.20 };

  throw new RangeError("Tensão fora da tabela de zonas de aproximação da NR-10.");
}
