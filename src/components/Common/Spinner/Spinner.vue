<script setup>
import { computed } from 'vue';

const props = defineProps({
  trackable: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Number,
    default: 0.0
  }
});

const overlayWidth = computed(() => `${Math.round(props.progress * 100)}%`);
</script>

<template>
  <div class="spinner">
    <div v-if="trackable" class="trackable">
      <div class="overlay" :style="{ width: overlayWidth }"></div>
      <div class="progress">
        <slot></slot>
      </div>
    </div>
    <img class="tank-icon" src="/assets/icons/tank.png" />
  </div>
</template>

<style scoped>
@keyframes scroll {
  0% {
    background-position-x: 0%;
  }
  100% {
    background-position-x: 100%;
  }
}

.spinner {
  width: 100%;
  height: 100%;
  background-image: url('./assets/images/spinner-scroller.png');
  background-position: bottom;
  background-size: 200% auto;
  background-repeat: repeat-x;
  animation-name: scroll;
  animation-duration: 2s;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
  animation-iteration-count: infinite;
  filter: invert(1);
}
.spinner::before {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 100%;
  box-shadow: 0px 0px 10px 10px #fff;
}
.spinner::after {
  content: '';
  display: block;
  position: absolute;
  right: 0;
  top: 0;
  width: 0;
  height: 100%;
  box-shadow: 0px 0px 10px 10px #fff;
}

.tank-icon {
  top: 3px;
  left: 50%;
  transform: translateX(-50%);
}

.trackable {
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
.trackable .overlay {
  z-index: 1;
  background-color: #ffffff83;
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
}
.trackable .progress {
}
</style>
