import { ref } from 'vue';
import { defineStore } from 'pinia';
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

import { remoteDB } from '@/config/firebase';
import { useAuthStore } from './auth';
import * as local from '@/database/driver';
import type { Profile } from '@/types';
import { useNotificationStore } from './notification';
import { Notifications } from '@/utils/constants';

export const useRemoteDBStore = defineStore('remote', () => {
  const auth = useAuthStore();
  const notify = useNotificationStore();

  const leaderboard = ref<Profile[]>([]);

  async function storeProfile(profile: Profile): Promise<boolean> {
    if (!auth.user) return false;
    try {
      await setDoc(doc(remoteDB, 'users', auth.user.uid), profile);
      await local.updateProfile(profile);
      return true;
    } catch (error) {
      notify.push(Notifications.GENERIC({ error }));
    }
    return false;
  }
  async function updateProfile(profile: Profile): Promise<boolean> {
    if (!auth.user) return false;
    try {
      await updateDoc(doc(remoteDB, 'users', auth.user.uid), profile);
      auth.profile = { ...auth.profile, ...profile };
      if (auth.profile.stats) {
        await local.updateProfile({ ...auth.profile, stats: { ...auth.profile.stats! } });
      } else {
        await local.updateProfile({ ...auth.profile });
      }
      return true;
    } catch (error) {
      notify.push(Notifications.GENERIC({ error }));
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
      notify.push(Notifications.GENERIC({ error }));
    }
    return -1;
  }
  async function fetchLeaderboard() {
    try {
      leaderboard.value = [];
      const top25 = query(collection(remoteDB, 'users'), orderBy('stats.points', 'desc'), limit(25));
      const docsSnap = await getDocs(top25);
      docsSnap.forEach((snap) => snap.exists() && leaderboard.value.push(snap.data()));
    } catch (error) {
      notify.push(Notifications.GENERIC({ error }));
    }
  }

  return {
    leaderboard,
    storeProfile,
    updateProfile,
    usersCountByName,
    fetchLeaderboard
  };
});
