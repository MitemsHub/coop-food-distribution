'use client'
import { useEffect, useRef, useState } from 'react'

export default function DraggableModal({
  open,
  onClose,
  title,
  children,
  footer,
  overlayClassName = 'bg-transparent',
  widthClass = 'max-w-md w-full mx-4'
}) {
  if (!open) return null

  const dragging = useRef(false)
  const start = useRef({ x: 0, y: 0 })
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // Reset position whenever the modal opens
    if (open) setPos({ x: 0, y: 0 })
  }, [open])

  const onPointerDown = (e) => {
    dragging.current = true
    start.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const onPointerMove = (e) => {
    if (!dragging.current) return
    setPos({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })
  }

  const onPointerUp = () => {
    dragging.current = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  const stop = (e) => e.stopPropagation()

  return (
    <div className={`fixed inset-0 ${overlayClassName} flex items-center justify-center z-50`} onClick={onClose}>
      <div
        onClick={stop}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        className={`bg-gradient-to-b from-white to-gray-50 rounded-xl shadow-2xl border border-gray-200 ${widthClass}`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4 cursor-move select-none"
               onPointerDown={onPointerDown}>
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="px-2 py-1 rounded hover:bg-gray-100"
            >
              ×
            </button>
          </div>
          {children}
          {footer && (
            <div className="mt-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}