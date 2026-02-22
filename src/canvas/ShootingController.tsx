import { useShooting } from '@/combat/useShooting'

/** Thin wrapper to call the shooting hook inside the Canvas tree */
export default function ShootingController() {
  useShooting()
  return null
}
