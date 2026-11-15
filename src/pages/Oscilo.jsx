import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Bot,
  Eye,
  EyeOff,
  FileUp,
  LockKeyhole,
  Maximize2,
  Moon,
  RotateCcw,
  Sun,
  Upload,
} from "lucide-react";
import {
  AreaChart,
  CartesianGrid,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  usePlotArea,
} from "recharts";
import { parseCfg, parseDat } from "../lib/comtrade";

const COLORS = ["#ff5252", "#22c55e", "#168bff", "#f59e0b", "#a855f7", "#eab308"];
const CURSOR_COLORS = { T1: "#f97316", T2: "#d946ef" };
const MAX_CHART_POINTS = 1400;
const DECIMATION_BLOCK_SIZE = 16;
const CURSOR_HANDLE_HALF_WIDTH_PX = 8;
const CHART_MARGIN = { top: 10, right: 16, bottom: 24, left: 0 };
const NO_TRANSITIONS = [];

function createNiceAnalogScale(minimum, maximum) {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    return { domain: [-5, 5], ticks: [-5, 0, 5] };
  }

  minimum = Math.min(minimum, 0);
  maximum = Math.max(maximum, 0);
  if (minimum === maximum) {
    return { domain: [-5, 5], ticks: [-5, 0, 5] };
  }

  const roughStep = (maximum - minimum) / 30;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const multiplier = [1, 2, 2.5, 5, 10].find((value) => value >= normalizedStep) ?? 10;
  const step = 5 * multiplier * magnitude;
  const firstTickIndex = Math.floor(minimum / step);
  const lastTickIndex = Math.ceil(maximum / step);
  const ticks = Array.from(
    { length: lastTickIndex - firstTickIndex + 1 },
    (_, index) => Number(((firstTickIndex + index) * step).toPrecision(12)),
  );

  return {
    domain: [firstTickIndex * step, lastTickIndex * step],
    ticks,
  };
}

function formatAxisValue(value) {
  return Number(value).toLocaleString("pt-BR", { maximumSignificantDigits: 4 });
}

function findTripStartTime(record) {
  const tripChannels = record.config.digitalChannels.filter((channel) => /\btrip\b/i.test(channel.name));
  if (tripChannels.length === 0) return record.triggerTimeMs;

  const tripChannelIndexes = new Set(tripChannels.map((channel) => channel.index));
  const firstSample = record.samples[0];
  let tripStartTimeMs = tripChannels.some((channel) => firstSample?.digital[channel.index] === 1)
    ? firstSample.timeMs
    : Infinity;

  for (const transition of record.transitions) {
    if (transition.state === 1 && tripChannelIndexes.has(transition.channelIndex)) {
      tripStartTimeMs = Math.min(tripStartTimeMs, transition.timeMs);
    }
  }

  return Number.isFinite(tripStartTimeMs) ? tripStartTimeMs : record.triggerTimeMs;
}

function classifyAnalog(channel) {
  const unit = channel.unit.toLowerCase();
  const name = channel.name.toLowerCase();
  if (
    /^(m|k|µ|u)?a$/.test(unit) ||
    unit.includes("amp") ||
    /(^|[^a-z])i(?:[abc]|l|o|0)?\d*(?=$|[^a-z])/.test(name)
  ) {
    return "current";
  }
  if (
    /^(m|k|µ|u)?v$/.test(unit) ||
    unit.includes("volt") ||
    /(^|[^a-z])(?:u|v)(?:[abc]|l|o|0|n)?\d*(?=$|[^a-z])/.test(name)
  ) {
    return "voltage";
  }
  return "other";
}

function phaseColor(channel, index) {
  const phase = channel.phase.trim().toUpperCase();
  const name = channel.name.toUpperCase();
  const phaseIndex =
    phase === "A" || /(^|[^A-Z])A($|[^A-Z])/.test(name) ? 0
      : phase === "B" || /(^|[^A-Z])B($|[^A-Z])/.test(name) ? 1
        : phase === "C" || /(^|[^A-Z])C($|[^A-Z])/.test(name) ? 2
          : index % COLORS.length;
  return COLORS[phaseIndex];
}

function nearestSampleIndex(samples, timeMs) {
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].timeMs < timeMs) low = middle + 1;
    else high = middle;
  }
  if (low > 0 && Math.abs(samples[low - 1].timeMs - timeMs) < Math.abs(samples[low].timeMs - timeMs)) {
    return low - 1;
  }
  return low;
}

function nearestSample(samples, timeMs) {
  return samples[nearestSampleIndex(samples, timeMs)];
}

function sampleRangeBounds(samples, minTime, maxTime) {
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].timeMs < minTime) low = middle + 1;
    else high = middle;
  }
  const start = Math.max(0, low - 1);
  low = start;
  high = samples.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].timeMs <= maxTime) low = middle + 1;
    else high = middle;
  }
  return { start, end: Math.min(samples.length, low + 1) };
}

function createDecimationIndex(samples, channels, getValue, transitions) {
  const blockCount = Math.ceil(samples.length / DECIMATION_BLOCK_SIZE);
  const extremaIndexes = new Uint32Array(blockCount * channels.length * 2);

  for (let block = 0; block < blockCount; block += 1) {
    const start = block * DECIMATION_BLOCK_SIZE;
    const end = Math.min(samples.length, start + DECIMATION_BLOCK_SIZE);
    for (let channelPositionIndex = 0; channelPositionIndex < channels.length; channelPositionIndex += 1) {
      const channel = channels[channelPositionIndex];
      let minimumIndex = start;
      let maximumIndex = start;
      let minimumValue = getValue(samples[start], channel);
      let maximumValue = minimumValue;

      for (let index = start + 1; index < end; index += 1) {
        const value = getValue(samples[index], channel);
        if (value < minimumValue) {
          minimumValue = value;
          minimumIndex = index;
        }
        if (value > maximumValue) {
          maximumValue = value;
          maximumIndex = index;
        }
      }

      const offset = (block * channels.length + channelPositionIndex) * 2;
      extremaIndexes[offset] = minimumIndex;
      extremaIndexes[offset + 1] = maximumIndex;
    }
  }

  return {
    samples,
    channels,
    getValue,
    extremaIndexes,
    transitionIndexes: transitions.map((event) => nearestSampleIndex(samples, event.timeMs)),
  };
}

function decimateRange(index, minTime, maxTime, maxPoints = MAX_CHART_POINTS) {
  const { samples, channels, getValue, extremaIndexes, transitionIndexes } = index;
  const { start, end } = sampleRangeBounds(samples, minTime, maxTime);
  const visibleCount = end - start;
  if (visibleCount <= maxPoints) return samples.slice(start, end);

  const firstFullBlock = Math.ceil(start / DECIMATION_BLOCK_SIZE);
  const lastFullBlock = Math.floor(end / DECIMATION_BLOCK_SIZE);
  const fullBlockCount = Math.max(0, lastFullBlock - firstFullBlock);
  const blocksPerBucket = Math.max(
    1,
    Math.ceil(fullBlockCount / (maxPoints / (2 * channels.length))),
  );
  const indexes = new Set();
  const addRange = (rangeStart, rangeEnd) => {
    for (let sampleIndex = rangeStart; sampleIndex < rangeEnd; sampleIndex += 1) {
      indexes.add(sampleIndex);
    }
  };

  addRange(start, Math.min(end, firstFullBlock * DECIMATION_BLOCK_SIZE));

  for (let blockStart = firstFullBlock; blockStart < lastFullBlock; blockStart += blocksPerBucket) {
    const blockEnd = Math.min(lastFullBlock, blockStart + blocksPerBucket);
    for (let channelPositionIndex = 0; channelPositionIndex < channels.length; channelPositionIndex += 1) {
      let minimumIndex = -1;
      let maximumIndex = -1;
      let minimumValue = Infinity;
      let maximumValue = -Infinity;

      for (let block = blockStart; block < blockEnd; block += 1) {
        const offset = (block * channels.length + channelPositionIndex) * 2;
        const candidateMinimum = extremaIndexes[offset];
        const candidateMaximum = extremaIndexes[offset + 1];
        const candidateMinimumValue = getValue(samples[candidateMinimum], channels[channelPositionIndex]);
        const candidateMaximumValue = getValue(samples[candidateMaximum], channels[channelPositionIndex]);
        if (candidateMinimumValue < minimumValue) {
          minimumValue = candidateMinimumValue;
          minimumIndex = candidateMinimum;
        }
        if (candidateMaximumValue > maximumValue) {
          maximumValue = candidateMaximumValue;
          maximumIndex = candidateMaximum;
        }
      }

      if (minimumIndex >= 0) indexes.add(minimumIndex);
      if (maximumIndex >= 0) indexes.add(maximumIndex);
    }
  }

  addRange(Math.max(start, lastFullBlock * DECIMATION_BLOCK_SIZE), end);

  let transitionLow = 0;
  let transitionHigh = transitionIndexes.length;
  while (transitionLow < transitionHigh) {
    const middle = Math.floor((transitionLow + transitionHigh) / 2);
    if (transitionIndexes[middle] < start) transitionLow = middle + 1;
    else transitionHigh = middle;
  }
  for (let cursor = transitionLow; cursor < transitionIndexes.length; cursor += 1) {
    const sampleIndex = transitionIndexes[cursor];
    if (sampleIndex >= end) break;
    indexes.add(sampleIndex);
  }

  return [...indexes].sort((left, right) => left - right).map((sampleIndex) => samples[sampleIndex]);
}

function calculatePhasor(samples, channelIndex, frequency, cursorTimeMs) {
  if (channelIndex === "" || channelIndex === undefined) return null;
  const periodMs = 1000 / frequency;
  const firstTime = samples[0].timeMs;
  const lastTime = samples.at(-1).timeMs;
  const endTime = Math.max(firstTime + periodMs, Math.min(cursorTimeMs, lastTime));
  const startTime = Math.max(firstTime, endTime - periodMs);
  const startIndex = nearestSampleIndex(samples, startTime);
  const segment = [];
  for (let index = startIndex; index < samples.length; index += 1) {
    if (samples[index].timeMs > endTime) break;
    segment.push(samples[index]);
  }
  if (segment.length < 4) return null;

  const mean = segment.reduce((sum, sample) => sum + sample.analog[channelIndex], 0) / segment.length;
  let real = 0;
  let imaginary = 0;
  for (const sample of segment) {
    const angle = (2 * Math.PI * frequency * (sample.timeMs - cursorTimeMs)) / 1000;
    const value = sample.analog[channelIndex] - mean;
    real += value * Math.cos(angle);
    imaginary -= value * Math.sin(angle);
  }
  real = (2 * real) / segment.length;
  imaginary = (2 * imaginary) / segment.length;
  return {
    magnitude: Math.hypot(real, imaginary) / Math.SQRT2,
    angle: (Math.atan2(imaginary, real) * 180) / Math.PI,
  };
}

function calculateRmsSeries(samples, channels, frequency) {
  const periodMs = 1000 / frequency;
  const firstTime = samples[0].timeMs;
  const series = new Map();

  for (const channel of channels) {
    const values = new Float32Array(samples.length);
    let windowStart = 0;
    let sumSquares = 0;

    for (let index = 0; index < samples.length; index += 1) {
      const sampleValue = samples[index].analog[channel.index];
      sumSquares += sampleValue * sampleValue;

      const windowStartTime = samples[index].timeMs - periodMs;
      while (windowStart < index && samples[windowStart].timeMs < windowStartTime) {
        const removedValue = samples[windowStart].analog[channel.index];
        sumSquares -= removedValue * removedValue;
        windowStart += 1;
      }

      if (samples[index].timeMs - firstTime >= periodMs) {
        values[index] = Math.sqrt(Math.max(0, sumSquares) / (index - windowStart + 1));
      } else {
        values[index] = Number.NaN;
      }
    }

    series.set(channel.index, values);
  }

  return series;
}

function PhasorDiagram({
  channels,
  samples,
  frequency,
  cursorTimeMs,
}) {
  const signalChannels = useMemo(
    () => channels
      .filter((channel) => ["current", "voltage"].includes(classifyAnalog(channel)))
      .map((channel, index) => ({
        type: classifyAnalog(channel),
        phaseIndex: index % COLORS.length,
        channel,
      })),
    [channels],
  );
  const [selectedChannelIndexes, setSelectedChannelIndexes] = useState(
    () => new Set(signalChannels.map(({ channel }) => channel.index)),
  );
  const [signalMenuOpen, setSignalMenuOpen] = useState(false);

  const vectors = signalChannels
    .filter(({ channel }) => selectedChannelIndexes.has(channel.index))
    .map((signal) => ({
      ...signal,
      phasor: calculatePhasor(samples, signal.channel.index, frequency, cursorTimeMs),
    }));
  const maximums = {
    current: Math.max(0, ...vectors.filter(({ type, phasor }) => type === "current" && phasor).map(({ phasor }) => phasor.magnitude)),
    voltage: Math.max(0, ...vectors.filter(({ type, phasor }) => type === "voltage" && phasor).map(({ phasor }) => phasor.magnitude)),
  };
  const toggleSignal = (channelIndex) => {
    setSelectedChannelIndexes((current) => {
      const next = new Set(current);
      if (next.has(channelIndex)) next.delete(channelIndex);
      else next.add(channelIndex);
      return next;
    });
  };
  const selectAllSignals = () => {
    setSelectedChannelIndexes(new Set(signalChannels.map(({ channel }) => channel.index)));
  };

  return (
    <section className="rounded border border-[#303943] bg-[#171c22]">
      <div className="relative z-20 border-b border-[#303943] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Diagrama fasorial</h2>
          {signalChannels.length > 0 && (
            <div className="relative">
              <button
                type="button"
                aria-expanded={signalMenuOpen}
                aria-label="Selecionar sinais do diagrama fasorial"
                onClick={() => setSignalMenuOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded border border-[#46515d] bg-[#11161c] px-2 py-1 text-[10px] text-slate-200 hover:bg-[#202832]"
              >
                <Activity size={12} className="text-cyan-400" />
                Sinais
                <span className="rounded bg-cyan-950 px-1 text-cyan-300">
                  {selectedChannelIndexes.size}
                </span>
              </button>
              {signalMenuOpen && (
                <div className="oscilo-signal-menu absolute right-0 top-full z-30 mt-1 max-h-56 w-64 overflow-y-auto rounded border border-[#46515d] bg-[#11161c] p-2 shadow-xl">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-400">Sinais de corrente e tensão:</p>
                    <div className="flex shrink-0 gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={selectAllSignals}
                        className="text-cyan-400 hover:text-cyan-200"
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedChannelIndexes(new Set())}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  {signalChannels.map(({ phaseIndex, channel }) => (
                    <label
                      key={channel.index}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-slate-200 hover:bg-[#202832]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannelIndexes.has(channel.index)}
                        onChange={() => toggleSignal(channel.index)}
                        aria-label={`Exibir ${channel.name}`}
                        className="h-3.5 w-3.5 shrink-0 accent-cyan-500"
                      />
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: COLORS[phaseIndex] }}
                      />
                      <span className="min-w-0 truncate">{channel.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {signalChannels.length === 0 && (
          <p className="mt-2 text-[10px] text-slate-500">Nenhum sinal de corrente ou tensão encontrado.</p>
        )}
      </div>
      <div className="grid items-center gap-2 p-3 xl:grid-cols-[minmax(0,1fr)_145px]">
        <svg viewBox="0 0 300 300" className="mx-auto w-full max-w-[290px]" role="img" aria-label="Diagrama fasorial">
          {[0.33, 0.66, 1].map((scale) => (
            <circle key={scale} cx="150" cy="150" r={scale * 116} fill="none" stroke="var(--oscilo-phasor-grid)" strokeDasharray={scale === 1 ? undefined : "3 4"} />
          ))}
          <line x1="25" y1="150" x2="275" y2="150" stroke="var(--oscilo-axis-color)" />
          <line x1="150" y1="25" x2="150" y2="275" stroke="var(--oscilo-axis-color)" />
          <text x="265" y="143" fill="var(--oscilo-axis-label)" fontSize="10">0°</text>
          <text x="155" y="30" fill="var(--oscilo-axis-label)" fontSize="10">90°</text>
          <text x="20" y="143" fill="var(--oscilo-axis-label)" fontSize="10">180°</text>
          <text x="155" y="278" fill="var(--oscilo-axis-label)" fontSize="10">-90°</text>
          {vectors.map(({ type, phaseIndex, channel, phasor }) => {
            const maximum = maximums[type];
            if (!phasor || maximum === 0) return null;
            const length = (phasor.magnitude / maximum) * 108;
            const angle = (phasor.angle * Math.PI) / 180;
            const x = 150 + length * Math.cos(angle);
            const y = 150 - length * Math.sin(angle);
            const color = COLORS[phaseIndex];
            return (
              <g key={`${type}-${channel.index}`} aria-label={`${channel.name} ${phasor.angle.toFixed(1)} graus`}>
                <line
                  x1="150"
                  y1="150"
                  x2={x}
                  y2={y}
                  stroke={color}
                  strokeWidth={type === "current" ? "3" : "2"}
                  strokeDasharray={type === "voltage" ? "5 4" : undefined}
                />
                {type === "current" ? (
                  <circle cx={x} cy={y} r="4" fill={color} />
                ) : (
                  <rect
                    x={x - 4}
                    y={y - 4}
                    width="8"
                    height="8"
                    fill="none"
                    stroke={color}
                    transform={`rotate(45 ${x} ${y})`}
                  />
                )}
                <text x={x + 6} y={y - 6} fill={color} fontSize="10" fontWeight="bold">
                  {channel.name}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="space-y-1.5">
          {vectors.map(({ type, phaseIndex, channel, phasor }) => (
            <div key={`${type}-${channel.index}`} className="border-t border-[#303943] py-1.5 first:border-0">
              <p className="text-[11px] font-semibold" style={{ color: COLORS[phaseIndex] }}>
                {channel.name}
              </p>
              <p className="font-mono text-[11px] text-slate-300">
                {phasor
                  ? `${phasor.magnitude.toFixed(2)} ${channel.unit} ∠ ${phasor.angle.toFixed(1)}°`
                  : "Sem fasor"}
              </p>
            </div>
          ))}
          {vectors.length === 0 && (
            <p className="text-[11px] text-slate-500">Selecione ao menos um sinal para exibir.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function CursorReadout({
  cursor,
  sample,
  channels,
  digital,
  rmsChannels,
  rmsSeries,
  sampleIndexes,
  onWidthChange,
}) {
  const readoutRef = useRef(null);
  const sampleIndex = sampleIndexes?.get(sample);
  const rmsMeasurements = rmsChannels.flatMap((channel) => {
    const value = sampleIndex === undefined
      ? undefined
      : rmsSeries?.get(channel.index)?.[sampleIndex];
    return Number.isFinite(value) ? [{ channel, value }] : [];
  });

  useLayoutEffect(() => {
    const element = readoutRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(() => {
      onWidthChange(cursor, element.getBoundingClientRect().width);
    });
    observer.observe(element);
    onWidthChange(cursor, element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [cursor, onWidthChange]);

  return (
    <div
      ref={readoutRef}
      className="pointer-events-none min-w-0 rounded border border-[#39434d] bg-[#11161c]/95 p-1.5 text-[9px] shadow"
      style={{ width: "max-content" }}
    >
      <div className="mb-1 whitespace-nowrap font-semibold" style={{ color: CURSOR_COLORS[cursor] }}>
        {cursor} · {sample.timeMs.toFixed(3)} ms
      </div>
      <div className="space-y-0.5">
        {channels.map((channel, index) => (
          <div
            key={channel.index}
            className="grid min-w-0 grid-cols-[8px_max-content_max-content] items-start gap-x-1.5"
          >
            <span
              className="mt-0.5 h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: digital ? COLORS[index % COLORS.length] : phaseColor(channel, index) }}
            />
            <span className="whitespace-nowrap text-slate-300">{channel.name}</span>
            <span className="whitespace-nowrap font-mono text-slate-100">
              {digital
                ? (sample.digital[channel.index] ? "1" : "0")
                : `${sample.analog[channel.index].toFixed(2)}${channel.unit ? ` ${channel.unit}` : ""}`}
            </span>
          </div>
        ))}
        {rmsMeasurements.map(({ channel, value }, index) => (
          <div
            key={`rms-${channel.index}`}
            className="grid min-w-0 grid-cols-[8px_max-content_max-content] items-start gap-x-1.5"
          >
            <span
              className="mt-0.5 h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: phaseColor(channel, index) }}
            />
            <span className="whitespace-nowrap text-slate-300">{channel.name} RMS</span>
            <span className="whitespace-nowrap font-mono text-slate-100">
              {value.toFixed(2)}{channel.unit ? ` ${channel.unit}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CanvasWaveformSeries({
  data,
  digital,
  channels,
  minTime,
  maxTime,
  yDomain,
  yTicks,
  onPlotAreaChange,
  rmsChannels,
  rmsSeries,
  sampleIndexes,
  showRms,
}) {
  const canvasRef = useRef(null);
  const drawnStateRef = useRef(null);
  const plotArea = usePlotArea();

  useLayoutEffect(() => {
    if (!plotArea) return;
    onPlotAreaChange(plotArea);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      canvas.style.transition = "none";
      canvas.style.transform = "none";
      canvas.style.transformOrigin = "0 0";
      const pixelRatio = window.devicePixelRatio || 1;
      const canvasWidth = Math.round(plotArea.width * pixelRatio);
      const canvasHeight = Math.round(plotArea.height * pixelRatio);
      if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
      if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
      canvas.style.width = `${plotArea.width}px`;
      canvas.style.height = `${plotArea.height}px`;

      const context = canvas.getContext("2d");
      if (!context) return;
      const style = getComputedStyle(canvas);
      const gridColor = style.getPropertyValue("--oscilo-grid-color").trim() || "#303943";
      const zeroLineColor = style.getPropertyValue("--oscilo-zero-line-color").trim() || "#64748b";
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, plotArea.width, plotArea.height);
      const timeSpan = maxTime - minTime || 1;
      const valueSpan = yDomain[1] - yDomain[0] || 1;
      const x = (timeMs) => ((timeMs - minTime) / timeSpan) * plotArea.width;
      const y = (value) => plotArea.height - ((value - yDomain[0]) / valueSpan) * plotArea.height;

      yTicks.forEach((value) => {
        const tickY = y(value);
        const zeroLine = !digital && value === 0;
        context.strokeStyle = zeroLine ? zeroLineColor : gridColor;
        context.lineWidth = zeroLine ? 1.25 : 1;
        context.setLineDash(zeroLine ? [] : [3, 4]);
        context.beginPath();
        context.moveTo(0, tickY);
        context.lineTo(plotArea.width, tickY);
        context.stroke();
      });
      context.setLineDash([]);

      if (digital) {
        channels.forEach((channel, channelPosition) => {
          const baseValue = channelPosition * 2.5;
          const baseY = y(baseValue);
          const first = data[0];
          if (!first) return;
          const firstX = x(first.timeMs);
          let previousY = y(baseValue + first.digital[channel.index]);

          context.beginPath();
          context.moveTo(firstX, baseY);
          context.lineTo(firstX, previousY);
          for (let index = 1; index < data.length; index += 1) {
            const sample = data[index];
            const sampleX = x(sample.timeMs);
            const sampleY = y(baseValue + sample.digital[channel.index]);
            context.lineTo(sampleX, previousY);
            context.lineTo(sampleX, sampleY);
            previousY = sampleY;
          }
          const lastX = x(data[data.length - 1].timeMs);
          context.lineTo(lastX, baseY);
          context.closePath();
          context.fillStyle = COLORS[channelPosition % COLORS.length];
          context.globalAlpha = 0.9;
          context.fill();
          context.globalAlpha = 1;
          context.strokeStyle = COLORS[channelPosition % COLORS.length];
          context.lineWidth = 1;
          context.stroke();
        });
      } else {
        channels.forEach((channel, channelPosition) => {
          context.beginPath();
          data.forEach((sample, index) => {
            const sampleX = x(sample.timeMs);
            const sampleY = y(sample.analog[channel.index]);
            if (index === 0) context.moveTo(sampleX, sampleY);
            else context.lineTo(sampleX, sampleY);
          });
          context.strokeStyle = phaseColor(channel, channelPosition);
          context.lineWidth = 1.4;
          context.stroke();
        });

        if (showRms && rmsSeries && sampleIndexes) {
          rmsChannels.forEach((channel, channelPosition) => {
            const values = rmsSeries.get(channel.index);
            if (!values) return;

            context.beginPath();
            let hasPoint = false;
            data.forEach((sample) => {
              const sampleIndex = sampleIndexes.get(sample);
              const value = sampleIndex === undefined ? Number.NaN : values[sampleIndex];
              if (!Number.isFinite(value)) return;
              const sampleX = x(sample.timeMs);
              const sampleY = y(value);
              if (!hasPoint) {
                context.moveTo(sampleX, sampleY);
                hasPoint = true;
              } else {
                context.lineTo(sampleX, sampleY);
              }
            });
            if (!hasPoint) return;
            context.strokeStyle = phaseColor(channel, channelPosition);
            context.lineWidth = 2;
            context.setLineDash([6, 3]);
            context.stroke();
            context.setLineDash([]);
          });
        }
      }

      drawnStateRef.current = {
        data,
        channels,
        rmsChannels,
        minTime,
        maxTime,
        yDomain: [...yDomain],
        width: plotArea.width,
        height: plotArea.height,
        showRms,
        rmsSeries,
      };
    };

    const previous = drawnStateRef.current;
    if (previous && (
      previous.data === data &&
      previous.channels === channels &&
      previous.rmsChannels === rmsChannels &&
      previous.minTime === minTime &&
      previous.maxTime === maxTime &&
      previous.yDomain[0] === yDomain[0] &&
      previous.yDomain[1] === yDomain[1] &&
      previous.width === plotArea.width &&
      previous.height === plotArea.height &&
      previous.showRms === showRms &&
      previous.rmsSeries === rmsSeries
    )) return;

    draw();
  }, [
    data,
    digital,
    channels,
    minTime,
    maxTime,
    yDomain,
    yTicks,
    plotArea,
    onPlotAreaChange,
    rmsChannels,
    rmsSeries,
    sampleIndexes,
    showRms,
  ]);

  if (!plotArea) return null;
  return (
    <foreignObject
      x={plotArea.x}
      y={plotArea.y}
      width={plotArea.width}
      height={plotArea.height}
      pointerEvents="none"
      style={{ overflow: "hidden" }}
    >
      <canvas ref={canvasRef} className="block" />
    </foreignObject>
  );
}

const WaveformPlot = memo(function WaveformPlot({
  data,
  waveformData,
  digital,
  minTime,
  maxTime,
  channels,
  yDomain,
  yTicks,
  onPlotAreaChange,
  rmsChannels,
  rmsSeries,
  sampleIndexes,
  showRms,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {digital ? (
        <AreaChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid stroke="var(--oscilo-grid-color)" strokeDasharray="3 4" />
          <XAxis dataKey="timeMs" type="number" domain={[minTime, maxTime]} tickFormatter={(value) => `${Number(value).toFixed(0)}`} stroke="var(--oscilo-axis-color)" tick={{ fill: "var(--oscilo-axis-label)", fontSize: 10 }} />
          <YAxis type="number" scale="linear" domain={yDomain} ticks={yTicks} width={50} stroke="var(--oscilo-axis-color)" tick={{ fill: "var(--oscilo-axis-text)", fontSize: 9 }} />
          <CanvasWaveformSeries
            data={waveformData}
            channels={channels}
            digital
            minTime={minTime}
            maxTime={maxTime}
            yDomain={yDomain}
            yTicks={yTicks}
            onPlotAreaChange={onPlotAreaChange}
            rmsChannels={rmsChannels}
            rmsSeries={rmsSeries}
            sampleIndexes={sampleIndexes}
            showRms={showRms}
          />
        </AreaChart>
      ) : (
        <LineChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid stroke="var(--oscilo-grid-color)" strokeDasharray="3 4" />
          <XAxis dataKey="timeMs" type="number" domain={[minTime, maxTime]} tickFormatter={(value) => `${Number(value).toFixed(0)}`} stroke="var(--oscilo-axis-color)" tick={{ fill: "var(--oscilo-axis-label)", fontSize: 10 }} />
          <YAxis
            type="number"
            scale="linear"
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={formatAxisValue}
            width={64}
            stroke="var(--oscilo-axis-color)"
            tick={{ fill: "var(--oscilo-axis-text)", fontSize: 10 }}
          />
          <CanvasWaveformSeries
            data={waveformData}
            channels={channels}
            digital={false}
            minTime={minTime}
            maxTime={maxTime}
            yDomain={yDomain}
            yTicks={yTicks}
            onPlotAreaChange={onPlotAreaChange}
            rmsChannels={rmsChannels}
            rmsSeries={rmsSeries}
            sampleIndexes={sampleIndexes}
            showRms={showRms}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
});

function SignalChart({
  title,
  samples,
  channels,
  timeRange,
  cursors,
  activeCursor,
  onCursorChange,
  onZoom,
  onPan,
  eventStartTimeMs,
  showCursorReadouts,
  onCursorInteraction,
  digital = false,
  transitions = NO_TRANSITIONS,
  signalOptions = [],
  rawChannels = channels,
  hiddenSignalChannelIndexes = new Set(),
  selectedRmsChannelIndexes = new Set(),
  onSignalChannelToggle,
  onRmsChannelToggle,
  onSelectAllCurves,
  onClearCurves,
  rmsChannels = [],
  rmsSeries = null,
  sampleIndexes = null,
}) {
  const chartContainerRef = useRef(null);
  const plotRef = useRef(null);
  const yAxisLabelsRef = useRef(null);
  const dragRef = useRef(null);
  const dragTargetRef = useRef(null);
  const animationFrameRef = useRef(null);
  const panFrameRef = useRef(null);
  const pendingCursorRef = useRef(null);
  const pendingPanRef = useRef(null);
  const panRef = useRef(null);
  const suppressNextClickRef = useRef(false);
  const onZoomRef = useRef(onZoom);
  const [rmsMenuOpen, setRmsMenuOpen] = useState(false);
  const showRms = rmsChannels.length > 0;
  const [resolution, setResolution] = useState({ index: null, maxPoints: MAX_CHART_POINTS });
  const [plotWidth, setPlotWidth] = useState(0);
  const [cursorReadoutWidths, setCursorReadoutWidths] = useState({ T1: 0, T2: 0 });
  const decimationIndex = useMemo(() => {
    const getValue = digital
      ? (sample, channel) => channel.index * 2.5 + sample.digital[channel.index]
      : (sample, channel) => sample.analog[channel.index];
    return createDecimationIndex(
      samples,
      channels,
      getValue,
      digital ? transitions : NO_TRANSITIONS,
    );
  }, [samples, channels, digital, transitions]);
  const maxPoints = resolution.index === decimationIndex
    ? resolution.maxPoints
    : MAX_CHART_POINTS;
  const axisData = useMemo(
    () => decimateRange(decimationIndex, timeRange.start, timeRange.end),
    [decimationIndex, timeRange],
  );
  const data = useMemo(
    () => decimateRange(decimationIndex, timeRange.start, timeRange.end, maxPoints),
    [decimationIndex, timeRange, maxPoints],
  );
  const cursorSamples = useMemo(() => ({
    T1: nearestSample(samples, cursors.T1),
    T2: nearestSample(samples, cursors.T2),
  }), [samples, cursors.T1, cursors.T2]);
  const analogScale = useMemo(() => {
    let minimum = Infinity;
    let maximum = -Infinity;
    const includeValue = (value) => {
      if (!Number.isFinite(value)) return;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    };

    for (const sample of data) {
      for (const channel of rawChannels) {
        includeValue(sample.analog[channel.index]);
      }

      if (showRms && rmsSeries && sampleIndexes) {
        const sampleIndex = sampleIndexes.get(sample);
        if (sampleIndex === undefined) continue;
        for (const channel of rmsChannels) {
          includeValue(rmsSeries.get(channel.index)?.[sampleIndex]);
        }
      }
    }

    return createNiceAnalogScale(minimum, maximum);
  }, [data, rawChannels, rmsChannels, rmsSeries, sampleIndexes, showRms]);
  const yDomain = useMemo(
    () => digital ? [0, Math.max(1, rawChannels.length * 2.5)] : analogScale.domain,
    [analogScale, rawChannels.length, digital],
  );
  const yTicks = useMemo(() => (
    digital
      ? rawChannels.map((_, index) => index * 2.5 + 0.5)
      : analogScale.ticks
  ), [analogScale, rawChannels, digital]);
  const updatePlotArea = useCallback((area) => {
    setPlotWidth((current) => current === area.width ? current : area.width);
    const plot = plotRef.current;
    if (plot) {
      plot.style.left = `${area.x}px`;
      plot.style.top = `${area.y}px`;
      plot.style.width = `${area.width}px`;
      plot.style.height = `${area.height}px`;
      plot.style.right = "auto";
      plot.style.bottom = "auto";
    }
    const labels = yAxisLabelsRef.current;
    if (labels) {
      labels.style.top = `${area.y}px`;
      labels.style.width = `${area.x}px`;
      labels.style.height = `${area.height}px`;
    }
  }, []);
  const updateCursorReadoutWidth = useCallback((cursor, width) => {
    setCursorReadoutWidths((current) => current[cursor] === width
      ? current
      : { ...current, [cursor]: width });
  }, []);

  useEffect(() => {
    let currentLimit = MAX_CHART_POINTS;
    let frameId;
    if (samples.length <= currentLimit) return undefined;

    const refineResolution = () => {
      currentLimit = Math.min(samples.length, Math.max(currentLimit + 1, Math.ceil(currentLimit * 1.5)));
      setResolution({ index: decimationIndex, maxPoints: currentLimit });
      if (currentLimit < samples.length) {
        frameId = requestAnimationFrame(refineResolution);
      }
    };

    frameId = requestAnimationFrame(refineResolution);
    return () => cancelAnimationFrame(frameId);
  }, [decimationIndex, samples.length]);
  useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (panFrameRef.current !== null) {
      cancelAnimationFrame(panFrameRef.current);
    }
  }, []);

  useEffect(() => {
    onZoomRef.current = onZoom;
  }, [onZoom]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return undefined;
    const handleWheel = (event) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      const bounds = plotRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width === 0) return;
      const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const deltaY = event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * window.innerHeight
          : event.deltaY;
      onZoomRef.current(deltaY, fraction);
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const queueCursorChange = (cursor, value) => {
    pendingCursorRef.current = { cursor, value };
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const pending = pendingCursorRef.current;
      pendingCursorRef.current = null;
      if (pending) onCursorChange(pending.cursor, pending.value);
    });
  };

  const queuePanChange = (pan, deltaX) => {
    pendingPanRef.current = {
      startRange: pan.startRange,
      deltaX,
      width: pan.width,
    };
    if (panFrameRef.current !== null) return;
    panFrameRef.current = requestAnimationFrame(() => {
      panFrameRef.current = null;
      const pending = pendingPanRef.current;
      pendingPanRef.current = null;
      if (pending) onPan(pending.startRange, pending.deltaX, pending.width);
    });
  };

  const flushPanChange = () => {
    if (panFrameRef.current !== null) {
      cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
    }
    const pending = pendingPanRef.current;
    pendingPanRef.current = null;
    if (pending) onPan(pending.startRange, pending.deltaX, pending.width);
  };

  const cursorFromEvent = (event, cursor = activeCursor, allowOutsidePlot = false) => {
    const bounds = plotRef.current?.getBoundingClientRect();
    if (!bounds) return;
    if (!allowOutsidePlot && (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    queueCursorChange(cursor, timeRange.start + fraction * (timeRange.end - timeRange.start));
  };

  const beginDrag = (event, cursor) => {
    event.preventDefault();
    event.stopPropagation();
    onCursorInteraction(true);
    dragRef.current = cursor;
    dragTargetRef.current = event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
    onCursorChange(cursor, cursors[cursor]);
  };

  const cursorFraction = (cursor) =>
    Math.max(0, Math.min(1, (cursors[cursor] - timeRange.start) / (timeRange.end - timeRange.start || 1)));
  const cursorPercent = (cursor) => `${cursorFraction(cursor) * 100}%`;
  const cursorReadoutTransform = (cursor) => {
    const availableWidth = Math.max(0, plotWidth - 8);
    const cursorX = cursorFraction(cursor) * availableWidth;
    const readoutWidth = cursorReadoutWidths[cursor];
    if (cursor === "T1") {
      return cursorX < readoutWidth + 8
        ? "translateX(8px)"
        : "translateX(calc(-100% - 8px))";
    }
    return cursorX + readoutWidth + 8 > availableWidth
      ? "translateX(calc(-100% - 8px))"
      : "translateX(8px)";
  };
  const cursorStartFraction = cursorFraction("T1");
  const cursorEndFraction = cursorFraction("T2");
  const t2IsRightOfT1 = cursorEndFraction >= cursorStartFraction;
  const cursorLineStart = t2IsRightOfT1 ? cursorStartFraction : cursorEndFraction;
  const cursorLineWidth = Math.abs(cursorEndFraction - cursorStartFraction);
  const cursorDelta = Math.abs(cursors.T2 - cursors.T1);
  const eventStartFraction = eventStartTimeMs === null
    ? null
    : (eventStartTimeMs - timeRange.start) / (timeRange.end - timeRange.start || 1);

  return (
    <section className="overflow-hidden rounded border border-[#303943] bg-[#171c22]">
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[#303943] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-200">{title}</h2>
          {signalOptions.length > 0 && (
            <div className="relative">
              <button
                type="button"
                aria-expanded={rmsMenuOpen}
                aria-label={`Selecionar sinais para o gráfico ${title}`}
                onClick={() => setRmsMenuOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded border border-[#46515d] bg-[#11161c] px-2 py-1 text-[10px] text-slate-200 hover:bg-[#202832]"
              >
                <Activity size={12} className="text-cyan-400" />
                Curvas
                <span className="rounded bg-cyan-950 px-1 text-cyan-300">
                  {rawChannels.length + rmsChannels.length}
                </span>
              </button>
              {rmsMenuOpen && (
                <div className="oscilo-signal-menu absolute left-0 top-full z-30 mt-1 max-h-56 w-64 overflow-y-auto rounded border border-[#46515d] bg-[#11161c] p-2 shadow-xl">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-400">
                      {digital
                        ? "Selecione os sinais binários:"
                        : "Selecione o sinal e/ou RMS:"}
                    </p>
                    <div className="flex shrink-0 gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => onSelectAllCurves(signalOptions)}
                        className="text-cyan-400 hover:text-cyan-200"
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => onClearCurves(signalOptions)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  {signalOptions.map((channel, index) => (
                    <div key={channel.index} className="rounded px-1.5 py-1.5 hover:bg-[#202832]">
                      <p className="mb-1 truncate text-[11px] font-medium text-slate-200">
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: phaseColor(channel, index) }}
                        />
                        {channel.name}{channel.unit ? ` (${channel.unit})` : ""}
                      </p>
                      {digital ? (
                        <label className="inline-flex cursor-pointer items-center gap-1 pl-3.5 text-[10px] text-slate-400">
                          <input
                            type="checkbox"
                            checked={!hiddenSignalChannelIndexes.has(channel.index)}
                            onChange={() => onSignalChannelToggle(channel.index)}
                            aria-label={`Exibir ou ocultar sinal binário ${channel.name}`}
                            className="h-3 w-3 accent-cyan-500"
                          />
                          Sinal
                        </label>
                      ) : (
                        <div className="flex gap-4 pl-3.5 text-[10px] text-slate-400">
                          <label className="inline-flex cursor-pointer items-center gap-1">
                            <input
                              type="checkbox"
                              checked={!hiddenSignalChannelIndexes.has(channel.index)}
                              onChange={() => onSignalChannelToggle(channel.index)}
                              aria-label={`Exibir ou ocultar sinal original ${channel.name}`}
                              className="h-3 w-3 accent-cyan-500"
                            />
                            Sinal
                          </label>
                          <label className="inline-flex cursor-pointer items-center gap-1">
                            <input
                              type="checkbox"
                              checked={selectedRmsChannelIndexes.has(channel.index)}
                              onChange={() => onRmsChannelToggle(channel.index)}
                              aria-label={`Exibir ou ocultar RMS de ${channel.name}`}
                              className="h-3 w-3 accent-cyan-500"
                            />
                            RMS
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
          {rawChannels.map((channel, index) => (
            <span key={channel.index} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: digital ? COLORS[index % COLORS.length] : phaseColor(channel, index) }} />
              {channel.name}{channel.unit ? ` (${channel.unit})` : ""}
            </span>
          ))}
          {showRms && rmsChannels.map((channel, index) => (
            <span key={`rms-${channel.index}`} className="inline-flex items-center gap-1">
              <span className="w-4 border-t-2 border-dashed" style={{ borderColor: phaseColor(channel, index) }} />
              {channel.name} RMS
            </span>
          ))}
        </div>
      </div>
      <div
        ref={chartContainerRef}
        className="relative touch-pan-y"
        style={{ height: 260 }}
        onClick={(event) => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
          }
          if (!dragRef.current) cursorFromEvent(event);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || dragRef.current) return;
          const bounds = plotRef.current?.getBoundingClientRect();
          if (
            !bounds ||
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          panRef.current = {
            startX: event.clientX,
            startRange: timeRange,
            width: bounds.width,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          if (dragRef.current) {
            cursorFromEvent(event, dragRef.current, true);
          } else if (panRef.current) {
            const deltaX = event.clientX - panRef.current.startX;
            if (Math.abs(deltaX) > 2) panRef.current.moved = true;
            if (panRef.current.moved) queuePanChange(panRef.current, deltaX);
          }
        }}
        onPointerUp={(event) => {
          if (dragRef.current) {
            if (pendingCursorRef.current) {
              const pending = pendingCursorRef.current;
              pendingCursorRef.current = null;
              onCursorChange(pending.cursor, pending.value);
            }
            if (animationFrameRef.current !== null) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
            dragRef.current = null;
            if (dragTargetRef.current?.hasPointerCapture(event.pointerId)) {
              dragTargetRef.current.releasePointerCapture(event.pointerId);
            }
            dragTargetRef.current = null;
          }
          if (panRef.current) {
            suppressNextClickRef.current = panRef.current.moved;
            flushPanChange();
            panRef.current = null;
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          dragRef.current = null;
          if (dragTargetRef.current?.hasPointerCapture(event.pointerId)) {
            dragTargetRef.current.releasePointerCapture(event.pointerId);
          }
          dragTargetRef.current = null;
          pendingCursorRef.current = null;
          if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          panRef.current = null;
          suppressNextClickRef.current = false;
          pendingPanRef.current = null;
          if (panFrameRef.current !== null) {
            cancelAnimationFrame(panFrameRef.current);
            panFrameRef.current = null;
          }
        }}
      >
        <WaveformPlot
          data={axisData}
          waveformData={data}
          digital={digital}
          minTime={timeRange.start}
          maxTime={timeRange.end}
          channels={rawChannels}
          yDomain={yDomain}
          yTicks={yTicks}
          onPlotAreaChange={updatePlotArea}
          rmsChannels={rmsChannels}
          rmsSeries={rmsSeries}
          sampleIndexes={sampleIndexes}
          showRms={showRms}
        />
        <div
          ref={yAxisLabelsRef}
          className="pointer-events-none absolute left-0 overflow-hidden"
          style={{ top: CHART_MARGIN.top }}
        >
          {yTicks.map((value, index) => {
            const label = digital ? rawChannels[index]?.name ?? "" : formatAxisValue(value);
            const position = ((yDomain[1] - value) / (yDomain[1] - yDomain[0] || 1)) * 100;
            const verticalAlignment = digital
              ? "-50%"
              : index === 0
                ? "-100%"
                : index === yTicks.length - 1
                  ? "0%"
                  : "-50%";
            return (
              <span
                key={`${value}-${index}`}
                title={digital ? label : undefined}
                className={`absolute right-2 whitespace-nowrap text-right text-slate-300 ${digital ? "max-w-full overflow-hidden text-ellipsis text-[9px]" : "text-[10px]"}`}
                style={{ top: `${position}%`, transform: `translateY(${verticalAlignment})` }}
              >
                {label}
              </span>
            );
          })}
        </div>
        <div
          ref={plotRef}
          className="pointer-events-none absolute"
          style={{
            left: CHART_MARGIN.left,
            right: CHART_MARGIN.right,
            top: CHART_MARGIN.top,
            bottom: CHART_MARGIN.bottom + 28,
          }}
          onPointerDown={(event) => {
            if (event.target === plotRef.current) event.stopPropagation();
          }}
        >
          {eventStartFraction !== null && eventStartFraction >= 0 && eventStartFraction <= 1 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-10 w-[2px] -translate-x-1/2 border-l-2 border-dashed border-red-500"
              style={{ left: `${eventStartFraction * 100}%` }}
            />
          )}
          {cursorLineWidth > 0 && (
            <div
              className="pointer-events-none absolute z-10"
              style={{
                left: t2IsRightOfT1
                  ? `${cursorLineStart * 100}%`
                  : `calc(${cursorLineStart * 100}% - ${CURSOR_HANDLE_HALF_WIDTH_PX}px)`,
                width: t2IsRightOfT1
                  ? `max(0px, calc(${cursorLineWidth * 100}% - ${CURSOR_HANDLE_HALF_WIDTH_PX}px))`
                  : `calc(${cursorLineWidth * 100}% + ${CURSOR_HANDLE_HALF_WIDTH_PX}px)`,
                top: "calc(100% - 8px)",
              }}
            >
              <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#9ca3af]" />
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm border border-[#4b5563] bg-[#171c22] px-1 text-[10px] text-slate-300">
                {cursorDelta.toFixed(3)} ms
              </span>
            </div>
          )}
          {showCursorReadouts && (
            <div className="pointer-events-none absolute inset-x-1 top-1 z-10">
              {["T1", "T2"].map((cursor) => (
                <div
                  key={cursor}
                  className="absolute top-0"
                  style={{
                    left: cursorPercent(cursor),
                    transform: cursorReadoutTransform(cursor),
                  }}
                >
                  <CursorReadout
                    cursor={cursor}
                    sample={cursorSamples[cursor]}
                    channels={rawChannels}
                    digital={digital}
                    rmsChannels={rmsChannels}
                    rmsSeries={rmsSeries}
                    sampleIndexes={sampleIndexes}
                    onWidthChange={updateCursorReadoutWidth}
                  />
                </div>
              ))}
            </div>
          )}
          {["T1", "T2"].map((cursor) => (
            <button
              key={cursor}
              type="button"
              data-cursor-readout-trigger="true"
              aria-label={`Arrastar cursor ${cursor}`}
              onClick={(event) => {
                event.stopPropagation();
                onCursorInteraction(true);
              }}
              aria-pressed={activeCursor === cursor}
              onPointerDown={(event) => beginDrag(event, cursor)}
              className="pointer-events-auto absolute top-0 h-full w-4 -translate-x-1/2 cursor-ew-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{
                left: cursorPercent(cursor),
              }}
            >
              <span
                className="pointer-events-none absolute left-1/2 top-0 h-full -translate-x-1/2 border-l-2 border-dashed"
                style={{ borderColor: CURSOR_COLORS[cursor] }}
              />
              <span className="absolute -left-[13px] bottom-0 rounded-sm px-1 text-[9px] font-bold text-black" style={{ backgroundColor: CURSOR_COLORS[cursor] }}>{cursor}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Oscilo({ onVoltar }) {
  const [files, setFiles] = useState({ cfg: null, dat: null });
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const loadRequestRef = useRef(0);
  const recordRef = useRef(record);
  const zoomFrameRef = useRef(null);
  const pendingZoomRef = useRef([]);
  const [cursors, setCursors] = useState({ T1: 0, T2: 0 });
  const [timeRange, setTimeRange] = useState({ start: 0, end: 1 });
  const timeRangeRef = useRef(timeRange);
  const [activeCursor, setActiveCursor] = useState("T1");
  const [showCursorReadouts, setShowCursorReadouts] = useState(false);
  const [hiddenSignalChannelIndexes, setHiddenSignalChannelIndexes] = useState(() => new Set());
  const [hiddenDigitalChannelIndexes, setHiddenDigitalChannelIndexes] = useState(() => new Set());
  const [selectedRmsChannelIndexes, setSelectedRmsChannelIndexes] = useState(() => new Set());
  const [rightPanelRatio, setRightPanelRatio] = useState(1 / 2.8);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [lightTheme, setLightTheme] = useState(true);
  const chartLayoutRef = useRef(null);
  const resizingColumnsRef = useRef(false);

  const clearQueuedZoom = () => {
    if (zoomFrameRef.current !== null) {
      cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = null;
    }
    pendingZoomRef.current = [];
  };

  const resizePanelsAt = (clientX) => {
    const bounds = chartLayoutRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const availableWidth = bounds.width - 32;
    if (availableWidth <= 0) return;

    const maxRatio = Math.min(0.65, (availableWidth - 320) / availableWidth);
    const minRatio = Math.min(maxRatio, Math.max(0.25, 340 / availableWidth));
    const rightWidth = bounds.right - clientX - 16;
    setRightPanelRatio(Math.max(minRatio, Math.min(maxRatio, rightWidth / availableWidth)));
  };

  const handlePanelResizeKeyDown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    setRightPanelRatio((current) => Math.max(0.25, Math.min(0.65, current + direction * 0.02)));
  };

  useEffect(() => () => {
    if (zoomFrameRef.current !== null) {
      cancelAnimationFrame(zoomFrameRef.current);
    }
  }, []);

  useEffect(() => {
    const hideCursorReadouts = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-cursor-readout-trigger='true']")) return;
      setShowCursorReadouts(false);
    };
    document.addEventListener("pointerdown", hideCursorReadouts);
    return () => document.removeEventListener("pointerdown", hideCursorReadouts);
  }, []);

  useLayoutEffect(() => {
    recordRef.current = record;
    pendingZoomRef.current = [];
    if (zoomFrameRef.current !== null) {
      cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = null;
    }
  }, [record]);

  const loadRecord = async (filePair) => {
    const requestId = ++loadRequestRef.current;
    clearQueuedZoom();
    if (filePair.cfg.name.replace(/\.cfg$/i, "").toLowerCase() !== filePair.dat.name.replace(/\.dat$/i, "").toLowerCase()) {
      setLoading(false);
      setError("Os nomes dos arquivos CFG e DAT não correspondem.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [configText, dataBuffer] = await Promise.all([filePair.cfg.text(), filePair.dat.arrayBuffer()]);
      const config = parseCfg(configText);
      const parsed = parseDat(dataBuffer, config);
      if (requestId !== loadRequestRef.current) return;
      const changedDigitalIndexes = new Set(parsed.changedDigitalIndexes);
      setHiddenDigitalChannelIndexes(new Set(
        config.digitalChannels
          .filter((channel) => !changedDigitalIndexes.has(channel.index))
          .map((channel) => channel.index),
      ));
      setRecord({ config, ...parsed });
      setCursors({
        T1: parsed.triggerTimeMs ?? 0,
        T2: parsed.timeSpanMs,
      });
      const initialRange = { start: 0, end: parsed.timeSpanMs };
      timeRangeRef.current = initialRange;
      setTimeRange(initialRange);
    } catch (loadError) {
      if (requestId !== loadRequestRef.current) return;
      setRecord(null);
      setError(loadError instanceof Error ? loadError.message : "Não foi possível ler os arquivos.");
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  };

  const handleFiles = (selectedFiles) => {
    loadRequestRef.current += 1;
    clearQueuedZoom();
    const next = { ...files };
    for (const file of selectedFiles) {
      const extension = file.name.split(".").at(-1).toLowerCase();
      if (extension === "cfg") next.cfg = file;
      if (extension === "dat") next.dat = file;
    }
    setFiles(next);
    setRecord(null);
    setHiddenSignalChannelIndexes(new Set());
    setHiddenDigitalChannelIndexes(new Set());
    setSelectedRmsChannelIndexes(new Set());
    setError("");

    if (next.cfg && next.dat) {
      void loadRecord(next);
    } else {
      loadRequestRef.current += 1;
      setLoading(false);
    }
  };

  const groups = useMemo(() => {
    if (!record) return { current: [], voltage: [], other: [] };
    return record.config.analogChannels.reduce(
      (result, channel) => {
        result[classifyAnalog(channel)].push(channel);
        return result;
      },
      { current: [], voltage: [], other: [] },
    );
  }, [record]);

  const selectedRmsChannels = useMemo(
    () => record
      ? record.config.analogChannels.filter((channel) => selectedRmsChannelIndexes.has(channel.index))
      : [],
    [record, selectedRmsChannelIndexes],
  );
  const selectedCurrentRmsChannels = useMemo(
    () => selectedRmsChannels.filter((channel) => classifyAnalog(channel) === "current"),
    [selectedRmsChannels],
  );
  const selectedVoltageRmsChannels = useMemo(
    () => selectedRmsChannels.filter((channel) => classifyAnalog(channel) === "voltage"),
    [selectedRmsChannels],
  );
  const selectedOtherRmsChannels = useMemo(
    () => selectedRmsChannels.filter((channel) => classifyAnalog(channel) === "other"),
    [selectedRmsChannels],
  );
  const rmsSampleIndexes = useMemo(() => {
    if (!record || selectedRmsChannels.length === 0) return null;
    const indexes = new WeakMap();
    record.samples.forEach((sample, index) => indexes.set(sample, index));
    return indexes;
  }, [record, selectedRmsChannels]);
  const rmsSeries = useMemo(
    () => record && selectedRmsChannels.length > 0
      ? calculateRmsSeries(record.samples, selectedRmsChannels, record.config.frequency)
      : null,
    [record, selectedRmsChannels],
  );

  const eventStartTimeMs = useMemo(
    () => record ? findTripStartTime(record) : null,
    [record],
  );
  const hasAnalogChannels = groups.current.length + groups.voltage.length > 0;

  const toggleRmsChannel = (channelIndex) => {
    setSelectedRmsChannelIndexes((current) => {
      const next = new Set(current);
      if (next.has(channelIndex)) next.delete(channelIndex);
      else next.add(channelIndex);
      return next;
    });
  };
  const toggleSignalChannel = (channelIndex) => {
    setHiddenSignalChannelIndexes((current) => {
      const next = new Set(current);
      if (next.has(channelIndex)) next.delete(channelIndex);
      else next.add(channelIndex);
      return next;
    });
  };
  const toggleDigitalChannel = (channelIndex) => {
    setHiddenDigitalChannelIndexes((current) => {
      const next = new Set(current);
      if (next.has(channelIndex)) next.delete(channelIndex);
      else next.add(channelIndex);
      return next;
    });
  };
  const setAnalogCurvesVisible = (channels, visible) => {
    const channelIndexes = channels.map((channel) => channel.index);
    setHiddenSignalChannelIndexes((current) => {
      const next = new Set(current);
      for (const index of channelIndexes) {
        if (visible) next.delete(index);
        else next.add(index);
      }
      return next;
    });
    setSelectedRmsChannelIndexes((current) => {
      const next = new Set(current);
      for (const index of channelIndexes) {
        if (visible) next.add(index);
        else next.delete(index);
      }
      return next;
    });
  };
  const setDigitalCurvesVisible = (channels, visible) => {
    setHiddenDigitalChannelIndexes((current) => {
      const next = new Set(current);
      for (const channel of channels) {
        if (visible) next.delete(channel.index);
        else next.add(channel.index);
      }
      return next;
    });
  };

  const changeCursor = (cursor, value) => {
    setActiveCursor(cursor);
    setCursors((previous) => ({
      ...previous,
      [cursor]: Math.max(0, Math.min(record?.timeSpanMs ?? value, value)),
    }));
  };

  const zoomTimeRange = (deltaY, anchorFraction) => {
    if (!record || record.timeSpanMs <= 0) return;
    const duration = record.timeSpanMs;
    const sampleInterval = record.samples.length > 1
      ? record.samples[1].timeMs - record.samples[0].timeMs
      : duration;
    const minWidth = Math.min(duration, Math.max(sampleInterval * 2, duration / 10000));
    pendingZoomRef.current.push({ deltaY, anchorFraction });
    const zoomRecord = record;
    if (zoomFrameRef.current === null) {
      zoomFrameRef.current = requestAnimationFrame(() => {
        zoomFrameRef.current = null;
        const zooms = pendingZoomRef.current;
        pendingZoomRef.current = [];
        if (recordRef.current !== zoomRecord) return;

        const target = zooms.reduce((range, zoom) => {
          const factor = Math.exp(Math.max(-300, Math.min(300, zoom.deltaY)) * 0.001);
          const currentWidth = range.end - range.start;
          const nextWidth = Math.max(minWidth, Math.min(duration, currentWidth * factor));
          const anchor = range.start + currentWidth * zoom.anchorFraction;
          const start = Math.max(
            0,
            Math.min(duration - nextWidth, anchor - nextWidth * zoom.anchorFraction),
          );
          return { start, end: start + nextWidth };
        }, timeRangeRef.current);
        if (target.start === timeRangeRef.current.start && target.end === timeRangeRef.current.end) return;
        timeRangeRef.current = target;
        setTimeRange(target);
      });
    }
  };

  const panTimeRange = (startRange, deltaX, plotWidth) => {
    if (!record || plotWidth <= 0) return;
    clearQueuedZoom();
    const duration = record.timeSpanMs;
    const rangeWidth = startRange.end - startRange.start;
    const offset = -(deltaX / plotWidth) * rangeWidth;
    const start = Math.max(
      0,
      Math.min(duration - rangeWidth, startRange.start + offset),
    );
    const next = { start, end: start + rangeWidth };
    timeRangeRef.current = next;
    startTransition(() => setTimeRange(next));
  };

  const resetTimeRange = () => {
    if (!record) return;
    clearQueuedZoom();
    const next = { start: 0, end: record.timeSpanMs };
    timeRangeRef.current = next;
    setTimeRange(next);
  };

  useEffect(() => {
    if (!record) return undefined;

    const handleCursorKeys = (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      if (target instanceof HTMLInputElement && target.type !== "range") return;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

      let cursor = activeCursor;
      if (target instanceof HTMLInputElement && target.type === "range") {
        cursor = target.getAttribute("aria-label")?.endsWith("T2") ? "T2" : "T1";
      }

      event.preventDefault();
      const currentIndex = nearestSampleIndex(record.samples, cursors[cursor]);
      const increment = event.shiftKey ? 10 : 1;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = Math.max(
        0,
        Math.min(record.samples.length - 1, currentIndex + direction * increment),
      );
      setActiveCursor(cursor);
      setCursors((previous) => ({
        ...previous,
        [cursor]: record.samples[nextIndex].timeMs,
      }));
    };

    window.addEventListener("keydown", handleCursorKeys);
    return () => window.removeEventListener("keydown", handleCursorKeys);
  }, [record, activeCursor, cursors]);

  const clearRecord = () => {
    loadRequestRef.current += 1;
    clearQueuedZoom();
    setLoading(false);
    setFiles({ cfg: null, dat: null });
    setRecord(null);
    setHiddenSignalChannelIndexes(new Set());
    setHiddenDigitalChannelIndexes(new Set());
    setSelectedRmsChannelIndexes(new Set());
    setContext("");
    setError("");
  };

  return (
    <div className={`app-scrollbar fixed inset-0 z-[100] h-dvh w-screen ${record || error ? "overflow-y-auto" : "overflow-y-hidden"} bg-[#0d1116] p-3 text-slate-100 sm:p-5 ${lightTheme ? "oscilo-theme-light" : ""}`}>
      <div className="mx-0 w-full space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#303943] pb-3">
          <div className="flex items-center gap-3">
            {onVoltar && (
              <button
                type="button"
                onClick={onVoltar}
                aria-label="Voltar ao menu principal"
                className="rounded border border-[#46515d] p-2 text-slate-300 hover:bg-[#202832] hover:text-white"
              >
                <ArrowLeft size={17} />
              </button>
            )}
            <div className="rounded bg-[#1d2935] p-2 text-cyan-400"><Activity size={21} /></div>
            <div>
              <h1 className="text-lg font-bold tracking-wide text-white sm:text-xl">Leitor de Oscilografia</h1>
              <p className="text-xs text-slate-400">
                {record
                  ? `${record.config.station} · ${record.samples.length.toLocaleString("pt-BR")} amostras · ${record.config.frequency} Hz`
                  : "Visualizador COMTRADE · os dados permanecem neste navegador"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-[#46515d] bg-[#171c22] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-[#202832]">
              <FileUp size={15} className="text-cyan-400" />
              {files.cfg || files.dat ? "Trocar arquivos" : "Abrir COMTRADE"}
              <input
                type="file"
                accept=".cfg,.dat"
                multiple
                className="sr-only"
                onChange={(event) => {
                  handleFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </label>
            {loading && (
              <span role="status" className="inline-flex items-center gap-2 px-2 text-xs text-cyan-300">
                <Upload size={14} className="animate-pulse" /> Lendo COMTRADE...
              </span>
            )}
            <button
              type="button"
              aria-label={lightTheme ? "Ativar tema escuro" : "Ativar tema claro"}
              aria-pressed={lightTheme}
              onClick={() => setLightTheme((current) => !current)}
              className="inline-flex items-center gap-2 rounded border border-[#46515d] bg-[#171c22] px-3 py-2 text-xs text-slate-300 hover:bg-[#202832] hover:text-white"
            >
              {lightTheme ? <Moon size={14} /> : <Sun size={14} />}
              {lightTheme ? "Tema escuro" : "Tema claro"}
            </button>
            {record && (timeRange.start > 0 || timeRange.end < record.timeSpanMs) && (
              <button
                type="button"
                onClick={resetTimeRange}
                className="inline-flex items-center gap-2 rounded border border-[#46515d] px-3 py-2 text-xs text-slate-300 hover:bg-[#202832]"
              >
                <Maximize2 size={14} /> Mostrar todo o registro
              </button>
            )}
            {record && (
              <button type="button" onClick={clearRecord} className="inline-flex items-center gap-2 rounded border border-[#46515d] px-3 py-2 text-xs text-slate-300 hover:bg-[#202832]">
                <RotateCcw size={14} /> Limpar
              </button>
            )}
          </div>
        </header>

        {(files.cfg || files.dat) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 rounded border border-[#303943] bg-[#14191f] px-3 py-2 text-[11px] text-slate-400">
            <span>CFG: <span className="text-slate-200">{files.cfg?.name ?? "não selecionado"}</span></span>
            <span>DAT: <span className="text-slate-200">{files.dat?.name ?? "não selecionado"}</span></span>
            {record && (
              <button
                type="button"
                aria-pressed={rightPanelVisible}
                onClick={() => setRightPanelVisible((visible) => !visible)}
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded border border-[#46515d] bg-[#171c22] px-2.5 py-1 text-[11px] text-slate-300 hover:bg-[#202832] hover:text-white"
              >
                {rightPanelVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                {rightPanelVisible ? "Ocultar painel" : "Exibir painel"}
              </button>
            )}
            {!loading && !record && !error && (
              <span className="basis-full text-amber-300">Selecione o arquivo {files.cfg ? ".DAT" : ".CFG"} correspondente para iniciar a leitura.</span>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded border border-red-900 bg-red-950/60 p-3 text-sm text-red-200">
            <AlertCircle size={17} /> {error}
          </div>
        )}
        {!record && !error && (
          <label className="flex min-h-48 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-[#46515d] bg-[#14191f] text-slate-400 hover:border-cyan-600 hover:text-slate-200">
            <input
              type="file"
              accept=".cfg,.dat"
              multiple
              className="sr-only"
              onChange={(event) => {
                handleFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <Upload size={25} className="text-cyan-500" />
            <span className="text-sm font-semibold">Selecione o par de arquivos .CFG e .DAT</span>
            <span className="text-xs">Os nomes-base dos dois arquivos devem coincidir.</span>
          </label>
        )}

        {record && (
          <>
            <div
              ref={chartLayoutRef}
              className={`grid grid-cols-1 items-start gap-3 ${rightPanelVisible ? "oscilo-resizable-grid" : ""}`}
              style={{
                "--oscilo-left-panel-fr": `${1 - rightPanelRatio}fr`,
                "--oscilo-right-panel-fr": `${rightPanelRatio}fr`,
              }}
            >
              <div className="space-y-3">
                {(groups.current.length > 0 || groups.other.length > 0) && (
                  <SignalChart
                    title={groups.current.length ? "Correntes" : "Outros sinais analógicos"}
                    samples={record.samples}
                    channels={groups.current.length ? groups.current : groups.other}
                    rawChannels={(groups.current.length ? groups.current : groups.other)
                      .filter((channel) => !hiddenSignalChannelIndexes.has(channel.index))}
                    signalOptions={groups.current.length ? groups.current : groups.other}
                    hiddenSignalChannelIndexes={hiddenSignalChannelIndexes}
                    selectedRmsChannelIndexes={selectedRmsChannelIndexes}
                    onSignalChannelToggle={toggleSignalChannel}
                    onRmsChannelToggle={toggleRmsChannel}
                    onSelectAllCurves={(channels) => setAnalogCurvesVisible(channels, true)}
                    onClearCurves={(channels) => setAnalogCurvesVisible(channels, false)}
                    rmsChannels={groups.current.length ? selectedCurrentRmsChannels : selectedOtherRmsChannels}
                    rmsSeries={rmsSeries}
                    sampleIndexes={rmsSampleIndexes}
                    timeRange={timeRange}
                    cursors={cursors}
                    activeCursor={activeCursor}
                    onCursorChange={changeCursor}
                    onZoom={zoomTimeRange}
                    onPan={panTimeRange}
                    eventStartTimeMs={eventStartTimeMs}
                    showCursorReadouts={showCursorReadouts}
                    onCursorInteraction={setShowCursorReadouts}
                  />
                )}
                {groups.voltage.length > 0 && (
                  <SignalChart
                    title="Tensões"
                    samples={record.samples}
                    channels={groups.voltage}
                    rawChannels={groups.voltage
                      .filter((channel) => !hiddenSignalChannelIndexes.has(channel.index))}
                    signalOptions={groups.voltage}
                    hiddenSignalChannelIndexes={hiddenSignalChannelIndexes}
                    selectedRmsChannelIndexes={selectedRmsChannelIndexes}
                    onSignalChannelToggle={toggleSignalChannel}
                    onRmsChannelToggle={toggleRmsChannel}
                    onSelectAllCurves={(channels) => setAnalogCurvesVisible(channels, true)}
                    onClearCurves={(channels) => setAnalogCurvesVisible(channels, false)}
                    rmsChannels={selectedVoltageRmsChannels}
                    rmsSeries={rmsSeries}
                    sampleIndexes={rmsSampleIndexes}
                    timeRange={timeRange}
                    cursors={cursors}
                    activeCursor={activeCursor}
                    onCursorChange={changeCursor}
                    onZoom={zoomTimeRange}
                    onPan={panTimeRange}
                    eventStartTimeMs={eventStartTimeMs}
                    showCursorReadouts={showCursorReadouts}
                    onCursorInteraction={setShowCursorReadouts}
                  />
                )}
                {groups.current.length > 0 && groups.other.length > 0 && (
                  <SignalChart
                    title="Outros sinais analógicos"
                    samples={record.samples}
                    channels={groups.other}
                    rawChannels={groups.other
                      .filter((channel) => !hiddenSignalChannelIndexes.has(channel.index))}
                    signalOptions={groups.other}
                    hiddenSignalChannelIndexes={hiddenSignalChannelIndexes}
                    selectedRmsChannelIndexes={selectedRmsChannelIndexes}
                    onSignalChannelToggle={toggleSignalChannel}
                    onRmsChannelToggle={toggleRmsChannel}
                    onSelectAllCurves={(channels) => setAnalogCurvesVisible(channels, true)}
                    onClearCurves={(channels) => setAnalogCurvesVisible(channels, false)}
                    rmsChannels={selectedOtherRmsChannels}
                    rmsSeries={rmsSeries}
                    sampleIndexes={rmsSampleIndexes}
                    timeRange={timeRange}
                    cursors={cursors}
                    activeCursor={activeCursor}
                    onCursorChange={changeCursor}
                    onZoom={zoomTimeRange}
                    onPan={panTimeRange}
                    eventStartTimeMs={eventStartTimeMs}
                    showCursorReadouts={showCursorReadouts}
                    onCursorInteraction={setShowCursorReadouts}
                  />
                )}
                {record.config.digitalChannels.length > 0 && (
                  <SignalChart
                    title="Entradas e saídas binárias"
                    samples={record.samples}
                    channels={record.config.digitalChannels}
                    rawChannels={record.config.digitalChannels
                      .filter((channel) => !hiddenDigitalChannelIndexes.has(channel.index))}
                    signalOptions={record.config.digitalChannels}
                    hiddenSignalChannelIndexes={hiddenDigitalChannelIndexes}
                    onSignalChannelToggle={toggleDigitalChannel}
                    onSelectAllCurves={(channels) => setDigitalCurvesVisible(channels, true)}
                    onClearCurves={(channels) => setDigitalCurvesVisible(channels, false)}
                    transitions={record.transitions}
                    digital
                    timeRange={timeRange}
                    cursors={cursors}
                    activeCursor={activeCursor}
                    onCursorChange={changeCursor}
                    onZoom={zoomTimeRange}
                    onPan={panTimeRange}
                    eventStartTimeMs={eventStartTimeMs}
                    showCursorReadouts={showCursorReadouts}
                    onCursorInteraction={setShowCursorReadouts}
                  />
                )}
                {record.config.digitalChannels.length > 0 && record.transitions.length === 0 && (
                  <section className="rounded border border-[#303943] bg-[#171c22] px-3 py-2 text-xs text-slate-400">
                    Nenhum canal binário mudou de estado durante o registro.
                  </section>
                )}
              </div>

              {rightPanelVisible && (
                <div
                  role="separator"
                  aria-label="Redimensionar área dos gráficos e painel lateral"
                  aria-orientation="vertical"
                  aria-valuemin={25}
                  aria-valuemax={65}
                  aria-valuenow={Math.round(rightPanelRatio * 100)}
                  tabIndex={0}
                  onKeyDown={handlePanelResizeKeyDown}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    resizingColumnsRef.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    resizePanelsAt(event.clientX);
                  }}
                  onPointerMove={(event) => {
                    if (resizingColumnsRef.current) resizePanelsAt(event.clientX);
                  }}
                  onPointerUp={(event) => {
                    resizingColumnsRef.current = false;
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                  }}
                  onPointerCancel={() => {
                    resizingColumnsRef.current = false;
                  }}
                  className="hidden h-full min-h-48 cursor-col-resize touch-none items-center justify-center rounded hover:bg-[#202832] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 xl:flex"
                >
                  <span className="h-10 w-1 rounded-full bg-[#46515d]" />
                </div>
              )}

              {rightPanelVisible && (
                <aside className="space-y-3">
                  {hasAnalogChannels && (
                    <PhasorDiagram
                      key={`${files.cfg?.name ?? ""}:${files.cfg?.lastModified ?? 0}:${files.dat?.name ?? ""}:${files.dat?.lastModified ?? 0}`}
                      channels={record.config.analogChannels}
                      samples={record.samples}
                      frequency={record.config.frequency}
                      cursorTimeMs={cursors[activeCursor]}
                    />
                  )}
                  <details className="rounded border border-[#303943] bg-[#171c22]">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-200">Contexto e análise do evento</summary>
                    <div className="space-y-3 border-t border-[#303943] p-3">
                      <label htmlFor="event-context" className="block text-xs text-slate-400">Descreva as condições do sistema e o contexto do evento.</label>
                      <textarea id="event-context" value={context} onChange={(event) => setContext(event.target.value)} rows={3} className="w-full rounded border border-[#46515d] bg-[#0f1318] p-2 text-sm text-slate-100 outline-none focus:border-cyan-600" />
                      <div className="flex items-start gap-2 text-xs text-slate-400">
                        <LockKeyhole size={15} className="mt-0.5 shrink-0" />
                        <p>Arquivos e contexto são processados localmente. A ferramenta de IA ainda não está configurada e nenhum dado será enviado.</p>
                      </div>
                      <button type="button" disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded bg-[#303943] px-3 py-2 text-xs text-slate-500">
                        <Bot size={14} /> Análise por IA indisponível
                      </button>
                    </div>
                  </details>
                </aside>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Oscilo;
