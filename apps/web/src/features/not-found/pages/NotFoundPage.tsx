import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="rk-page">
      <h1>Route not found</h1>
      <p>This path is not configured in the migration shell.</p>
      <Link to="/">Go to feed</Link>
    </section>
  )
}
