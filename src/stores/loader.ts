import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useLoaderStore = defineStore('loader', () => {
  const progress = ref<number>(0.0);
  const noOfFilesDownloaded = ref<number>(0);
  const isLoading = ref(false);

  function updateProgress(prgs: number) {
    progress.value = prgs;
  }
  function updateFileCount(noOfFiles: number) {
    noOfFilesDownloaded.value = noOfFiles;
  }

  return {
    isLoading,
    progress,
    noOfFilesDownloaded,
    updateProgress,
    updateFileCount
  };
});
