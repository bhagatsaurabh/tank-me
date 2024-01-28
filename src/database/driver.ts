import { Profile } from '@/interfaces/auth';
import { updateObject, getObject } from './indexeddb';

export const updateProfile = async (profile: Profile) => {
  return await updateObject('users', profile.id, profile);
};
export const getProfile = async (id: string) => {
  return await getObject<Profile>('users', id);
};
