import { fireEvent, render } from '@testing-library/react-native';

import { LocationFields } from '../components/location-fields';
import { emptyLocationDraft, type LocationDraft } from '../types';

describe('LocationFields', () => {
  it('solicita a UF antes de habilitar a cidade', async () => {
    const screen = await render(<LocationFields onChange={jest.fn()} value={emptyLocationDraft} />);

    expect(screen.getByText('UF')).toBeTruthy();
    expect(screen.getByText('Cidade')).toBeTruthy();
    expect(screen.getByTestId('location-city-trigger').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByText('Selecione a UF primeiro.')).toBeTruthy();
  });

  it('preenche a UF selecionada e mantém a cidade vazia', async () => {
    const onChange = jest.fn();
    const screen = await render(<LocationFields onChange={onChange} value={emptyLocationDraft} />);

    await fireEvent.press(screen.getByTestId('location-state-trigger'));
    await fireEvent.changeText(screen.getByTestId('location-state-search'), 'santa catarina');
    await fireEvent.press(screen.getByTestId('location-state-option-SC'));

    expect(onChange).toHaveBeenCalledWith({
      stateCode: 'SC',
      stateName: 'Santa Catarina',
      cityId: null,
      cityName: '',
    });
  });

  it('seleciona somente cidades pertencentes à UF atual', async () => {
    const onChange = jest.fn();
    const value: LocationDraft = {
      stateCode: 'SC',
      stateName: 'Santa Catarina',
      cityId: null,
      cityName: '',
    };
    const screen = await render(<LocationFields onChange={onChange} value={value} />);

    await fireEvent.press(screen.getByTestId('location-city-trigger'));
    await fireEvent.changeText(screen.getByTestId('location-city-search'), 'rio do sul');
    await fireEvent.press(screen.getByTestId('location-city-option-4214805'));

    expect(onChange).toHaveBeenCalledWith({
      stateCode: 'SC',
      stateName: 'Santa Catarina',
      cityId: 4214805,
      cityName: 'Rio do Sul',
    });
  });

  it('limpa a cidade ao trocar a UF', async () => {
    const onChange = jest.fn();
    const value: LocationDraft = {
      stateCode: 'SC',
      stateName: 'Santa Catarina',
      cityId: 4214805,
      cityName: 'Rio do Sul',
    };
    const screen = await render(<LocationFields onChange={onChange} value={value} />);

    await fireEvent.press(screen.getByTestId('location-state-trigger'));
    await fireEvent.changeText(screen.getByTestId('location-state-search'), 'parana');
    await fireEvent.press(screen.getByTestId('location-state-option-PR'));

    expect(onChange).toHaveBeenCalledWith({
      stateCode: 'PR',
      stateName: 'Paraná',
      cityId: null,
      cityName: '',
    });
  });

  it('exibe mensagens distintas nos campos de UF e cidade', async () => {
    const value: LocationDraft = {
      stateCode: 'SC',
      stateName: 'Santa Catarina',
      cityId: null,
      cityName: '',
    };
    const screen = await render(
      <LocationFields
        errors={{ city: 'Escolha uma cidade desta UF.' }}
        onChange={jest.fn()}
        value={value}
      />,
    );

    expect(screen.getByText('Escolha uma cidade desta UF.')).toBeTruthy();
    expect(screen.queryByText('Escolha uma UF válida.')).toBeNull();

    await screen.rerender(
      <LocationFields
        errors={{ state: 'Escolha uma UF válida.' }}
        onChange={jest.fn()}
        value={emptyLocationDraft}
      />,
    );
    expect(screen.getByText('Escolha uma UF válida.')).toBeTruthy();
    expect(screen.queryByText('Escolha uma cidade desta UF.')).toBeNull();
  });
});
