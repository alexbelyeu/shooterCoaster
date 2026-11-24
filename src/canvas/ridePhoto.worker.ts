/**
 * The on-ride photo's darkroom (#701): encodes the snapshot's JPEG off the main thread, so it never lands between the
 * game's frames. Answers each request with its run's JPEG, or null.
 */
export interface DevelopRequest {
  runId: number
  /** RGBA, top row first (`GpuSnapshot.collect`). */
  pixels: ArrayBuffer
  width: number
  height: number
  quality: number
}

export interface DevelopResult {
  runId: number
  blob: Blob | null
  width: number
  height: number
}

onmessage = async (e: MessageEvent<DevelopRequest>) => {
  const { runId, pixels, width, height, quality } = e.data
  let blob: Blob | null = null
  try {
    const canvas = new OffscreenCanvas(width, height)
    // A CPU canvas: an accelerated one goes through the GPU process, behind the game's frames, and its cold start there
    // took 14–26 s on CI's software renderer. One small JPEG a run needs no GPU.
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    }
  } catch {
    blob = null
  }
  const result: DevelopResult = { runId, blob, width, height }
  postMessage(result)
}
