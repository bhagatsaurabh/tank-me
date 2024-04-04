<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Nullable } from '@babylonjs/core';
import { GameClient } from '@/game/client';
import { clamp, denormalize, normalize } from '@/utils';
import { InputManager } from '@/game/input';
import { touchMap } from '@/utils/constants';

const isSupported = ref(false);
const moveBgEl = ref<Nullable<HTMLElement>>(null);
const moveFgEl = ref<Nullable<HTMLElement>>(null);
const mQuery = ref<MediaQueryList>(window.matchMedia('(pointer: coarse) and (hover: none)'));
const moveBgPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });

const changeListener = () => checkDevice();
const checkDevice = () => {
  isSupported.value = mQuery.value.matches;
};

const handleMove = (event: TouchEvent) => {
  event.preventDefault();
  if (!moveBgEl.value || !moveFgEl.value) return;

  const rect = moveBgEl.value.getBoundingClientRect();
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  moveBgPos.value = {
    x: rect.left + halfWidth,
    y: rect.top + halfHeight
  };

  const rawX = clamp(event.touches[0].clientX - moveBgPos.value.x, -halfWidth, halfWidth);
  const rawY = clamp(event.touches[0].clientY - moveBgPos.value.y, -halfHeight, halfHeight);
  const fgPos = {
    x: clamp(rawX + halfWidth, 16, rect.width - 16),
    y: clamp(rawY + halfHeight, 16, rect.height - 16)
  };
  moveFgEl.value.style.left = `${fgPos.x}px`;
  moveFgEl.value.style.top = `${fgPos.y}px`;

  const normRawX = denormalize(normalize(rawX, -halfWidth, halfWidth), -1, 1);
  const normRawY = denormalize(normalize(rawY, -halfHeight, halfHeight), -1, 1);

  InputManager.input[touchMap['Joystick1Left']] = normRawX > 0.4;
  InputManager.input[touchMap['Joystick1Right']] = normRawX < -0.4;
  InputManager.input[touchMap['Joystick1Up']] = normRawY > 0.4;
  InputManager.input[touchMap['Joystick1Down']] = normRawY < -0.4;
};
const handleMoveCancel = () => {
  if (!moveFgEl.value) return;

  moveFgEl.value.style.left = '50%';
  moveFgEl.value.style.top = '50%';

  InputManager.input[touchMap['Joystick1Left']] = false;
  InputManager.input[touchMap['Joystick1Right']] = false;
  InputManager.input[touchMap['Joystick1Up']] = false;
  InputManager.input[touchMap['Joystick1Down']] = false;
};
const handleBrakeOn = () => {
  InputManager.input[touchMap['Brake']] = true;
};
const handleBrakeOff = () => {
  InputManager.input[touchMap['Brake']] = false;
};
const handleResetOn = () => {
  InputManager.input[touchMap['Reset']] = true;
};
const handleResetOff = () => {
  InputManager.input[touchMap['Reset']] = false;
};
const handleBarrelOn = (isUp: boolean) => {
  if (isUp) {
    InputManager.input[touchMap['Joystick2Up']] = true;
    InputManager.input[touchMap['Joystick2Down']] = false;
  } else {
    InputManager.input[touchMap['Joystick2Down']] = true;
    InputManager.input[touchMap['Joystick2Up']] = false;
  }
};
const handleBarrelOff = () => {
  InputManager.input[touchMap['Joystick2Up']] = false;
  InputManager.input[touchMap['Joystick2Down']] = false;
};
const handleTurretOn = (isLeft: boolean) => {
  if (isLeft) {
    InputManager.input[touchMap['Joystick2Left']] = true;
    InputManager.input[touchMap['Joystick2Right']] = false;
  } else {
    InputManager.input[touchMap['Joystick2Right']] = true;
    InputManager.input[touchMap['Joystick2Left']] = false;
  }
};
const handleTurretOff = () => {
  InputManager.input[touchMap['Joystick2Left']] = false;
  InputManager.input[touchMap['Joystick2Right']] = false;
};
const handleFireOn = () => {
  InputManager.input[touchMap['Fire']] = true;
};
const handleFireOff = () => {
  InputManager.input[touchMap['Fire']] = false;
};
const handlePerspectiveOn = () => {
  InputManager.input[touchMap['Perspective']] = true;
};
const handlePerspectiveOff = () => {
  InputManager.input[touchMap['Perspective']] = false;
};

onMounted(() => {
  checkDevice();
  mQuery.value.addEventListener('change', changeListener);
});
onBeforeUnmount(() => mQuery.value.removeEventListener('change', changeListener));
</script>

<template>
  <div
    v-if="isSupported && GameClient.get() && !GameClient.get().isMatchEnded"
    class="touch-controls"
    @contextmenu.prevent="(e) => e.stopPropagation()"
  >
    <div class="left">
      <div
        class="joystick-move"
        @touchstart="handleMove"
        @touchmove="handleMove"
        @touchcancel="handleMoveCancel"
        @touchend="handleMoveCancel"
      >
        <div class="bg" ref="moveBgEl">
          <img class="chevron c-left" src="/assets/icons/chevron-left.png" :draggable="false" />
          <img class="chevron c-right" src="/assets/icons/chevron-left.png" :draggable="false" />
          <img class="chevron c-up" src="/assets/icons/chevron-left.png" :draggable="false" />
          <img class="chevron c-down" src="/assets/icons/chevron-left.png" :draggable="false" />
        </div>
        <div class="fg" ref="moveFgEl"></div>
      </div>
      <div
        class="brake"
        @pointerdown="handleBrakeOn"
        @pointerup="handleBrakeOff"
        @pointercancel="handleBrakeOff"
        @pointerout="handleBrakeOff"
        @pointerleave="handleBrakeOff"
      >
        <img src="/assets/icons/brake.png" :draggable="false" />
      </div>
      <div
        class="reset"
        @pointerdown="handleResetOn"
        @pointerup="handleResetOff"
        @pointercancel="handleResetOff"
        @pointerout="handleResetOff"
        @pointerleave="handleResetOff"
      >
        <img src="/assets/icons/reset-turret.png" :draggable="false" />
      </div>
    </div>
    <div class="right">
      <div class="joystick-aim">
        <img
          @pointerdown="() => handleBarrelOn(true)"
          @pointerup="handleBarrelOff"
          @pointercancel="handleBarrelOff"
          @pointerout="handleBarrelOff"
          @pointerleave="handleBarrelOff"
          class="control up"
          src="/assets/icons/control-barrelup.png"
          :draggable="false"
        />
        <img
          @pointerdown="() => handleBarrelOn(false)"
          @pointerup="handleBarrelOff"
          @pointercancel="handleBarrelOff"
          @pointerout="handleBarrelOff"
          @pointerleave="handleBarrelOff"
          class="control down"
          src="/assets/icons/control-barreldown.png"
          :draggable="false"
        />
        <img
          @pointerdown="() => handleTurretOn(true)"
          @pointerup="handleTurretOff"
          @pointercancel="handleTurretOff"
          @pointerout="handleTurretOff"
          @pointerleave="handleTurretOff"
          class="control left"
          src="/assets/icons/control-turretleft.png"
          :draggable="false"
        />
        <img
          @pointerdown="() => handleTurretOn(false)"
          @pointerup="handleTurretOff"
          @pointercancel="handleTurretOff"
          @pointerout="handleTurretOff"
          @pointerleave="handleTurretOff"
          class="control right"
          src="/assets/icons/control-turretright.png"
          :draggable="false"
        />
      </div>
      <div
        @pointerdown="handlePerspectiveOn"
        @pointerup="handlePerspectiveOff"
        @pointercancel="handlePerspectiveOff"
        @pointerout="handlePerspectiveOff"
        @pointerleave="handlePerspectiveOff"
        class="perspective"
      >
        FPP
      </div>
      <div
        @pointerdown="handleFireOn"
        @pointerup="handleFireOff"
        @pointercancel="handleFireOff"
        @pointerout="handleFireOff"
        @pointerleave="handleFireOff"
        class="fire"
      >
        <img src="/assets/game/gui/shell.png" :draggable="false" />
      </div>
    </div>
  </div>
</template>

<style scope>
.touch-controls {
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  z-index: 51;
  padding: 2.5rem;
  user-select: none;
  touch-action: none;
}

.joystick-move .bg {
  width: 17vw;
  height: 17vw;
  background-color: #000;
  opacity: 0.25;
  border-radius: 100%;
}
.joystick-move .fg {
  position: absolute;
  width: 30%;
  height: 30%;
  background-color: #000;
  opacity: 0.25;
  border-radius: 100%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  filter: invert(1);
}
.joystick-move .chevron {
  position: absolute;
  filter: invert(1);
  width: 1rem;
  height: 1rem;
}
.joystick-move .chevron.c-left {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}
.joystick-move .chevron.c-right {
  right: 0;
  top: 50%;
  transform: translateY(-50%) rotateZ(180deg);
}
.joystick-move .chevron.c-up {
  left: 50%;
  top: 0;
  transform: translateX(-50%) rotateZ(90deg);
}
.joystick-move .chevron.c-down {
  left: 50%;
  bottom: 0;
  transform: translateX(-50%) rotateZ(-90deg);
}

.joystick-aim {
  width: 15vw;
  height: 15vw;
}

.joystick-aim .control {
  position: absolute;
  opacity: 0.25;
  background-color: #00000047;
  padding: 0.75rem;
  border-radius: 100%;
  filter: invert(1);
}
.joystick-aim .control.up {
  left: 50%;
  top: 0;
  transform: translate(-50%, -25%);
}
.joystick-aim .control.down {
  left: 50%;
  bottom: 0;
  transform: translate(-50%, 25%);
}
.joystick-aim .control.left {
  left: 0;
  top: 50%;
  transform: translate(-25%, -50%);
}
.joystick-aim .control.right {
  right: 0;
  top: 50%;
  transform: translate(25%, -50%);
}

.left .brake {
  position: absolute;
  bottom: -1rem;
  right: -3rem;
  opacity: 0.25;
  padding: 0.75rem;
  background-color: #00000047;
  font-size: 0;
  border-radius: 100%;
}
.left .brake img {
  width: 1.8rem;
  height: 1.8rem;
  filter: invert(1);
  pointer-events: none;
}

.left .reset {
  position: absolute;
  bottom: 2.75rem;
  right: -4.25rem;
  opacity: 0.25;
  padding: 0.75rem;
  background-color: #00000047;
  font-size: 0;
  border-radius: 100%;
}
.left .reset img {
  width: 1.8rem;
  height: 1.8rem;
  filter: invert(1);
}

.right .fire {
  width: min-content;
  padding: 1.5rem;
  background-color: #00000047;
  border-radius: 100%;
  position: absolute;
  top: -125%;
  right: 1rem;
  width: min-content;
  height: min-content;
  font-size: 0;
}
.right .fire img {
  width: 2.5rem;
  height: 2.5rem;
  transform: rotateZ(-45deg);
  opacity: 0.5;
}

.right .perspective {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  bottom: -1rem;
  left: -50%;
  width: 3.5rem;
  height: 3.5rem;
  font-size: 0.75rem;
  padding: 0.5rem;
  border-radius: 100%;
  background-color: #00000047;
  opacity: 0.5;
}
</style>
