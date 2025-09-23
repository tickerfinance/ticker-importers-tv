import 'dotenv/config'
import fs from 'fs'
import {
  getAllChannels,
  getChannelMediaItems,
  getChannelStatisticsHistory
} from './lib/db-operations.js'

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function arrayToCSV(data: any[], headers: string[]): string {
  const csvRows = [headers.join(',')]

  for (const row of data) {
    const csvRow = headers.map(header => escapeCSV(row[header]))
    csvRows.push(csvRow.join(','))
  }

  return csvRows.join('\n')
}

async function exportChannelsToCSV(): Promise<void> {
  console.log('Exporting channels to CSV...')
  const channels = await getAllChannels()

  const headers = ['slug', 'name', 'youtube_id', 'visible', 'created_at']
  const csv = arrayToCSV(channels, headers)

  fs.writeFileSync('export_channels.csv', csv)
  console.log(`Exported ${channels.length} channels to export_channels.csv`)
}

async function exportVideosToCSV(): Promise<void> {
  console.log('Exporting videos to CSV...')
  const channels = await getAllChannels()

  let allVideos: any[] = []

  for (const channel of channels) {
    const videos = await getChannelMediaItems(channel.slug)
    allVideos = allVideos.concat(videos)
  }

  const headers = [
    'id', 'title', 'date', 'content_type', 'duration', 'description',
    'youtube_id', 'image', 'channel_slug', 'youtube_url', 'views', 'likes', 'comments',
    'apple_podcasts_url', 'created_at'
  ]

  const csv = arrayToCSV(allVideos, headers)

  fs.writeFileSync('export_videos.csv', csv)
  console.log(`Exported ${allVideos.length} videos to export_videos.csv`)
}

async function exportChannelStatisticsToCSV(): Promise<void> {
  console.log('Exporting channel statistics to CSV...')
  const channels = await getAllChannels()

  let allStats: any[] = []

  for (const channel of channels) {
    const stats = await getChannelStatisticsHistory(channel.slug, 365) // Last year
    allStats = allStats.concat(stats)
  }

  const headers = [
    'id', 'channel_slug', 'date', 'subscriber_count', 'total_channel_views',
    'total_videos', 'calculated_total_likes', 'calculated_total_comments', 'created_at'
  ]

  const csv = arrayToCSV(allStats, headers)

  fs.writeFileSync('export_channel_statistics.csv', csv)
  console.log(`Exported ${allStats.length} channel statistics records to export_channel_statistics.csv`)
}

async function generateSummaryReport(): Promise<void> {
  console.log('Generating summary report...')
  const channels = await getAllChannels()

  const summary = {
    total_channels: channels.length,
    channels_by_visibility: {
      visible: channels.filter(c => c.visible).length,
      hidden: channels.filter(c => !c.visible).length,
      null_visibility: channels.filter(c => c.visible === null).length
    },
    channels_with_youtube_id: channels.filter(c => c.youtube_id).length
  }

  let totalVideos = 0
  const channelVideoCounts: { [key: string]: number } = {}

  for (const channel of channels) {
    const videos = await getChannelMediaItems(channel.slug)
    channelVideoCounts[channel.slug] = videos.length
    totalVideos += videos.length
  }

  const fullReport = {
    ...summary,
    total_videos: totalVideos,
    videos_per_channel: channelVideoCounts,
    export_timestamp: new Date().toISOString()
  }

  fs.writeFileSync('export_summary.json', JSON.stringify(fullReport, null, 2))
  console.log(`Generated summary report: export_summary.json`)
  console.log(`Total channels: ${summary.total_channels}`)
  console.log(`Total videos: ${totalVideos}`)
}

async function main(): Promise<void> {
  try {
    await exportChannelsToCSV()
    await exportVideosToCSV()
    await exportChannelStatisticsToCSV()
    await generateSummaryReport()

    console.log('\n--- Export completed successfully ---')
    console.log('Files created:')
    console.log('- export_channels.csv')
    console.log('- export_videos.csv')
    console.log('- export_channel_statistics.csv')
    console.log('- export_summary.json')

  } catch (error) {
    console.error('Export failed:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}