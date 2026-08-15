export type BrazilianState = Readonly<{
  id: number;
  code: string;
  name: string;
}>;

export type BrazilianCity = Readonly<{
  id: number;
  name: string;
  stateCode: string;
}>;

export type LocationDraft = {
  stateCode: string;
  stateName: string;
  cityId: number | null;
  cityName: string;
};

export type LocationFieldErrors = Partial<Record<'state' | 'city', string>>;

export const emptyLocationDraft: LocationDraft = {
  stateCode: '',
  stateName: '',
  cityId: null,
  cityName: '',
};

export type LocationCatalogMetadata = Readonly<{
  schemaVersion: number;
  snapshotDate: string;
  source: string;
  sourceUrls: readonly string[];
  stateCount: number;
  cityCount: number;
}>;
