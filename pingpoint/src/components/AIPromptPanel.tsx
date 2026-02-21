import { useState } from 'react'
import styles from './AIPromptPanel.module.css'

export function AIPromptPanel() {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed) return
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setPrompt('')
    // Placeholder: no real AI call yet
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: 'This is a prototype. Connect your AI model here to get answers about your network status, device health, and packet analysis.',
      },
    ])
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Network assistant</h2>
        <p className={styles.subtitle}>Ask about devices, traffic, or security</p>
      </div>

      <div className={styles.conversation}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <p>Try asking:</p>
            <ul>
              <li>“Which devices are on my network?”</li>
              <li>“Summarize recent traffic.”</li>
              <li>“Any suspicious activity?”</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? styles.userMsg : styles.assistantMsg}>
            {m.text}
          </div>
        ))}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          className={styles.input}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask about your network..."
          rows={2}
          aria-label="Ask about network"
        />
        <button type="submit" className={styles.sendBtn} disabled={!prompt.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
