/** The part of `THREE.WebGLRenderer` the poll reads. */
interface ReadinessRenderer {
  properties: { has(object: object): boolean; get(object: object): unknown }
  extensions: { has(name: string): boolean }
}

const POLL_MS = 10

/** `WebGLRenderer.compileAsync`'s readiness poll, but cancellable: three's keeps polling after an unmount and throws on a disposed material (#141). */
export function whenProgramsReady(gl: ReadinessRenderer, materials: Set<object>, cancelled: () => boolean, done: () => void): void {
  const check = () => {
    if (cancelled()) return
    for (const m of materials) {
      // A disposed material has no properties left, so no program to wait on.
      const props = gl.properties.has(m) ? (gl.properties.get(m) as { currentProgram?: { isReady(): boolean } }) : null
      if (!props?.currentProgram || props.currentProgram.isReady()) materials.delete(m)
    }
    if (materials.size === 0) done()
    else setTimeout(check, POLL_MS)
  }
  // Without the parallel-compile extension isReady() blocks, so give the driver a moment first, as three does.
  if (gl.extensions.has('KHR_parallel_shader_compile')) check()
  else setTimeout(check, POLL_MS)
}
