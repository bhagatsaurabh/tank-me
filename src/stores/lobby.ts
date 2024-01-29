import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { LobbyStatus } from '@/interfaces/types';

export const useLobbyStore = defineStore('lobby', () => {
  const status = ref<LobbyStatus>('idle');

  return {
    status
  };
});
