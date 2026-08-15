import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { getBrazilianState, getBrazilianStates, getCitiesByState } from '../location-catalog';
import type {
  BrazilianCity,
  BrazilianState,
  LocationDraft,
  LocationFieldErrors,
} from '../types';
import { SearchSelectField, type SearchSelectOption } from './search-select-field';

type StateSelectOption = SearchSelectOption & { state: BrazilianState };
type CitySelectOption = SearchSelectOption & { city: BrazilianCity };

const stateOptions: readonly StateSelectOption[] = getBrazilianStates().map((state) => ({
  key: state.code,
  label: `${state.name} (${state.code})`,
  searchText: `${state.code} ${state.name}`,
  state,
}));

type LocationFieldsProps = {
  value: LocationDraft;
  onChange: (value: LocationDraft) => void;
  errors?: LocationFieldErrors;
  disabled?: boolean;
  testID?: string;
};

export function LocationFields({
  value,
  onChange,
  errors,
  disabled = false,
  testID = 'location',
}: LocationFieldsProps) {
  const selectedState = getBrazilianState(value.stateCode);
  const cityOptions = useMemo<readonly CitySelectOption[]>(
    () =>
      getCitiesByState(value.stateCode).map((city) => ({
        key: String(city.id),
        label: city.name,
        searchText: city.name,
        city,
      })),
    [value.stateCode],
  );

  function selectState(option: StateSelectOption) {
    const stateChanged = option.state.code !== value.stateCode;
    onChange({
      stateCode: option.state.code,
      stateName: option.state.name,
      cityId: stateChanged ? null : value.cityId,
      cityName: stateChanged ? '' : value.cityName,
    });
  }

  function selectCity(option: CitySelectOption) {
    if (!selectedState || option.city.stateCode !== selectedState.code) return;
    onChange({
      stateCode: selectedState.code,
      stateName: selectedState.name,
      cityId: option.city.id,
      cityName: option.city.name,
    });
  }

  return (
    <View style={styles.container}>
      <SearchSelectField
        error={errors?.state}
        label="UF"
        onSelect={selectState}
        options={stateOptions}
        placeholder="Selecione o estado"
        searchPlaceholder="Busque por nome ou sigla"
        selectedKey={selectedState?.code}
        selectedLabel={selectedState ? `${selectedState.name} (${selectedState.code})` : undefined}
        testID={`${testID}-state`}
        disabled={disabled}
      />
      <SearchSelectField
        disabled={disabled || !selectedState}
        disabledHint={!selectedState ? 'Selecione a UF primeiro.' : undefined}
        emptyMessage="Nenhuma cidade encontrada nesta UF."
        error={errors?.city}
        label="Cidade"
        onSelect={selectCity}
        options={cityOptions}
        placeholder="Selecione a cidade"
        searchPlaceholder="Busque a cidade"
        selectedKey={value.cityId === null ? undefined : String(value.cityId)}
        selectedLabel={value.cityName || undefined}
        testID={`${testID}-city`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
});
