import { create } from 'zustand'

interface InputState {
  mouseX: number
  mouseY: number
  mouseDown: boolean
  ndcX: number // normalized device coords
  ndcY: number
  setMouse: (x: number, y: number, ndcX: number, ndcY: number) => void
  setMouseDown: (down: boolean) => void
}

export const useInputStore = create<InputState>((set) => ({
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  ndcX: 0,
  ndcY: 0,
  setMouse: (x, y, ndcX, ndcY) => set({ mouseX: x, mouseY: y, ndcX, ndcY }),
  setMouseDown: (down) => set({ mouseDown: down }),
}))
