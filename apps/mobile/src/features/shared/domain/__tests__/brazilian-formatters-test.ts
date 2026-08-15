import {
  formatBrazilianPhone,
  formatCpf,
  isValidCpf,
  normalizeEmail,
  normalizeMultilineText,
  normalizeText,
} from '@/features/shared/domain/brazilian-formatters';

describe('Brazilian formatters', () => {
  test('normalizes user-entered text and email', () => {
    expect(normalizeText('  Ana   Souza ')).toBe('Ana Souza');
    expect(normalizeEmail(' ANA@EXAMPLE.COM ')).toBe('ana@example.com');
  });

  test('formats phone and CPF progressively', () => {
    expect(formatBrazilianPhone('479999912345')).toBe('(47) 99999-1234');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });

  test('validates CPF check digits and rejects repeated digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-24')).toBe(false);
  });

  test('preserves intentional paragraphs while normalizing whitespace', () => {
    expect(normalizeMultilineText('  Primeira   linha\r\n\r\n\r\n Segunda linha  ')).toBe(
      'Primeira linha\n\nSegunda linha',
    );
  });
});
