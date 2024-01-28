import { defineStore } from 'pinia';
import {
  collection,
  doc,
  getCountFromServer,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

import { remoteDB } from '@/config/firebase';
import { useAuthStore } from './auth';
import * as local from '@/database/driver';
import { Profile } from '@/interfaces/auth';

export const useRemoteDBStore = defineStore('remote', () => {
  const auth = useAuthStore();

  async function storeProfile(profile: Profile): Promise<boolean> {
    if (!auth.user) return false;
    try {
      await setDoc(doc(remoteDB, 'users', auth.user.uid), profile);
      await local.updateProfile(profile);
      return true;
    } catch (error) {
      console.log(error);
      // TODO: Notify
    }
    return false;
  }
  async function updateProfile(profile: Profile): Promise<boolean> {
    if (!auth.user) return false;
    try {
      await updateDoc(doc(remoteDB, 'users', auth.user.uid), profile);
      auth.profile = { ...auth.profile, ...profile };
      await local.updateProfile(auth.profile);
      return true;
    } catch (error) {
      console.log(error);
      // TODO: Notify
    }
    return false;
  }
  async function usersCountByName(username: string) {
    try {
      const snap = await getCountFromServer(
        query(collection(remoteDB, 'users'), where('username', '==', username))
      );
      return snap.data().count;
    } catch (error) {
      console.log(error);
      // TODO: Notify
    }
    return -1;
  }

  return {
    storeProfile,
    updateProfile,
    usersCountByName
  };
});
