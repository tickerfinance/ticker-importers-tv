import 'dotenv/config'
import fs from 'fs'
import {
  upsertChannel,
  insertNewMediaItems,
  getLatestMediaItemDate,
  upsertChannelStatistics,
  type ChannelData,
  type VideoData,
  type ChannelStatistics
} from './lib/db-operations.js'

// YouTube API key should be stored as an environment variable
const API_KEY = process.env.YOUTUBE_API_KEY
if (!API_KEY) {
  throw new Error('YOUTUBE_API_KEY environment variable is required')
}

interface YouTubeVideoSnippet {
  title: string
  description: string
  publishedAt: string
  thumbnails: {
    default?: { url: string }
    medium?: { url: string }
    high?: { url: string }
    standard?: { url: string }
    maxres?: { url: string }
  }
}

interface YouTubeVideoContentDetails {
  duration: string
}

interface YouTubeVideoStatistics {
  viewCount?: string
  likeCount?: string
  commentCount?: string
}

interface YouTubeVideo {
  id: string
  snippet: YouTubeVideoSnippet
  contentDetails: YouTubeVideoContentDetails
  statistics?: YouTubeVideoStatistics
}

interface YouTubeChannelStatistics {
  subscriberCount?: string
  viewCount?: string
  videoCount?: string
}

function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')

  return hours * 3600 + minutes * 60 + seconds
}

function formatDuration(duration: string): string {
  const totalSeconds = parseDurationToSeconds(duration)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

async function getChannelIdByUsername(username: string): Promise<string | null> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${username}&key=${API_KEY}`
  console.log(`Fetching channel ID by username from: ${url}`)

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.items && data.items.length > 0) {
      return data.items[0].id
    }
  } catch (error) {
    console.error(`Error fetching channel ID for username ${username}:`, error)
  }

  return null
}

async function searchChannelByName(channelName: string): Promise<string | null> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelName)}&type=channel&key=${API_KEY}`
  console.log(`Searching for channel by name from: ${url}`)

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.items && data.items.length > 0) {
      return data.items[0].snippet.channelId
    }
  } catch (error) {
    console.error(`Error searching for channel ${channelName}:`, error)
  }

  return null
}

async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
  console.log(`Fetching uploads playlist from: ${channelUrl}`)

  try {
    const response = await fetch(channelUrl)
    const data = await response.json()

    if (data.items && data.items.length > 0) {
      return data.items[0].contentDetails?.relatedPlaylists?.uploads || null
    }
  } catch (error) {
    console.error(`Error fetching uploads playlist for channel ${channelId}:`, error)
  }

  return null
}

async function fetchChannelStatistics(channelId: string): Promise<ChannelStatistics> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${API_KEY}`
  console.log(`Fetching channel statistics from: ${url}`)

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.items && data.items.length > 0) {
      return data.items[0].statistics || {}
    }
  } catch (error) {
    console.error(`Error fetching channel statistics for ${channelId}:`, error)
  }

  return {}
}

async function getVideosFromChannel(channelId: string, limitVideos?: number): Promise<VideoData[]> {
  const uploadsPlaylistId = await getUploadsPlaylistId(channelId)
  if (!uploadsPlaylistId) {
    console.error(`Could not get uploads playlist for channel ${channelId}`)
    return []
  }

  const videos: VideoData[] = []
  let nextPageToken: string | undefined

  while (true) {
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsPlaylistId}&key=${API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
    console.log(`Fetching playlist items from: ${playlistUrl}`)

    try {
      const playlistResponse = await fetch(playlistUrl)
      const playlistData = await playlistResponse.json()

      if (!playlistData.items) {
        console.log(`No playlist items found for playlist ${uploadsPlaylistId}`)
        break
      }

      // Extract video IDs
      const videoIds = playlistData.items
        .map((item: any) => item.snippet?.resourceId?.videoId)
        .filter((id: string) => id)

      if (videoIds.length === 0) {
        console.log(`No video IDs extracted from playlist items for playlist ${uploadsPlaylistId}. Breaking loop.`)
        break
      }

      // Get detailed video information including statistics
      const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${API_KEY}`
      console.log(`Fetching video details from: ${videoDetailsUrl}`)

      const videoDetailsResponse = await fetch(videoDetailsUrl)
      const videoDetailsData = await videoDetailsResponse.json()

      for (const video of videoDetailsData.items || []) {
        const videoId = video.id
        const title = video.snippet.title
        const description = video.snippet.description
        const publishedAt = video.snippet.publishedAt

        const durationIso = video.contentDetails.duration
        const durationSeconds = parseDurationToSeconds(durationIso)

        // Filter videos shorter than 2 minutes (120 seconds)
        if (durationSeconds < 120) {
          const humanReadableDuration = formatDuration(durationIso)
          console.log(`Skipping short video ${videoId} (${humanReadableDuration}): ${title}`)
          continue
        }

        // Get statistics from the API response
        const statistics = video.statistics || {}
        const viewCount = parseInt(statistics.viewCount || '0')
        const likeCount = parseInt(statistics.likeCount || '0')
        const commentCount = parseInt(statistics.commentCount || '0')

        const duration = formatDuration(durationIso)

        // Get thumbnail URLs
        const thumbnails = video.snippet.thumbnails
        const thumbnailUrls = {
          default: thumbnails.default?.url || '',
          medium: thumbnails.medium?.url || '',
          high: thumbnails.high?.url || '',
          standard: thumbnails.standard?.url || '',
          maxres: thumbnails.maxres?.url || ''
        }

        // Convert published_at to YYYY-MM-DD format
        const date = new Date(publishedAt).toISOString().split('T')[0]
        console.log(`Processing video ${videoId} with date ${date}`)

        videos.push({
          id: videoId,
          title,
          date,
          contentType: 'podcast',
          duration,
          description,
          thumbnails: thumbnailUrls,
          views: viewCount,
          likes: likeCount,
          comments: commentCount
        })

        // Check if we've reached the limit
        if (limitVideos && videos.length >= limitVideos) {
          console.log(`Reached video limit of ${limitVideos}`)
          return videos
        }
      }

      nextPageToken = playlistData.nextPageToken
      if (!nextPageToken) {
        break
      }
    } catch (error) {
      console.error(`Error fetching videos for channel ${channelId}:`, error)
      break
    }
  }

  return videos
}

async function main() {
  const args = process.argv.slice(2)
  const limitVideos = args.includes('--limit-videos') ? parseInt(args[args.indexOf('--limit-videos') + 1]) || 50 : undefined
  const configPath = args.includes('--config') ? args[args.indexOf('--config') + 1] : 'channels-config.json'

  console.log('Loading channel configuration...')
  const channelsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as ChannelData[]

  for (const channel of channelsConfig) {
    console.log(`\\n--- Processing Channel: ${channel.name} (${channel.slug}) ---`)

    try {
      // Upsert channel data
      await upsertChannel(channel)
      console.log(`Upserted channel: ${channel.name}`)

      // Get channel ID
      let channelId = channel.youtubeId

      if (!channelId && (channel as any).youtubeUsername) {
        channelId = await getChannelIdByUsername((channel as any).youtubeUsername) || undefined
      }

      if (!channelId) {
        channelId = await searchChannelByName(channel.name) || undefined
      }

      if (!channelId) {
        console.error(`Could not find YouTube channel ID for ${channel.name}`)
        continue
      }

      console.log(`Using channel ID: ${channelId}`)

      // Fetch videos
      console.log(`Fetching videos for ${channel.name}...`)
      const videos = await getVideosFromChannel(channelId, limitVideos)

      if (videos.length === 0) {
        console.log(`No videos found for ${channel.name}`)
        continue
      }

      console.log(`Found ${videos.length} videos for ${channel.name}`)

      // Insert new media items (and update existing ones)
      await insertNewMediaItems(channel.slug, videos)
      console.log(`Processed media items for ${channel.name}`)

      // Fetch and store channel statistics
      try {
        const channelStats = await fetchChannelStatistics(channelId)
        if (Object.keys(channelStats).length > 0) {
          await upsertChannelStatistics(channel.slug, channelStats)
          console.log(`Updated channel statistics for ${channel.slug}: ${channelStats.subscriberCount || 0} subscribers, ${channelStats.viewCount || 0} total views`)
        }
      } catch (error) {
        console.error(`Failed to fetch/store channel statistics for ${channel.slug}:`, error)
      }

      console.log(`Successfully processed ${videos.length} videos for ${channel.name}`)

    } catch (error) {
      console.error(`Error processing channel ${channel.name}:`, error)
    }
  }

  console.log('\\n--- YouTube import completed ---')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}