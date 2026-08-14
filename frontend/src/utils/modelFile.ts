import type { FrameModel } from '../domain/frame'
import { toSolverPayload } from '../domain/frame'

export function downloadModelFile(model: FrameModel): void {
  const contents = JSON.stringify(toSolverPayload(model), null, 2)
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${model.name.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-') || 'frame-model'}.json`
  anchor.style.display = 'none'
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
