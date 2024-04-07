import { getFile, storeFile } from '@/database/driver';
import { useNotificationStore, useLoaderStore } from '@/stores';
import { Notifications } from '@/utils/constants';
import { readAsArrayBuffer, readAsDataURL } from '@/utils';

export class AssetLoader {
  static assets: Record<string, string | ArrayBuffer> = {};
  static noOfFilesDownloaded: number = 0;
  private static assetSources = [
    { path: '/assets/game/models/Panzer_I.glb' },
    { path: '/assets/game/map/desert/height.png' },
    { path: '/assets/game/map/desert/diffuse.png' },
    { path: '/assets/game/textures/explosion.jpg' },
    { path: '/assets/game/textures/flare.png' },
    { path: '/assets/game/textures/fire.jpg' },
    { path: '/assets/game/textures/grass.png' },
    { path: '/assets/game/spritesheets/smoke_dust_cloud.png' },
    { path: '/assets/game/spritesheets/explosion.png' },
    { path: '/assets/game/spritesheets/fire.png' },
    { path: '/assets/game/audio/explosion.mp3', format: 'arraybuffer' },
    { path: '/assets/game/audio/cannon.mp3', format: 'arraybuffer' },
    { path: '/assets/game/audio/idle.mp3', format: 'arraybuffer' },
    { path: '/assets/game/audio/run.mp3', format: 'arraybuffer' },
    { path: '/assets/game/audio/load.mp3', format: 'arraybuffer' },
    { path: '/assets/game/audio/whizz1.mp3', format: 'arraybuffer' },
    { path: '/assets/game/audio/whizz2.mp3', format: 'arraybuffer' },
    { path: '/assets/game/gui/ads.png' },
    { path: '/assets/game/gui/overlay.png' },
    { path: '/assets/game/gui/shell.png' }
  ];

  static async load() {
    const loaderStore = useLoaderStore();
    const notify = useNotificationStore();

    loaderStore.setTotalFiles(this.assetSources.length);
    loaderStore.isLoading = true;

    try {
      // Cache check
      const files = await Promise.all(AssetLoader.assetSources.map((filePath) => getFile(filePath.path)));

      if (files.filter((file) => !file).length === 0) {
        AssetLoader.assetSources.forEach(
          (filePath, idx) => (AssetLoader.assets[filePath.path] = URL.createObjectURL(files[idx] as Blob))
        );
      }

      // Cache miss
      const responses = await Promise.all(
        AssetLoader.assetSources.map((filePath, idx) =>
          files[idx] ? Promise.resolve(null) : fetch(filePath.path)
        )
      );
      let contentLoaded = 0;
      const totalContentLength = responses
        .map((res) => (res ? parseInt(res.headers.get('content-length') ?? '0') : 0))
        .reduce((total, len) => total + len, 0);

      const blobs = await Promise.all(
        AssetLoader.assetSources.map((_path, idx) => {
          if (!responses[idx]) return Promise.resolve(null);
          else {
            const res = new Response(
              new ReadableStream({
                async start(controller) {
                  const reader = responses[idx]?.body?.getReader();
                  for (;;) {
                    const { done, value } = await (reader as ReadableStreamDefaultReader).read();
                    if (done) {
                      AssetLoader.noOfFilesDownloaded += 1;
                      loaderStore.updateFileCount(AssetLoader.noOfFilesDownloaded);
                      break;
                    }
                    contentLoaded += value.byteLength;
                    loaderStore.updateProgress(contentLoaded / totalContentLength);
                    controller.enqueue(value);
                  }
                  controller.close();
                }
              })
            );
            return res.blob();
          }
        })
      );

      // Store in cache
      await Promise.all(
        blobs.map((blob, idx) =>
          blob ? storeFile(AssetLoader.assetSources[idx].path, blob) : Promise.resolve()
        )
      );

      // Get Object URLs
      AssetLoader.assetSources.forEach(
        (filePath, idx) =>
          (AssetLoader.assets[filePath.path] = URL.createObjectURL((blobs[idx] ?? files[idx]) as Blob))
      );

      // Convert to desired formats
      for (let i = 0; i < AssetLoader.assetSources.length; i += 1) {
        if (AssetLoader.assetSources[i].format === 'base64') {
          AssetLoader.assets[AssetLoader.assetSources[i].path] = await readAsDataURL(
            (blobs[i] ?? files[i]) as Blob
          );
        } else if (AssetLoader.assetSources[i].format === 'arraybuffer') {
          AssetLoader.assets[AssetLoader.assetSources[i].path] = await readAsArrayBuffer(
            (blobs[i] ?? files[i]) as Blob
          );
        }
      }
    } catch (error) {
      notify.push(Notifications.ASSET_LOAD_FAILED({ error }));
    } finally {
      loaderStore.isLoading = false;
    }
  }
  static unload() {
    Object.values(AssetLoader.assets).forEach((url) => typeof url === 'string' && URL.revokeObjectURL(url));
    AssetLoader.assets = {};
  }
}
