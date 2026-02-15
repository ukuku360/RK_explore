
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CommunityPost } from '../../../types/domain'

import { fetchCommunityPosts, createCommunityPost, deleteCommunityPost } from '../../../services/community/community.service'
import { useAuthSession } from '../../../app/providers/auth-session-context'
import { supabaseClient as supabase } from '../../../services/supabase/client'
import { CommunityPostCard } from './CommunityPostCard'
import { CreateCommunityPost } from './CreateCommunityPost'

export function CommunityFeed() {
  const { user } = useAuthSession()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const communityPostsQueryKey: ['community_posts', string | undefined] = ['community_posts', user?.id]


  const { data: posts = [], isLoading } = useQuery<CommunityPost[]>({
    queryKey: communityPostsQueryKey,
    queryFn: () => fetchCommunityPosts(user?.id),
  })


  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('community-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['community_posts'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  async function handleCreate(content: string) {
    if (!user) return
    setIsSubmitting(true)
    try {
      await createCommunityPost(content, user.label, user.id)
      // Optimistic update or wait for realtime/invalidation is handled by query
    } catch (error) {
      console.error('Failed to post', error)
      alert('Failed to post. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: deleteCommunityPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community_posts'] })
    },
    onError: (error) => {
      console.error('Failed to delete', error)
      alert('Failed to delete post.')
    }
  })

  function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this post?')) return
    deleteMutation.mutate(id)
  }

  if (isLoading) {
    return <div className="rk-loading">Loading community posts...</div>
  }

  return (
    <div className="rk-feed-container">
      <CreateCommunityPost onSubmit={handleCreate} isSubmitting={isSubmitting} />
      
      <div className="rk-community-list">
        {posts.length === 0 ? (
          <div className="rk-empty-state">
            No community posts yet. Be the first!
          </div>
        ) : (
          posts.map((post) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              communityPostsQueryKey={communityPostsQueryKey}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
