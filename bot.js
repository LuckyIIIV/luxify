const { Client, GatewayIntentBits, ActivityType, AuditLogEvent, ChannelType, PermissionFlagsBits } = require('discord.js')
if (process.env.NODE_ENV !== "production") {
  require('dotenv').config()
}
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
if (!DISCORD_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: Missing environment variables!")
  process.exit(1)
}
const fs = require('fs')
const whitelist = require('./whitelist.json')
const handleCommand = require('./commands.js')
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
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
  'muschi','vagina','ficken','fickt', 'bitch', 'sklave'
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
let ticketCounter = 0
const ticketCategories = {
  support: "1393207709117186178",
  media: "1393207737747247184",
  ban: "1393207740020555936"
}
const allowedRoles = [
  "1412843820630016030",
  "1393207670336651304",
  "1393207671284437095",
  "1393207669472628746",
  "1412843008726007910",
  "1412812080851062860",
  "1393207667782058007",
  "1412503646712631447",
  "1393207668637958297"
]
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
  if (whitelist.whitelistedUsers.includes(message.author.id)) {
    try {
      await handleCommand(message, args, whitelist, fs, TEAM_CHANNEL, () => { securityActive = true }, () => { securityActive = false }, securityActive, supabase)
    } catch (err) {
      await message.channel.send(`Error: ${err.message}`)
    }
  } else {
    await message.channel.send('You are not allowed to use this bot.')
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
client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isStringSelectMenu()) return
    if (interaction.customId !== "ticket_menu") return
    await interaction.deferReply({ ephemeral: true })
    ticketCounter++
    fs.writeFileSync('./ticket_counter.txt', String(ticketCounter))
    const ticketNumber = String(ticketCounter).padStart(3, "0")
    const type = interaction.values[0]
    const categoryId = ticketCategories[type]
    if (!categoryId) {
      await interaction.editReply("❌ Kategorie nicht gefunden!")
      return
    }
    const guild = interaction.guild
    const category = guild.channels.cache.get(categoryId)
    if (!category) {
      await interaction.editReply("❌ Kategorie existiert nicht auf diesem Server.")
      return
    }
    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
      { id: guild.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ]
    allowedRoles.forEach(roleId => {
      if (guild.roles.cache.get(roleId)) overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })
    })
    guild.roles.cache.filter(r => r.permissions.has(PermissionFlagsBits.Administrator)).forEach(r => {
      overwrites.push({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })
    })
    const channelName = `ticket-${ticketNumber}`
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: overwrites
    })
    await channel.send(`🎫 Ticket erstellt von ${interaction.user.tag} (${type})\nEin Teammitglied wird sich bald melden.`)
    await interaction.editReply(`✅ Dein Ticket wurde erstellt: ${channel}`)
  } catch (err) {
    console.error("Ticket Create Error:", err)
    try {
      const errorString = String(err).slice(0, 1900)
      if (interaction.deferred || interaction.replied) await interaction.editReply(`❌ Fehler beim Erstellen des Tickets:\n\`\`\`\n${errorString}\n\`\`\``)
      else await interaction.reply({ content: `❌ Fehler beim Erstellen des Tickets:\n\`\`\`\n${errorString}\n\`\`\``, ephemeral: true })
    } catch {}
    try {
      const guild = interaction.guild
      const teamChannel = guild?.channels.cache.get(TEAM_CHANNEL)
      const errorString = String(err).slice(0, 1900)
      if (teamChannel) await teamChannel.send(`Ticket Create Error in ${guild?.name} (${guild?.id}):\n\`\`\`\n${errorString}\n\`\`\``)
    } catch {}
  }
})
client.login(DISCORD_TOKEN)
