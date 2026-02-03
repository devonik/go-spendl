import type { ButtonProps } from '@nuxt/ui'
import { ConfirmDialog } from '#components'

export interface ConfirmDialogOptions {
  title: string
  description?: string
  body?: boolean
  linkGroups?: Record<string, ButtonProps[]>
  setEmail?: (value?: string) => void
}

export function useConfirmDialog() {
  const overlay = useOverlay()

  return (options: ConfirmDialogOptions): Promise<boolean> => {
    const modal = overlay.create(ConfirmDialog, {
      destroyOnClose: true,
      props: options,
    })

    return modal.open()
  }
}
