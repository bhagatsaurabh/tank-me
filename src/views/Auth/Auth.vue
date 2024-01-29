<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useRemoteDBStore } from '@/stores/remote';

const auth = useAuthStore();
const remote = useRemoteDBStore();
const router = useRouter();

const email = ref<string>('');
const username = ref<string>('');
const busy = ref(false);
const showErr = ref(false);
// eslint-disable-next-line no-useless-escape
const isValid = computed<boolean>(() => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(email.value));

const handleSignIn = async (provider: 'email' | 'guest') => {
  if (provider === 'email' && !isValid.value) {
    showErr.value = true;
    return;
  }
  await auth.signIn(provider, email.value);
};
const handleUsername = async () => {
  busy.value = true;
  const existingCount = await remote.usersCountByName(username.value);
  if (existingCount !== 0) {
    // TODO: Notify
  } else {
    await auth.updateUserProfile({ username: username.value });
  }
  busy.value = false;
  router.push('/lobby');
};

watch(
  () => auth.status,
  () => {
    if (auth.status === 'signed-in' && auth.profile?.username) {
      router.push('/lobby');
    }
  }
);
watch(email, () => (showErr.value = false));

onMounted(async () => {
  const link = window.location.href;
  if (auth.isVerificationLink(link)) {
    const storedEmail = window.localStorage.getItem('email');
    let result: boolean;
    if (link.includes('tankSignIntype=upgrade')) {
      result = await auth.signIn('guest-verify', storedEmail, link);
    } else {
      result = await auth.signIn('verify', storedEmail, link);
    }
    if (result) {
      window.close();
    }
  }
});
</script>

<template>
  <template v-if="auth.status === 'signed-out'">
    <input v-model="email" type="email" spellcheck="false" />
    <span v-if="showErr">Provide a valid e-mail</span>
    <button @click="() => handleSignIn('email')">Sign In</button>
    <br />
    <button @click="() => handleSignIn('guest')">Guest</button>
  </template>
  <template v-else-if="auth.status === 'pending' || busy">Wait...</template>
  <template v-else-if="auth.status === 'blocked'">Please open this link on same device</template>
  <template v-else-if="auth.status === 'signed-in' && !auth.profile?.username">
    Enter username:
    <input v-model="username" type="text" spellcheck="false" />
    <button @click="handleUsername">Proceed</button>
  </template>
  <template v-else-if="auth.status === 'verified'"> Verified successfully </template>
</template>

<style scoped></style>
