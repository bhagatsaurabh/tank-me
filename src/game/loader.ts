export class AssetLoader {
  static assets: Record<string, string> = {};
  static progress: number = 0;
  static noOfFilesDownloaded: number = 0;

  static async load(files: { id: string; url: string }[]) {
    // TODO: Cache from local IndexedDB by default
    const responses = await Promise.all(files.map((file) => fetch(file.url)));
    let contentLoaded = 0;
    const totalContentLength = responses
      .map((res) => parseInt(res.headers.get('content-length') ?? '0'))
      .reduce((total, len) => total + len, 0);

    const blobs = await Promise.all(
      files.map((_file, idx) => {
        const res = new Response(
          new ReadableStream({
            async start(controller) {
              const reader = responses[idx].body?.getReader();
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
      })
    );

    files.forEach((file, idx) => (AssetLoader.assets[file.id] = URL.createObjectURL(blobs[idx])));
  }
  static unload() {
    Object.values(AssetLoader.assets).forEach((url) => URL.revokeObjectURL(url));
  }
}
