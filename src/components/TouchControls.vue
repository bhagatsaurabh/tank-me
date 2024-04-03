<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const isSupported = ref(false);
const mQuery = ref<MediaQueryList>(window.matchMedia('(pointer: coarse) and (hover: none)'));

const changeListener = () => checkDevice();
const checkDevice = () => {
  isSupported.value = mQuery.value.matches;
};

onMounted(() => {
  checkDevice();
  mQuery.value.addEventListener('change', changeListener);
});
onBeforeUnmount(() => mQuery.value.removeEventListener('change', changeListener));
</script>

<template>
  <div v-if="isSupported" class="touch-controls">Touch Controls</div>
</template>

<style scope>
.touch-controls {
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 51;
}
</style>
