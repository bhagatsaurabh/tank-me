<script setup>
import { watch, onBeforeUnmount, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { getSlug, trapBetween, trapFocus, noop } from '@/utils/utils';
import Backdrop from '@/components/Common/Backdrop/Backdrop.vue';
import Icon from '@/components/Common/Icon/Icon.vue';
import Button from '@/components/Common/Button/Button.vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  controls: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['dismiss', 'action']);

const router = useRouter();
const el = ref(null);
const queuedAction = ref(null);
const bound = ref(null);
const show = ref(false);
const waitForAction = ref(false);

const keyListener = (event) => trapFocus(event, el.value, bound.value);

const handleDismiss = () => {
  if (show.value) {
    window.removeEventListener('keydown', keyListener);
    show.value = false;
    router.back();
  }
};
const handleAction = async (control) => {
  if (!control.async) {
    if (queuedAction.value === null) {
      queuedAction.value = control;
      handleDismiss();
    }
  } else {
    control.busy = true;
    waitForAction.value = true;
    await control.action();
    handleDismiss();
  }
};
const handleLeave = () => {
  queuedAction.value && emit('action', queuedAction.value);
  emit('dismiss');
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
  document.activeElement?.blur();
  show.value = true;
});
onBeforeUnmount(unregisterGuard);
</script>

<template>
  <Backdrop :dismissable="!waitForAction" :show="show" @dismiss="handleDismiss" />
  <Transition @after-leave="handleLeave" v-bind="$attrs" name="scale-fade" appear>
    <div v-if="show" ref="el" class="modal" role="dialog">
      <div class="bg"></div>
      <Icon
        v-if="!controls.length"
        class="close-icon"
        alt="Close icon"
        name="close"
        adaptive
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
          :key="control"
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
  box-shadow: 0 0 10px 0px #000;
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
.close-icon {
  margin-left: calc(100% - 1.1rem);
  vertical-align: unset;
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

@media (min-width: 768px) {
  .modal {
    min-width: 25%;
  }
}
@media (min-width: 1024px) {
  /*  */
}
</style>
