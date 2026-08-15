import { fireEvent, render } from '@testing-library/react-native';

import { TagSelector } from '@/components/tag-selector';

const options = [
  { value: 'anxious', label: 'Ansioso' },
  { value: 'energetic', label: 'Enérgico' },
  { value: 'calm', label: 'Calmo' },
];

describe('<TagSelector />', () => {
  test('adds and removes a selected tag', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <TagSelector
        label="Comportamento"
        onChange={onChange}
        options={options}
        selectedValues={['anxious']}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Ansioso' }).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Ansioso' }));
    expect(onChange).toHaveBeenLastCalledWith([]);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Enérgico' }));
    expect(onChange).toHaveBeenLastCalledWith(['anxious', 'energetic']);
  });

  test('replaces the selected value directly for a single choice', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <TagSelector
        label="Espécie"
        maxSelected={1}
        onChange={onChange}
        options={options}
        selectedValues={['anxious']}
      />,
    );

    const currentOption = screen.getByRole('radio', { name: 'Ansioso' });
    const replacementOption = screen.getByRole('radio', { name: 'Enérgico' });
    expect(currentOption.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true, selected: true }),
    );
    expect(replacementOption.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );

    await fireEvent.press(replacementOption);
    expect(onChange).toHaveBeenCalledWith(['energetic']);
  });

  test('keeps the limit behavior for multiple choices', async () => {
    const screen = await render(
      <TagSelector
        label="Comportamento"
        maxSelected={2}
        onChange={jest.fn()}
        options={options}
        selectedValues={['anxious', 'energetic']}
      />,
    );

    expect(screen.getByLabelText('Calmo').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});
