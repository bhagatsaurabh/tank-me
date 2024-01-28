import { NavigationGuard } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useLobbyStore } from '@/stores/lobby';

export const authGuard: NavigationGuard = async (_to, _from, next) => {
  const auth = useAuthStore();

  if (auth.user) {
    next();
  } else {
    next('/auth');
  }
};

export const lobbyGuard: NavigationGuard = async (_to, _from, next) => {
  const auth = useAuthStore();
  if (auth.profile?.username && !window.location.href.includes('type=upgrade')) {
    next();
  } else {
    next('/auth');
  }
};

export const gameGuard: NavigationGuard = async (_to, _from, next) => {
  const auth = useAuthStore();
  const lobby = useLobbyStore();
  if (auth.profile?.username && lobby.status === 'playing') {
    next();
  } else {
    next(auth.profile?.username ? '/lobby' : '/auth');
  }
};

export const noAuthGuard = async () => {
  const auth = useAuthStore();
  return !auth.user || !auth.profile?.username || window.location.href.includes('type=upgrade');
};
