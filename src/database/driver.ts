import type { Profile } from '@/interfaces/auth';
import { updateObject, getObject } from './indexeddb';

export const updateProfile = async (profile: Profile) => {
  if (!profile.id) return false;
  return await updateObject('users', profile.id, profile);
};
export const getProfile = async (id: string) => {
  return await getObject<Profile>('users', id);
};

export const storeFile = async (pathId: string, file: File) => {
  return await updateObject('files', pathId, file);
};

export const getFile = async (pathId: string) => {
  return await getObject<File>('files', pathId);
};
