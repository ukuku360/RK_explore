import { supabaseClient } from '../supabase/client'

const BUCKET = 'profile-images'

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  })

  if (error) throw new Error(`Profile image upload failed: ${error.message}`)

  const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
