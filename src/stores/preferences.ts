import { ref, toRaw } from 'vue';
import { defineStore } from 'pinia';
import type { Nullable } from '@babylonjs/core';

import type { UserPreferences } from '@/types';
import { getPreferences, storePreferences } from '@/database/driver';

export const usePreferencesStore = defineStore('preferences', () => {
  const data = ref<Nullable<Partial<UserPreferences>>>(null);

  async function load() {
    data.value = await getPreferences();
  }
  function update(updatedPrefs: Partial<UserPreferences>) {
    data.value = { ...(data.value ?? {}), ...updatedPrefs };
    storePreferences(toRaw(data.value));
  }

  return {
    data,
    load,
    update
  };
});
