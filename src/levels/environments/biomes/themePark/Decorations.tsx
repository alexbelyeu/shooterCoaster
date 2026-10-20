import { useMemo } from 'react'
import FerrisWheel from '../../FerrisWheel'
import Carousel from '../../Carousel'

/** Colorful theme park decorations — tents, poles, fences, booths, hedges */
export default function FunfairDecorations() {
  const decorations = useMemo(() => {
    const arr: { x: number; z: number; type: 'tent' | 'pole' | 'arch' | 'booth' | 'hedge'; color: string; rotation?: number }[] = []
    const colors = ['#ff4444', '#ffaa00', '#4488ff', '#44cc44', '#ff44ff', '#ffffff']

    for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * Math.PI * 2
      const r = 400 + Math.random() * 200
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'tent',
        color: colors[i % colors.length],
      })
    }

    for (let i = 0; i < 8; i++) {
      const theta = ((i + 0.5) / 8) * Math.PI * 2
      const r = 800 + Math.random() * 200
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'tent',
        color: colors[(i + 3) % colors.length],
      })
    }

    for (let i = 0; i < 20; i++) {
      const r = 150 + Math.random() * 550
      const theta = Math.random() * Math.PI * 2
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'booth',
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
      })
    }

    for (let i = 0; i < 40; i++) {
      const theta = (i / 40) * Math.PI * 2
      const r = 1100
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'hedge',
        color: '#2d6b2d',
        rotation: theta,
      })
    }

    for (let i = 0; i < 30; i++) {
      const r = 100 + Math.random() * 800
      const theta = Math.random() * Math.PI * 2
      arr.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        type: 'pole',
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    for (let i = 0; i < 4; i++) {
      const theta = (i / 4) * Math.PI * 2
      arr.push({
        x: Math.cos(theta) * 250,
        z: Math.sin(theta) * 250,
        type: 'arch',
        color: colors[i % colors.length],
      })
    }

    return arr
  }, [])

  return (
    <>
      {decorations.map((d, i) => {
        switch (d.type) {
          case 'tent':
            return (
              <group key={i} position={[d.x, 0, d.z]}>
                <mesh position={[0, 30, 0]}>
                  <coneGeometry args={[25, 40, 6]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                <mesh position={[0, 8, 0]}>
                  <cylinderGeometry args={[24, 24, 16, 6]} />
                  <meshPhongMaterial color="#ffffff" flatShading />
                </mesh>
              </group>
            )
          case 'booth':
            return (
              <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.rotation ?? 0, 0]}>
                <mesh position={[0, 8, 0]}>
                  <boxGeometry args={[12, 16, 10]} />
                  <meshPhongMaterial color="#f5e6c8" flatShading />
                </mesh>
                <mesh position={[0, 18, 0]}>
                  <boxGeometry args={[14, 3, 12]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                <mesh position={[0, 5, 5.5]}>
                  <boxGeometry args={[10, 2, 1]} />
                  <meshPhongMaterial color="#8b6914" flatShading />
                </mesh>
              </group>
            )
          case 'hedge':
            return (
              <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.rotation ?? 0, 0]}>
                <mesh position={[0, 5, 0]}>
                  <boxGeometry args={[18, 10, 6]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
              </group>
            )
          case 'pole':
            return (
              <group key={i} position={[d.x, 0, d.z]}>
                <mesh position={[0, 25, 0]}>
                  <cylinderGeometry args={[1, 1, 50, 4]} />
                  <meshPhongMaterial color="#888888" flatShading />
                </mesh>
                <mesh position={[3, 45, 0]}>
                  <boxGeometry args={[6, 4, 0.5]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
              </group>
            )
          case 'arch':
            return (
              <group key={i} position={[d.x, 0, d.z]}>
                <mesh position={[-15, 30, 0]}>
                  <boxGeometry args={[4, 60, 4]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                <mesh position={[15, 30, 0]}>
                  <boxGeometry args={[4, 60, 4]} />
                  <meshPhongMaterial color={d.color} flatShading />
                </mesh>
                <mesh position={[0, 62, 0]}>
                  <boxGeometry args={[34, 4, 4]} />
                  <meshPhongMaterial color="#ffdd00" flatShading />
                </mesh>
              </group>
            )
          default:
            return null
        }
      })}

      <FerrisWheel position={[-500, 0, 300]} radius={60} />
      <Carousel position={[400, 0, 350]} radius={20} />
    </>
  )
}
