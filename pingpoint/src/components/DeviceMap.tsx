import { useState, useCallback, useRef } from 'react'
import styles from './DeviceMap.module.css'

export interface Device {
  id: string
  name: string
  x: number
  y: number
  status: 'unknown' | 'online' | 'offline' | 'warning'
  /** From PCAP: hostname (e.g. from DHCP) */
  hostname?: string
}

interface DeviceMapProps {
  devices: Device[]
  selectedDeviceId: string | null
  onSelectDevice: (id: string | null) => void
}

export function DeviceMap({ devices, selectedDeviceId, onSelectDevice }: DeviceMapProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const lastPoint = useRef({ x: 0, y: 0 })

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const onDevice = (e.target as HTMLElement).closest(`.${styles.device}`)
    if (onDevice) {
      const id = (onDevice as HTMLElement).dataset.deviceId
      if (id) onSelectDevice(id)
      return
    }
    setIsDragging(true)
    lastPoint.current = { x: e.clientX, y: e.clientY }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [onSelectDevice])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      const dx = e.clientX - lastPoint.current.x
      const dy = e.clientY - lastPoint.current.y
      lastPoint.current = { x: e.clientX, y: e.clientY }
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
    },
    [isDragging]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false)
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }, [])

  return (
    <div
      className={styles.viewport}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      role="application"
      aria-label="Pannable network device map"
    >
      <div
        className={styles.world}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}
      >
        <div className={styles.grid} aria-hidden />
        {devices.map((d) => (
          <div
            key={d.id}
            className={styles.device}
            style={{ left: d.x, top: d.y }}
            data-status={d.status}
            data-device-id={d.id}
            data-selected={selectedDeviceId === d.id ? 'true' : undefined}
          >
            <div className={styles.deviceIcon}>
              <DeviceIcon />
            </div>
            <span className={styles.deviceName}>{d.name}</span>
          </div>
        ))}
      </div>
      <div className={styles.hint}>
        Drag to pan • Upload a PCAP to see hosts on the map
      </div>
    </div>
  )
}

function DeviceIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
      <path d="M8 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
