<script setup></script>

<template>
  <header class="header">
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
  background-color: #c9b18b;
  box-shadow: 0 0 5px 0 #000;
  background-image: url('/assets/images/dirt-overlay.png');
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
