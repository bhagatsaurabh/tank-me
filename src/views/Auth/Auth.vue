<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useRemoteDBStore } from '@/stores/remote';
import type { Nullable } from '@babylonjs/core';
import Button from '@/components/Common/Button/Button.vue';
import InputText from '@/components/Common/InputText/InputText.vue';
import Spinner from '@/components/Common/Spinner/Spinner.vue';
// import Modal from '@/components/Modal/Modal.vue';

const auth = useAuthStore();
const remote = useRemoteDBStore();
const router = useRouter();

const email = ref<string>('');
const username = ref<string>('');
const busy = ref(false);
const errorMsg = ref<Nullable<string>>(null);
const emailEl = ref<Nullable<InputText>>(null);
const didSignIn = ref(false);
// const modal = ref<Nullable<{ title: string; controls: string[]; message: string }>>(null);
// const showModal = ref<boolean>(false);

const handleSignIn = async (provider: 'email' | 'guest') => {
  if (provider === 'email' && emailEl.value.validate(email.value)) {
    return;
  }
  await auth.signIn(provider, email.value);
  didSignIn.value = true;
};
const handleUsername = async () => {
  busy.value = true;
  const existingCount = await remote.usersCountByName(username.value);
  if (existingCount !== 0) {
    errorMsg.value = 'Username already exists';
  } else {
    await auth.updateUserProfile({ username: username.value });
  }
  busy.value = false;
  router.push('/lobby');
};
const validateEmail = (val: string) => {
  if (!val) return 'Please enter an e-mail';
  // eslint-disable-next-line no-useless-escape
  if (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(val)) return null;
  return 'Not a valid e-mail';
};

watch(
  () => auth.status,
  () => {
    if (auth.status === 'signed-in' && auth.profile?.username) {
      router.push('/lobby');
    }
  }
);
watch(email, () => (errorMsg.value = null));
watch(
  () => auth.stateCheck,
  async () => {
    const link = window.location.href;
    if (auth.isVerificationLink(link)) {
      const storedEmail = window.localStorage.getItem('email');
      if (link.includes('tankSignIntype=upgrade')) {
        await auth.signIn('guest-verify', storedEmail, link);
      } else {
        await auth.signIn('verify', storedEmail, link);
      }
    }
  }
);
</script>

<template>
  <!-- <Modal
      v-if="showModal && modal"
      :title="modal.title"
      :controls="modal.controls"
      @dismiss="showModal = false"
      @action="(action: string) => console.log(action)"
    >
      {{ modal.message }}
    </Modal> -->
  <main class="auth-container">
    <div class="background"></div>
    <Transition name="fade-slide-ltr">
      <div class="auth-card" v-if="auth.status === 'signed-out'">
        <InputText
          class="mb-2p5"
          ref="emailEl"
          v-model="email"
          type="email"
          placeholder="E-mail"
          :attrs="{ spellCheck: false }"
          :validator="(val: string) => validateEmail(val)"
        />
        <span v-if="errorMsg">{{ errorMsg }}</span>
        <Button :action="() => handleSignIn('email')" async>Verify</Button>
        <br />
        <Button :action="() => handleSignIn('guest')" async>Guest</Button>
      </div>
      <div class="auth-card" v-else-if="(auth.status === 'pending' || busy) && didSignIn">
        <span>Please check your provided e-mail for verification link</span>
        <br />
        <span class="fs-0p75">Waiting for verification...</span>
      </div>
      <div class="auth-card" v-else-if="auth.status === 'blocked'">
        Please open the verification link on same device
      </div>
      <div class="auth-card" v-else-if="auth.status === 'signed-in' && !auth.profile?.username">
        Enter username:
        <input v-model="username" type="text" spellcheck="false" />
        <button @click="handleUsername">Proceed</button>
      </div>
      <div class="auth-card" v-else-if="auth.status === 'verified'">Verified successfully</div>
      <div class="auth-card" v-else>
        <div class="wait">
          <Spinner />
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
@keyframes slide {
  0% {
    background-position-x: 0%;
    background-position-y: 0%;
  }
  25% {
    background-position-x: -50%;
    background-position-y: -50%;
  }
  50% {
    background-position-x: 0%;
    background-position-y: -100%;
  }
  75% {
    background-position-x: 50%;
    background-position-y: -50%;
  }
  100% {
    background-position-x: 0%;
    background-position-y: 0%;
  }
}

.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
.auth-container .background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('./assets/images/background.jpg');
  background-size: 40%;
  filter: blur(4px) brightness(0.4);
  animation-name: slide;
  animation-duration: 45s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-fill-mode: forwards;
}

.auth-card {
  position: absolute;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  background-color: rgba(211, 211, 211, 0.25);
  box-shadow: 0px 0px 10px 0px #000;
}

.wait {
  width: 10rem;
  height: 2rem;
}
</style>
