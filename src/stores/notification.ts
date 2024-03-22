import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Nullable } from '@babylonjs/core';

import type { INotification } from '@/types/interfaces';

export const useNotificationStore = defineStore('notification', () => {
  const active = ref<Nullable<INotification>>(null);

  function push(notification: INotification) {
    active.value = notification;
    if (notification.error) {
      console.log(notification.error);
    }
  }
  function clear() {
    active.value = null;
  }

  return {
    active,
    push,
    clear
  };
});
