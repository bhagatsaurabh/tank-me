<script setup>
import { ref } from 'vue';

import Icon from '@/components/Common/Icon/Icon.vue';
import Spinner from '@/components/Common/Spinner/Spinner.vue';
import { noop } from '@/utils/utils';

const props = defineProps({
  icon: {
    type: String,
    default: null
  },
  iconLeft: {
    type: Boolean,
    default: false
  },
  iconRight: {
    type: Boolean,
    default: false
  },
  size: {
    type: Number,
    default: 1
  },
  async: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  action: {
    type: Function,
    default: noop
  }
});

const el = ref(null);
const busy = ref(false);

const handleClick = async () => {
  if (props.async) busy.value = true;
  await props.action();
  busy.value = false;
};

defineExpose({
  native: el
});
</script>

<template>
  <button
    @click="handleClick"
    ref="el"
    class="control"
    :style="{ fontSize: `${size}rem` }"
    :disabled="disabled || busy"
  >
    <Icon
      class="mr-0p5"
      v-if="icon && iconLeft"
      v-hide="busy"
      :alt="`${icon} icon`"
      :name="icon"
      :size="size"
    />
    <Icon
      v-if="icon && !iconLeft && !iconRight"
      v-hide="busy"
      :alt="`${icon} icon`"
      :name="icon"
      :size="size"
    />
    <div class="content" tabindex="-1" v-hide="busy">
      <slot></slot>
    </div>
    <Icon
      class="ml-0p5"
      v-if="icon && iconRight"
      v-hide="busy"
      :alt="`${icon} icon`"
      :name="icon"
      :size="size"
    />
    <Spinner v-if="async && busy" :size="0.75 * size" />
  </button>
</template>

<style scoped>
.control {
  cursor: pointer;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  color: #000;
  border: none;
  padding: 0.5rem 1rem;
  background-image: url('./assets/images/dirt-overlay.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-color: #c9b18b;
  box-shadow:
    2.5px 2.5px 5px 0 black,
    0 0 0 0 black inset;
  transition: all 0.1s linear;
}

.control:disabled {
  opacity: 0.6;
  pointer-events: none;
  cursor: not-allowed;
}

.control:deep(span) {
  display: inline-flex;
  transition: opacity 0.2s linear;
}
.control div {
  display: inline-flex;
  align-items: center;
}

.control:deep(.spinner) {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.control:active {
  box-shadow:
    0 0 0 0 black,
    2.5px 2.5px 5px 0 black inset;
}

.content {
  overflow: auto;
}

@media (hover: hover) {
  .control:hover {
    box-shadow:
      2px 2px 4px 0 #000,
      0 0 0 0 #000 inset;
  }
  .control:active:hover {
    box-shadow:
      0px 0px 0px 0 #000,
      2.5px 2.5px 5px 0 black inset;
  }
}
</style>
