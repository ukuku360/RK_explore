import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../../../lib/queryKeys'
import { listUserProfileAvatars } from '../../../services/profile/profile-details.service'

export function useProfileAvatarsByUserIdsQuery(userIds: string[]) {
  const normalizedIds = [...new Set(userIds.filter((id) => id.trim().length > 0))].sort()

  return useQuery({
    queryKey: queryKeys.profile.avatars(normalizedIds.join(',')),
    queryFn: () => listUserProfileAvatars(normalizedIds),
    enabled: normalizedIds.length > 0,
    staleTime: 1000 * 60,
  })
}
