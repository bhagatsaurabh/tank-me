<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { Nullable } from '@babylonjs/core';

import { closeDB, openDB } from './database/indexeddb';
import { useAuthStore } from './stores/auth';
import { useBroadcastStore } from './stores/broadcast';
import Modal from '@/components/Common/Modal/Modal.vue';
import { useNotificationStore } from './stores/notification';
import type { IModalInfo } from './types/interfaces';

const auth = useAuthStore();
const broadcast = useBroadcastStore();
const notifyStore = useNotificationStore();

const modal = ref<Nullable<IModalInfo>>(null);

const handleModalDismiss = () => {
  modal.value = null;
  const isReload = notifyStore.active?.action === 'reload';
  notifyStore.clear();
  if (isReload) {
    location.reload();
  }
};

watch(
  () => notifyStore.active,
  () => {
    if (notifyStore.active?.type === 'popup') {
      modal.value = { title: notifyStore.active.title, controls: [], message: notifyStore.active.message };
    }
  }
);

onMounted(async () => {
  await openDB();
  broadcast.registerBroadcastListener('tankme_bc_channel');
  auth.registerAuthListener();
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
  <RouterView />
</template>

<style scoped></style>
