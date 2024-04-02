import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useLoaderStore = defineStore('loader', () => {
  const progress = ref(0.0);
  const noOfFiles = ref(0);
  const noOfFilesDownloaded = ref(0);
  const isLoading = ref(false);

  function setTotalFiles(fileCount: number) {
    noOfFiles.value = fileCount;
  }
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
    noOfFiles,
    setTotalFiles,
    updateProgress,
    updateFileCount
  };
});
