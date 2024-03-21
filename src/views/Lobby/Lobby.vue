<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useLobbyStore } from '@/stores/lobby';
import { useLoaderStore } from '@/stores/loader';
import Header from '@/components/Common/Header/Header.vue';
import Button from '@/components/Common/Button/Button.vue';
import Spinner from '@/components/Common/Spinner/Spinner.vue';
import Backdrop from '@/components/Common/Backdrop/Backdrop.vue';
import { AssetLoader } from '@/game/loader';
import { GameClient } from '@/game/client';

const auth = useAuthStore();
const lobby = useLobbyStore();
const loader = useLoaderStore();
const router = useRouter();

const email = ref<string>('');
const showErr = ref(false);
const startTS = ref(-1);
const timer = ref('');
// eslint-disable-next-line no-useless-escape
const isValid = computed<boolean>(() => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(email.value));

const handleUpgrade = async () => {
  if (!isValid.value) {
    showErr.value = true;
    return;
  }
  await auth.signIn('email', email.value, '', true);
};
let handle = -1;
const handleStart = async () => {
  if (lobby.status === 'idle') {
    await lobby.match('desert');
    startTS.value = Date.now();
    timer.value = '00:00';
    handle = setInterval(() => {
      timer.value = `${new Date(Date.now() - startTS.value).toISOString().substring(14, 19)}`;
    }, 1000);
  } else {
    GameClient.disconnect();
    startTS.value = -1;
    clearInterval(handle);
  }
};

watch(
  () => lobby.status,
  () => {
    if (lobby.status === 'playing') {
      startTS.value = -1;
      clearInterval(handle);
      router.push('/game');
    }
  }
);
watch(
  () => loader.progress,
  () => console.log(loader.progress)
);

onMounted(async () => {
  await AssetLoader.load();
  await lobby.connect();
});
</script>

<template>
  <Header>
    <template #left>
      <div class="header-hero">
        <img class="hero" alt="tankme logo" src="/assets/images/logo192.png" />
        <span class="ml-1">Tank Me</span>
      </div>
    </template>
    <template #right>
      <div class="header-controls">
        <Button>Leaderboard</Button>
        <Button><img alt="avatar icon" src="/assets/icons/avatar.png" /></Button>
      </div>
    </template>
  </Header>
  <Backdrop :show="auth.status === 'pending' || loader.isLoading" :dismissable="false">
    <div class="wait">
      <Spinner :progress="loader.progress" trackable>
        <span>{{ `${Math.round(loader.progress * 100)}%` }}</span>
      </Spinner>
    </div>
  </Backdrop>
  <main class="lobby">
    <div class="match">
      <Button class="match-control" @click="handleStart">
        <template v-if="lobby.status === 'idle'">
          <span>Start</span>
        </template>
        <template v-else>
          <div>Cancel</div>
          <div class="fs-0p75">{{ timer }}</div>
        </template>
      </Button>
    </div>
  </main>
  <template v-if="auth.status !== 'pending' && !auth.profile?.email">
    <input v-model="email" type="email" spellcheck="false" />
    <span v-if="showErr">Provide a valid e-mail</span>
    <button @click="handleUpgrade">Verify</button>
  </template>
</template>

<style scoped>
.hero {
  max-height: 80%;
}
.header-hero {
  padding: 0 1rem;
  display: flex;
  align-items: center;
  height: 100%;
}
.header-hero img {
  filter: drop-shadow(0px 0px 10px #000);
}
.header-hero span {
  color: #000;
  text-shadow: 0px 0px 10px #656565;
}
.header-controls {
  display: flex;
}

.wait {
  position: fixed;
  width: 10rem;
  height: 2.1rem;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.lobby {
  width: 100vw;
  height: calc(100vh - var(--header-height));
}
.lobby .match {
  position: absolute;
  bottom: 0;
  left: 0;
  padding: 1rem;
}
.match-control {
  padding: 1rem 2rem;
  font-size: 1.5rem !important;
}
.match-control:deep(.content) {
  flex-direction: column !important;
}
</style>
