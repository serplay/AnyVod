import type { KeyboardEvent } from 'react'

/**
 * Keyboard handler for non-button elements that act as buttons
 * (`role="button" tabIndex={0}`): activates on Enter and Space.
 */
export function onActivateKey(action: () => void) {
  return (e: KeyboardEvent<HTMLElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }
}
