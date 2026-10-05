import { createSHA256 } from "hash-wasm";

// The original never sits in memory as one ArrayBuffer. The digest identifies a
// reselected browser File; it is not a claim that Stream verifies that digest.
self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    const file = event.data.file;
    const hash = await createSHA256();
    hash.init();
    const chunkBytes = 8 * 1024 * 1024;
    for (let offset = 0; offset < file.size; offset += chunkBytes) {
      hash.update(new Uint8Array(await file.slice(offset, offset + chunkBytes).arrayBuffer()));
      self.postMessage({ progress: Math.min(1, (offset + chunkBytes) / file.size) });
    }
    self.postMessage({ sha256: hash.digest("hex") });
  } catch {
    self.postMessage({ error: "No se pudo comprobar la identidad del archivo." });
  }
};

export {};
