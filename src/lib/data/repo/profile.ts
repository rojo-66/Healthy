import { PROFILE_ID, type Profile } from '../schemas/profile';
import { createTableRepo, type TableInput } from './table-repo';

export const profileRepo = createTableRepo('profile');

/** Il profilo (riga unica), se è già stato compilato. */
export function getProfile(): Promise<Profile | undefined> {
  return profileRepo.get(PROFILE_ID);
}

export function saveProfile(profile: Omit<TableInput<'profile'>, 'id'>): Promise<Profile> {
  return profileRepo.put({ ...profile, id: PROFILE_ID });
}
