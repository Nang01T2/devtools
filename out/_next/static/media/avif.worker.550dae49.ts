//import avifWasmUrl from "./avif.wasm?url";
//const avifWasmUrl=new URL('avif.wasm',import.meta.url);
const avifWasmUrl=new URL('avif.wasm',location.origin);
let wasm: any = null;
let memory: WebAssembly.Memory;

const imports = {
  wbg: {
    __wbg_log_53027a77be2f101a: (p: number, n: number) => {
      const bytes = new Uint8Array(wasm.memory.buffer, p, n);
      console.log("[AVIF Worker]", new TextDecoder().decode(bytes));
    },
    __wbindgen_init_externref_table: () => {
      const table = wasm.__wbindgen_export_0;
      const offset = table.grow(4);
      table.set(0);
      table.set(offset);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    },
  },
};

// Initialize WASM once
const initWasm = async () => {
  if (wasm) return wasm;

  const response = await fetch(avifWasmUrl, { cache: "force-cache" });
  const { instance } = await WebAssembly.instantiateStreaming(response, imports);
  wasm = instance.exports;
  memory = wasm.memory as WebAssembly.Memory;

  // Signal ready
  postMessage({ type: "ready" });
  return wasm;
};

self.onmessage = async (e: MessageEvent) => {
  const { id, bytes, width, height, quality = 50, speed = 8 } = e.data;

  try {
    const wasmInstance = await initWasm();
    const malloc = wasmInstance.__wbindgen_malloc;
    const free = wasmInstance.__wbindgen_free;

    const n1 = bytes.length;
    const p1 = malloc(n1, 1);
    new Uint8Array(wasmInstance.memory.buffer).set(bytes, p1);

    const resultPtr = wasmInstance.avif_from_imagedata(p1, n1, width, height, quality, speed);
    const [p2, n2] = resultPtr;

    const result = new Uint8Array(wasmInstance.memory.buffer, p2, n2).slice();
    free(p2, n2);

    // Transfer buffer (zero-copy)
    postMessage({ id, result }, [result.buffer]);
  } catch (err: any) {
    postMessage({ id, error: err.message || "AVIF encoding failed" });
  }
};