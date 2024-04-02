<script setup lang="ts">
import { onMounted, ref, type PropType } from 'vue';
import type { Nullable } from '@babylonjs/core';

const props = defineProps({
  type: {
    type: String,
    default: 'text'
  },
  placeholder: {
    type: String,
    default: null
  },
  attrs: {
    type: Object,
    default: () => ({})
  },
  validator: {
    type: Function as PropType<(val: string) => string>,
    default: () => null
  },
  validation: {
    type: String,
    default: 'Lazy',
    validator: (val: string) => ['Lazy', 'Eager', 'Off'].includes(val)
  },
  focus: {
    type: Boolean,
    default: false
  },
  modelValue: String
});
const emit = defineEmits(['update:modelValue']);

const native = ref<Nullable<HTMLInputElement>>(null);
const errormsg = ref<string>('');

const handleInput = (e: Event) => {
  if (props.validation === 'Eager') validate((e.target as HTMLInputElement)?.value);
  else {
    errormsg.value = '';
    native.value?.setCustomValidity('');
  }

  emit('update:modelValue', (e.target as HTMLInputElement).value);
};
const validate = (val: string) => {
  errormsg.value = props.validator(val);
  native.value?.setCustomValidity(errormsg.value);
  return errormsg.value;
};
const invalidate = (msg: string) => {
  errormsg.value = msg;
  native.value?.setCustomValidity(errormsg.value);
};

onMounted(() => props.focus && native.value?.focus());

defineExpose({ native, validate, invalidate });
</script>

<template>
  <span
    :class="{
      input: true,
      blank: !modelValue,
      invalid: !!errormsg
    }"
    :data-placeholder="placeholder"
  >
    <input
      ref="native"
      :value="modelValue"
      @input="handleInput"
      :type="type"
      :placeholder="placeholder"
      v-bind="attrs"
    />
    <Transition name="slide-down">
      <div v-if="validation !== 'Off' && !!errormsg" class="errormsg">
        <span>{{ errormsg }}</span>
      </div>
    </Transition>
  </span>
</template>

<style scoped>
.input {
  display: inline-block;
  margin-bottom: 1.5rem;
}
.input input {
  height: 100%;
  width: 100%;
  font-size: 1rem;
  border: none;
  padding: 0.5rem;
  background-color: transparent;
  color: #dedede;
  transition: all 0.1s linear;
}

.input::after {
  content: '';
  display: block;
  position: absolute;
  width: 100%;
  height: 1px;
  bottom: 0;
  left: 0;
  transition:
    height 0.1s linear,
    background-color 0.1s linear;
  background-color: gray;
}
.input:focus-within::after {
  background-color: #c8b08a;
  height: 4px;
}
.input.invalid:focus-within::after {
  background-color: #ff4b4b;
}
.input input:focus {
  outline: none;
  background-color: #d9d9d9cc;
  color: #1f1f1f;
  box-shadow: 0px -8px 10px -6px inset;
}
.errormsg {
  position: absolute;
  width: 100%;
  bottom: -1.5rem;
  left: 0;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  font-weight: 600;
  font-size: 0.75rem;
  color: red;
  transform-origin: top;
  background-color: #ffffff5e;
}
.errormsg::before {
  content: '';
  display: block;
  position: absolute;
  width: 2px;
  height: 100%;
  background-color: red;
}
.errormsg span {
  margin-left: 0.5rem;
}
</style>
