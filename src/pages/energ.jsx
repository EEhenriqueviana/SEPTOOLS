import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Flame, Plus, Shield, Trash2, X, Zap } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calculateArcFlash, validateArcFlashInputs } from "../lib/arcFlash";
import { getNr10ZoneDistances } from "../lib/nr10";

const INCIDENT_ENERGY_LEVELS = [
  { value: 1.2, color: "#16a34a" },
  { value: 4, color: "#dc2626" },
  { value: 8, color: "#eab308" },
  { value: 25, color: "#3b82f6" },
  { value: 40, color: "#f97316" },
];

const DEFAULT_EPI_ITEMS = [
  "Capacete",
  "Óculos de segurança",
  "Protetor auricular",
  "Calçado de Segurança",
  "Camisas e calças resistentes a arco",
  "Protetor facial",
  "Balaclava",
  "Luvas isolantes",
];

const DEFAULT_INPUT = {
  voltageKv: "13.8",
  faultCurrentKa: "18.241",
  gapMm: "152",
  workingDistanceMm: "914",
  enclosureHeightMm: "1244.6",
  enclosureWidthMm: "1244.6",
  enclosureDepthMm: "1143",
  arcTimeMs: "191",
  reducedArcTimeMs: "191",
  electrodeConfiguration: "HCB",
};

const configurationLabels = {
  VCB: "VCB - invólucro vertical",
  VCBB: "VCBB - caixa vertical",
  HCB: "HCB - invólucro horizontal",
  VOA: "VOA - condutores verticais, aberto",
  HOA: "HOA - condutores horizontais, aberto",
};

function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getEpiLevel(calories) {
  if (calories > 40) return "Perigo extremo";
  if (calories > 25) return "Categoria 4";
  if (calories > 8) return "Categoria 3";
  if (calories > 4) return "Categoria 2";
  if (calories > 1.2) return "Categoria 1";
  return "Sem categoria mínima";
}

function getAtpvCategory(calories) {
  if (!Number.isFinite(calories) || calories <= 1.2) return "-";
  if (calories <= 4) return "1";
  if (calories <= 8) return "2";
  if (calories <= 25) return "3";
  if (calories <= 40) return "4";
  return "PERIGO";
}

function todayBrazil() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function findEnergyLevelDistance(points, energyLevel) {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (previous.energy >= energyLevel && current.energy <= energyLevel) {
      const energySpan = previous.energy - current.energy;
      if (energySpan === 0) return previous.distanceMm;

      const fraction = (previous.energy - energyLevel) / energySpan;
      return previous.distanceMm + fraction * (current.distanceMm - previous.distanceMm);
    }
  }

  return null;
}

function Energ() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [isLabelOpen, setIsLabelOpen] = useState(false);
  const labelDialogRef = useRef(null);
  const [epiItems, setEpiItems] = useState(DEFAULT_EPI_ITEMS);
  const [newEpiItem, setNewEpiItem] = useState("");
  const [label, setLabel] = useState({
    tag: "QGBT-01",
    responsible: "Eng. José da Silva",
    date: todayBrazil(),
  });

  const updateInput = (field, value) => {
    setInput((current) => ({ ...current, [field]: value }));
  };

  const addEpiItem = (event) => {
    event.preventDefault();
    const item = newEpiItem.trim();
    if (!item) return;

    setEpiItems((current) => [...current, item]);
    setNewEpiItem("");
  };

  const removeEpiItem = (indexToRemove) => {
    setEpiItems((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const result = useMemo(() => {
    const numericInput = Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        typeof value === "string" && key !== "electrodeConfiguration" ? Number(value) : value,
      ]),
    );
    const errors = validateArcFlashInputs(numericInput);
    if (Object.keys(errors).length > 0) return { errors };

    try {
      return {
        errors: {},
        data: calculateArcFlash(numericInput),
      };
    } catch (error) {
      return { errors: { calculation: error.message } };
    }
  }, [input]);

  const data = result.data;
  const calories = data?.worstCase.energyCaloriesPerCm2;
  const joules = data?.worstCase.energyJoulesPerCm2;
  const boundary = data?.worstCase.arcFlashBoundaryMm;
  const critical = Number.isFinite(calories) && calories > 40;
  const energyDistanceChart = useMemo(() => {
    if (!data) return null;

    const numericInput = Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        typeof value === "string" && key !== "electrodeConfiguration" ? Number(value) : value,
      ]),
    );
    const workingDistanceMm = Number(input.workingDistanceMm);
    const maxDistanceMm = Math.max(1600, workingDistanceMm * 1.5);
    const sampleCount = 61;
    const distances = Array.from({ length: sampleCount }, (_, index) => (
      305 + (maxDistanceMm - 305) * index / (sampleCount - 1)
    ));
    distances.push(workingDistanceMm);

    const points = [...new Set(distances)]
      .sort((first, second) => first - second)
      .map((distanceMm) => ({
        distanceMm,
        energy: distanceMm === workingDistanceMm
          ? calories
          : calculateArcFlash({ ...numericInput, workingDistanceMm: distanceMm })
            .worstCase.energyCaloriesPerCm2,
      }));
    const maxEnergy = Math.max(5, Math.ceil(Math.max(...points.map((point) => point.energy)) / 5) * 5);

    return {
      points,
      maxDistanceMm,
      maxEnergy,
      energyLevels: INCIDENT_ENERGY_LEVELS.map((level) => ({
        ...level,
        distanceMm: findEnergyLevelDistance(points, level.value),
      })),
    };
  }, [calories, data, input]);

  useEffect(() => {
    const currentDialog = labelDialogRef.current;
    if (!currentDialog) return;

    if (isLabelOpen && !currentDialog.open) {
      currentDialog.showModal();
    } else if (!isLabelOpen && currentDialog.open) {
      currentDialog.close();
    }
  }, [isLabelOpen]);

  const isOpenAir =
    input.electrodeConfiguration === "VOA" ||
    input.electrodeConfiguration === "HOA";

  const fieldClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <Flame className="h-7 w-7 text-orange-600" />
            Energia Incidente e Arc Flash
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Modelo IEEE 1584-2018 para sistemas trifásicos de 208 V a 15 kV.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsLabelOpen(true)}
          disabled={!data}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Gerar etiqueta
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
              <Zap className="h-5 w-5 text-amber-600" />
              Dados do sistema
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-slate-600">
                Tensão nominal (kV)
                <input
                  type="number"
                  step="0.001"
                  value={input.voltageKv}
                  onChange={(event) => updateInput("voltageKv", event.target.value)}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Corrente de falta (kA)
                <input
                  type="number"
                  step="0.001"
                  value={input.faultCurrentKa}
                  onChange={(event) => updateInput("faultCurrentKa", event.target.value)}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="col-span-2 text-xs font-semibold text-slate-600">
                Configuração dos eletrodos
                <select
                  value={input.electrodeConfiguration}
                  onChange={(event) =>
                    updateInput("electrodeConfiguration", event.target.value)
                  }
                  className={`${fieldClass} mt-1`}
                >
                  {Object.entries(configurationLabels).map(([value, labelText]) => (
                    <option key={value} value={value}>{labelText}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Espaçamento (mm)
                <input
                  type="number"
                  value={input.gapMm}
                  onChange={(event) => updateInput("gapMm", event.target.value)}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Distância de trabalho (mm)
                <input
                  type="number"
                  value={input.workingDistanceMm}
                  onChange={(event) => updateInput("workingDistanceMm", event.target.value)}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <p className="col-span-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                {Number(input.voltageKv) <= 0.6
                  ? "Até 0,6 kV (600 V), o modelo aceita corrente de falta de 0,7 a 106 kA e espaçamento de eletrodos de 6,35 a 76,2 mm."
                  : "Acima de 0,6 kV, o modelo aceita corrente de falta de 0,2 a 65 kA e espaçamento de eletrodos de 19,05 a 254 mm."}
                {" "}Informe a tensão em kV (por exemplo, 480 V = 0,48 kV).
              </p>
            </div>
          </div>

          {!isOpenAir && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-800">Dimensões do invólucro</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["enclosureHeightMm", "Altura (mm)"],
                  ["enclosureWidthMm", "Largura (mm)"],
                  ["enclosureDepthMm", "Profundidade (mm)"],
                ].map(([field, labelText]) => (
                  <label key={field} className="text-xs font-semibold text-slate-600">
                    {labelText}
                    <input
                      type="number"
                      value={input[field]}
                      onChange={(event) => updateInput(field, event.target.value)}
                      className={`${fieldClass} mt-1`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-800">Tempos de atuação</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-slate-600">
                Tempo nominal (ms)
                <input
                  type="number"
                  value={input.arcTimeMs}
                  onChange={(event) => updateInput("arcTimeMs", event.target.value)}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Tempo reduzido (ms)
                <input
                  type="number"
                  value={input.reducedArcTimeMs}
                  onChange={(event) => updateInput("reducedArcTimeMs", event.target.value)}
                  className={`${fieldClass} mt-1`}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-800">EPIs na etiqueta</h3>
            <div className="space-y-2">
              <form onSubmit={addEpiItem} className="flex gap-2">
                <input
                  type="text"
                  value={newEpiItem}
                  onChange={(event) => setNewEpiItem(event.target.value)}
                  aria-label="Novo EPI"
                  placeholder="Digite um EPI"
                  required
                  className={`${fieldClass} mt-0`}
                />
                <button
                  type="submit"
                  aria-label="Adicionar EPI"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-orange-600 px-3 text-white hover:bg-orange-700"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </form>
              <ul className="max-h-44 space-y-1 overflow-y-auto" aria-live="polite">
                {epiItems.map((item, index) => (
                  <li
                    key={`${item}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeEpiItem(index)}
                      aria-label={`Remover EPI ${item}`}
                      className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {Object.keys(result.errors).length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {Object.values(result.errors)[0]}
            </div>
          )}
        </section>

        <section className="space-y-4">
          {data ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <ResultCard
                  title="Corrente nominal"
                  value={`${formatNumber(data.nominalArcCurrentKa)} kA`}
                  color="text-blue-700"
                />
                <ResultCard
                  title="Corrente reduzida"
                  value={`${formatNumber(data.reducedArcCurrentKa)} kA`}
                  color="text-violet-700"
                />
                <ResultCard
                  title="Energia incidente"
                  value={`${formatNumber(calories)} cal/cm²`}
                  color={critical ? "text-red-700" : "text-orange-700"}
                />
                <ResultCard
                  title="Fronteira de arco"
                  value={`${formatNumber(boundary / 1000, 2)} m`}
                  color="text-emerald-700"
                />
              </div>

              <div className={`rounded-xl border p-5 ${critical ? "border-red-300 bg-red-50" : "border-orange-200 bg-orange-50"}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-6 w-6 shrink-0 ${critical ? "text-red-700" : "text-orange-700"}`} />
                  <div>
                    <h3 className={`font-bold ${critical ? "text-red-800" : "text-orange-800"}`}>
                      {critical ? "PERIGO EXTREMO - intervenção energizada não recomendada" : "AVISO DE ARC FLASH"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-700">
                      Classificação: <strong>{getEpiLevel(calories)}</strong>
                      {" | "}Energia: <strong>{formatNumber(joules)} J/cm²</strong>
                      {" | "}ATPV mínimo: <strong>{formatNumber(calories)} cal/cm²</strong>
                    </p>
                  </div>
                </div>
              </div>

              {energyDistanceChart && (
                <section
                  aria-label="Gráfico de energia incidente por distância"
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        Energia incidente × distância
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Curva calculada pelo modelo IEEE 1584-2018 para os dados informados.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
                      {energyDistanceChart.energyLevels.map((level) => (
                        <span key={level.value} className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="w-5 border-t-2 border-dashed"
                            style={{ borderColor: level.color }}
                          />
                          {formatNumber(level.value, 1)} cal/cm²
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="w-5 border-t-2 border-dashed border-fuchsia-500"
                        />
                        Dist. trab.
                      </span>
                    </div>
                  </div>

                  <div className="h-72 w-full" role="img" aria-label="Curva de energia incidente em função da distância">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={energyDistanceChart.points}
                        margin={{ top: 10, right: 12, left: 4, bottom: 8 }}
                      >
                        <CartesianGrid stroke="#e2e8f0" />
                        <XAxis
                          type="number"
                          dataKey="distanceMm"
                          domain={[305, energyDistanceChart.maxDistanceMm]}
                          tickFormatter={(value) => formatNumber(value, 0)}
                          stroke="#64748b"
                          tick={{ fontSize: 11 }}
                          label={{
                            value: "Distância (mm)",
                            position: "insideBottom",
                            offset: -3,
                            fill: "#475569",
                            fontSize: 12,
                          }}
                        />
                        <YAxis
                          type="number"
                          domain={[0, energyDistanceChart.maxEnergy]}
                          tickFormatter={(value) => formatNumber(value, 0)}
                          stroke="#64748b"
                          tick={{ fontSize: 11 }}
                          width={42}
                          label={{
                            value: "Energia (cal/cm²)",
                            angle: -90,
                            position: "insideLeft",
                            fill: "#475569",
                            fontSize: 12,
                          }}
                        />
                        <Tooltip
                          formatter={(value) => [
                            `${formatNumber(Number(value))} cal/cm²`,
                            "Energia incidente",
                          ]}
                          labelFormatter={(value) => `Distância: ${formatNumber(Number(value), 0)} mm`}
                          contentStyle={{ borderRadius: 8, borderColor: "#cbd5e1" }}
                        />
                        {energyDistanceChart.energyLevels.map((level) => (
                          level.distanceMm !== null && (
                            <ReferenceLine
                              key={level.value}
                              x={level.distanceMm}
                              stroke={level.color}
                              strokeDasharray="7 7"
                              strokeWidth={2}
                            />
                          )
                        ))}
                        <ReferenceLine
                          x={Number(input.workingDistanceMm)}
                          stroke="#d946ef"
                          strokeDasharray="7 7"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="energy"
                          name="Energia incidente"
                          stroke="#111827"
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                        <ReferenceDot
                          x={Number(input.workingDistanceMm)}
                          y={calories}
                          r={5}
                          fill="#d946ef"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    A curva é exibida a partir da distância mínima de 305 mm do modelo. As linhas coloridas
                    marcam os cruzamentos com os níveis de energia dentro dessa faixa.
                  </p>
                </section>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                    <Shield className="h-5 w-5 text-slate-600" />
                    Cenários calculados
                  </h3>
                  <div className="space-y-2 text-sm">
                    {data.scenarios.map((scenario, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span>Corrente {index === 0 ? "nominal" : "reduzida"}</span>
                        <strong>{formatNumber(scenario.energyCaloriesPerCm2)} cal/cm²</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 font-semibold text-slate-800">Dados da etiqueta</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-xs font-semibold text-slate-600">
                      TAG do equipamento
                      <input
                        value={label.tag}
                        onChange={(event) => setLabel((current) => ({ ...current, tag: event.target.value }))}
                        className={`${fieldClass} mt-1`}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Responsável técnico
                      <input
                        value={label.responsible}
                        onChange={(event) => setLabel((current) => ({ ...current, responsible: event.target.value }))}
                        className={`${fieldClass} mt-1`}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Data
                      <input
                        value={label.date}
                        onChange={(event) => setLabel((current) => ({ ...current, date: event.target.value }))}
                        className={`${fieldClass} mt-1`}
                      />
                    </label>
                  </div>
                </div>
              </div>

            </>
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              Corrija os dados informados para visualizar o resultado.
            </div>
          )}
        </section>
      </div>

      <dialog
        ref={labelDialogRef}
        onClose={() => setIsLabelOpen(false)}
        aria-labelledby="arc-flash-dialog-title"
        className="fixed inset-0 m-auto max-h-[92vh] w-[min(95vw,960px)] overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 id="arc-flash-dialog-title" className="text-lg font-bold text-slate-900">
              Prévia da etiqueta
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Para gerar o arquivo, selecione “Salvar como PDF” na janela de impressão.
            </p>
          </div>
          <button
            type="button"
            onClick={() => labelDialogRef.current?.close()}
            aria-label="Fechar prévia da etiqueta"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-144px)] overflow-auto bg-slate-100 p-4 md:p-6">
          {data && (
            <ArcLabel
              label={label}
              voltageKv={input.voltageKv}
              faultCurrentKa={input.faultCurrentKa}
              arcTimeMs={input.arcTimeMs}
              calories={calories}
              boundary={boundary}
              workingDistance={input.workingDistanceMm}
              epiItems={epiItems}
            />
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={() => labelDialogRef.current?.close()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>
        </div>
      </dialog>
    </div>
  );
}

function ResultCard({ title, value, color }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ArcLabel({
  label,
  voltageKv,
  faultCurrentKa,
  arcTimeMs,
  calories,
  boundary,
  workingDistance,
  epiItems,
}) {
  const nominalVoltage = Number(voltageKv) * 1000;
  const formatVoltage = Number.isFinite(nominalVoltage)
    ? `${formatNumber(nominalVoltage, 0)} V`
    : "-";
  const formattedCalories = formatNumber(calories, 1);
  const atpv = getAtpvCategory(calories);
  const nr10Zones = getNr10ZoneDistances(Number(voltageKv));
  const controlledZone = nr10Zones.rc;
  const riskZone = nr10Zones.rr;

  return (
    <div
      id="arc-flash-label"
      className="mx-auto w-full max-w-[720px] overflow-hidden border-2 border-slate-950 bg-white text-slate-950 print:w-[180mm]"
    >
      <div className="relative grid grid-cols-[105px_1fr] border-b border-slate-950 bg-orange-500 text-center">
        <div className="flex items-center justify-center py-3">
          <svg viewBox="0 0 72 64" className="h-16 w-16" aria-label="Símbolo de advertência">
            <path
              d="M31.8 5.4c1.9-3.3 6.5-3.3 8.4 0l26.2 45.4c1.9 3.3-.5 7.4-4.2 7.4H9.8c-3.8 0-6.1-4.1-4.2-7.4L31.8 5.4Z"
              fill="#0f172a"
            />
            <rect x="33" y="20" width="6" height="23" rx="3" fill="#fff" />
            <circle cx="36" cy="50" r="3.5" fill="#fff" />
          </svg>
        </div>
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl font-black tracking-wide">
          PERIGO
        </p>
      </div>

      <div className="border-b border-slate-950 py-2 text-center">
        <p className="text-xl font-medium uppercase">
          Risco de arco e choque elétrico
        </p>
        <p className="text-xl font-medium uppercase">
          Necessário uso de EPI adequado
        </p>
      </div>

      <div className="grid grid-cols-[220px_1fr] border-b border-slate-950 text-base">
        <div className="border-r border-slate-950 px-3 py-1.5">TAG do Equipamento</div>
        <div className="px-3 py-1.5 text-xl font-black text-red-600">{label.tag}</div>
      </div>
      <div className="grid grid-cols-[220px_1fr] border-b border-slate-950 text-base">
        <div className="border-r border-slate-950 px-3 py-1.5">Tensão Nominal</div>
        <div className="px-3 py-1.5 text-xl font-black text-red-600">{formatVoltage}</div>
      </div>

      <div className="border-b border-slate-950 text-center">
        <p className="border-b border-slate-950 bg-slate-200 py-1 text-base font-medium">ARCO</p>
        <div className="grid grid-cols-[340px_1fr] whitespace-nowrap text-left text-base">
          <div className="border-r border-slate-950 px-3 py-1">Corrente de Curto-Circuito</div>
          <div className="px-3 py-1 font-bold text-red-600">
            {formatNumber(Number(faultCurrentKa), 1)} kA
          </div>
        </div>
        <div className="grid grid-cols-[340px_1fr] whitespace-nowrap border-t border-slate-950 text-left text-base">
          <div className="border-r border-slate-950 px-3 py-1">Tempo de Eliminação da Falta</div>
          <div className="px-3 py-1 font-bold text-red-600">
            {formatNumber(Number(arcTimeMs), 0)} ms
          </div>
        </div>
        <div className="grid grid-cols-[340px_1fr] whitespace-nowrap border-t border-slate-950 text-left text-base">
          <div className="border-r border-slate-950 px-3 py-1">
            Distância limite para proteção de arco (AFB)
          </div>
          <div className="px-3 py-1 font-bold text-red-600">
            {formatNumber(boundary, 0)} mm
          </div>
        </div>
        <div className="grid grid-cols-[340px_1fr] whitespace-nowrap border-t border-slate-950 text-left text-base">
          <div className="border-r border-slate-950 px-3 py-1">Distância de trabalho</div>
          <div className="px-3 py-1 font-bold text-red-600">
            {formatNumber(Number(workingDistance), 0)} mm
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_110px] border-b border-slate-950">
        <div className="relative flex min-h-20 items-center px-3 py-2">
          <span className="absolute inset-y-0 left-3 flex items-center text-base">
            Energia Incidente
          </span>
          <p className="w-full text-center text-3xl font-black text-red-600">
            {formattedCalories} cal/cm²
          </p>
        </div>
        <div className="flex items-center justify-between border-l border-slate-950 px-3">
          <span className="text-base">ATPV</span>
          <strong className="text-3xl text-red-600">{atpv}</strong>
        </div>
      </div>

      <div className="border-b border-slate-950 text-center">
        <p className="border-b border-slate-950 bg-slate-200 py-1 text-base font-medium">CHOQUE</p>
        <div className="grid grid-cols-[220px_1fr] text-left text-base">
          <div className="border-r border-slate-950 px-3 py-1">Zona Controlada</div>
          <div className="px-3 py-1 text-red-600">
            {formatNumber(controlledZone, 2)} m
          </div>
        </div>
        <div className="grid grid-cols-[220px_1fr] border-t border-slate-950 text-left text-base">
          <div className="border-r border-slate-950 px-3 py-1">Zona de Risco</div>
          <div className="px-3 py-1 text-red-600">
            {formatNumber(riskZone, 2)} m
          </div>
        </div>
      </div>

      <div className="border-b border-slate-950">
        <p className="border-b border-slate-950 bg-slate-200 py-1 text-center text-base font-medium">
          EPI REQUERIDO
        </p>
        <div className="px-3 py-2 text-base leading-6">
          {epiItems.length > 0
            ? epiItems.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)
            : <p>Nenhum EPI informado.</p>}
        </div>
      </div>

      <div className="grid grid-cols-[220px_1fr] border-b border-slate-950 text-base">
        <div className="border-r border-slate-950 px-3 py-1.5">
          <strong>DATA:</strong> {label.date}
        </div>
        <div className="px-3 py-1.5">
          <strong>RESPONSÁVEL:</strong> {label.responsible}
        </div>
      </div>
      <div className="px-3 py-1.5 text-sm">
        METODOLOGIA: NBR 17227 | IEEE 1584 | NR-10 | NFPA-70E
      </div>
    </div>
  );
}

export default Energ;