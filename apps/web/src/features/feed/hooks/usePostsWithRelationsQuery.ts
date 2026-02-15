import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../../lib/queryKeys'
import { listPostsWithRelations } from '../../../services/posts/posts.service'

type UsePostsWithRelationsQueryOptions = {
  enabled?: boolean
}

export function usePostsWithRelationsQuery(options?: UsePostsWithRelationsQueryOptions) {
  return useQuery({
    queryKey: queryKeys.feed.postsWithRelations(),
    queryFn: () => listPostsWithRelations(50),
    enabled: options?.enabled ?? true,
  })
}
