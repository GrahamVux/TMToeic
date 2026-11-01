import { VIEW_AS_HEADER } from '@toeic/shared'

const KEY = 'toeic.viewAs'

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

// The account an admin is previewing. Kept per tab, so closing the tab ends the preview.
let current: string | null = read()

export function getViewAsId(): string | null {
  return current
}

export function setViewAsId(id: string | null) {
  current = id
  try {
    if (id) window.sessionStorage.setItem(KEY, id)
    else window.sessionStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the preview still works, it just does not survive a reload.
  }
}

/** Headers that make the API answer as the previewed account. Empty outside a preview. */
export function viewAsHeaders(): Record<string, string> {
  return current ? { [VIEW_AS_HEADER]: current } : {}
}
