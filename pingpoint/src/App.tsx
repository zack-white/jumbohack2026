import { useState, useCallback, useRef } from 'react'
import { DeviceMap } from './components/DeviceMap'
import { AIPromptPanel } from './components/AIPromptPanel'
import { DeviceInfoPanel } from './components/DeviceInfoPanel'
import type { Device } from './components/DeviceMap'
import { parsePcap } from './utils/pcapParser'
import styles from './App.module.css'

const DEVICE_NAMES = [
  'Router', 'Laptop', 'Phone', 'Tablet', 'Smart TV', 'Speaker',
  'Camera', 'Printer', 'NAS', 'Smart Home Hub', 'Desktop', 'Watch',
]

function pickName(used: Set<string>): string {
  const available = DEVICE_NAMES.filter((n) => !used.has(n))
  if (available.length === 0) return `Device ${used.size + 1}`
  return available[Math.floor(Math.random() * available.length)]
}

const WORLD_CENTER = 2000
const DEVICE_SPACING = 140
const COLS = 5

function generatePosition(devices: Device[]): { x: number; y: number } {
  const index = devices.length
  const row = Math.floor(index / COLS)
  const col = index % COLS
  const jitter = 28
  const jx = (Math.random() - 0.5) * 2 * jitter
  const jy = (Math.random() - 0.5) * 2 * jitter
  return {
    x: WORLD_CENTER + (col - Math.floor(COLS / 2)) * DEVICE_SPACING + jx,
    y: WORLD_CENTER + (row - Math.floor(COLS / 2)) * DEVICE_SPACING + jy,
  }
}

function App() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePcapUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setParseError(null)
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const buffer = reader.result as ArrayBuffer
          const hosts = parsePcap(buffer)
          if (hosts.length === 0) {
            setParseError('No IPv4 hosts found in this capture.')
            return
          }
          const positions = hosts.map((_, idx) => {
            const row = Math.floor(idx / COLS)
            const col = idx % COLS
            const jitter = 28
            const jx = (Math.random() - 0.5) * 2 * jitter
            const jy = (Math.random() - 0.5) * 2 * jitter
            return {
              x: WORLD_CENTER + (col - Math.floor(COLS / 2)) * DEVICE_SPACING + jx,
              y: WORLD_CENTER + (row - Math.floor(COLS / 2)) * DEVICE_SPACING + jy,
            }
          })
          const newDevices: Device[] = hosts.map((h, i) => {
            const { x, y } = positions[i]
            return {
              id: crypto.randomUUID(),
              name: h.hostname ?? h.ip,
              x,
              y,
              status: 'unknown' as const,
              ip: h.ip,
              packetCount: h.packetCount,
              mac: h.mac,
              hostname: h.hostname,
              firstSeenMs: h.firstSeenMs,
              lastSeenMs: h.lastSeenMs,
            }
          })
          setDevices(newDevices)
          setSelectedDeviceId(null)
        } catch (err) {
          setParseError(err instanceof Error ? err.message : 'Failed to parse PCAP file.')
        }
      }
      reader.readAsArrayBuffer(file)
      e.target.value = ''
    },
    []
  )

  const selectedDevice = selectedDeviceId
    ? devices.find((d) => d.id === selectedDeviceId)
    : null

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.logo}>PingPoint</h1>
        <p className={styles.tagline}>Network insight at a glance</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pcap,.cap,application/vnd.tcpdump.pcap"
          onChange={handlePcapUpload}
          className={styles.fileInput}
          aria-label="Upload PCAP file"
        />
        <button
          type="button"
          className={styles.addDeviceBtn}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload PCAP
        </button>
        {parseError && (
          <span className={styles.parseError} role="alert">
            {parseError}
          </span>
        )}
      </header>

      <main className={styles.main}>
        <section className={styles.mapWrap} aria-label="Network map">
          <DeviceMap
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={setSelectedDeviceId}
          />
        </section>

        <aside className={styles.aiPanel} aria-label="Ask about network">
          {selectedDevice && (
            <DeviceInfoPanel
              device={selectedDevice}
              onClose={() => setSelectedDeviceId(null)}
            />
          )}
          <AIPromptPanel />
        </aside>
      </main>
    </div>
  )
}

export default App
