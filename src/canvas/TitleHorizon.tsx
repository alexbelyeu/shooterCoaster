/** The world beyond the title park (#459): hills, ride silhouettes, the far skyline and their lights; four draw calls. */
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { type FlatWriter, buildHillGrid, buildTitleHorizon } from './titleHorizon'

const LIGHT_PX = 3.2

const lightVertex = /* glsl */ `
  uniform float uSize;
  attribute vec3 color;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize;
    vColor = color;
    // Lights through the haze: the farthest keep half their glow.
    vFade = 1.0 - 0.5 * smoothstep(1000.0, 3000.0, -mvPosition.z);
  }
`

// Alpha from the distance to the point's centre, no division: finite on every pixel (#344).
const lightFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5)) * 2.0;
    float a = clamp(1.0 - d, 0.0, 1.0);
    a *= a * vFade;
    if (a <= 0.0) discard;
    gl_FragColor = vec4(vColor * 1.6, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function flatGeometry(w: FlatWriter): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(w.positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(w.colors, 3))
  g.computeBoundingSphere()
  return g
}

function lightsGeometry(writers: FlatWriter[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(writers.flatMap((w) => w.lights), 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(writers.flatMap((w) => w.lightColors), 3))
  g.computeBoundingSphere()
  return g
}

function hillGeometry(): THREE.BufferGeometry {
  const grid = buildHillGrid()
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(grid.positions, 3))
  g.setAttribute('color', new THREE.BufferAttribute(grid.colors, 3))
  g.setIndex(grid.index)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

export default function TitleHorizon() {
  const dpr = useThree((s) => s.viewport.dpr)
  const assets = useMemo(() => {
    const { rides, skyline } = buildTitleHorizon()
    return {
      hills: hillGeometry(),
      hillMat: new THREE.MeshLambertMaterial({ vertexColors: true }),
      rides: flatGeometry(rides),
      skyline: flatGeometry(skyline),
      silhouetteMat: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      lights: lightsGeometry([rides, skyline]),
      lightMat: new THREE.ShaderMaterial({
        vertexShader: lightVertex,
        fragmentShader: lightFragment,
        uniforms: { uSize: { value: LIGHT_PX } },
        transparent: true,
        depthWrite: false,
      }),
    }
  }, [])
  useEffect(() => () => Object.values(assets).forEach((a) => a.dispose()), [assets])
  useEffect(() => {
    assets.lightMat.uniforms.uSize.value = LIGHT_PX * dpr
  }, [assets, dpr])

  return (
    <>
      <mesh name="title-hills" geometry={assets.hills} material={assets.hillMat} />
      <mesh name="title-rides-far" geometry={assets.rides} material={assets.silhouetteMat} />
      <mesh name="title-skyline" geometry={assets.skyline} material={assets.silhouetteMat} />
      <points name="title-horizon-lights" geometry={assets.lights} material={assets.lightMat} />
    </>
  )
}
