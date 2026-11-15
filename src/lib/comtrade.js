const parseNumber = (value, fallback = 0) => {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const splitCsv = (line) =>
  line.split(",").map((value) => value.trim().replace(/^"(.*)"$/, "$1"));

const parseTimestamp = (value, revision) => {
  const [date, time = "00:00:00"] = value.split(",");
  const dateParts = date.split(/[/-]/).map(Number);
  if (dateParts.length !== 3 || dateParts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [year, month, day] =
    revision >= 2013
      ? dateParts
      : [dateParts[2], dateParts[1], dateParts[0]];
  const timeParts = time.split(":");
  const seconds = Number(timeParts[2] ?? 0);
  const milliseconds = Number((seconds % 1).toFixed(6)) * 1000;
  const wholeSeconds = Math.floor(seconds);
  const [hours, minutes] = timeParts.map((part) => Number(part));

  return Date.UTC(year, month - 1, day, hours, minutes, wholeSeconds, milliseconds);
};

export function parseCfg(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.length < 10) {
    throw new Error("O arquivo CFG está incompleto ou inválido.");
  }

  const station = splitCsv(lines[0]);
  const counts = splitCsv(lines[1]);
  const revision = parseNumber(station[2], 1999);
  const analogCount = parseNumber(counts[1]?.replace(/[Aa]$/, ""));
  const digitalCount = parseNumber(counts[2]?.replace(/[Dd]$/, ""));

  if (!Number.isInteger(analogCount) || analogCount < 1 ||
      !Number.isInteger(digitalCount) || digitalCount < 0) {
    throw new Error("O CFG não informa uma quantidade válida de canais.");
  }

  let cursor = 2;
  const analogChannels = [];

  for (let index = 0; index < analogCount; index += 1, cursor += 1) {
    const fields = splitCsv(lines[cursor] ?? "");
    if (fields.length < 6) {
      throw new Error(`Definição inválida do canal analógico ${index + 1} no CFG.`);
    }

    analogChannels.push({
      index,
      name: fields[1] || `Analógico ${index + 1}`,
      phase: fields[2] || "",
      unit: fields[4] || "",
      a: parseNumber(fields[5], 1),
      b: parseNumber(fields[6]),
    });
  }

  const digitalChannels = [];
  for (let index = 0; index < digitalCount; index += 1, cursor += 1) {
    const fields = splitCsv(lines[cursor] ?? "");
    if (fields.length < 2) {
      throw new Error(`Definição inválida do canal digital ${index + 1} no CFG.`);
    }

    digitalChannels.push({
      index,
      name: fields[1] || `Digital ${index + 1}`,
      phase: fields[2] || "",
    });
  }

  const frequency = parseNumber(lines[cursor]);
  cursor += 1;
  const rateCount = parseNumber(lines[cursor]);
  cursor += 1;
  const samplingRates = [];

  for (let index = 0; index < rateCount; index += 1, cursor += 1) {
    const fields = splitCsv(lines[cursor] ?? "");
    samplingRates.push({
      rate: parseNumber(fields[0]),
      endSample: parseNumber(fields[1]),
    });
  }

  const startTimestampText = (lines[cursor++] ?? "").trim();
  const triggerTimestampText = (lines[cursor++] ?? "").trim();
  const dataFormat = (lines[cursor++] ?? "ASCII").trim().toUpperCase();
  const timeMultiplier = parseNumber(lines[cursor], 1) || 1;
  const startTimestamp = parseTimestamp(startTimestampText, revision);
  const triggerTimestamp = parseTimestamp(triggerTimestampText, revision);

  if (!["ASCII", "BINARY", "BINARY32", "FLOAT32"].includes(dataFormat)) {
    throw new Error(`Formato DAT não suportado: ${dataFormat}.`);
  }

  return {
    station: station[0] || "Estação",
    revision,
    analogChannels,
    digitalChannels,
    frequency: frequency > 0 ? frequency : 60,
    samplingRates,
    startTimestamp,
    triggerTimestamp,
    dataFormat,
    timeMultiplier,
  };
}

const toPhysicalValue = (raw, channel, isFloat) =>
  isFloat ? raw : raw * channel.a + channel.b;

const getDigitalState = (view, offset, channelIndex) => {
  const word = Math.floor(channelIndex / 16);
  const bit = channelIndex % 16;
  const wordOffset = offset + word * 2;
  if (wordOffset + 2 > view.byteLength) return 0;
  return (view.getUint16(wordOffset, true) >> bit) & 1;
};

export function parseDat(buffer, config) {
  const analogCount = config.analogChannels.length;
  const digitalCount = config.digitalChannels.length;
  const samples = [];

  if (config.dataFormat === "ASCII") {
    const text = new TextDecoder("windows-1252").decode(buffer);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const fields = splitCsv(line);
      if (fields.length < analogCount + digitalCount + 2) {
        throw new Error("O DAT ASCII contém uma linha de amostras incompleta.");
      }

      const sampleNumber = parseNumber(fields[0], samples.length + 1);
      const timestamp = parseNumber(fields[1]);
      let cursor = 2;
      const analog = config.analogChannels.map((channel) =>
        toPhysicalValue(parseNumber(fields[cursor++]), channel, false),
      );
      const digital = config.digitalChannels.map(() =>
        parseNumber(fields[cursor++]) ? 1 : 0,
      );
      samples.push({ sampleNumber, timestamp, analog, digital });
    }
  } else {
    const view = new DataView(buffer);
    const is32Bit = config.dataFormat === "BINARY32" ||
      config.dataFormat === "FLOAT32";
    const isFloat = config.dataFormat === "FLOAT32";
    const analogByteWidth = is32Bit ? 4 : 2;
    const digitalWordCount = Math.ceil(digitalCount / 16);
    const recordSize = 8 + analogCount * analogByteWidth + digitalWordCount * 2;

    if (view.byteLength % recordSize !== 0) {
      throw new Error("O tamanho do DAT binário não corresponde aos canais do CFG.");
    }

    for (let offset = 0; offset < view.byteLength; offset += recordSize) {
      const sampleNumber = view.getUint32(offset, true);
      const timestamp = view.getUint32(offset + 4, true);
      let cursor = offset + 8;
      const analog = config.analogChannels.map((channel) => {
        const raw = is32Bit
          ? isFloat
            ? view.getFloat32(cursor, true)
            : view.getInt32(cursor, true)
          : view.getInt16(cursor, true);
        cursor += analogByteWidth;
        return toPhysicalValue(raw, channel, isFloat);
      });
      const digitalOffset = cursor;
      const digital = config.digitalChannels.map((channel) =>
        getDigitalState(view, digitalOffset, channel.index),
      );
      samples.push({ sampleNumber, timestamp, analog, digital });
    }
  }

  if (samples.length === 0) {
    throw new Error("O arquivo DAT não contém amostras.");
  }

  const firstTimestamp = samples[0].timestamp;
  const hasTimestamps = samples.some((sample) => sample.timestamp !== firstTimestamp);
  const triggerOffsetMs =
    config.startTimestamp !== null && config.triggerTimestamp !== null
      ? config.triggerTimestamp - config.startTimestamp
      : null;

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    sample.timeMs =
      hasTimestamps
        ? ((sample.timestamp - firstTimestamp) * config.timeMultiplier) / 1000
        : ((sample.sampleNumber - samples[0].sampleNumber) /
            (config.samplingRates[0]?.rate || config.frequency)) *
          1000;
  }

  const transitions = [];
  const changedDigitalIndexes = new Set();
  for (let sampleIndex = 1; sampleIndex < samples.length; sampleIndex += 1) {
    const previous = samples[sampleIndex - 1];
    const current = samples[sampleIndex];
    for (let channelIndex = 0; channelIndex < digitalCount; channelIndex += 1) {
      if (previous.digital[channelIndex] !== current.digital[channelIndex]) {
        changedDigitalIndexes.add(channelIndex);
        transitions.push({
          channelIndex,
          timeMs: current.timeMs,
          state: current.digital[channelIndex],
          sampleNumber: current.sampleNumber,
        });
      }
    }
  }

  const timeSpanMs = samples.at(-1).timeMs - samples[0].timeMs;
  const triggerTimeMs =
    triggerOffsetMs === null
      ? null
      : Math.max(0, Math.min(timeSpanMs, triggerOffsetMs));

  return {
    samples,
    transitions,
    changedDigitalIndexes: [...changedDigitalIndexes],
    triggerTimeMs,
    timeSpanMs,
  };
}
