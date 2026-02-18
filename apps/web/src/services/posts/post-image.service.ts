import { supabaseClient } from '../supabase/client'

const BUCKET = 'post-images'

export async function uploadPostImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  })

  if (error) throw new Error(`Image upload failed: ${error.message}`)

  const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
