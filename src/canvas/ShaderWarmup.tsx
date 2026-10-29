/**
 * Compiles every shader a level can draw behind the countdown, so no kill, explosion or late wave stalls on one.
 * The approach (compileAsync, then one warm-up frame) follows slop-newyork's
 * `precompileShaders` (main.js), Copyright (c) 2026 Mr.doob, MIT License,
 * https://github.com/mrdoob/slop-newyork. Written from its description; no code copied.
 */
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as enemyAssets from '@/entities/enemies/SharedEnemyAssets'
import * as bossAssets from '@/entities/bosses/bossAssets'
import { useGameStore } from '@/store/useGameStore'

function enemyMaterials(): THREE.Material[] {
  const out: THREE.Material[] = []
  for (const value of [...Object.values(enemyAssets), ...Object.values(bossAssets)]) {
    for (const m of Array.isArray(value) ? value : [value]) {
      if (m instanceof THREE.Material) out.push(m)
    }
  }
  return out
}

/** One frame with nothing culled or hidden and empty instanced pools (bullets) given one instance, so buffers and textures upload too. */
function renderWarmupFrame(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget) {
  const objects: THREE.Object3D[] = []
  const visible: boolean[] = []
  const culled: boolean[] = []
  const emptyPools: THREE.InstancedMesh[] = []
  scene.traverse((o) => {
    objects.push(o)
    visible.push(o.visible)
    culled.push(o.frustumCulled)
    o.visible = true
    o.frustumCulled = false
    const pool = o as THREE.InstancedMesh
    if (pool.isInstancedMesh && pool.count === 0) {
      pool.count = 1
      emptyPools.push(pool)
    }
  })
  const prevTarget = gl.getRenderTarget()
  try {
    gl.setRenderTarget(target)
    gl.render(scene, camera)
  } finally {
    gl.setRenderTarget(prevTarget)
    for (let i = 0; i < objects.length; i++) {
      objects[i].visible = visible[i]
      objects[i].frustumCulled = culled[i]
    }
    for (const pool of emptyPools) pool.count = 0
  }
}

/**
 * Compiles into an off-screen target, not the canvas: the composer's render pass draws into one,
 * and a canvas compile would build different (sRGB-output) programs. Reruns on Next Level, not on Replay.
 */
export default function ShaderWarmup({ levelId }: { levelId: string }) {
  const get = useThree((s) => s.get)

  useEffect(() => {
    // Read here, not at render: CoasterCamera's mount effect has made its camera the default by now.
    const { gl, scene, camera } = get()
    const { setSceneReady } = useGameStore.getState()
    setSceneReady(false)
    const started = performance.now()
    const testApi = window.__SC_TEST__
    if (testApi) testApi.shaderWarmup = { done: false, ms: 0, programs: 0 }
    const target = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType })
    const specimenGeo = new THREE.BoxGeometry()
    const specimens = new THREE.Group()
    specimens.name = 'shader-warmup'
    specimens.visible = false
    for (const m of enemyMaterials()) specimens.add(new THREE.Mesh(specimenGeo, m))
    scene.add(specimens)

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      scene.remove(specimens)
      specimenGeo.dispose()
      target.dispose()
    }

    const prevTarget = gl.getRenderTarget()
    gl.setRenderTarget(target)
    const compiled = gl.compileAsync(scene, camera)
    gl.setRenderTarget(prevTarget)

    compiled.then(() => {
      if (cleaned) return
      renderWarmupFrame(gl, scene, camera, target)
      cleanup()
      setSceneReady(true)
      if (testApi) testApi.shaderWarmup = { done: true, ms: performance.now() - started, programs: gl.info.programs?.length ?? 0 }
    })

    return () => {
      cleanup()
      setSceneReady(false)
    }
  }, [get, levelId])

  return null
}
