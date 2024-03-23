<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { throttle } from '@/utils/utils';
import type { Nullable } from '@babylonjs/core';
import { GameClient } from '@/game/client';
import { useRoute } from 'vue-router';

const route = useRoute();

const containerEl = ref<Nullable<HTMLDivElement>>(null);
const canvasEl = ref<Nullable<HTMLCanvasElement>>(null);
const isLoading = ref(false);

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

    // Initialize the game
    isLoading.value = true;
    await GameClient.get().createWorld(canvasEl.value, route.hash === '#ai');
    isLoading.value = false;
  }
});
onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <div class="game-container" ref="containerEl">
    <div v-if="isLoading" class="feed-load"></div>
    <canvas ref="canvasEl"></canvas>
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
  background-color: rgb(255, 145, 145);
}
</style>
@/game/main
