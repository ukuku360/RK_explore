import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuthSession } from '../../../app/providers/auth-session-context'
import { usePostsWithRelationsQuery } from '../../feed/hooks/usePostsWithRelationsQuery'
import type { Post } from '../../../types/domain'

const CATEGORY_EMOJI: Record<string, string> = {
  Sports: '⚽',
  Culture: '🎭',
  Eatout: '🍜',
  Travel: '✈️',
  Study: '📚',
  Extra: '✨',
}

interface Badge {
  id: string
  label: string
  description: string
  earned: boolean
}

function computeBadges(stats: {
  postCount: number
  rsvpCount: number
  votesCast: number
  confirmedTrips: number
}): Badge[] {
  return [
    {
      id: 'pioneer',
      label: '✈️ Trip Pioneer',
      description: 'Proposed 5+ trips',
      earned: stats.postCount >= 5,
    },
    {
      id: 'social',
      label: '🤝 Social Butterfly',
      description: 'RSVPed to 10+ trips',
      earned: stats.rsvpCount >= 10,
    },
    {
      id: 'voter',
      label: '👍 Trusted Voter',
      description: 'Voted on 10+ trips',
      earned: stats.votesCast >= 10,
    },
    {
      id: 'confirmed',
      label: '✅ Confirmed Leader',
      description: 'Had a trip confirmed',
      earned: stats.confirmedTrips >= 1,
    },
    {
      id: 'poweruser',
      label: '⭐ Power User',
      description: '30+ total actions',
      earned: stats.postCount + stats.rsvpCount + stats.votesCast >= 30,
    },
  ]
}

function formatJoinedDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getNicknameFromPosts(targetUserId: string, posts: Post[]): string {
  for (const post of posts) {
    if (post.user_id === targetUserId && post.author.trim()) {
      return post.author.trim()
    }
    for (const comment of post.comments) {
      if (comment.user_id === targetUserId && comment.author.trim()) {
        return comment.author.trim()
      }
    }
  }
  return `User ${targetUserId.slice(0, 8)}`
}

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuthSession()

  const targetUserId = userId ?? user?.id
  const isOwnProfile = !userId || userId === user?.id

  const postsQuery = usePostsWithRelationsQuery({ enabled: Boolean(user) })

  const profileData = useMemo(() => {
    if (!targetUserId || !postsQuery.data) return null

    const posts = postsQuery.data

    const userPosts = posts.filter((p) => p.user_id === targetUserId)
    const rsvpedPosts = posts.filter((p) => p.rsvps.some((r) => r.user_id === targetUserId))
    const votedPosts = posts.filter((p) => p.votes.some((v) => v.user_id === targetUserId))
    const confirmedTrips = userPosts.filter((p) => p.status === 'confirmed').length

    const nickname = isOwnProfile
      ? (user?.label ?? 'Unknown')
      : getNicknameFromPosts(targetUserId, posts)

    const categoryCounts: Record<string, number> = {}
    for (const post of rsvpedPosts) {
      categoryCounts[post.category] = (categoryCounts[post.category] ?? 0) + 1
    }
    for (const post of userPosts) {
      categoryCounts[post.category] = (categoryCounts[post.category] ?? 0) + 0.5
    }

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat)

    const badges = computeBadges({
      postCount: userPosts.length,
      rsvpCount: rsvpedPosts.length,
      votesCast: votedPosts.length,
      confirmedTrips,
    })

    const recentPosts = [...userPosts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)

    const hasActivity = userPosts.length > 0 || rsvpedPosts.length > 0 || votedPosts.length > 0

    return {
      nickname,
      userPosts,
      rsvpedPosts,
      votedPosts,
      confirmedTrips,
      topCategories,
      badges,
      earnedBadges: badges.filter((b) => b.earned),
      recentPosts,
      hasActivity,
    }
  }, [targetUserId, postsQuery.data, isOwnProfile, user])

  if (!user) return null

  if (postsQuery.isLoading) {
    return (
      <section className="rk-page rk-profile-page">
        <p style={{ color: 'var(--rk-muted)' }}>Loading profile...</p>
      </section>
    )
  }

  if (!profileData) {
    return (
      <section className="rk-page rk-profile-page">
        <h1>Profile not found</h1>
        <p>Could not load profile data.</p>
        <Link to="/" className="rk-profile-back-link" style={{ marginTop: 12, display: 'inline-block' }}>
          ← Back to Feed
        </Link>
      </section>
    )
  }

  const joinedDate = isOwnProfile && user?.createdAt ? formatJoinedDate(user.createdAt) : null

  return (
    <section className="rk-page rk-profile-page">
      <div className="rk-profile-page-top">
        <Link to="/" className="rk-profile-back-link">← Back to Feed</Link>
      </div>

      {/* Hero */}
      <div className="rk-profile-hero">
        <div className="rk-profile-avatar-lg">
          {profileData.nickname.charAt(0).toUpperCase()}
        </div>
        <div className="rk-profile-hero-info">
          <h1 className="rk-profile-page-name">{profileData.nickname}</h1>
          {isOwnProfile && <p className="rk-profile-page-email">{user.email}</p>}
          {joinedDate && <p className="rk-profile-page-joined">Joined {joinedDate}</p>}
          {!isOwnProfile && <p className="rk-profile-page-joined">Community member</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="rk-profile-stats-grid">
        <div className="rk-profile-stat-card">
          <span className="rk-profile-stat-value">{profileData.userPosts.length}</span>
          <span className="rk-profile-stat-label">Trips Proposed</span>
        </div>
        <div className="rk-profile-stat-card">
          <span className="rk-profile-stat-value">{profileData.rsvpedPosts.length}</span>
          <span className="rk-profile-stat-label">Trips Joined</span>
        </div>
        <div className="rk-profile-stat-card">
          <span className="rk-profile-stat-value">{profileData.votedPosts.length}</span>
          <span className="rk-profile-stat-label">Votes Cast</span>
        </div>
        <div className="rk-profile-stat-card">
          <span className="rk-profile-stat-value">{profileData.confirmedTrips}</span>
          <span className="rk-profile-stat-label">Confirmed Trips</span>
        </div>
      </div>

      {/* Badges */}
      {profileData.hasActivity && (
        <div className="rk-profile-section">
          <h2 className="rk-profile-section-title">Badges</h2>
          <div className="rk-profile-badges">
            {profileData.badges.map((badge) => (
              <div
                key={badge.id}
                className={`rk-profile-badge ${badge.earned ? 'rk-profile-badge-earned' : 'rk-profile-badge-locked'}`}
                title={badge.description}
              >
                {badge.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Interests */}
      {profileData.topCategories.length > 0 && (
        <div className="rk-profile-section">
          <h2 className="rk-profile-section-title">Favourite Categories</h2>
          <div className="rk-profile-categories">
            {profileData.topCategories.map((cat) => (
              <span key={cat} className="rk-chip rk-profile-category-chip">
                {CATEGORY_EMOJI[cat] ?? '🌟'} {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trips */}
      {profileData.recentPosts.length > 0 && (
        <div className="rk-profile-section">
          <h2 className="rk-profile-section-title">Recent Trips Proposed</h2>
          <div className="rk-profile-recent-trips">
            {profileData.recentPosts.map((post) => (
              <div key={post.id} className="rk-profile-trip-item">
                <span className="rk-profile-trip-emoji">{CATEGORY_EMOJI[post.category] ?? '✨'}</span>
                <div className="rk-profile-trip-info">
                  <strong>{post.location}</strong>
                  <span className={`rk-status rk-status-${post.status}`}>
                    {post.status === 'confirmed' ? 'Confirmed' : 'Proposed'}
                  </span>
                </div>
                <span className="rk-profile-trip-votes">▲ {post.votes.length}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!profileData.hasActivity && (
        <p className="rk-profile-empty">No activity yet.</p>
      )}
    </section>
  )
}
