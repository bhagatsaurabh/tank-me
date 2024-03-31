<script setup lang="ts">
import type { Nullable } from '@babylonjs/core';
import { ref, onUpdated } from 'vue';

const props = defineProps({
  alt: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 1
  },
  animated: {
    type: Boolean,
    default: false
  }
});

const extn = props.animated ? 'gif' : 'png';
const metaUrl = import.meta.url;
const source = ref<Nullable<string>>(null);
if (props.name.startsWith('src#')) {
  source.value = props.name.substring(4);
} else {
  source.value = new URL(`/assets/icons/${props.name}.${extn}`, metaUrl).href;
}

onUpdated(() => {
  if (props.name.startsWith('src#')) {
    source.value = props.name.substring(4);
  } else {
    source.value = new URL(`/assets/icons/${props.name}.${extn}`, metaUrl).href;
  }
});
</script>

<template>
  <span class="icon-container">
    <img :alt="alt" :style="{ maxWidth: `${size}rem` }" class="icon" :src="source!" :draggable="false" />
  </span>
</template>

<style scoped>
.icon-container {
  user-select: none;
}
</style>
