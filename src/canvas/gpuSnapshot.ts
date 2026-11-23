/**
 * A small copy of the frame on screen, read back without stalling the frame that takes it (#701, the on-ride photo).
 *
 * `createImageBitmap` or `toBlob` on the live WebGL canvas waits for the GPU and copies the whole drawing buffer on the
 * spot (~0.9 s on CI's software renderer, #710). Instead, right after the composer has drawn the frame, `take` blits the
 * drawing buffer down to the photo's size on the GPU into a renderbuffer of its own, then queues `readPixels` into a
 * pixel-pack buffer behind a fence: nothing waits. `collect`, on later frames, hands the pixels over once the fence has
 * signalled, top row first (the blit flips them).
 *
 * Every binding it changes is put back as it found it, so three's state cache never goes stale.
 */
export class GpuSnapshot {
  private readonly gl: WebGL2RenderingContext
  private fbo: WebGLFramebuffer | null = null
  private colour: WebGLRenderbuffer | null = null
  private pack: WebGLBuffer | null = null
  private fence: WebGLSync | null = null
  private width = 0
  private height = 0

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  /** True while a snapshot is on its way back. */
  get pending(): boolean {
    return this.fence !== null
  }

  /** Copies the frame now in the drawing buffer at `width` × `height` and starts reading it back. False if it couldn't. */
  take(width: number, height: number): boolean {
    const { gl } = this
    if (this.fence || gl.isContextLost()) return false
    this.size(width, height)
    const read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    const draw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    const packed = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null
    const scissor = gl.isEnabled(gl.SCISSOR_TEST)
    try {
      if (scissor) gl.disable(gl.SCISSOR_TEST)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbo)
      // Flipped on the way down, so the pixels come back top row first, as an image wants them.
      gl.blitFramebuffer(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, height, width, 0, gl.COLOR_BUFFER_BIT, gl.LINEAR)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fbo)
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pack)
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, 0)
      this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
      gl.flush()
    } finally {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packed)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, draw)
      if (scissor) gl.enable(gl.SCISSOR_TEST)
    }
    return this.fence !== null
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
  }

  dispose(): void {
    const { gl } = this
    this.cancel()
    gl.deleteFramebuffer(this.fbo)
    gl.deleteRenderbuffer(this.colour)
    gl.deleteBuffer(this.pack)
    this.fbo = this.colour = this.pack = null
    this.width = this.height = 0
  }

  /** Makes the renderbuffer and pack buffer at this size (or remakes them after a resize): ahead of `take`, so its frame never does. */
  size(width: number, height: number): void {
    if (this.fbo && width === this.width && height === this.height) return
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
