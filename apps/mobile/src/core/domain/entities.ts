export type PhotoCollection = {
  profileUri: string | null;
  galleryUris: string[];
};

export type Location = {
  stateIbgeId: string;
  stateCode: string;
  stateName: string;
  cityIbgeId: string;
  cityName: string;
};

export type PetSpecies = 'dog' | 'cat' | 'bird' | 'other';
export type PetSize = 'small' | 'medium' | 'large' | 'giant';

export type PetCareTag =
  | 'special_needs'
  | 'medication'
  | 'special_diet'
  | 'allergies'
  | 'mobility_support'
  | 'senior'
  | 'postoperative'
  | 'frequent_supervision';

export type PetBehaviorTag =
  | 'anxious'
  | 'affectionate'
  | 'hyperactive'
  | 'reactive_to_animals'
  | 'fearful'
  | 'territorial'
  | 'sociable'
  | 'calm'
  | 'escape_risk'
  | 'resource_guarding';

export type CareService = 'boarding' | 'daycare' | 'home_visit' | 'walking';

export type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  photos: PhotoCollection;
  createdAt: string;
  updatedAt: string;
};

export type TutorProfile = {
  userId: string;
  location: Location;
  bio: string;
  photos: PhotoCollection;
  createdAt: string;
  updatedAt: string;
};

export type CaregiverProfile = {
  userId: string;
  location: Location;
  bio: string;
  experienceYears: number;
  acceptedSpecies: PetSpecies[];
  acceptedSizes: PetSize[];
  offeredServices: CareService[];
  availability: string[];
  photos: PhotoCollection;
  createdAt: string;
  updatedAt: string;
};

export type CaregiverPrivateData = {
  userId: string;
  cpf: string;
  createdAt: string;
  updatedAt: string;
};

export type PetBehaviorAnalysis = {
  traits: PetBehaviorTag[];
  notes: string;
};

export type Pet = {
  id: string;
  ownerUserId: string;
  name: string;
  species: PetSpecies;
  breed: string;
  ageYears: number | null;
  size: PetSize;
  characteristics: string;
  careTags: PetCareTag[];
  behavior: PetBehaviorAnalysis;
  medicationDetails: string;
  additionalNotes: string;
  photos: PhotoCollection;
  createdAt: string;
  updatedAt: string;
};

export type DemoSession = {
  mode: 'demo';
  userId: string;
  signedInAt: string;
};

export type AppDatabase = {
  schemaVersion: 1;
  seedVersion: 1;
  users: User[];
  tutorProfiles: TutorProfile[];
  caregiverProfiles: CaregiverProfile[];
  caregiverPrivateData: CaregiverPrivateData[];
  pets: Pet[];
};

export type RegisterUserInput = {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  photos?: PhotoCollection;
};

export type UpsertTutorProfileInput = Omit<TutorProfile, 'createdAt' | 'updatedAt'>;

export type UpsertCaregiverProfileInput = Omit<CaregiverProfile, 'createdAt' | 'updatedAt'>;

export type UpsertCaregiverPrivateDataInput = {
  cpf: string;
};

export type UpsertPetInput = Omit<Pet, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export const emptyPhotoCollection = (): PhotoCollection => ({
  profileUri: null,
  galleryUris: [],
});
