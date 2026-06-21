import { useEffect, useRef, useState } from 'react'

// Textarea with optional speech-to-text (Web Speech API; Chrome/Edge). Falls back to plain typing.
export default function MicTextarea({ value, onChange, placeholder, rows = 8 }) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recRef = useRef(null)
  const cbRef = useRef(onChange); cbRef.current = onChange
  const valRef = useRef(value); valRef.current = value

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    setSupported(true)
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      let t = ''
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript
      const cur = valRef.current
      cbRef.current((cur ? cur + ' ' : '') + t.trim())
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    return () => { try { rec.stop() } catch { /* noop */ } }
  }, [])

  function toggle() {
    const rec = recRef.current
    if (!rec) return
    if (listening) { rec.stop(); setListening(false) }
    else { try { rec.start(); setListening(true) } catch { /* already started */ } }
  }

  return (
    <div>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ resize: 'vertical' }} />
      {supported && (
        <button type="button" className={`btn ${listening ? 'btn-navy' : 'btn-line'}`} style={{ marginTop: 8 }} onClick={toggle}>
          {listening ? '● Listening… tap to stop' : '🎤 Dictate instead of typing'}
        </button>
      )}
    </div>
  )
}
