const CHECKPOINTS = [
  'Report queue list',
  'Hide / unhide actions',
  'Delete with reason',
  'Dismiss with reason',
  'Moderation action log',
  'Show hidden posts toggle',
] as const

export default function AdminPage() {
  return (
    <section className="rk-page">
      <h1>Admin Workspace</h1>
      <p>
        This route is lazy-loaded and access-gated by admin email. Functional parity work lands in
        RKM-020~RKM-022.
      </p>
      <div className="rk-panel">
        <strong>Upcoming admin migration checkpoints</strong>
        <ul>
          {CHECKPOINTS.map((checkpoint) => (
            <li key={checkpoint}>{checkpoint}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
