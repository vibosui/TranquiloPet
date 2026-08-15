import type { CareService, PetSize, PetSpecies } from '@/core/domain/entities';

export const careServiceOptions: readonly { value: CareService; label: string }[] = [
  { value: 'boarding', label: 'Hospedagem' },
  { value: 'daycare', label: 'Creche durante o dia' },
  { value: 'home_visit', label: 'Visita na casa do tutor' },
  { value: 'walking', label: 'Passeio' },
];

export const acceptedSpeciesOptions: readonly { value: PetSpecies; label: string }[] = [
  { value: 'dog', label: 'Cachorros' },
  { value: 'cat', label: 'Gatos' },
  { value: 'bird', label: 'Aves' },
  { value: 'other', label: 'Outros' },
];

export const acceptedSizeOptions: readonly { value: PetSize; label: string }[] = [
  { value: 'small', label: 'Pequeno' },
  { value: 'medium', label: 'Médio' },
  { value: 'large', label: 'Grande' },
  { value: 'giant', label: 'Gigante' },
];

export const availabilityOptions = [
  { value: 'weekdays', label: 'Dias úteis' },
  { value: 'weekends', label: 'Finais de semana' },
  { value: 'mornings', label: 'Manhãs' },
  { value: 'afternoons', label: 'Tardes' },
  { value: 'evenings', label: 'Noites' },
] as const;
