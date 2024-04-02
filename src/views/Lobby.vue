<script setup lang="ts">
import { ref, onMounted, watch, onBeforeMount } from 'vue';
import { useRouter } from 'vue-router';
import type { Nullable } from '@babylonjs/core';

import { useAuthStore, useLobbyStore, useLoaderStore } from '@/stores';
import { Header, Button, Spinner, Backdrop, Modal } from '@/components/common';
import Leaderboard from '@/components/Leaderboard.vue';
import Profile from '@/components/Profile.vue';
import { AssetLoader } from '@/game/loader';
import { GameClient } from '@/game/client';
import { randInRange } from '@/utils';

const auth = useAuthStore();
const lobby = useLobbyStore();
const loader = useLoaderStore();
const router = useRouter();

const startTS = ref(-1);
const timer = ref('');
const showProfile = ref(false);
const isGuestUpgrading = ref<boolean>(false);
const suggestAI = ref(false);
const isSuggestionRejected = ref<Nullable<boolean>>(false);
const isLeaderboardOpen = ref(false);
const randomStartPoint = ref(0);

let handle = -1;
const handleStart = async () => {
  if (lobby.status === 'idle') {
    clearInterval(handle);
    startTS.value = Date.now();
    timer.value = '00:00';
    handle = setInterval(() => {
      const mark = new Date(Date.now() - startTS.value);
      if (mark.getTime() / 1000 > 10 && !isSuggestionRejected.value) {
        suggestAI.value = true;
      }
      timer.value = `${mark.toISOString().substring(14, 19)}`;
    }, 1000);
    await lobby.match('desert');
  } else {
    handleReset(true);
  }
};
const handleStartAI = () => {
  handleReset(true);
  router.push({ path: '/game', hash: '#ai' });
};
const handleReset = (disconnect = false) => {
  disconnect && GameClient.disconnect();
  startTS.value = -1;
  clearInterval(handle);
  isSuggestionRejected.value = false;
};

const handleAction = (action: { text: string }) => {
  if (action.text === 'Yes') {
    handleStartAI();
  } else {
    isSuggestionRejected.value = true;
  }

  suggestAI.value = false;
};

watch(
  () => lobby.status,
  () => {
    if (lobby.status === 'playing') {
      handleReset();
      router.push({ path: '/game' });
    }
  }
);

onBeforeMount(() => (randomStartPoint.value = randInRange(0, 148)));
onMounted(async () => {
  await AssetLoader.load();
  await lobby.connect();
});
</script>

<template>
  <Header class="header">
    <template #left>
      <div class="header-hero">
        <img class="hero" alt="tankme logo" src="/assets/images/logo192.png" />
        <span class="ml-1">Tank Me</span>
      </div>
    </template>
    <template #right>
      <div class="header-controls">
        <Button @click="isLeaderboardOpen = true">Leaderboard</Button>
        <Button class="profile-control" :class="{ float: showProfile }" @click="showProfile = !showProfile">
          <img alt="avatar icon" src="/assets/icons/avatar.png" />
        </Button>
        <Button v-if="showProfile" class="profile-control filler">
          <img alt="avatar icon" src="/assets/icons/avatar.png" />
        </Button>
        <Profile
          v-if="showProfile"
          :is-guest-upgrading="isGuestUpgrading"
          @dismiss="showProfile = false"
          @guest-upgrade="(val) => (isGuestUpgrading = val)"
        />
      </div>
    </template>
  </Header>
  <Backdrop :show="(auth.status === 'pending' || loader.isLoading) && !isGuestUpgrading" :dismissable="false">
    <div class="wait">
      <span class="progress">
        {{
          `Fetching Game Assets (${loader.noOfFilesDownloaded}/${loader.noOfFiles})\n${Math.round(loader.progress * 100)}%`
        }}
      </span>
      <Spinner :progress="loader.progress" trackable />
    </div>
  </Backdrop>
  <main class="lobby">
    <Modal
      v-if="suggestAI"
      title="Play vs. AI ?"
      :controls="[{ text: 'Yes' }, { text: 'No' }]"
      @dismiss="() => handleAction({ text: 'No' })"
      @action="handleAction"
    >
      Match-making is slow and taking longer than expected.
    </Modal>
    <div class="background">
      <video
        :src="`/assets/videos/dynamic-background.mp4#t=${randomStartPoint}`"
        autoplay
        loop
        playsinline
        muted
      ></video>
    </div>
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
      <Button @click="handleStartAI" :size="0.75" :disabled="lobby.status === 'matchmaking'">vs. AI</Button>
    </div>
    <Leaderboard v-if="isLeaderboardOpen" @dismiss="isLeaderboardOpen = false" />
  </main>
</template>

<style scoped>
.header {
  opacity: 0.8;
}
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
  filter: drop-shadow(0px 0px 4px #000);
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
  display: flex;
  align-items: flex-end;
  column-gap: 1.5rem;
  opacity: 0.8;
  width: 100%;
  background: url('/assets/images/dirt-overlay.png');
  mask-image: linear-gradient(to top, rgba(0, 0, 0, 1), rgba(0, 0, 0, 1) 70%, rgba(0, 0, 0, 0));
}
.match-control {
  padding: 1rem 2rem;
  font-size: 1.5rem !important;
}
.match-control:deep(.content) {
  flex-direction: column !important;
}

.profile-control.float {
  position: fixed;
  right: 0;
  top: 0;
  z-index: 101;
  box-shadow: 0px -10px 10px 0px;
}
.profile-control.float:active {
  box-shadow:
    0px -10px 10px 0px,
    2.5px 2.5px 5px 0 black inset !important;
}

.background {
  position: fixed;
  width: 100%;
  height: 100%;
  z-index: -1;
  top: 0;
  left: 0;
  filter: blur(1px);
}
.background video {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.progress {
  position: absolute;
  color: #fff;
  top: 125%;
  font-size: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  white-space: pre;
  text-align: center;
}
</style>
