import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Nullable } from '@babylonjs/core';

import { useAuthStore } from './auth';
import type { BroadcastMessage } from '@/types/auth';

// For cross-tab communication
export const useBroadcastStore = defineStore('broadcast', () => {
  const auth = useAuthStore();
  const channel = ref<Nullable<BroadcastChannel>>(null);

  function registerBroadcastListener(name: string) {
    channel.value = new BroadcastChannel(name);
    channel.value.onmessage = async (ev: MessageEvent<BroadcastMessage>) => {
      if (ev.data.type === 'auth' && ev.data.value === 'guest-verified' && auth.user?.uid) {
        await auth.loadUserProfile(auth.user.uid);
        auth.status = 'signed-in';
      }
    };
  }
  function close() {
    channel.value?.close();
  }
  function sendBroadcast(value: BroadcastMessage) {
    channel.value?.postMessage(value);
  }

  return {
    registerBroadcastListener,
    sendBroadcast,
    close
  };
});
