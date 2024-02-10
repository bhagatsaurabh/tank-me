import { getFile } from '@/database/driver';
import { readAsArrayBuffer, readAsDataURL } from '@/utils/utils';

export class AssetLoader {
  static assets: Record<string, string | ArrayBuffer> = {};
  static progress: number = 0;
  static noOfFilesDownloaded: number = 0;

  static async load(filePaths: { path: string; format?: string }[]) {
    // Cache check
    const files = await Promise.all(filePaths.map((filePath) => getFile(filePath.path)));

    if (files.filter((file) => !file).length === 0) {
      filePaths.forEach(
        (filePath, idx) => (AssetLoader.assets[filePath.path] = URL.createObjectURL(files[idx] as Blob))
      );
    }

    // Cache miss
    const responses = await Promise.all(
      filePaths.map((filePath, idx) => (files[idx] ? Promise.resolve(null) : fetch(filePath.path)))
    );
    let contentLoaded = 0;
    const totalContentLength = responses
      .map((res) => (res ? parseInt(res.headers.get('content-length') ?? '0') : 0))
      .reduce((total, len) => total + len, 0);

    const blobs = await Promise.all(
      filePaths.map((_path, idx) => {
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
                    break;
                  }
                  contentLoaded += value.byteLength;
                  AssetLoader.progress = contentLoaded / totalContentLength;
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

    // Get Object URLs
    filePaths.forEach(
      (filePath, idx) =>
        (AssetLoader.assets[filePath.path] = URL.createObjectURL((blobs[idx] ?? files[idx]) as Blob))
    );

    // Convert to desired formats
    for (let i = 0; i < filePaths.length; i += 1) {
      if (filePaths[i].format === 'base64') {
        AssetLoader.assets[filePaths[i].path] = await readAsDataURL((blobs[i] ?? files[i]) as Blob);
      } else if (filePaths[i].format === 'arraybuffer') {
        AssetLoader.assets[filePaths[i].path] = await readAsArrayBuffer((blobs[i] ?? files[i]) as Blob);
      }
    }
  }
  static unload() {
    Object.values(AssetLoader.assets).forEach((url) => typeof url === 'string' && URL.revokeObjectURL(url));
    AssetLoader.assets = {};
  }
}
