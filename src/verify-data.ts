import 'dotenv/config'
import fs from 'fs'
import {
  getAllChannels,
  getChannelMediaItems,
  getChannelStatisticsHistory
} from './lib/db-operations.js'

interface VerificationResult {
  passed: boolean
  message: string
  details?: any
}

async function verifyChannelCounts(): Promise<VerificationResult> {
  const channels = await getAllChannels()
  const summary = JSON.parse(fs.readFileSync('export_summary.json', 'utf8'))

  if (channels.length !== summary.total_channels) {
    return {
      passed: false,
      message: `Channel count mismatch: DB has ${channels.length}, summary shows ${summary.total_channels}`
    }
  }

  return {
    passed: true,
    message: `✅ Channel count verified: ${channels.length} channels`
  }
}

async function verifyVideoCounts(): Promise<VerificationResult> {
  const channels = await getAllChannels()
  const summary = JSON.parse(fs.readFileSync('export_summary.json', 'utf8'))

  let totalDbVideos = 0
  const channelMismatches: string[] = []

  for (const channel of channels) {
    const videos = await getChannelMediaItems(channel.slug)
    const dbCount = videos.length
    const summaryCount = summary.videos_per_channel[channel.slug] || 0

    totalDbVideos += dbCount

    if (dbCount !== summaryCount) {
      channelMismatches.push(`${channel.slug}: DB=${dbCount}, Summary=${summaryCount}`)
    }
  }

  if (totalDbVideos !== summary.total_videos) {
    return {
      passed: false,
      message: `Total video count mismatch: DB has ${totalDbVideos}, summary shows ${summary.total_videos}`,
      details: { channelMismatches }
    }
  }

  if (channelMismatches.length > 0) {
    return {
      passed: false,
      message: `Channel video count mismatches found`,
      details: { channelMismatches }
    }
  }

  return {
    passed: true,
    message: `✅ Video count verified: ${totalDbVideos} videos across all channels`
  }
}

async function verifyDataIntegrity(): Promise<VerificationResult> {
  const channels = await getAllChannels()
  const issues: string[] = []

  for (const channel of channels) {
    // Check if channel has youtube_id
    if (!channel.youtube_id) {
      issues.push(`Channel ${channel.slug} missing youtube_id`)
    }

    // Check video data integrity
    const videos = await getChannelMediaItems(channel.slug)

    for (const video of videos) {
      // Check for required fields
      if (!video.id) issues.push(`Video missing ID in channel ${channel.slug}`)
      if (!video.title) issues.push(`Video ${video.id} missing title in channel ${channel.slug}`)
      if (!video.date) issues.push(`Video ${video.id} missing date in channel ${channel.slug}`)

      // Check YouTube URL format
      if (video.youtube_url && !video.youtube_url.includes('youtube.com/watch?v=')) {
        issues.push(`Video ${video.id} has invalid YouTube URL format in channel ${channel.slug}`)
      }

      // Check if statistics are present (should be 0 or positive numbers)
      if (video.views !== null && video.views < 0) {
        issues.push(`Video ${video.id} has negative views in channel ${channel.slug}`)
      }
      if (video.likes !== null && video.likes < 0) {
        issues.push(`Video ${video.id} has negative likes in channel ${channel.slug}`)
      }
      if (video.comments !== null && video.comments < 0) {
        issues.push(`Video ${video.id} has negative comments in channel ${channel.slug}`)
      }
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Data integrity issues found: ${issues.length} problems`,
      details: { issues: issues.slice(0, 20) } // Show first 20 issues
    }
  }

  return {
    passed: true,
    message: `✅ Data integrity verified: No issues found across ${channels.length} channels`
  }
}

function parseCSVRecordCount(csvContent: string): number {
  const lines = csvContent.split('\n')
  let recordCount = 0
  let inQuotes = false

  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i].trim()
    if (!line) continue

    // Count records by tracking when we start a new record (not inside quotes)
    if (!inQuotes) {
      // Check if this line starts with a pattern that looks like a video ID (11 characters, alphanumeric)
      if (/^[a-zA-Z0-9_-]{11},/.test(line)) {
        recordCount++
      }
    }

    // Track quote state for multiline handling
    const quoteCount = (line.match(/"/g) || []).length
    if (quoteCount % 2 === 1) {
      inQuotes = !inQuotes
    }
  }

  return recordCount
}

async function verifyCSVFiles(): Promise<VerificationResult> {
  const issues: string[] = []

  // Check if all CSV files exist
  const requiredFiles = [
    'export_channels.csv',
    'export_videos.csv',
    'export_channel_statistics.csv',
    'export_summary.json'
  ]

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      issues.push(`Missing file: ${file}`)
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `CSV export files missing`,
      details: { issues }
    }
  }

  // Check CSV file record counts match expected data
  const channelsContent = fs.readFileSync('export_channels.csv', 'utf8')
  const channelLines = channelsContent.split('\n').filter(line => line.trim() !== '').length - 1 // -1 for header

  const videosContent = fs.readFileSync('export_videos.csv', 'utf8')
  const videoRecords = parseCSVRecordCount(videosContent)

  const summary = JSON.parse(fs.readFileSync('export_summary.json', 'utf8'))

  if (channelLines !== summary.total_channels) {
    issues.push(`Channels CSV record count (${channelLines}) doesn't match summary (${summary.total_channels})`)
  }

  if (videoRecords !== summary.total_videos) {
    issues.push(`Videos CSV record count (${videoRecords}) doesn't match summary (${summary.total_videos})`)
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `CSV file verification failed`,
      details: { issues }
    }
  }

  return {
    passed: true,
    message: `✅ CSV files verified: All files present and record counts match (${summary.total_channels} channels, ${summary.total_videos} videos)`
  }
}

async function runFullVerification(): Promise<void> {
  console.log('🔍 Starting comprehensive data verification...\n')

  const tests = [
    { name: 'Channel Count Verification', test: verifyChannelCounts },
    { name: 'Video Count Verification', test: verifyVideoCounts },
    { name: 'Data Integrity Check', test: verifyDataIntegrity },
    { name: 'CSV Files Verification', test: verifyCSVFiles }
  ]

  const results: VerificationResult[] = []

  for (const testCase of tests) {
    console.log(`Running: ${testCase.name}...`)
    try {
      const result = await testCase.test()
      results.push(result)

      if (result.passed) {
        console.log(`${result.message}`)
      } else {
        console.log(`❌ ${result.message}`)
        if (result.details) {
          console.log('Details:', JSON.stringify(result.details, null, 2))
        }
      }
    } catch (error) {
      console.log(`❌ ${testCase.name} failed with error:`, error)
      results.push({
        passed: false,
        message: `Test failed with error: ${error}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      })
    }
    console.log('')
  }

  // Summary
  const passed = results.filter(r => r.passed).length
  const total = results.length

  console.log('📊 VERIFICATION SUMMARY')
  console.log('═'.repeat(50))
  console.log(`Tests passed: ${passed}/${total}`)

  if (passed === total) {
    console.log('🎉 ALL VERIFICATIONS PASSED! Data integrity confirmed.')
  } else {
    console.log('⚠️  Some verifications failed. Please review the issues above.')
  }

  // Write verification report
  const report = {
    timestamp: new Date().toISOString(),
    passed_tests: passed,
    total_tests: total,
    all_passed: passed === total,
    results: results
  }

  fs.writeFileSync('verification_report.json', JSON.stringify(report, null, 2))
  console.log('\n📝 Detailed verification report saved to: verification_report.json')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFullVerification().catch(console.error)
}