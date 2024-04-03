<script setup lang="ts">
import { onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Nullable } from '@babylonjs/core';

import { closeDB, openDB } from '@/database/indexeddb';
import {
  useBroadcastStore,
  useNotificationStore,
  useAuthStore,
  usePresentationStore,
  usePreferencesStore
} from '@/stores';
import { Modal } from '@/components/common';
import type { IModalInfo } from '@/types/interfaces';

const auth = useAuthStore();
const broadcast = useBroadcastStore();
const notifyStore = useNotificationStore();
const presentationStore = usePresentationStore();
const preferences = usePreferencesStore();

const modal = ref<Nullable<IModalInfo>>(null);
const fullscreenConsent = ref<Nullable<InstanceType<typeof Modal>>>(null);

const handleModalDismiss = () => {
  modal.value = null;
  const isReload = notifyStore.active?.action === 'reload';
  notifyStore.clear();
  if (isReload) {
    location.reload();
  }
};
const handleAllowFullscreen = async () => {
  await presentationStore.fullscreen();
};
const handleDismiss = () => {
  preferences.update({ fullscreenConsentTS: Date.now() });
};

watch(
  () => notifyStore.active,
  () => {
    if (notifyStore.active?.type === 'popup') {
      modal.value = { title: notifyStore.active.title, controls: [], message: notifyStore.active.message };
    }
  }
);

let handle = -1;
onMounted(async () => {
  await openDB();

  await preferences.load();
  presentationStore.registerListeners();

  broadcast.registerBroadcastListener('tankme_bc_channel');
  auth.registerAuthListener();

  handle = setInterval(() => {
    if (preferences.data?.fullscreenConsentTS) {
      if (Date.now() - (preferences.data?.fullscreenConsentTS ?? 0) >= 43200000) {
        fullscreenConsent.value?.showModal();
      }
    } else {
      fullscreenConsent.value?.showModal();
    }
  }, 2000);
});
onBeforeUnmount(() => {
  presentationStore.unregister();
  clearInterval(handle);
});
onUnmounted(() => {
  auth.deRegisterAuthListener();
  broadcast.close();
  closeDB();
});
</script>

<template>
  <Modal v-if="modal" :title="modal.title" :controls="modal.controls" @dismiss="handleModalDismiss">
    <template v-html="modal.message"></template>
  </Modal>
  <Modal
    ref="fullscreenConsent"
    title="Fullscreen: Permission required"
    :controls="[{ text: 'Deny' }, { text: 'Allow', async: true, action: handleAllowFullscreen }]"
    @dismiss="handleDismiss"
    hidden
  >
    <h5>Playing on fullscreen is recommended for best experience !</h5>
  </Modal>
  <RouterView />
</template>

<style scoped></style>
