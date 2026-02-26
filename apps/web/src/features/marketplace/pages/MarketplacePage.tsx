import { MarketplaceHub } from '../components/MarketplaceHub'

export function MarketplacePage() {
  return (
    <div className="rk-page rk-marketplace-page">
      <h1>Marketplace</h1>
      <p className="rk-page-subtitle">
        Buy, sell, bid, and negotiate privately with other tenants.
      </p>
      <MarketplaceHub />
    </div>
  )
}
