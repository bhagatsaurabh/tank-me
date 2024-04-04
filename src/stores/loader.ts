import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Nullable } from '@babylonjs/core';
import { clamp } from '@/utils';

export const useLoaderStore = defineStore('loader', () => {
  const progress = ref(0.0);
  const noOfFiles = ref(0);
  const noOfFilesDownloaded = ref(0);
  const isLoading = ref(false);
  const cache = ref<Record<string, string>>({});

  function setTotalFiles(fileCount: number) {
    noOfFiles.value = fileCount;
  }
  function updateProgress(prgs: number) {
    progress.value = clamp(prgs, 0, 1);
  }
  function updateFileCount(noOfFiles: number) {
    noOfFilesDownloaded.value = noOfFiles;
  }
  async function prefetch(path: string) {
    if (cache.value[path]) return;

    try {
      const res = await fetch(path);
      cache.value[path] = URL.createObjectURL(await res.blob());
      return true;
    } catch (error) {
      console.log(error);
    }
    return false;
  }
  function get(path: string): Nullable<string> {
    return cache.value[path];
  }

  return {
    isLoading,
    progress,
    noOfFilesDownloaded,
    noOfFiles,
    cache,
    setTotalFiles,
    updateProgress,
    updateFileCount,
    prefetch,
    get
  };
});
