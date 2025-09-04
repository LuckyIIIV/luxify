const { Client, GatewayIntentBits, ActivityType, AuditLogEvent } = require('discord.js')
if (process.env.NODE_ENV !== "production") {
  require('dotenv').config()
}
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
if (!DISCORD_TOKEN) {
  console.error("ERROR: No Discord token found! Did you set it in Environment Variables?")
  process.exit(1)
}
const fs = require('fs')
const whitelist = require('./whitelist.json')
const handleCommand = require('./commands.js')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ]
})

const joinTimestamps = new Map()
const messageLogs = new Map()
const punishedUsers = new Set()
const TEAM_CHANNEL = '1393207746274398298'
let securityActive = true

const blacklist = [
  'nigga','niga','nicka','nigger','niger',
  'fotze','bastard','hurensohn','schwanz','penis',
  'muschi','vagina','ficken','fickt'
]

function normalize(str) {
  return str.toLowerCase()
    .replace(/@/g, 'a')
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/\+/g, 't')
    .replace(/[^a-z]/g, '')
}

function isBlacklisted(content) {
  const normalizedContent = normalize(content)
  for (const word of blacklist) {
    if (normalizedContent.includes(normalize(word))) return true
  }
  return false
}

client.once('ready', () => {
  console.log(`Bot online as ${client.user.tag}`)
  client.user.setPresence({
    activities: [{
      name: '[+] Security | 👑 LuxifySMP',
      type: ActivityType.Streaming,
      url: 'https://twitch.tv/luxifysmp'
    }],
    status: 'dnd'
  })
})

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return
  if (!message.content.startsWith('+')) return

  const args = message.content.slice(1).split(/ +/)
  const command = args[0]?.toLowerCase()

  if (command === 'pausear') {
    if (!whitelist.whitelistedUsers.includes(message.author.id))
      return message.channel.send('You are not allowed to use this command.')
    securityActive = false
    return message.channel.send('Security system paused.')
  }

  if (command === 'ar') {
    if (!whitelist.whitelistedUsers.includes(message.author.id))
      return message.channel.send('You are not allowed to use this command.')
    securityActive = true
    return message.channel.send('Security system activated.')
  }

  if (whitelist.whitelistedUsers.includes(message.author.id)) {
    try {
      await handleCommand(message, args, whitelist, fs, TEAM_CHANNEL)
    } catch (err) {
      message.channel.send(`Error: ${err.message}`)
    }
  } else {
    return message.channel.send('You are not allowed to use this bot.')
  }

  if (!securityActive) return

  const now = Date.now()
  const key = `${message.guild.id}-${message.author.id}`

  if (!messageLogs.has(key)) messageLogs.set(key, [])
  const logs = messageLogs.get(key)
  logs.push({ content: message.content, time: now })
  const recent = logs.filter(l => now - l.time < 5000)
  messageLogs.set(key, recent)

  if (isBlacklisted(message.content)) {
    if (!whitelist.whitelistedUsers.includes(message.author.id) && !punishedUsers.has(message.author.id)) {
      punishedUsers.add(message.author.id)
      try {
        await message.delete()
        await message.member.timeout(30 * 60 * 1000, 'User used blacklisted words')
        await message.channel.send(`${message.author.tag} was timed out for 30m (blacklisted words)`)
      } catch {}
    } else {
      try { await message.delete() } catch {}
    }
    return
  }

  if (recent.length > 8) {
    if (!whitelist.whitelistedUsers.includes(message.author.id) && !punishedUsers.has(message.author.id)) {
      punishedUsers.add(message.author.id)
      try {
        await message.member.timeout(60 * 60 * 1000, 'Spam detected')
        await message.guild.channels.cache.get(TEAM_CHANNEL)?.send(`⚠️ Spam detected: ${message.author.tag} timed out for 1h`)
      } catch {}
    }
  }

  const linkPattern = /(https?:\/\/[^\s]+)/gi
  if (message.content.match(linkPattern)) {
    const suspicious = /(grabify|iplogger|phish|scam|free-nitro)/i
    if (suspicious.test(message.content)) {
      try {
        await message.delete()
        await message.member.timeout(60 * 60 * 1000, 'Phishing detected')
        await message.guild.channels.cache.get(TEAM_CHANNEL)?.send(`⚠️ Phishing attempt blocked from ${message.author.tag}`)
      } catch {}
    }
  }
})

client.on('guildMemberAdd', async member => {
  if (!securityActive) return
  const now = Date.now()
  const guildId = member.guild.id
  if (!joinTimestamps.has(guildId)) joinTimestamps.set(guildId, [])
  const timestamps = joinTimestamps.get(guildId)
  timestamps.push(now)
  const recent = timestamps.filter(t => now - t < 10000)
  joinTimestamps.set(guildId, recent)

  if (member.user.bot && !whitelist.whitelistedUsers.includes(member.id)) {
    try {
      await member.kick('Unauthorized bot join blocked')
      await member.guild.channels.cache.get(TEAM_CHANNEL)?.send(`⚠️ Unauthorized bot blocked: ${member.user.tag}`)
    } catch {}
  }

  if (recent.length > 7) {
    member.guild.channels.cache.get(TEAM_CHANNEL)?.send(`⚠️ Possible raid detected on ${member.guild.name}`)
  }
})

client.on('guildAuditLogEntryCreate', async (entry, guild) => {
  if (!securityActive) return
  if (!guild || !entry.executor) return
  const userId = entry.executor.id
  if (whitelist.whitelistedUsers.includes(userId)) return

  const destructive = [
    AuditLogEvent.ChannelDelete,
    AuditLogEvent.ChannelCreate,
    AuditLogEvent.RoleDelete,
    AuditLogEvent.RoleCreate,
    AuditLogEvent.WebhookCreate,
    AuditLogEvent.WebhookDelete
  ]

  if (destructive.includes(entry.action)) {
    const member = await guild.members.fetch(userId).catch(() => null)
    if (!member) return
    try {
      await member.timeout(60 * 60 * 1000, 'Suspicious destructive action')
      guild.channels.cache.get(TEAM_CHANNEL)?.send(`⚠️ Suspicious action by ${entry.executor.tag} was blocked`)
    } catch {}
  }
})

client.login(DISCORD_TOKEN)
