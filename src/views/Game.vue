<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Nullable } from '@babylonjs/core';

import { throttle } from '@/utils';
import { GameClient } from '@/game/client';
import { Spinner, Button, Modal } from '@/components/common';
import { useLoaderStore, useLobbyStore, usePresentationStore } from '@/stores';
import TouchControls from '@/components/TouchControls.vue';

const route = useRoute();
const router = useRouter();
const lobby = useLobbyStore();
const presentation = usePresentationStore();
const loader = useLoaderStore();

const containerEl = ref<Nullable<HTMLDivElement>>(null);
const canvasEl = ref<Nullable<HTMLCanvasElement>>(null);
const isLoading = ref(false);
const gameClient = ref<Nullable<GameClient>>(null);
const currTime = ref('');
const fullscreenConsent = ref<Nullable<InstanceType<typeof Modal>>>(null);
const isVsAI = computed(() => route.hash === '#ai');

const handleResize = () => {
  if (canvasEl.value) {
    canvasEl.value.width = Math.floor(window.innerWidth);
    canvasEl.value.height = Math.floor(window.innerHeight);
  }
};
const throttledHandleResize = throttle(handleResize, 200);
const handleBackToLobby = () => {
  gameClient.value?.world?.destroy();
  lobby.status = 'idle';
  router.push('/lobby');
};
const handleAllowFullscreen = async () => {
  await presentation.fullscreen();
};

watch(
  () => presentation.isFullscreen,
  () => {
    if (presentation.isFullscreen) {
      fullscreenConsent.value?.hideModal();
    } else {
      if (presentation.device === 'mobile') {
        fullscreenConsent.value?.showModal();
      }
    }
  }
);

let observer: ResizeObserver;
let handle = -1;
onMounted(async () => {
  observer = new ResizeObserver(throttledHandleResize);
  if (canvasEl.value) {
    observer.observe(canvasEl.value);
    canvasEl.value.width = window.innerWidth;
    canvasEl.value.height = window.innerHeight;

    gameClient.value = GameClient.get();

    // Initialize the game
    isLoading.value = true;
    await gameClient.value.createWorld(
      canvasEl.value,
      isVsAI.value,
      presentation.device === 'desktop' ? 'high' : 'low'
    );
    isLoading.value = false;
    gameClient.value.world?.engine?.resize(true);

    handle = setInterval(() => {
      const mark = new Date(
        (gameClient.value?.matchDuration ?? 0) -
          (Date.now() -
            ((isVsAI.value
              ? gameClient.value?.world?.startTimestamp
              : gameClient.value?.state?.startTimestamp) ?? 0))
      );
      currTime.value = `${mark.toISOString().substring(14, 19)}`;
      if (currTime.value === '00:00') clearInterval(handle);
    }, 1000);
  }
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearInterval(handle);
});
</script>

<template>
  <div class="game-container" ref="containerEl">
    <Modal
      ref="fullscreenConsent"
      title="Fullscreen: Permission required"
      :controls="[{ text: 'Deny' }, { text: 'Allow', async: true, action: handleAllowFullscreen }]"
    >
      <h5>
        {{
          presentation.device === 'desktop'
            ? 'Playing on fullscreen is recommended for best experience !'
            : 'Touch controls only work when in fullscreen !'
        }}
      </h5>
    </Modal>
    <div v-if="isLoading" class="feed-load">
      <div class="background"></div>
      <div class="spinner">
        <Spinner />
      </div>
    </div>
    <canvas ref="canvasEl"></canvas>
    <TouchControls v-if="!gameClient?.isMatchEnded" />
    <div class="timer" v-if="lobby.status === 'playing' || (gameClient?.world && isVsAI)">{{ currTime }}</div>
    <div v-if="gameClient?.isMatchEnded" class="matchend">
      <section class="title">
        <div class="background" :style="{ backgroundImage: loader.get('/assets/images/load.png')! }"></div>
        <h1>{{ gameClient?.isDraw ? 'Draw' : gameClient?.didWin ? 'Winner !' : 'Lost' }}</h1>
      </section>
      <section class="stats">
        <div class="keys">
          <h4>Shells Used</h4>
          <h4>Total Damage</h4>
          <h4 v-if="!isVsAI">Points</h4>
        </div>
        <div class="values">
          <h4>{{ gameClient?.stats?.shellsUsed }}</h4>
          <h4>{{ gameClient?.stats?.totalDamage }}</h4>
          <h4 v-if="!isVsAI">{{ gameClient?.stats?.points }}</h4>
        </div>
      </section>
      <section class="controls">
        <Button icon="chevron-left" :size="1.4" icon-left @click="handleBackToLobby">Lobby</Button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  position: absolute;
  width: 100%;
  height: 100%;
}
.game-container canvas {
  width: 100%;
  height: 100%;
}

.game-container .feed-load {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
}

.feed-load .background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/assets/images/load.png');
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: blur(2px);
}

.feed-load .spinner {
  width: 20rem;
  height: 2.3rem;
}

.matchend {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #00000029;
}
.matchend .title {
  font-size: 4rem;
  margin-left: 2rem;
}
.matchend .title .background {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background: url('/assets/images/background.jpg');
  mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0));
}
.matchend .stats {
  display: flex;
  margin-right: 2rem;
  column-gap: 1rem;
}
.matchend .controls {
  position: absolute;
  left: 2rem;
  top: calc(50% + 6rem);
}

.timer {
  background-color: #daaa818a;
  padding: 0.25rem 1rem;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
}

@media (max-width: 768px) and (orientation: portrait) {
  .matchend {
    flex-direction: column;
  }
}
</style>
