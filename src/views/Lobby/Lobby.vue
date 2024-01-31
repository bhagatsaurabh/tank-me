<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useLobbyStore } from '@/stores/lobby';

const auth = useAuthStore();
const lobby = useLobbyStore();
const router = useRouter();

const email = ref<string>('');
const showErr = ref(false);
// eslint-disable-next-line no-useless-escape
const isValid = computed<boolean>(() => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(email.value));

const handleUpgrade = async () => {
  if (!isValid.value) {
    showErr.value = true;
    return;
  }
  await auth.signIn('email', email.value, '', true);
};
const handleStart = () => {
  lobby.status = 'playing';
  router.push('/game');
};

onMounted(() => {
  // TODO: Load game assets
  // TODO: Connect to colyseus
});
</script>

<template>
  <div>The Lobby component</div>
  <template v-if="auth.status !== 'pending' && !auth.profile?.email">
    <input v-model="email" type="email" spellcheck="false" />
    <span v-if="showErr">Provide a valid e-mail</span>
    <button @click="handleUpgrade">Verify</button>
  </template>
  <template v-if="auth.status === 'pending'">Wait...</template>
  <template v-if="auth.status === 'signed-in'">
    <button @click="handleStart">Start</button>
  </template>
</template>

<style scoped></style>
