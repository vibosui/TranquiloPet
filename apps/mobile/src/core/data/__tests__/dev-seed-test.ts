import { createDevelopmentSeed } from '@/core/data/dev-seed';
import { isValidCpf } from '@/features/shared/domain/brazilian-formatters';

describe('development seed', () => {
  test('creates the requested deterministic records and role overlap', () => {
    const database = createDevelopmentSeed();

    expect(database.users).toHaveLength(10);
    expect(database.tutorProfiles).toHaveLength(5);
    expect(database.caregiverProfiles).toHaveLength(5);
    expect(database.caregiverPrivateData).toHaveLength(5);
    expect(database.pets).toHaveLength(20);

    const fifthUserId = 'demo-user-05';
    expect(database.tutorProfiles.some((profile) => profile.userId === fifthUserId)).toBe(true);
    expect(database.caregiverProfiles.some((profile) => profile.userId === fifthUserId)).toBe(true);

    const tenthUserId = 'demo-user-10';
    expect(database.tutorProfiles.some((profile) => profile.userId === tenthUserId)).toBe(false);
    expect(database.caregiverProfiles.some((profile) => profile.userId === tenthUserId)).toBe(false);
  });

  test('assigns two pets per user and leaves no orphan references', () => {
    const database = createDevelopmentSeed();
    const userIds = new Set(database.users.map((user) => user.id));

    for (const user of database.users) {
      expect(database.pets.filter((pet) => pet.ownerUserId === user.id)).toHaveLength(2);
    }

    expect(database.tutorProfiles.every((profile) => userIds.has(profile.userId))).toBe(true);
    expect(database.caregiverProfiles.every((profile) => userIds.has(profile.userId))).toBe(true);
    expect(database.caregiverPrivateData.every((data) => userIds.has(data.userId))).toBe(true);
    expect(database.caregiverPrivateData.every((data) => isValidCpf(data.cpf))).toBe(true);
    expect(database.pets.every((pet) => userIds.has(pet.ownerUserId))).toBe(true);
    expect(
      database.pets
        .filter((pet) => pet.careTags.includes('medication'))
        .every(
          (pet) =>
            pet.medicationDetails.length > 0 &&
            !pet.additionalNotes.startsWith('Medicação:'),
        ),
    ).toBe(true);
  });

  test('returns a fresh graph on every call', () => {
    const first = createDevelopmentSeed();
    first.users[0].fullName = 'Alterado';
    first.pets[0].careTags.push('medication');

    const second = createDevelopmentSeed();
    expect(second.users[0].fullName).toBe('Ana Souza');
    expect(second.pets[0].careTags).not.toEqual(first.pets[0].careTags);
  });
});
