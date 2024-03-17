import type { Directive, DirectiveBinding } from 'vue';

export const vHide: Directive<HTMLElement, any> = (el: HTMLElement, binding: DirectiveBinding<boolean>) => {
  el.style.opacity = binding.value ? '0' : '1';
  el.style.pointerEvents = binding.value ? 'none' : 'all';
};
