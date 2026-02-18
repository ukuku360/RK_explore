import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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

interface ProfileDetails {
  bio: string
  tagline: string
  location: string
  occupations: string
  hobbies: string
  links: string
}

const DEFAULT_PROFILE_DETAILS: ProfileDetails = {
  bio: '',
  tagline: '',
  location: '',
  occupations: '',
  hobbies: '',
  links: '',
}

function getProfileDetailsStorageKey(userId: string): string {
  return `rk:profile-details:${userId}`
}

function parseList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function loadProfileDetails(userId: string): ProfileDetails {
  if (typeof window === 'undefined') return DEFAULT_PROFILE_DETAILS

  const rawValue = window.localStorage.getItem(getProfileDetailsStorageKey(userId))
  if (!rawValue) return DEFAULT_PROFILE_DETAILS

  try {
    const parsed = JSON.parse(rawValue) as Partial<ProfileDetails>
    return {
      bio: parsed.bio ?? '',
      tagline: parsed.tagline ?? '',
      location: parsed.location ?? '',
      occupations: parsed.occupations ?? '',
      hobbies: parsed.hobbies ?? '',
      links: parsed.links ?? '',
    }
  } catch {
    return DEFAULT_PROFILE_DETAILS
  }
}

function saveProfileDetails(userId: string, details: ProfileDetails): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getProfileDetailsStorageKey(userId), JSON.stringify(details))
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
  const [draftDetails, setDraftDetails] = useState<ProfileDetails>(DEFAULT_PROFILE_DETAILS)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [, setDetailsVersion] = useState(0)

  const profileDetails = targetUserId ? loadProfileDetails(targetUserId) : DEFAULT_PROFILE_DETAILS

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
  const hasProfileDetails = Object.values(profileDetails).some((value) => value.trim().length > 0)

  function handleStartEdit() {
    setDraftDetails(profileDetails)
    setIsEditingDetails(true)
  }

  function handleDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!targetUserId) return
    saveProfileDetails(targetUserId, draftDetails)
    setDetailsVersion((current) => current + 1)
    setIsEditingDetails(false)
  }

  function handleDetailsCancel() {
    setIsEditingDetails(false)
  }

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

      <div className="rk-profile-section rk-profile-about-card">
        <div className="rk-profile-section-heading-row">
          <h2 className="rk-profile-section-title">About Me</h2>
          {isOwnProfile && !isEditingDetails && (
            <button
              type="button"
              className="rk-button rk-button-ghost rk-profile-edit-button"
              onClick={handleStartEdit}
            >
              Edit profile
            </button>
          )}
        </div>

        {isOwnProfile && isEditingDetails ? (
          <form className="rk-profile-about-form" onSubmit={handleDetailsSubmit}>
            <label className="rk-label" htmlFor="profile-tagline">한 줄 소개</label>
            <input
              id="profile-tagline"
              className="rk-input"
              value={draftDetails.tagline}
              onChange={(event) =>
                setDraftDetails((current) => ({ ...current, tagline: event.target.value }))
              }
              placeholder="예: 주말마다 소소한 여행을 즐기는 나윤입니다"
              maxLength={80}
            />

            <label className="rk-label" htmlFor="profile-bio">자기소개</label>
            <textarea
              id="profile-bio"
              className="rk-post-input"
              value={draftDetails.bio}
              onChange={(event) =>
                setDraftDetails((current) => ({ ...current, bio: event.target.value }))
              }
              placeholder="내가 어떤 사람인지, 요즘 관심사는 무엇인지 자유롭게 써보세요."
              rows={4}
              maxLength={300}
            />

            <div className="rk-profile-about-grid">
              <label className="rk-profile-about-field">
                <span className="rk-label">활동 지역</span>
                <input
                  className="rk-input"
                  value={draftDetails.location}
                  onChange={(event) =>
                    setDraftDetails((current) => ({ ...current, location: event.target.value }))
                  }
                  placeholder="예: 서울 · 경기"
                  maxLength={40}
                />
              </label>

              <label className="rk-profile-about-field">
                <span className="rk-label">직업/관심 분야</span>
                <input
                  className="rk-input"
                  value={draftDetails.occupations}
                  onChange={(event) =>
                    setDraftDetails((current) => ({ ...current, occupations: event.target.value }))
                  }
                  placeholder="예: Product Designer, PM"
                  maxLength={80}
                />
              </label>
            </div>

            <label className="rk-label" htmlFor="profile-hobbies">취미/관심사 (쉼표로 구분)</label>
            <input
              id="profile-hobbies"
              className="rk-input"
              value={draftDetails.hobbies}
              onChange={(event) =>
                setDraftDetails((current) => ({ ...current, hobbies: event.target.value }))
              }
              placeholder="예: 러닝, 전시회, 카페 투어"
              maxLength={120}
            />

            <label className="rk-label" htmlFor="profile-links">링크 (쉼표로 구분)</label>
            <input
              id="profile-links"
              className="rk-input"
              value={draftDetails.links}
              onChange={(event) =>
                setDraftDetails((current) => ({ ...current, links: event.target.value }))
              }
              placeholder="예: instagram.com/nayoon, github.com/nayoon"
              maxLength={160}
            />

            <div className="rk-profile-about-actions">
              <button type="submit" className="rk-button rk-button-primary">Save</button>
              <button type="button" className="rk-button rk-button-ghost" onClick={handleDetailsCancel}>
                Cancel
              </button>
            </div>
          </form>
        ) : hasProfileDetails ? (
          <div className="rk-profile-about-content">
            {profileDetails.tagline && (
              <p className="rk-profile-tagline">“{profileDetails.tagline}”</p>
            )}
            {profileDetails.bio && <p className="rk-profile-bio">{profileDetails.bio}</p>}
            <div className="rk-profile-meta-list">
              {profileDetails.location && (
                <div className="rk-profile-meta-item"><strong>📍 지역</strong><span>{profileDetails.location}</span></div>
              )}
              {profileDetails.occupations && (
                <div className="rk-profile-meta-item"><strong>💼 분야</strong><span>{profileDetails.occupations}</span></div>
              )}
            </div>

            {parseList(profileDetails.hobbies).length > 0 && (
              <div className="rk-profile-meta-block">
                <span className="rk-profile-meta-title">✨ 취미 & 관심사</span>
                <div className="rk-profile-categories">
                  {parseList(profileDetails.hobbies).map((hobby) => (
                    <span key={hobby} className="rk-chip rk-profile-category-chip">{hobby}</span>
                  ))}
                </div>
              </div>
            )}

            {parseList(profileDetails.links).length > 0 && (
              <div className="rk-profile-meta-block">
                <span className="rk-profile-meta-title">🔗 Links</span>
                <ul className="rk-profile-link-list">
                  {parseList(profileDetails.links).map((link) => (
                    <li key={link}>{link}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="rk-profile-empty">
            {isOwnProfile
              ? '프로필 소개가 비어 있어요. Edit profile 버튼으로 나를 소개해보세요.'
              : '아직 작성된 소개가 없어요.'}
          </p>
        )}
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
