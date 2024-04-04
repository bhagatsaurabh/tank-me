import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { ScreenOrientation } from '@/types';
import { GameClient } from '@/game/client';

export const usePresentationStore = defineStore('presentation', () => {
  const isFullscreen = ref(false);
  const orientation = ref<ScreenOrientation>('landscape');
  const media = ref<'desktop' | 'mobile'>('desktop');

  const fullscreenChangeListener = () => {
    isFullscreen.value = !!document.fullscreenElement;
    if (isFullscreen.value) {
      (screen.orientation as any).lock('landscape').catch((error: Error) => console.log(error));
    }
    GameClient.get()?.world?.engine?.resize(true);
  };
  const orientationChangeListener = () => {
    if (screen.orientation.type.includes('landscape')) orientation.value = 'landscape';
    else orientation.value = 'portrait';
    GameClient.get()?.world?.engine?.resize(true);
  };
  const desktopMediaListener = (event: MediaQueryListEvent) => {
    media.value = event.matches ? 'desktop' : 'mobile';
  };
  let mQueryDesktop: MediaQueryList;
  function registerListeners() {
    document.documentElement.addEventListener('fullscreenchange', fullscreenChangeListener);
    (screen as any).addEventListener('orientationchange', orientationChangeListener);
    mQueryDesktop = matchMedia('(min-width: 1024px');
    mQueryDesktop.addEventListener('change', desktopMediaListener);
    media.value = mQueryDesktop.matches ? 'desktop' : 'mobile';
  }
  function unregister() {
    document.documentElement.removeEventListener('fullscreenchange', fullscreenChangeListener);
    (screen as any).removeEventListener('orientationchange', orientationChangeListener);
    mQueryDesktop?.removeEventListener('change', desktopMediaListener);
  }
  async function fullscreen() {
    if (isFullscreen.value) return true;

    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch (error) {
      console.log(error);
    }
    return false;
  }

  return {
    isFullscreen,
    orientation,
    media,
    registerListeners,
    unregister,
    fullscreen
  };
});
