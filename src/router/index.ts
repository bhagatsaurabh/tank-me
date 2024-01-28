import { createRouter, createWebHistory } from 'vue-router';

import { authGuard, gameGuard, lobbyGuard, noAuthGuard } from './guards';
import Auth from '@/views/Auth/Auth.vue';
import Lobby from '@/views/Lobby/Lobby.vue';
import Game from '@/views/Game/Game.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: Game,
      beforeEnter: [authGuard, gameGuard]
    },
    {
      path: '/lobby',
      component: Lobby,
      beforeEnter: [authGuard, lobbyGuard]
    },
    {
      path: '/auth',
      component: Auth,
      beforeEnter: noAuthGuard
    }
  ]
});

export default router;
