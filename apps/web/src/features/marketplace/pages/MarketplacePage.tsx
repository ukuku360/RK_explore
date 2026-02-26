import { MarketplaceHub } from '../components/MarketplaceHub'

export function MarketplacePage() {
  return (
    <div className="rk-page rk-marketplace-page">
      <h1>Marketplace</h1>
      <p className="rk-page-subtitle">
        Discover listings, sell faster, and close deals in private chat.
      </p>
      <MarketplaceHub />
    </div>
  )
}
