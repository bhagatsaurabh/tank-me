<script setup lang="ts">
import { ref, computed } from 'vue';

import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

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
</script>

<template>
  <div>The Lobby component</div>
  <template v-if="auth.status !== 'pending' && !auth.profile?.email">
    <input v-model="email" type="email" spellcheck="false" />
    <span v-if="showErr">Provide a valid e-mail</span>
    <button @click="handleUpgrade">Verify</button>
  </template>
  <template v-if="auth.status === 'pending'">Wait...</template>
</template>

<style scoped></style>
