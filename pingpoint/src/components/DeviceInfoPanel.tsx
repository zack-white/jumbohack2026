import type { Device } from './DeviceMap'
import styles from './DeviceInfoPanel.module.css'

function formatTimestamp(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
}

interface DeviceInfoPanelProps {
  device: Device
  onClose: () => void
}

export function DeviceInfoPanel({ device, onClose }: DeviceInfoPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>{device.name}</h3>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close device info"
        >
          ×
        </button>
      </div>
      <dl className={styles.details}>
        <div className={styles.row}>
          <dt>Status</dt>
          <dd data-status={device.status}>{device.status}</dd>
        </div>
        <div className={styles.row}>
          <dt>IP address</dt>
          <dd>192.168.1.{Math.floor(Math.random() * 200) + 50}</dd>
        </div>
        <div className={styles.row}>
          <dt>MAC address</dt>
          <dd>00:1A:2B:3C:4D:{Math.floor(Math.random() * 256).toString(16).padStart(2, '0')}</dd>
        </div>
        <div className={styles.row}>
          <dt>Last seen</dt>
          <dd>Just now</dd>
        </div>
        <div className={styles.row}>
          <dt>Packets (24h)</dt>
          <dd>{Math.floor(Math.random() * 50000).toLocaleString()}</dd>
        </div>
      </dl>
      <p className={styles.filler}>
        This device is part of your local network. Connect packet capture or network APIs to show real traffic and health data here.
      </p>
    </div>
  )
}
