<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

import { closeDB, openDB } from './database/indexeddb';
import { useAuthStore } from './stores/auth';
import { useBroadcastStore } from './stores/broadcast';

const auth = useAuthStore();
const broadcast = useBroadcastStore();

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
  <RouterView />
</template>

<style scoped></style>
