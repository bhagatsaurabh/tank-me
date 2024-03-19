<script setup>
defineProps({
  size: {
    type: Number,
    default: 1
  }
});
</script>

<template>
  <div class="spinner">
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

.tank-icon {
  top: 3px;
  left: 50%;
  transform: translateX(-50%);
}
</style>
