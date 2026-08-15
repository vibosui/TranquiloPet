import {
  filterLocationOptions,
  getBrazilianState,
  getBrazilianStates,
  getCitiesByState,
  getCityById,
  isValidLocationDraft,
  locationCatalogMetadata,
  normalizeLocationSearch,
  validateLocationDraft,
} from '../location-catalog';

describe('catálogo brasileiro de localidades', () => {
  it('contém o snapshot íntegro do IBGE', () => {
    const states = getBrazilianStates();
    const cities = states.flatMap((state) => getCitiesByState(state.code));

    expect(locationCatalogMetadata).toMatchObject({
      schemaVersion: 1,
      stateCount: 27,
      cityCount: 5571,
      source: 'Instituto Brasileiro de Geografia e Estatística (IBGE)',
    });
    expect(states).toHaveLength(27);
    expect(cities).toHaveLength(5571);
    expect(new Set(states.map((state) => state.id)).size).toBe(states.length);
    expect(new Set(states.map((state) => state.code)).size).toBe(states.length);
    expect(new Set(cities.map((city) => city.id)).size).toBe(cities.length);
    expect(cities.every((city) => getBrazilianState(city.stateCode))).toBe(true);
  });

  it('consulta estados e cidades pelos identificadores oficiais', () => {
    expect(getBrazilianState(' sc ')).toEqual({ id: 42, code: 'SC', name: 'Santa Catarina' });

    const rioDoSul = getCitiesByState('SC').find((city) => city.name === 'Rio do Sul');
    expect(rioDoSul).toEqual({ id: 4214805, name: 'Rio do Sul', stateCode: 'SC' });
    expect(getCityById('SC', 4214805)).toEqual(rioDoSul);
    expect(getCitiesByState('XX')).toEqual([]);
  });

  it('normaliza caixa, espaços e acentos para a busca', () => {
    expect(normalizeLocationSearch('  SÃO   José  ')).toBe('sao jose');

    const matches = filterLocationOptions(
      getCitiesByState('SP'),
      'sao jose',
      (city) => city.name,
      10,
    );

    expect(matches.map((city) => city.name)).toEqual([
      'São José da Bela Vista',
      'São José do Barreiro',
      'São José do Rio Pardo',
      'São José do Rio Preto',
      'São José dos Campos',
    ]);
  });

  it('busca UF por nome ou sigla e respeita o limite', () => {
    const matches = filterLocationOptions(
      getBrazilianStates(),
      'sc',
      (state) => `${state.code} ${state.name}`,
      1,
    );

    expect(matches).toEqual([{ id: 42, code: 'SC', name: 'Santa Catarina' }]);
  });

  it('valida a associação entre UF, nome e município', () => {
    expect(
      isValidLocationDraft({
        stateCode: 'SC',
        stateName: 'Santa Catarina',
        cityId: 4214805,
        cityName: 'Rio do Sul',
      }),
    ).toBe(true);
    expect(
      isValidLocationDraft({
        stateCode: 'PR',
        stateName: 'Paraná',
        cityId: 4214805,
        cityName: 'Rio do Sul',
      }),
    ).toBe(false);
  });

  it('atribui o erro ao campo de UF antes de validar a cidade', () => {
    expect(validateLocationDraft({ stateCode: '', stateName: '', cityId: null, cityName: '' }))
      .toEqual({ state: 'Selecione uma UF válida na lista.' });

    expect(
      validateLocationDraft({
        stateCode: 'XX',
        stateName: 'Estado inexistente',
        cityId: 4214805,
        cityName: 'Rio do Sul',
      }),
    ).toEqual({ state: 'Selecione uma UF válida na lista.' });
  });

  it('atribui somente à cidade o erro de município ausente ou incompatível', () => {
    expect(
      validateLocationDraft({
        stateCode: 'SC',
        stateName: 'Santa Catarina',
        cityId: null,
        cityName: '',
      }),
    ).toEqual({ city: 'Selecione uma cidade válida para a UF escolhida.' });

    expect(
      validateLocationDraft({
        stateCode: 'PR',
        stateName: 'Paraná',
        cityId: 4214805,
        cityName: 'Rio do Sul',
      }),
    ).toEqual({ city: 'Selecione uma cidade válida para a UF escolhida.' });
  });
});
