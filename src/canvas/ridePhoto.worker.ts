/**
 * The on-ride photo's darkroom (#701): scales the captured frame and encodes its JPEG off the main thread, so neither
 * can land between the game's frames (on CI's headless Chromium the frame after the capture took 11–17 s while a
 * main-thread canvas did this). Answers each request with its run's JPEG, or null.
 */
export interface DevelopRequest {
  runId: number
  frame: ImageBitmap
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
  const { runId, frame, width, height, quality } = e.data
  let blob: Blob | null = null
  try {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(frame, 0, 0, width, height)
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    }
  } catch {
    blob = null
  }
  frame.close()
  const result: DevelopResult = { runId, blob, width, height }
  postMessage(result)
}
