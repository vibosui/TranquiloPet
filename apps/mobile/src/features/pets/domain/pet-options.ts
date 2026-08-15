import type {
  PetBehaviorTag,
  PetCareTag,
  PetSize,
  PetSpecies,
} from '@/core/domain/entities';

export const petSpeciesOptions: readonly { value: PetSpecies; label: string }[] = [
  { value: 'dog', label: 'Cachorro' },
  { value: 'cat', label: 'Gato' },
  { value: 'bird', label: 'Ave' },
  { value: 'other', label: 'Outro' },
];

export const petSizeOptions: readonly { value: PetSize; label: string }[] = [
  { value: 'small', label: 'Pequeno' },
  { value: 'medium', label: 'Médio' },
  { value: 'large', label: 'Grande' },
  { value: 'giant', label: 'Gigante' },
];

export const petCareOptions: readonly { value: PetCareTag; label: string }[] = [
  { value: 'special_needs', label: 'Necessita cuidados especiais' },
  { value: 'medication', label: 'Precisa de medicação' },
  { value: 'special_diet', label: 'Dieta especial' },
  { value: 'allergies', label: 'Possui alergias' },
  { value: 'mobility_support', label: 'Mobilidade reduzida' },
  { value: 'senior', label: 'Pet idoso' },
  { value: 'postoperative', label: 'Pós-operatório' },
  { value: 'frequent_supervision', label: 'Supervisão frequente' },
];

export const petBehaviorOptions: readonly { value: PetBehaviorTag; label: string }[] = [
  { value: 'anxious', label: 'Ansioso' },
  { value: 'affectionate', label: 'Muito apegado / carente' },
  { value: 'hyperactive', label: 'Energético / hiperativo' },
  { value: 'reactive_to_animals', label: 'Reativo com outros animais' },
  { value: 'fearful', label: 'Medroso / timido' },
  { value: 'territorial', label: 'Territorial' },
  { value: 'sociable', label: 'Sociável' },
  { value: 'calm', label: 'Calmo' },
  { value: 'escape_risk', label: 'Tende a fugir' },
  { value: 'resource_guarding', label: 'Protege comida ou brinquedos' },
];

export function labelForOption<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}
