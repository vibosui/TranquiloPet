import {
  emptyPhotoCollection,
  type AppDatabase,
  type Location,
  type Pet,
  type PetBehaviorTag,
  type PetCareTag,
  type PetSpecies,
  type PetSize,
  type User,
} from '@/core/domain/entities';

const SEED_TIMESTAMP = '2026-01-01T12:00:00.000Z';

const locations: Location[] = [
  {
    stateIbgeId: '35',
    stateCode: 'SP',
    stateName: 'São Paulo',
    cityIbgeId: '3550308',
    cityName: 'São Paulo',
  },
  {
    stateIbgeId: '33',
    stateCode: 'RJ',
    stateName: 'Rio de Janeiro',
    cityIbgeId: '3304557',
    cityName: 'Rio de Janeiro',
  },
  {
    stateIbgeId: '31',
    stateCode: 'MG',
    stateName: 'Minas Gerais',
    cityIbgeId: '3106200',
    cityName: 'Belo Horizonte',
  },
  {
    stateIbgeId: '42',
    stateCode: 'SC',
    stateName: 'Santa Catarina',
    cityIbgeId: '4205407',
    cityName: 'Florianópolis',
  },
  {
    stateIbgeId: '41',
    stateCode: 'PR',
    stateName: 'Paraná',
    cityIbgeId: '4106902',
    cityName: 'Curitiba',
  },
];

const userNames = [
  'Ana Souza',
  'Bruno Lima',
  'Carla Mendes',
  'Diego Santos',
  'Elisa Rocha',
  'Fábio Costa',
  'Gabriela Alves',
  'Henrique Martins',
  'Isabela Ribeiro',
  'João Ferreira',
] as const;

const petNames = [
  'Luna',
  'Theo',
  'Mel',
  'Nino',
  'Amora',
  'Bento',
  'Nina',
  'Fred',
  'Maya',
  'Bob',
  'Sol',
  'Chico',
  'Jade',
  'Tobias',
  'Pipoca',
  'Luke',
  'Cacau',
  'Zeca',
  'Frida',
  'Simba',
] as const;

const speciesCycle: PetSpecies[] = ['dog', 'cat', 'dog', 'bird', 'other'];
const sizeCycle: PetSize[] = ['small', 'medium', 'large', 'small', 'giant'];
const careTagCycle: PetCareTag[][] = [
  [],
  ['medication'],
  ['special_diet', 'allergies'],
  ['frequent_supervision'],
  ['senior', 'mobility_support'],
];
const behaviorCycle: PetBehaviorTag[][] = [
  ['sociable', 'affectionate'],
  ['anxious', 'affectionate'],
  ['hyperactive', 'escape_risk'],
  ['calm'],
  ['fearful', 'reactive_to_animals'],
];

function userId(index: number) {
  return `demo-user-${String(index + 1).padStart(2, '0')}`;
}

function buildFictionalCpf(index: number) {
  const base = `90000000${index + 1}`;
  const appendDigit = (digits: string) => {
    const sum = digits
      .split('')
      .reduce((total, digit, digitIndex) => total + Number(digit) * (digits.length + 1 - digitIndex), 0);
    const remainder = (sum * 10) % 11;
    return `${digits}${remainder === 10 ? 0 : remainder}`;
  };

  return appendDigit(appendDigit(base));
}

function buildUsers(): User[] {
  return userNames.map((fullName, index) => ({
    id: userId(index),
    fullName,
    email: `demo${String(index + 1).padStart(2, '0')}@tranquilopet.local`,
    phone: `1190000${String(index + 1).padStart(4, '0')}`,
    photos: emptyPhotoCollection(),
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  }));
}

function buildPets(): Pet[] {
  return petNames.map((name, index) => {
    const ownerIndex = Math.floor(index / 2);
    const variant = index % speciesCycle.length;
    const species = speciesCycle[variant];

    return {
      id: `demo-pet-${String(index + 1).padStart(2, '0')}`,
      ownerUserId: userId(ownerIndex),
      name,
      species,
      breed: species === 'dog' ? 'Sem raça definida' : species === 'cat' ? 'SRD' : '',
      ageYears: (index % 12) + 1,
      size: sizeCycle[variant],
      characteristics: 'Registro fictício para validação do aplicativo.',
      careTags: [...careTagCycle[variant]],
      behavior: {
        traits: [...behaviorCycle[variant]],
        notes: 'Análise comportamental inicial de demonstração.',
      },
      medicationDetails: careTagCycle[variant].includes('medication')
        ? '1 comprimido às 20h'
        : '',
      additionalNotes: 'Use apenas informações fictícias neste ambiente.',
      photos: emptyPhotoCollection(),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    };
  });
}

export function createDevelopmentSeed(): AppDatabase {
  const users = buildUsers();

  return {
    schemaVersion: 1,
    seedVersion: 1,
    users,
    tutorProfiles: users.slice(0, 5).map((user, index) => ({
      userId: user.id,
      location: { ...locations[index] },
      bio: `Tutor de demonstração ${index + 1}.`,
      photos: emptyPhotoCollection(),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    })),
    caregiverProfiles: users.slice(4, 9).map((user, index) => ({
      userId: user.id,
      location: { ...locations[index] },
      bio: `Cuidador de demonstração ${index + 1}, disponível para cuidados tranquilos.`,
      experienceYears: index + 1,
      acceptedSpecies: index % 2 === 0 ? ['dog', 'cat'] : ['dog'],
      acceptedSizes: index % 2 === 0 ? ['small', 'medium', 'large'] : ['small', 'medium'],
      offeredServices: index % 2 === 0 ? ['boarding', 'home_visit'] : ['daycare', 'walking'],
      availability: ['weekdays', 'mornings'],
      photos: emptyPhotoCollection(),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    })),
    caregiverPrivateData: users.slice(4, 9).map((user, index) => ({
      userId: user.id,
      cpf: buildFictionalCpf(index),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    })),
    pets: buildPets(),
  };
}
