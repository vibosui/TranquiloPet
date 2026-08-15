import snapshotJson from './data/brazil-locations.json';
import type {
  BrazilianCity,
  BrazilianState,
  LocationCatalogMetadata,
  LocationDraft,
  LocationFieldErrors,
} from './types';

type RawState = [id: number, code: string, name: string];
type RawCity = [id: number, name: string];
type RawSnapshot = {
  metadata: LocationCatalogMetadata;
  states: RawState[];
  citiesByState: Record<string, RawCity[]>;
};

const snapshot = snapshotJson as unknown as RawSnapshot;

export const locationCatalogMetadata: LocationCatalogMetadata = Object.freeze({
  ...snapshot.metadata,
  sourceUrls: Object.freeze([...snapshot.metadata.sourceUrls]),
});

const states: readonly BrazilianState[] = Object.freeze(
  snapshot.states.map(([id, code, name]) => Object.freeze({ id, code, name })),
);

const statesByCode = new Map(states.map((state) => [state.code, state]));
const citiesByState = new Map<string, readonly BrazilianCity[]>();

for (const state of states) {
  const rawCities = snapshot.citiesByState[state.code] ?? [];
  citiesByState.set(
    state.code,
    Object.freeze(
      rawCities.map(([id, name]) => Object.freeze({ id, name, stateCode: state.code })),
    ),
  );
}

export function normalizeLocationSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

export function filterLocationOptions<T>(
  options: readonly T[],
  query: string,
  getSearchText: (option: T) => string,
  limit = Number.POSITIVE_INFINITY,
) {
  const normalizedQuery = normalizeLocationSearch(query);
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : options.length;

  if (!normalizedQuery) return options.slice(0, safeLimit);

  const prefixMatches: T[] = [];
  const wordMatches: T[] = [];
  const otherMatches: T[] = [];

  for (const option of options) {
    const searchableText = normalizeLocationSearch(getSearchText(option));
    if (!searchableText.includes(normalizedQuery)) continue;

    if (searchableText.startsWith(normalizedQuery)) {
      prefixMatches.push(option);
    } else if (searchableText.includes(` ${normalizedQuery}`)) {
      wordMatches.push(option);
    } else {
      otherMatches.push(option);
    }
  }

  return [...prefixMatches, ...wordMatches, ...otherMatches].slice(0, safeLimit);
}

export function getBrazilianStates() {
  return states;
}

export function getBrazilianState(stateCode: string) {
  return statesByCode.get(stateCode.trim().toUpperCase());
}

export function getCitiesByState(stateCode: string) {
  return citiesByState.get(stateCode.trim().toUpperCase()) ?? [];
}

export function getCityById(stateCode: string, cityId: number | null) {
  if (cityId === null) return undefined;
  return getCitiesByState(stateCode).find((city) => city.id === cityId);
}

export function isValidLocationDraft(location: LocationDraft) {
  return Object.keys(validateLocationDraft(location)).length === 0;
}

export function validateLocationDraft(location: LocationDraft): LocationFieldErrors {
  const state = getBrazilianState(location.stateCode);
  if (!state || state.name !== location.stateName) {
    return { state: 'Selecione uma UF válida na lista.' };
  }

  const city = getCityById(state.code, location.cityId);
  if (!city || city.name !== location.cityName) {
    return { city: 'Selecione uma cidade válida para a UF escolhida.' };
  }

  return {};
}
