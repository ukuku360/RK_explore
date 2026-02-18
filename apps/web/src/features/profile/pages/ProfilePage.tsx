import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { queryKeys } from '../../../lib/queryKeys'
import { useAuthSession } from '../../../app/providers/auth-session-context'
import { usePostsWithRelationsQuery } from '../../feed/hooks/usePostsWithRelationsQuery'
import {
  getUserProfileDetails,
  upsertUserProfileDetails,
} from '../../../services/profile/profile-details.service'
import { uploadProfileImage } from '../../../services/profile/profile-image.service'
import type { Post, ProfileDetails } from '../../../types/domain'

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

const DEFAULT_PROFILE_DETAILS: ProfileDetails = {
  bio: '',
  tagline: '',
  location: '',
  country: '',
  city: '',
  uni: '',
  major: '',
  occupations: '',
  hobbies: '',
  links: '',
  avatar_url: null,
}

function parseList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
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
  const { user, updateNickname } = useAuthSession()
  const queryClient = useQueryClient()

  const targetUserId = userId ?? user?.id
  const isOwnProfile = !userId || userId === user?.id

  const postsQuery = usePostsWithRelationsQuery({ enabled: Boolean(user) })

  const profileDetailsQuery = useQuery({
    queryKey: queryKeys.profile.details(targetUserId ?? 'anonymous'),
    queryFn: () => getUserProfileDetails(targetUserId ?? ''),
    enabled: Boolean(targetUserId),
  })

  const profileDetails = profileDetailsQuery.data ?? DEFAULT_PROFILE_DETAILS
  const [draftDetails, setDraftDetails] = useState<ProfileDetails>(DEFAULT_PROFILE_DETAILS)
  const [draftNickname, setDraftNickname] = useState('')
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [nicknameUpdateError, setNicknameUpdateError] = useState('')
  const [avatarInputError, setAvatarInputError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const saveDetailsMutation = useMutation({
    mutationFn: (nextDetails: ProfileDetails) => upsertUserProfileDetails(targetUserId ?? '', nextDetails),
    onSuccess: async (nextDetails) => {
      if (!targetUserId) return
      queryClient.setQueryData(queryKeys.profile.details(targetUserId), nextDetails)
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.all })
      setIsEditingDetails(false)
    },
  })

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!targetUserId) throw new Error('No target user.')
      const avatarUrl = await uploadProfileImage(targetUserId, file)
      return upsertUserProfileDetails(targetUserId, {
        ...profileDetails,
        avatar_url: avatarUrl,
      })
    },
    onSuccess: async (nextDetails) => {
      if (!targetUserId) return
      queryClient.setQueryData(queryKeys.profile.details(targetUserId), nextDetails)
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.all })
    },
  })

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
  const hasFromDetails = [profileDetails.country, profileDetails.city].some((value) => value.trim().length > 0)
  const hasUniDetails = [profileDetails.uni, profileDetails.major].some((value) => value.trim().length > 0)
  const hasProfileDetails = Boolean(profileDetails.avatar_url) || [
    profileDetails.tagline,
    profileDetails.bio,
    profileDetails.location,
    profileDetails.country,
    profileDetails.city,
    profileDetails.uni,
    profileDetails.major,
    profileDetails.occupations,
    profileDetails.hobbies,
    profileDetails.links,
  ].some((value) => value.trim().length > 0)
  const profileDetailsError = profileDetailsQuery.error instanceof Error ? profileDetailsQuery.error.message : null
  const saveDetailsError = saveDetailsMutation.error instanceof Error ? saveDetailsMutation.error.message : null
  const avatarUploadError = uploadAvatarMutation.error instanceof Error ? uploadAvatarMutation.error.message : null
  const avatarErrorMessage = avatarInputError || avatarUploadError

  function handleStartEdit() {
    setDraftDetails(profileDetails)
    setDraftNickname(user?.label ?? '')
    setNicknameUpdateError('')
    setIsEditingDetails(true)
  }

  async function handleDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!targetUserId) return

    const normalizedDraftNickname = draftNickname.trim().replace(/\s+/g, ' ').slice(0, 20)
    const currentNickname = user?.label.trim() ?? ''
    const shouldUpdateNickname = isOwnProfile && normalizedDraftNickname !== currentNickname

    if (shouldUpdateNickname) {
      const nicknameUpdateResult = await updateNickname(normalizedDraftNickname)
      if (!nicknameUpdateResult.ok) {
        setNicknameUpdateError(nicknameUpdateResult.message ?? 'Failed to update nickname.')
        return
      }
    }

    setNicknameUpdateError('')
    await saveDetailsMutation.mutateAsync(draftDetails)
  }

  function handleDetailsCancel() {
    setNicknameUpdateError('')
    setIsEditingDetails(false)
  }

  function handleAvatarClick() {
    if (!isOwnProfile) return
    setAvatarInputError('')
    avatarInputRef.current?.click()
  }

  async function handleAvatarInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarInputError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarInputError('Image must be 5MB or smaller.')
      return
    }

    setAvatarInputError('')
    await uploadAvatarMutation.mutateAsync(file)
  }

  return (
    <section className="rk-page rk-profile-page">
      <div className="rk-profile-page-top">
        <Link to="/" className="rk-profile-back-link">← Back to Feed</Link>
      </div>

      {/* Hero */}
      <div className="rk-profile-hero">
        <button
          type="button"
          className={`rk-profile-avatar-lg ${isOwnProfile ? 'rk-profile-avatar-clickable' : ''}`}
          onClick={handleAvatarClick}
          disabled={!isOwnProfile || uploadAvatarMutation.isPending}
          title={isOwnProfile ? 'Click to upload profile photo' : undefined}
        >
          {profileDetails.avatar_url ? (
            <img src={profileDetails.avatar_url} alt={`${profileData.nickname} profile`} className="rk-profile-avatar-image" />
          ) : (
            profileData.nickname.charAt(0).toUpperCase()
          )}
        </button>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="rk-profile-avatar-input"
          onChange={(event) => void handleAvatarInputChange(event)}
        />

        <div className="rk-profile-hero-info">
          <h1 className="rk-profile-page-name">{profileData.nickname}</h1>
          {isOwnProfile && <p className="rk-profile-page-email">{user.email}</p>}
          {joinedDate && <p className="rk-profile-page-joined">Joined {joinedDate}</p>}
          {!isOwnProfile && <p className="rk-profile-page-joined">Community member</p>}
          {isOwnProfile && (
            <p className="rk-profile-page-joined">
              {uploadAvatarMutation.isPending ? 'Uploading photo...' : 'Tap your profile photo to upload a new one'}
            </p>
          )}
          {isOwnProfile && (
            <button
              type="button"
              className="rk-button rk-button-ghost"
              onClick={handleStartEdit}
            >
              Edit Nickname / Profile
            </button>
          )}
          {avatarErrorMessage && <p className="rk-profile-error">{avatarErrorMessage}</p>}
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

        {profileDetailsQuery.isLoading && !isEditingDetails && (
          <p className="rk-profile-empty">Loading profile details...</p>
        )}

        {!isEditingDetails && (profileDetailsError || saveDetailsError) && (
          <p className="rk-profile-error">{profileDetailsError ?? saveDetailsError}</p>
        )}

        {isOwnProfile && isEditingDetails ? (
          <form className="rk-profile-about-form" onSubmit={handleDetailsSubmit}>
            <label className="rk-label" htmlFor="profile-nickname">Nickname</label>
            <input
              id="profile-nickname"
              className="rk-input"
              value={draftNickname}
              onChange={(event) => {
                setDraftNickname(event.target.value)
                setNicknameUpdateError('')
              }}
              placeholder="e.g. Nayoon"
              maxLength={20}
            />

            <label className="rk-label" htmlFor="profile-tagline">One Liner</label>
            <input
              id="profile-tagline"
              className="rk-input"
              value={draftDetails.tagline}
              onChange={(event) =>
                setDraftDetails((current) => ({ ...current, tagline: event.target.value }))
              }
              placeholder="e.g. Weekend traveler who loves easy city escapes"
              maxLength={80}
            />

            <label className="rk-label" htmlFor="profile-bio">Bio</label>
            <textarea
              id="profile-bio"
              className="rk-post-input"
              value={draftDetails.bio}
              onChange={(event) =>
                setDraftDetails((current) => ({ ...current, bio: event.target.value }))
              }
              placeholder="Tell others about yourself and what you are currently into."
              rows={4}
              maxLength={300}
            />

            <div className="rk-profile-about-grid">
              <label className="rk-profile-about-field">
                <span className="rk-label">Unit Number</span>
                <input
                  className="rk-input"
                  value={draftDetails.location}
                  onChange={(event) =>
                    setDraftDetails((current) => ({ ...current, location: event.target.value }))
                  }
                  placeholder="e.g. 1502"
                  maxLength={40}
                />
              </label>

              <label className="rk-profile-about-field">
                <span className="rk-label">Role / Focus</span>
                <input
                  className="rk-input"
                  value={draftDetails.occupations}
                  onChange={(event) =>
                    setDraftDetails((current) => ({ ...current, occupations: event.target.value }))
                  }
                  placeholder="e.g. Product Designer, PM"
                  maxLength={80}
                />
              </label>
            </div>

            <p className="rk-profile-meta-title">From</p>
            <div className="rk-profile-about-grid">
              <label className="rk-profile-about-field">
                <span className="rk-label">Country</span>
                <input
                  className="rk-input"
                  value={draftDetails.country}
                  onChange={(event) =>
                    setDraftDetails((current) => ({ ...current, country: event.target.value }))
                  }
                  placeholder="e.g. Korea"
                  maxLength={60}
                />
              </label>

              <label className="rk-profile-about-field">
                <span className="rk-label">City</span>
                <input
                  className="rk-input"
                  value={draftDetails.city}
                  onChange={(event) =>
                    setDraftDetails((current) => ({ ...current, city: event.target.value }))
                  }
                  placeholder="e.g. Seoul"
                  maxLength={60}
                />
              </label>
            </div>

            <p className="rk-profile-meta-title">Uni / Major</p>
            <div className="rk-profile-about-grid">
              <label className="rk-profile-about-field">
                <span className="rk-label">Uni</span>
                <input
                  className="rk-input"
                  value={draftDetails.uni}
                  onChange={(event) =>
                    setDraftDetails((current) => ({ ...current, uni: event.target.value }))
                  }
                  placeholder="e.g. Sookmyung Women's University"
                  maxLength={80}
                />
              </label>

              <label className="rk-profile-about-field">
                <span className="rk-label">Major</span>
                <input
                  className="rk-input"
                  value={draftDetails.major}
                  onChange={(event) =>
                    setDraftDetails((current) => ({ ...current, major: event.target.value }))
                  }
                  placeholder="e.g. Design"
                  maxLength={80}
                />
              </label>
            </div>

            <label className="rk-label" htmlFor="profile-hobbies">Hobbies / Interests (comma-separated)</label>
            <input
              id="profile-hobbies"
              className="rk-input"
              value={draftDetails.hobbies}
              onChange={(event) =>
                setDraftDetails((current) => ({ ...current, hobbies: event.target.value }))
              }
              placeholder="e.g. running, exhibitions, cafe tours"
              maxLength={120}
            />

            <label className="rk-label" htmlFor="profile-links">Links (comma-separated)</label>
            <input
              id="profile-links"
              className="rk-input"
              value={draftDetails.links}
              onChange={(event) =>
                setDraftDetails((current) => ({ ...current, links: event.target.value }))
              }
              placeholder="e.g. instagram.com/nayoon, github.com/nayoon"
              maxLength={160}
            />

            {nicknameUpdateError && <p className="rk-profile-error">{nicknameUpdateError}</p>}
            {saveDetailsError && <p className="rk-profile-error">{saveDetailsError}</p>}

            <div className="rk-profile-about-actions">
              <button type="submit" className="rk-button rk-button-primary" disabled={saveDetailsMutation.isPending}>
                {saveDetailsMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="rk-button rk-button-ghost"
                onClick={handleDetailsCancel}
                disabled={saveDetailsMutation.isPending}
              >
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
                <div className="rk-profile-meta-item"><strong>🏠 Unit Number</strong><span>{profileDetails.location}</span></div>
              )}
              {profileDetails.occupations && (
                <div className="rk-profile-meta-item"><strong>💼 Focus</strong><span>{profileDetails.occupations}</span></div>
              )}
            </div>

            {hasFromDetails && (
              <div className="rk-profile-meta-block">
                <span className="rk-profile-meta-title">From</span>
                <div className="rk-profile-meta-list">
                  {profileDetails.country && (
                    <div className="rk-profile-meta-item"><strong>Country</strong><span>{profileDetails.country}</span></div>
                  )}
                  {profileDetails.city && (
                    <div className="rk-profile-meta-item"><strong>City</strong><span>{profileDetails.city}</span></div>
                  )}
                </div>
              </div>
            )}

            {hasUniDetails && (
              <div className="rk-profile-meta-block">
                <span className="rk-profile-meta-title">Uni / Major</span>
                <div className="rk-profile-meta-list">
                  {profileDetails.uni && (
                    <div className="rk-profile-meta-item"><strong>Uni</strong><span>{profileDetails.uni}</span></div>
                  )}
                  {profileDetails.major && (
                    <div className="rk-profile-meta-item"><strong>Major</strong><span>{profileDetails.major}</span></div>
                  )}
                </div>
              </div>
            )}

            {parseList(profileDetails.hobbies).length > 0 && (
              <div className="rk-profile-meta-block">
                <span className="rk-profile-meta-title">✨ Hobbies & Interests</span>
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
              ? 'Your profile intro is empty. Use the Edit profile button to introduce yourself.'
              : 'No profile intro yet.'}
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
