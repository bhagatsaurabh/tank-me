<script setup lang="ts">
import { watch, onBeforeUnmount, ref, onMounted, type PropType } from 'vue';
import { useRouter } from 'vue-router';
import type { Nullable } from '@babylonjs/core';

import { getSlug, trapBetween, trapFocus, noop } from '@/utils';
import { Backdrop, Button } from '@/components/common';
import type { IModalAction, ITrapBounds } from '@/types';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  controls: {
    type: Array as PropType<IModalAction[]>,
    default: () => []
  },
  hidden: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['dismiss', 'action']);

const router = useRouter();
const el = ref(null);
const queuedAction = ref<Nullable<IModalAction>>(null);
const bound = ref<Nullable<ITrapBounds>>(null);
const show = ref(false);
const waitForAction = ref(false);

const keyListener = (event: KeyboardEvent) => trapFocus(event, el.value!, bound.value!);

const handleDismiss = () => {
  if (show.value) {
    window.removeEventListener('keydown', keyListener);
    show.value = false;
    router.back();
  }
};
const handleAction = async (control: IModalAction) => {
  if (!control.async) {
    if (queuedAction.value === null) {
      queuedAction.value = control;
      handleDismiss();
    }
  } else {
    control.busy = true;
    waitForAction.value = true;
    if (control.action) await control.action();
    handleDismiss();
  }
};
const handleLeave = () => {
  queuedAction.value && emit('action', queuedAction.value);
  emit('dismiss');
};
const showModal = () => {
  (document.activeElement as HTMLElement)?.blur();
  show.value = true;
};
const hideModal = () => {
  handleDismiss();
};

let unregisterGuard = () => {};
watch(
  show,
  async (newVal, oldVal) => {
    if (oldVal !== newVal && newVal) {
      await router.push({ hash: getSlug(props.title) });

      unregisterGuard = router.beforeEach((_to, from, next) => {
        if (from.hash.startsWith('#pop')) {
          window.removeEventListener('keydown', keyListener);
          show.value = false;
        }
        unregisterGuard();
        next();
      });
    }
  },
  { immediate: true }
);
watch(el, () => {
  if (el.value) {
    bound.value = trapBetween(el.value);
    window.addEventListener('keydown', keyListener);
  }
});

onMounted(() => {
  if (!props.hidden) {
    showModal();
  }
});
onBeforeUnmount(unregisterGuard);

defineExpose({
  showModal,
  hideModal
});
</script>

<template>
  <Backdrop :dismissable="!waitForAction" :show="show" @dismiss="handleDismiss" />
  <Transition @after-leave="handleLeave" v-bind="$attrs" name="scale-fade" appear>
    <div v-if="show" ref="el" class="modal" role="dialog">
      <div class="bg"></div>
      <Button
        class="close-icon"
        v-if="!controls.length"
        icon="close"
        @click="waitForAction ? noop : handleDismiss"
      />
      <h2 class="title">{{ title }}</h2>
      <div class="content">
        <slot></slot>
      </div>
      <div v-if="controls.length" class="controls">
        <Button
          :disabled="waitForAction"
          v-for="control in controls"
          :key="control.text"
          @click="() => handleAction(control)"
          :async="control.async"
          :busy="control.busy"
          accented
        >
          {{ control.text }}
        </Button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal {
  position: fixed;
  z-index: 102;
  border: 1px solid white;
  box-shadow: 0 0 20px 0px #000000ba;
  left: 50%;
  top: 50%;
  background-color: #434343;
  transform: translate(-50%, -50%) scale(1);
  padding: 1rem;
  color: #f3f3f3;
  transform-origin: center;
}

.modal .content {
  white-space: break-spaces;
  margin-bottom: 2rem;
}
.modal .title {
  font-weight: light;
  margin-bottom: 1rem;
}
.modal .controls {
  display: flex;
  justify-content: flex-end;
  column-gap: 1rem;
}
.modal .bg {
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  background-image: url('/assets/images/background.jpg');
  opacity: 0.1;
}

.close-icon {
  margin-left: calc(100% - 1.1rem);
}

@media (min-width: 768px) {
  .modal {
    min-width: 25%;
  }
}
@media (min-width: 1024px) {
  /*  */
}
</style>
