import { useEffect, useRef, useState } from 'react'

// Marketing Plan tab — the plan renders inline as part of the page (no inner scrollbar).
// The hosted plan is same-origin, so we size the frame to its full content height; the
// page itself is the only scroll, so it reads as a full tab, not a boxed viewer.
export default function PlanTab({ client }) {
  const c = client
  const ref = useRef(null)
  const [h, setH] = useState(1400)

  useEffect(() => {
    function measure() {
      try {
        const d = ref.current && ref.current.contentDocument
        if (d) {
          const nh = Math.max(d.body.scrollHeight, d.documentElement.scrollHeight)
          if (nh && Math.abs(nh - h) > 4) setH(nh)
        }
      } catch { /* not ready yet */ }
    }
    const id = setInterval(measure, 700)        // keep synced as images/QR load
    window.addEventListener('resize', measure)
    return () => { clearInterval(id); window.removeEventListener('resize', measure) }
  }, [h])

  if (!c?.plan_embed_url) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <b>Your plan is being prepared.</b>
        <p className="muted" style={{ marginTop: 6 }}>We’re putting it together — it’ll appear here shortly.</p>
      </div>
    )
  }

  return (
    <iframe
      ref={ref}
      title="Your marketing plan"
      src={c.plan_embed_url}
      scrolling="no"
      onLoad={() => { try { const d = ref.current.contentDocument; setH(Math.max(d.body.scrollHeight, d.documentElement.scrollHeight)) } catch { /* */ } }}
      style={{ display: 'block', width: '100%', height: h, border: 'none', background: 'transparent', marginTop: 10, overflow: 'hidden' }}
    />
  )
}
