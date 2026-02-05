import { useEffect, useState } from 'react'
import './VirtualKeyboard.css'

interface VirtualKeyboardProps {
  pressedKey?: string
}

const keyRows = [
  [
    { code: 'Backquote', label: '`', shiftLabel: '~' },
    { code: 'Digit1', label: '1', shiftLabel: '!' },
    { code: 'Digit2', label: '2', shiftLabel: '@' },
    { code: 'Digit3', label: '3', shiftLabel: '#' },
    { code: 'Digit4', label: '4', shiftLabel: '$' },
    { code: 'Digit5', label: '5', shiftLabel: '%' },
    { code: 'Digit6', label: '6', shiftLabel: '^' },
    { code: 'Digit7', label: '7', shiftLabel: '&' },
    { code: 'Digit8', label: '8', shiftLabel: '*' },
    { code: 'Digit9', label: '9', shiftLabel: '(' },
    { code: 'Digit0', label: '0', shiftLabel: ')' },
    { code: 'Minus', label: '-', shiftLabel: '_' },
    { code: 'Equal', label: '=', shiftLabel: '+' },
    { code: 'Backspace', label: '←', width: 'w-16' },
  ],
  [
    { code: 'Tab', label: 'Tab', width: 'w-14' },
    { code: 'KeyQ', label: 'Q' },
    { code: 'KeyW', label: 'W' },
    { code: 'KeyE', label: 'E' },
    { code: 'KeyR', label: 'R' },
    { code: 'KeyT', label: 'T' },
    { code: 'KeyY', label: 'Y' },
    { code: 'KeyU', label: 'U' },
    { code: 'KeyI', label: 'I' },
    { code: 'KeyO', label: 'O' },
    { code: 'KeyP', label: 'P' },
    { code: 'BracketLeft', label: '[', shiftLabel: '{' },
    { code: 'BracketRight', label: ']', shiftLabel: '}' },
    { code: 'Backslash', label: '\\', shiftLabel: '|', width: 'w-12' },
  ],
  [
    { code: 'CapsLock', label: 'Caps', width: 'w-16' },
    { code: 'KeyA', label: 'A' },
    { code: 'KeyS', label: 'S' },
    { code: 'KeyD', label: 'D' },
    { code: 'KeyF', label: 'F' },
    { code: 'KeyG', label: 'G' },
    { code: 'KeyH', label: 'H' },
    { code: 'KeyJ', label: 'J' },
    { code: 'KeyK', label: 'K' },
    { code: 'KeyL', label: 'L' },
    { code: 'Semicolon', label: ';', shiftLabel: ':' },
    { code: 'Quote', label: "'", shiftLabel: '"' },
    { code: 'Enter', label: 'Enter', width: 'w-16' },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', width: 'w-20' },
    { code: 'KeyZ', label: 'Z' },
    { code: 'KeyX', label: 'X' },
    { code: 'KeyC', label: 'C' },
    { code: 'KeyV', label: 'V' },
    { code: 'KeyB', label: 'B' },
    { code: 'KeyN', label: 'N' },
    { code: 'KeyM', label: 'M' },
    { code: 'Comma', label: ',', shiftLabel: '<' },
    { code: 'Period', label: '.', shiftLabel: '>' },
    { code: 'Slash', label: '/', shiftLabel: '?' },
    { code: 'ShiftRight', label: 'Shift', width: 'w-20' },
  ],
  [
    { code: 'ControlLeft', label: 'Ctrl', width: 'w-14' },
    { code: 'MetaLeft', label: '⌘', width: 'w-12' },
    { code: 'AltLeft', label: 'Alt', width: 'w-12' },
    { code: 'Space', label: 'Space', width: 'flex-1' },
    { code: 'AltRight', label: 'Alt', width: 'w-12' },
    { code: 'MetaRight', label: '⌘', width: 'w-12' },
    { code: 'ControlRight', label: 'Ctrl', width: 'w-14' },
  ],
]

export function VirtualKeyboard({ pressedKey }: VirtualKeyboardProps) {
  const [localPressedKey, setLocalPressedKey] = useState<string>('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setLocalPressedKey(e.code)
    }

    const handleKeyUp = () => {
      setLocalPressedKey('')
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const activeKey = pressedKey || localPressedKey

  return (
    <div className="virtual-keyboard">
      {keyRows.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {row.map((key) => (
            <div
              key={key.code}
              className={`key ${key.width || 'w-10'} ${
                activeKey === key.code ? 'pressed' : ''
              }`}
            >
              <span className="key-label">{key.label}</span>
              {key.shiftLabel && (
                <span className="key-shift-label">{key.shiftLabel}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
