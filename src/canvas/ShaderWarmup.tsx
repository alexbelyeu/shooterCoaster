/**
 * Compiles every shader a level can draw behind the loading screen (#674), so no kill, explosion or late wave stalls on one.
 * The approach (compile asynchronously, then a warm-up draw) follows slop-newyork's
 * `precompileShaders` (main.js), Copyright (c) 2026 Mr.doob, MIT License,
 * https://github.com/mrdoob/slop-newyork. Written from its description; no code copied.
 */
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as enemyAssets from '@/entities/enemies/SharedEnemyAssets'
import * as bossAssets from '@/entities/bosses/bossAssets'
import { useGameStore } from '@/store/useGameStore'
import { markStartup } from '@/core/startupMarks'
import { whenProgramsReady } from './programReadiness'
import { composerSceneTarget } from './post/composerTargets'
import { chunk, runInFrameSlices } from './frameSlices'
import { reportLoad, unloadLevel } from '@/core/loadProgress'

/** Compile work per frame (#597); the loading screen only needs to keep its bar moving (#674). */
const SLICE_BUDGET_MS = 60
/** The loading bar's share of the warm-up for the compiles; the warm-up draws are the rest. */
const COMPILE_SHARE = 0.7
/** Objects per warm-up draw: each first draw uploads its buffers and textures. */
const DRAW_BATCH = 4

function enemyMaterials(): THREE.Material[] {
  const out: THREE.Material[] = []
  for (const value of [...Object.values(enemyAssets), ...Object.values(bossAssets)]) {
    for (const m of Array.isArray(value) ? value : [value]) {
      if (m instanceof THREE.Material) out.push(m)
    }
  }
  return out
}

const WARMUP_SIZE = 64

/**
 * A small target like the composer's scene target: the same samples, format and depth attachment. A GPU links a
 * pipeline per program for each of those (Metal, Vulkan), so a warm-up into any other target left them all to the
 * first frame of play (#625).
 */
function warmupTarget(): THREE.WebGLRenderTarget {
  const like = composerSceneTarget()
  const target = new THREE.WebGLRenderTarget(WARMUP_SIZE, WARMUP_SIZE, {
    type: like?.texture.type ?? THREE.HalfFloatType,
    format: like?.texture.format,
    colorSpace: like?.texture.colorSpace,
    depthBuffer: like?.depthBuffer ?? true,
    stencilBuffer: like?.stencilBuffer ?? false,
    samples: like?.samples ?? 0,
  })
  // Its own depth texture: a clone would share the composer's image, which three resizes to this target.
  const depth = like?.depthTexture
  if (depth) {
    target.depthTexture = new THREE.DepthTexture(WARMUP_SIZE, WARMUP_SIZE, depth.type)
    target.depthTexture.format = depth.format
  }
  return target
}

const isDrawable = (o: THREE.Object3D) =>
  (o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite

/**
 * The scene's drawables, and those with a light inside: `compile(object, camera, scene)` gathers the scene's lights
 * and then the object's again, so one of those compiles with the whole scene instead.
 */
function drawables(scene: THREE.Scene): { objects: THREE.Object3D[]; lightHosts: Set<THREE.Object3D> } {
  const objects: THREE.Object3D[] = []
  const lightHosts = new Set<THREE.Object3D>()
  scene.traverse((o) => {
    if (isDrawable(o)) objects.push(o)
    if ((o as THREE.Light).isLight) for (let p = o.parent; p; p = p.parent) lightHosts.add(p)
  })
  return { objects, lightHosts }
}

/**
 * Draws `batch` (and the drawables it hangs from) with nothing culled and empty instanced pools (bullets) given one
 * instance, so their buffers and textures upload. Every group and light is shown, every other drawable hidden.
 */
function renderWarmupBatch(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  target: THREE.WebGLRenderTarget,
  batch: THREE.Object3D[],
) {
  const shown = new Set<THREE.Object3D>()
  for (const o of batch) for (let p: THREE.Object3D | null = o; p; p = p.parent) shown.add(p)
  const objects: THREE.Object3D[] = []
  const visible: boolean[] = []
  const culled: boolean[] = []
  const emptyPools: THREE.InstancedMesh[] = []
  scene.traverse((o) => {
    objects.push(o)
    visible.push(o.visible)
    culled.push(o.frustumCulled)
    o.visible = !isDrawable(o) || shown.has(o)
    o.frustumCulled = false
    const pool = o as THREE.InstancedMesh
    if (o.visible && pool.isInstancedMesh && pool.count === 0) {
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
 * Compiles into an off-screen target like the composer's, not the canvas: the composer's render pass draws into one,
 * and a canvas compile would build different (sRGB-output) programs. Reruns on Next Level, not on Replay.
 *
 * Spread over frames (#597): compiles, readiness polls and warm-up draws each take a slice of a frame, so the
 * loading screen's bar keeps moving (each step is reported to `core/loadProgress.ts`). Until it is done the camera draws nothing of the level (the camera sees no layer), since a visible frame would wait on
 * every program still linking. It starts two frames after the mount, once the sky's env bake (`Atmosphere.tsx`,
 * one frame after the mount) has set `scene.environment`, which every Standard material's program depends on.
 */
export default function ShaderWarmup({ levelId }: { levelId: string }) {
  const get = useThree((s) => s.get)

  useEffect(() => {
    // Read here, not at render: CoasterCamera's mount effect has made its camera the default by now.
    const { gl, scene, camera } = get()
    const { setSceneReady } = useGameStore.getState()
    setSceneReady(false)
    markStartup('levelMounted')
    reportLoad(levelId, 'scene', 1)
    const started = performance.now()
    const testApi = window.__SC_TEST__
    if (testApi) {
      testApi.shaderWarmup = { levelId, done: false, ms: 0, programs: 0 }
      testApi.programGrowth = []
    }
    const target = warmupTarget()
    const specimenGeo = new THREE.BoxGeometry()
    const specimens = new THREE.Group()
    specimens.name = 'shader-warmup'
    specimens.visible = false
    for (const m of enemyMaterials()) specimens.add(new THREE.Mesh(specimenGeo, m))
    scene.add(specimens)

    // Hidden behind the loading screen: once the run has reached `playing` (`?e2e=1`) the level draws as it is, a
    // pause included, and the rest of the compiles run in one go (a visible frame would wait on them anyway).
    let reachedPlay = useGameStore.getState().phase === 'playing'
    const playingAtMount = reachedPlay
    // At least half of a slow frame (a software renderer's are 200 ms with nothing drawn): fewer, fuller frames.
    const budgetMs = (restOfFrameMs: number) => (reachedPlay ? Infinity : Math.max(SLICE_BUDGET_MS, restOfFrameMs / 2))
    // One batch a frame (#625): a first draw's cost is mostly the GPU's (its pipelines), which the JS
    // clock never sees, so a time budget let every batch into one frame and the GPU then held the next for seconds.
    // A run that starts playing (`?e2e=1`) draws them all at once, as before.
    const drawBudgetMs = () => (playingAtMount ? Infinity : 0)
    const mask = camera.layers.mask
    let warming = true
    /** Hidden while warming up before play, and once the store has moved on to another level: Ready never shows the
     *  outgoing world while the scene swap is pending (`SceneManager`'s transition). */
    const applyMask = () => {
      const leaving = useGameStore.getState().currentLevel !== levelId
      camera.layers.mask = leaving || (warming && !reachedPlay) ? 0 : mask
    }
    applyMask()
    const unsubscribe = useGameStore.subscribe((s) => {
      if (s.phase === 'playing') reachedPlay = true
      applyMask()
    })
    /** Compiles and warm-up draws gather the lights through the camera's layers: they need the real ones. */
    const withLayers = (fn: () => void) => {
      camera.layers.mask = mask
      try {
        fn()
      } finally {
        applyMask()
      }
    }

    let cleaned = false
    const cancelled = () => cleaned
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      warming = false
      applyMask()
      scene.remove(specimens)
      specimenGeo.dispose()
      target.dispose()
    }

    const finish = () => {
      cleanup()
      // A warm-up with nothing left to draw (a zero-batch pass) still completes its stage.
      reportLoad(levelId, 'shaders', 1)
      // A warm-up still finishing after the store moved on to another level must not open that level's Ready.
      if (useGameStore.getState().currentLevel === levelId) setSceneReady(true)
      markStartup('warmupDone')
      if (testApi) testApi.shaderWarmup = { levelId, done: true, ms: performance.now() - started, programs: gl.info.programs?.length ?? 0 }
    }

    const draw = (objects: THREE.Object3D[]) => {
      const batches = chunk(objects, DRAW_BATCH)
      let drawn = 0
      const drawBatch = (batch: THREE.Object3D[]) => {
        withLayers(() => renderWarmupBatch(gl, scene, camera, target, batch))
        reportLoad(levelId, 'shaders', COMPILE_SHARE + ((1 - COMPILE_SHARE) * ++drawn) / batches.length)
      }
      runInFrameSlices(batches, drawBatch, {
        budgetMs: drawBudgetMs,
        cancelled,
        done: finish,
      })
    }

    const compile = () => {
      const { objects, lightHosts } = drawables(scene)
      const units: THREE.Object3D[] = objects.filter((o) => !lightHosts.has(o))
      if (units.length < objects.length) units.push(scene)
      const materials = new Set<object>()
      const compileUnit = (unit: THREE.Object3D) =>
        withLayers(() => {
          const prevTarget = gl.getRenderTarget()
          gl.setRenderTarget(target)
          try {
            for (const m of gl.compile(unit, camera, unit === scene ? null : scene)) materials.add(m)
          } finally {
            gl.setRenderTarget(prevTarget)
          }
        })
      let compiled = 0
      const compileStep = (unit: THREE.Object3D) => {
        compileUnit(unit)
        reportLoad(levelId, 'shaders', (COMPILE_SHARE * ++compiled) / units.length)
      }
      runInFrameSlices(units, compileStep, {
        budgetMs,
        cancelled,
        done: () => whenProgramsReady(gl, materials, cancelled, () => draw(objects)),
      })
    }
    const afterEnvBake = requestAnimationFrame(() => {
      if (!cleaned) requestAnimationFrame(() => !cleaned && compile())
    })

    return () => {
      cancelAnimationFrame(afterEnvBake)
      cleanup()
      unsubscribe()
      camera.layers.mask = mask
      setSceneReady(false)
      unloadLevel(levelId)
    }
  }, [get, levelId])

  return null
}
