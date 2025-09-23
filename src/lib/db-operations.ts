import { supabase, CHANNELS_TABLE, VIDEOS_TABLE, CHANNEL_STATISTICS_TABLE } from './supabase.js'
import { Tables, TablesInsert, TablesUpdate } from '../types/database.js'

export interface ChannelData {
  slug: string
  name: string
  youtubeId?: string
}

export interface VideoData {
  id: string
  title: string
  date: string
  contentType?: string
  duration?: string
  description?: string
  thumbnails?: {
    default?: string
    medium?: string
    high?: string
    standard?: string
    maxres?: string
  }
  views?: number
  likes?: number
  comments?: number
}

export interface ChannelStatistics {
  subscriberCount?: string
  viewCount?: string
  videoCount?: string
}

export async function upsertChannel(channelData: ChannelData): Promise<void> {
  const channelRecord: TablesInsert<'tv_channels'> = {
    slug: channelData.slug,
    name: channelData.name,
    youtube_id: channelData.youtubeId || null
  }

  const { error } = await supabase
    .from(CHANNELS_TABLE)
    .upsert(channelRecord)

  if (error) {
    throw new Error(`Failed to upsert channel: ${error.message}`)
  }
}

export async function insertNewMediaItems(channelSlug: string, videos: VideoData[]): Promise<void> {
  // Get all existing ids for this channel
  const { data: existingData, error: fetchError } = await supabase
    .from(VIDEOS_TABLE)
    .select('id')
    .eq('channel_slug', channelSlug)

  if (fetchError) {
    throw new Error(`Failed to fetch existing videos: ${fetchError.message}`)
  }

  const existingIds = new Set(existingData?.map(item => item.id) || [])

  const newRecords: TablesInsert<'tv_media_items'>[] = []
  const updatePromises: Promise<any>[] = []

  for (const video of videos) {
    if (existingIds.has(video.id)) {
      // Update statistics for existing videos
      const updateRecord: TablesUpdate<'tv_media_items'> = {
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0
      }

      updatePromises.push(
        Promise.resolve(
          supabase
            .from(VIDEOS_TABLE)
            .update(updateRecord)
            .eq('id', video.id)
        )
      )
      continue
    }

    // Prepare new media item record
    const record: TablesInsert<'tv_media_items'> = {
      id: video.id,
      title: video.title,
      date: video.date,
      content_type: video.contentType || 'podcast',
      duration: video.duration || null,
      description: video.description || null,
      youtube_id: video.id,
      image: video.thumbnails?.high || video.thumbnails?.default || null,
      channel_slug: channelSlug,
      youtube_url: `https://www.youtube.com/watch?v=${video.id}`,
      views: video.views || 0,
      likes: video.likes || 0,
      comments: video.comments || 0
    }
    newRecords.push(record)
  }

  // Execute all updates in parallel
  if (updatePromises.length > 0) {
    await Promise.all(updatePromises)
  }

  // Insert new records
  if (newRecords.length > 0) {
    const { error } = await supabase
      .from(VIDEOS_TABLE)
      .insert(newRecords)

    if (error) {
      throw new Error(`Failed to insert new media items: ${error.message}`)
    }
  }
}

export async function getChannelMediaItems(channelSlug: string): Promise<Tables<'tv_media_items'>[]> {
  const { data, error } = await supabase
    .from(VIDEOS_TABLE)
    .select('*')
    .eq('channel_slug', channelSlug)

  if (error) {
    throw new Error(`Failed to get channel media items: ${error.message}`)
  }

  return data || []
}

export async function getAllChannels(): Promise<Tables<'tv_channels'>[]> {
  const { data, error } = await supabase
    .from(CHANNELS_TABLE)
    .select('*')

  if (error) {
    throw new Error(`Failed to get all channels: ${error.message}`)
  }

  return data || []
}

export async function getLatestMediaItemDate(channelSlug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(VIDEOS_TABLE)
    .select('date')
    .eq('channel_slug', channelSlug)
    .order('date', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Failed to get latest media item date: ${error.message}`)
  }

  if (data && data.length > 0 && data[0].date) {
    return data[0].date
  }

  return null
}

export async function upsertChannelStatistics(
  channelSlug: string,
  statistics: ChannelStatistics,
  date?: string
): Promise<void> {
  const statisticsDate = date || new Date().toISOString().split('T')[0]

  // Calculate aggregated stats from video data
  const { data: videoStats, error: videoStatsError } = await supabase
    .from(VIDEOS_TABLE)
    .select('views, likes, comments')
    .eq('channel_slug', channelSlug)

  if (videoStatsError) {
    throw new Error(`Failed to get video stats: ${videoStatsError.message}`)
  }

  const calculatedLikes = videoStats?.reduce((sum, item) => sum + (item.likes || 0), 0) || 0
  const calculatedComments = videoStats?.reduce((sum, item) => sum + (item.comments || 0), 0) || 0

  const record: TablesInsert<'tv_channel_statistics'> = {
    channel_slug: channelSlug,
    date: statisticsDate,
    subscriber_count: statistics.subscriberCount ? parseInt(statistics.subscriberCount) : 0,
    total_channel_views: statistics.viewCount ? parseInt(statistics.viewCount) : 0,
    total_videos: statistics.videoCount ? parseInt(statistics.videoCount) : 0,
    calculated_total_likes: calculatedLikes,
    calculated_total_comments: calculatedComments
  }

  const { error } = await supabase
    .from(CHANNEL_STATISTICS_TABLE)
    .upsert(record)

  if (error) {
    throw new Error(`Failed to upsert channel statistics: ${error.message}`)
  }
}

export async function getChannelStatisticsHistory(
  channelSlug: string,
  days: number = 30
): Promise<Tables<'tv_channel_statistics'>[]> {
  const { data, error } = await supabase
    .from(CHANNEL_STATISTICS_TABLE)
    .select('*')
    .eq('channel_slug', channelSlug)
    .order('date', { ascending: false })
    .limit(days)

  if (error) {
    throw new Error(`Failed to get channel statistics history: ${error.message}`)
  }

  return data || []
}