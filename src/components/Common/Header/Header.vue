<script setup></script>

<template>
  <header class="header">
    <div class="background"></div>
    <div class="left">
      <slot name="left"></slot>
    </div>
    <div v-if="$slots.right" class="right">
      <slot name="right"></slot>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  width: 100%;
  height: var(--header-height);
  top: 0;
  z-index: 10;
}
.header .background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/assets/images/dirt-overlay.png');
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 1) 75%, rgba(0, 0, 0, 0));
  background-size: auto;
}

header.header .left,
header.header .right {
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
}
header.header .left {
  justify-content: start;
}
header.header .right {
  justify-content: end;
}
</style>
