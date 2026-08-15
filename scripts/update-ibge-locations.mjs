import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATES_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome';
const CITIES_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome&view=nivelado';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(
  scriptDirectory,
  '../apps/mobile/src/features/locations/data/brazil-locations.json',
);

function getSnapshotDate() {
  const argument = process.argv.find((value) => value.startsWith('--snapshot-date='));
  const date = argument?.slice('--snapshot-date='.length) ?? new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Use --snapshot-date=AAAA-MM-DD.');
  }

  return date;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`O IBGE respondeu ${response.status} para ${url}`);
  }

  return response.json();
}

function compareNames(left, right) {
  return left.localeCompare(right, 'pt-BR', { sensitivity: 'base' });
}

function buildSnapshot(rawStates, rawCities, snapshotDate) {
  if (!Array.isArray(rawStates) || rawStates.length !== 27) {
    throw new Error(`Esperadas 27 UFs; recebidas ${rawStates?.length ?? 0}.`);
  }
  if (!Array.isArray(rawCities) || rawCities.length < 5_500) {
    throw new Error(`Esperados pelo menos 5.500 municípios; recebidos ${rawCities?.length ?? 0}.`);
  }

  const stateCodes = new Set();
  const stateIds = new Set();
  const states = rawStates
    .map((state) => {
      const id = Number(state.id);
      const code = String(state.sigla ?? '').toUpperCase();
      const name = String(state.nome ?? '').trim();

      if (!Number.isInteger(id) || !/^[A-Z]{2}$/.test(code) || name.length < 2) {
        throw new Error(`UF inválida recebida do IBGE: ${JSON.stringify(state)}`);
      }
      if (stateCodes.has(code) || stateIds.has(id)) {
        throw new Error(`UF duplicada recebida do IBGE: ${code}/${id}`);
      }

      stateCodes.add(code);
      stateIds.add(id);
      return [id, code, name];
    })
    .sort((left, right) => compareNames(left[2], right[2]) || left[0] - right[0]);

  const citiesByState = Object.fromEntries(states.map(([, code]) => [code, []]));
  const cityIds = new Set();

  for (const city of rawCities) {
    const id = Number(city['municipio-id']);
    const name = String(city['municipio-nome'] ?? '').trim();
    const stateCode = String(city['UF-sigla'] ?? '').toUpperCase();

    if (!Number.isInteger(id) || name.length < 2 || !stateCodes.has(stateCode)) {
      throw new Error(`Município inválido recebido do IBGE: ${JSON.stringify(city)}`);
    }
    if (cityIds.has(id)) {
      throw new Error(`Código de município duplicado recebido do IBGE: ${id}`);
    }

    cityIds.add(id);
    citiesByState[stateCode].push([id, name]);
  }

  for (const cities of Object.values(citiesByState)) {
    cities.sort((left, right) => compareNames(left[1], right[1]) || left[0] - right[0]);
  }

  return {
    metadata: {
      schemaVersion: 1,
      snapshotDate,
      source: 'Instituto Brasileiro de Geografia e Estatística (IBGE)',
      sourceUrls: [STATES_URL, CITIES_URL],
      stateCount: states.length,
      cityCount: cityIds.size,
    },
    states,
    citiesByState,
  };
}

async function main() {
  const snapshotDate = getSnapshotDate();
  const [rawStates, rawCities] = await Promise.all([
    fetchJson(STATES_URL),
    fetchJson(CITIES_URL),
  ]);
  const snapshot = buildSnapshot(rawStates, rawCities, snapshotDate);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, 'utf8');

  console.log(
    `Snapshot IBGE salvo: ${snapshot.metadata.stateCount} UFs, ` +
      `${snapshot.metadata.cityCount} municípios (${outputPath}).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
