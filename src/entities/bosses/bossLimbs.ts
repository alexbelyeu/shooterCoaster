import * as THREE from 'three'

const _m = new THREE.Matrix4()

/** Instance `i` of a unit limb (y 0 → 1, radius 1) laid root-local from a to b with radius r. */
export function setLimb(limbs: THREE.InstancedMesh, i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const len = Math.hypot(dx, dy, dz) || 1
  const ux = dx / len
  const uy = dy / len
  const uz = dz / len
  // x' = u × up, or +x when the limb is vertical; z' = x' × u.
  let px = -uz
  let pz = ux
  const pl = Math.hypot(px, pz)
  if (pl < 1e-4) {
    px = 1
    pz = 0
  } else {
    px /= pl
    pz /= pl
  }
  const qx = -pz * uy
  const qy = pz * ux - px * uz
  const qz = px * uy
  _m.set(px * r, ux * len, qx * r, ax, 0, uy * len, qy * r, ay, pz * r, uz * len, qz * r, az, 0, 0, 0, 1)
  limbs.setMatrixAt(i, _m)
}
