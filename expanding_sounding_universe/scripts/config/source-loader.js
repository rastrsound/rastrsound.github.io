const requiredColumns = Object.freeze(["name", "audio", "ra", "dec"]);

const parseCsv = text => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field.trim());
      if (row.some(value => value !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV-tiedostossa on sulkematon lainausmerkki.");
  }
  row.push(field.trim());
  if (row.some(value => value !== "")) {
    rows.push(row);
  }
  return rows;
};

const parseSexagesimal = (value, rightAscension, rowNumber) => {
  const normalized = value.trim().replaceAll("−", "-");
  if (!normalized.includes(":")) {
    const degrees = Number(normalized);
    if (!Number.isFinite(degrees)) {
      throw new Error(`Rivi ${rowNumber}: koordinaatti "${value}" ei ole kelvollinen.`);
    }
    return degrees;
  }

  const parts = normalized.split(":");
  if (parts.length !== 3 || parts.some(part => part.trim() === "")) {
    throw new Error(`Rivi ${rowNumber}: koordinaatti "${value}" ei ole kelvollinen.`);
  }
  const sign = parts[0].trim().startsWith("-") ? -1 : 1;
  const units = Math.abs(Number(parts[0]));
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);
  if (
    ![units, minutes, seconds].every(Number.isFinite)
    || minutes < 0
    || minutes >= 60
    || seconds < 0
    || seconds >= 60
  ) {
    throw new Error(`Rivi ${rowNumber}: koordinaatti "${value}" ei ole kelvollinen.`);
  }
  const decimal = sign * (units + minutes / 60 + seconds / 3600);
  return rightAscension ? decimal * 15 : decimal;
};

const validateCoordinate = (value, minimum, maximum, label, rowNumber) => {
  if (value < minimum || value > maximum) {
    throw new Error(`Rivi ${rowNumber}: ${label} ei ole välillä ${minimum}–${maximum} astetta.`);
  }
  return value;
};

const sourceId = filename => filename
  .replace(/\.[^.]+$/, "")
  .normalize("NFKD")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .toUpperCase();

export const parseSources = text => {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("sources.csv ei sisällä yhtään kohdetta.");
  }

  const headers = rows[0].map(header => header.toLowerCase());
  requiredColumns.forEach(column => {
    if (!headers.includes(column)) {
      throw new Error(`sources.csv: sarake "${column}" puuttuu.`);
    }
  });
  const indexes = Object.fromEntries(requiredColumns.map(column => [column, headers.indexOf(column)]));
  const identifiers = new Set();
  const sources = rows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    const name = row[indexes.name]?.trim();
    const audioFile = row[indexes.audio]?.trim();
    const rightAscensionText = row[indexes.ra]?.trim();
    const declinationText = row[indexes.dec]?.trim();
    if (!name || !audioFile || !rightAscensionText || !declinationText) {
      throw new Error(`Rivi ${rowNumber}: name, audio, ra ja dec ovat pakollisia.`);
    }
    if (audioFile.includes("/") || audioFile.includes("\\") || !audioFile.toLowerCase().endsWith(".mp3")) {
      throw new Error(`Rivi ${rowNumber}: audio-tiedoston pitää olla data-kansiossa oleva MP3-tiedosto.`);
    }
    const id = sourceId(audioFile);
    if (!id || identifiers.has(id)) {
      throw new Error(`Rivi ${rowNumber}: audio-tiedoston tunniste ei ole yksilöllinen.`);
    }
    identifiers.add(id);
    const rightAscension = parseSexagesimal(rightAscensionText, true, rowNumber);
    if (rightAscension < 0 || rightAscension >= 360) {
      throw new Error(`Rivi ${rowNumber}: RA ei ole välillä 0–360 astetta.`);
    }
    const declination = validateCoordinate(
      parseSexagesimal(declinationText, false, rowNumber),
      -90,
      90,
      "Dec",
      rowNumber
    );
    return Object.freeze({
      id,
      name,
      rightAscension,
      declination,
      audio: `./data/${audioFile}`
    });
  });
  return Object.freeze(sources);
};

export const loadSources = async url => {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Kohdeluetteloa ei voitu ladata (${response.status}).`);
  }
  return parseSources(await response.text());
};
