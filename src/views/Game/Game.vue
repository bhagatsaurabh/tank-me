<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { throttle } from '@/utils/utils';
import type { Nullable } from '@babylonjs/core';
import { GameClient } from '@/game/client';
import { useRoute } from 'vue-router';
import Spinner from '@/components/Common/Spinner/Spinner.vue';

const route = useRoute();

const containerEl = ref<Nullable<HTMLDivElement>>(null);
const canvasEl = ref<Nullable<HTMLCanvasElement>>(null);
const isLoading = ref(false);
const gameClient = ref<Nullable<GameClient>>(null);

const handleResize = () => {
  if (canvasEl.value) {
    canvasEl.value.width = Math.floor(window.innerWidth);
    canvasEl.value.height = Math.floor(window.innerHeight);
  }
};
const throttledHandleResize = throttle(handleResize, 200);

let observer: ResizeObserver;
onMounted(async () => {
  observer = new ResizeObserver(throttledHandleResize);
  if (canvasEl.value) {
    observer.observe(canvasEl.value);
    canvasEl.value.width = window.innerWidth;
    canvasEl.value.height = window.innerHeight;

    gameClient.value = GameClient.get();

    // Initialize the game
    isLoading.value = true;
    await gameClient.value.createWorld(canvasEl.value, route.hash === '#ai');
    isLoading.value = false;
  }
});
onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <div class="game-container" ref="containerEl">
    <div v-if="isLoading" class="feed-load">
      <div class="background"></div>
      <div class="spinner">
        <Spinner />
      </div>
    </div>
    <canvas ref="canvasEl"></canvas>
    <div v-if="gameClient?.isMatchEnded" class="matchend">
      <section class="title">
        {{ gameClient?.didWin ? 'Winner !' : 'Lost' }}
      </section>
      <section class="stats">
        <div class="keys">
          <h4>Shells Used: </h4>
          <h4>Total Damage: </h4>
        </div>
        <div class="values">
          <h4>{{ gameClient?.stats.shellsUsed }}</h4>
          <h4>{{ gameClient?.stats.totalDamage }}</h4>
        </div>
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
  justify-content: center;
  align-items: center;
}
</style>
