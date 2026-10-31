import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { HeightFunction } from '@/utils/terrainNoise'
import { useQualityProfile } from '@/canvas/useRenderBudget'
import { buildContactShadowGeometry, createContactShadowMaterial, type ShadowCaster } from './contactShadows'

interface ShadowRegistry {
  add(casters: readonly ShadowCaster[]): () => void
}

const ContactShadowContext = createContext<ShadowRegistry | null>(null)

/** Cast contact shadows for `casters` (keep the array stable: memoise it). No-op outside `<ContactShadows>`. */
export function useContactShadows(casters: readonly ShadowCaster[]) {
  const registry = useContext(ContactShadowContext)
  useEffect(() => registry?.add(casters), [registry, casters])
}

/** Merges every `useContactShadows` list below it into one mesh (hidden on low quality); mounted from the start so the shader warm-up compiles it. */
export default function ContactShadows({ groundFn, children }: { groundFn: HeightFunction; children: ReactNode }) {
  const visible = useQualityProfile().contactShadows
  const meshRef = useRef<THREE.Mesh>(null)
  const lists = useRef(new Set<readonly ShadowCaster[]>())
  const dirty = useRef(false)
  const registry = useMemo<ShadowRegistry>(
    () => ({
      add(casters) {
        lists.current.add(casters)
        dirty.current = true
        return () => {
          lists.current.delete(casters)
          dirty.current = true
        }
      },
    }),
    [],
  )
  const material = useMemo(() => createContactShadowMaterial(), [])
  const empty = useMemo(() => new THREE.BufferGeometry(), [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!dirty.current || !mesh) return
    dirty.current = false
    if (mesh.geometry !== empty) mesh.geometry.dispose()
    const all = [...lists.current].flat()
    mesh.geometry = all.length > 0 ? buildContactShadowGeometry(all, groundFn) : empty
  })

  useEffect(() => {
    const mesh = meshRef.current
    return () => {
      if (mesh && mesh.geometry !== empty) mesh.geometry.dispose()
      empty.dispose()
      material.dispose()
    }
  }, [empty, material])

  return (
    <ContactShadowContext.Provider value={registry}>
      {children}
      {/* Before other transparent props (ponds, water), so they blend over the darkened ground. */}
      <mesh ref={meshRef} name="contact-shadows" geometry={empty} material={material} renderOrder={-1} visible={visible} />
    </ContactShadowContext.Provider>
  )
}
