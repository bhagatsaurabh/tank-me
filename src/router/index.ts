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
      component: Auth,
      beforeEnter: noAuthGuard,
      name: 'Auth'
    },
    {
      path: '/lobby',
      component: Lobby,
      beforeEnter: [authGuard, lobbyGuard],
      name: 'Lobby'
    },
    {
      path: '/game',
      component: Game,
      beforeEnter: [authGuard, gameGuard],
      name: 'Game'
    }
  ]
});

export default router;
