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
  await auth.signIn('email', email.value, null, true);
};
</script>

<template>
  <div>The Lobby component</div>
  <input v-model="email" type="email" spellcheck="false" />
  <template v-if="auth.status !== 'pending'">
    <span v-if="showErr">Provide a valid e-mail</span>
    <button @click="handleUpgrade">Verify</button>
  </template>
  <template v-else>Wait...</template>
</template>

<style scoped></style>
