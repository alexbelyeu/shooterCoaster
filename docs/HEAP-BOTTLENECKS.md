# Heap Snapshot Analysis — Shooter Coaster

**Snapshot:** `shootercoaster-Heap-20260222T170835.heapsnapshot`  
**Total self size:** ~82 MB  
**Nodes:** 1,319,052 | **Edges:** 5,332,938

---

## 1. Core bottlenecks (what’s making it slow)

### A. **Native / large strings (41.5% of heap)**

- **~34.8 MB** in `native` type, mostly `system / ExternalStringData`.
- Single objects: **7.2 MB**, **2.4 MB**, **1.9 MB**, **1.2 MB**, **1.1 MB** each.
- **Cause:** Very large strings kept alive: base64 source maps (`data:application/json;base64,...`), big JSON config (e.g. `x-api-app-info` / Chrome viewer ~158 KB), and other dev-only payloads.
- **Impact:** High GC pressure and memory use; can contribute to frame hitches when GC runs.

**Actions:**

- **Production build:** Disable or strip source maps for production (`build.sourcemap: false` in Vite), or host source maps separately and load only when needed.
- **Dev:** If the snapshot was taken in dev, expect lower memory in production; still consider excluding heavy extensions when profiling.

---

### B. **Code (17.1%)**

- **~14.3 MB** in compiled code / script / baseline instruction stream.
- Normal for a React + Three + Tone.js app; no direct fix, but it underlines that **reducing bundle size and lazy loading** will help both parse time and memory.

---

### C. **Object + array overhead (12.4% + 12.0%)**

- **Object:** ~10.4 MB  
- **Array:** ~10.1 MB (including “(object elements)”)
- **Cause:** Large object graphs: React tree, Three.js scene graph, Tone.js graph, store/state.
- **Impact:** More objects ⇒ more GC work and pointer chasing; can hurt cache and frame time.

**Actions:**

- Prefer **fewer, larger components** and **instancing** instead of many small objects (see trees below).
- Avoid retaining big structures unnecessarily (e.g. detach Tone nodes when not playing, dispose Three.js resources on unmount).

---

### D. **ArrayBuffer / Float32Array / JSArrayBufferData**

- **ArrayBuffer:** ~491 KB (constructor name)  
- **Float32Array:** ~370 KB  
- **Native JSArrayBufferData:** three × **~1.27 MB** each ⇒ **~3.8 MB** in a few chunks.
- **Cause:** Likely **audio buffers** (Tone.js/Web Audio) and/or **Three.js geometry buffers** (positions, normals, colors).
- **Impact:** Fixed cost; acceptable if buffers are created once and reused. Problematic if buffers are recreated every frame or never released.

**Actions:**

- Ensure **Tone.js** synths/players are created once and reused; dispose when changing level/screen.
- Ensure **Three.js** geometries and textures are **disposed** when no longer needed (`geometry.dispose()`, etc.).
- Avoid creating new `Float32Array`/ArrayBuffers in hot paths (e.g. per-frame).

---

### E. **Trees: 120 × 2 meshes instead of InstancedMesh (CPU/GPU + object count)**

- **TreeField** in `BiomeEnvironment.tsx` has a comment “Use InstancedMesh for performance” and allocates shared `trunkGeo` and `canopyGeo`, but **the render path does not use them**.
- It does `trees.map(...)` and renders **120 groups**, each with **2 `<mesh>`** (trunk + canopy) ⇒ **240 meshes**, each with `<cylinderGeometry args={...} />` / `<coneGeometry args={...} />` and `<meshPhongMaterial ... />`.
- **Consequences:**
  - 240+ draw calls for trees alone (and 120 groups in the scene graph).
  - R3F may create or cache many geometry/material instances (heap showed `_CylinderGeometry` and related).
  - More React nodes and Three objects ⇒ more memory and GC, and slower culling/rendering.

**Action:**

- **Switch TreeField to InstancedMesh:** one instanced mesh for trunks, one for canopies; use the existing `trunkGeo` and `canopyGeo` and set per-instance matrix (and color if supported) from the `trees` array. This will cut draw calls and object count sharply and is the single highest-impact rendering fix.

---

### F. **Three.js math objects (Quaternion, Vector3, etc.)**

- **Quaternion:** ~61 KB in constructor-name aggregation; many small objects.
- **Vector3** and similar appear in **TrackMesh**, **CoasterCamera**, **useShooting**, **AimSystem**, curves, etc., often created per frame or per call.
- **Impact:** Extra allocations in hot paths ⇒ more GC and possible frame spikes.

**Actions:**

- **Reuse** vectors/quaternions (e.g. `useRef(new THREE.Vector3())`, `useRef(new THREE.Quaternion())`) instead of `new THREE.Vector3()` in loops or every frame.
- **TrackMesh** already uses many `new THREE.Vector3()` etc. inside `buildTrackGeometry`; that runs once per curve, so acceptable. Prefer reuse in `useFrame` and other per-frame logic.

---

### G. **Tone.js / Web Audio**

- Heap shows **exponentialRampToValueAtTime**, **setValueCurveAtTime**, **get maxValue**, **set value**, **get value**, and source-map strings referencing **MusicManager**.
- **Impact:** Audio graph and automation objects add to object count and memory; large buffers (above) matter more for raw MB.

**Actions:**

- Reuse synths/effects; **dispose** or disconnect when changing scene (e.g. title vs level).
- Avoid creating new `Tone.Synth` / buffers in hot paths.

---

## 2. Summary table

| Area              | Approx. impact   | Priority | Main action                          |
|-------------------|------------------|----------|--------------------------------------|
| Large strings     | ~41% heap, GC    | High     | Disable prod source maps; reduce dev payloads |
| Trees (240 meshes)| Draw calls, CPU  | **Highest** | Use 2 InstancedMeshes for trees     |
| ArrayBuffers      | ~4 MB            | Medium   | Reuse/dispose audio and geometry buffers |
| Object/array count| 12% + 12%       | Medium   | Fewer nodes; instancing; dispose     |
| Three.js math     | Allocations      | Low–Med | Reuse Vector3/Quaternion in hot paths |
| Tone.js           | Object count     | Low     | Reuse/dispose synths and graph       |

---

## 3. How this was derived

- **Heap snapshot** was parsed with a small script (`scripts/analyze-heap.js`) that:
  - Aggregates **self size** by node type and by constructor/name.
  - Lists the largest individual nodes (self size ≥ 10 KB).
- **Codebase** was checked for:
  - Geometry/mesh creation (Three.js, R3F).
  - Audio (Tone.js) usage.
  - Tree rendering (TreeField) and InstancedMesh use.
  - Build config (source maps).

The snapshot is likely from **development** (Vite dev server, source maps, extensions). Production will generally use less memory once source maps are off and code is minified; the **tree InstancedMesh** and **buffer/reuse** changes will help in both dev and prod.
