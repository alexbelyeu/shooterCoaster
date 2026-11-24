/**
 * A small copy of the frame on screen, read back without stalling the frame that takes it (#701, the on-ride photo).
 *
 * `createImageBitmap` or `toBlob` on the live WebGL canvas waits for the GPU and copies the whole drawing buffer on the
 * spot (~0.9 s on CI's software renderer, #710). Instead, right after the composer has drawn the frame, `take` blits the
 * drawing buffer down to the photo's size on the GPU into a renderbuffer of its own, and that is all the frame does.
 * `read`, on the next frame, queues `readPixels` from that renderbuffer into a pixel-pack buffer behind a fence, and
 * `collect`, on later frames, hands the pixels over once the fence has signalled, top row first (the blit flips them).
 *
 * Which capture to use: in play, this (the frame can't wait); paused, full size, `canvas.toBlob` (photo mode, #828,
 * where a slow frame costs nothing).
 *
 * Every binding it changes is put back as it found it, so three's state cache never goes stale.
 */
export class GpuSnapshot {
  private readonly gl: WebGL2RenderingContext
  private fbo: WebGLFramebuffer | null = null
  private colour: WebGLRenderbuffer | null = null
  private pack: WebGLBuffer | null = null
  private fence: WebGLSync | null = null
  /** Blitted by `take`, not yet read. */
  private blitted = false
  private width = 0
  private height = 0

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  /** True from `take` until the pixels are collected or dropped. */
  get pending(): boolean {
    return this.blitted || this.fence !== null
  }

  /** Copies the frame now in the drawing buffer down to `width` × `height` on the GPU, nothing more. False if it couldn't. */
  take(width: number, height: number): boolean {
    const { gl } = this
    if (this.pending || gl.isContextLost()) return false
    // A lost and restored context left the buffers dead: make new ones.
    if (this.fbo && !gl.isFramebuffer(this.fbo)) this.forget()
    this.size(width, height)
    const read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    const draw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    const scissor = gl.isEnabled(gl.SCISSOR_TEST)
    try {
      if (scissor) gl.disable(gl.SCISSOR_TEST)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbo)
      // Flipped on the way down, so the pixels come back top row first, as an image wants them.
      gl.blitFramebuffer(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, height, width, 0, gl.COLOR_BUFFER_BIT, gl.LINEAR)
      this.blitted = true
    } finally {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw)
      if (scissor) gl.enable(gl.SCISSOR_TEST)
    }
    return true
  }

  /** On a frame after `take`: starts reading the copy back into the pack buffer, behind a fence. */
  read(): void {
    const { gl } = this
    if (!this.blitted) return
    this.blitted = false
    if (gl.isContextLost()) return
    const read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    const packed = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null
    try {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fbo)
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pack)
      gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, 0)
      this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
      gl.flush()
    } finally {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packed)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read)
    }
  }

  /** The snapshot's RGBA pixels once the GPU has them, else null (still on its way, or nothing taken). */
  collect(): { pixels: Uint8Array; width: number; height: number } | null {
    const { gl, fence } = this
    if (!fence || gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED) return null
    gl.deleteSync(fence)
    this.fence = null
    const pixels = new Uint8Array(this.width * this.height * 4)
    const packed = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pack)
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packed)
    return { pixels, width: this.width, height: this.height }
  }

  /** Drops a snapshot on its way back. */
  cancel(): void {
    if (this.fence) this.gl.deleteSync(this.fence)
    this.fence = null
    this.blitted = false
  }

  dispose(): void {
    const { gl } = this
    this.cancel()
    gl.deleteFramebuffer(this.fbo)
    gl.deleteRenderbuffer(this.colour)
    gl.deleteBuffer(this.pack)
    this.forget()
  }

  /** Lets go of the buffers without deleting them (after a context loss there is nothing to delete). */
  private forget(): void {
    this.cancel()
    this.fbo = this.colour = this.pack = null
    this.width = this.height = 0
  }

  /** Makes the renderbuffer and pack buffer at this size (or remakes them after a resize): ahead of `take`, so its frame
   *  never does. Not while a snapshot is on its way back: it would read the new, empty buffer (the next `take` resizes). */
  size(width: number, height: number): void {
    if (this.pending || (this.fbo && width === this.width && height === this.height)) return
    const { gl } = this
    this.fbo ??= gl.createFramebuffer()
    this.colour ??= gl.createRenderbuffer()
    this.pack ??= gl.createBuffer()
    const renderbuffer = gl.getParameter(gl.RENDERBUFFER_BINDING) as WebGLRenderbuffer | null
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.colour)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, width, height)
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer)
    const draw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbo)
    gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.colour)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw)
    const packed = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pack)
    gl.bufferData(gl.PIXEL_PACK_BUFFER, width * height * 4, gl.STREAM_READ)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packed)
    this.width = width
    this.height = height
  }
}
