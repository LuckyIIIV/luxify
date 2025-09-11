const { Client, GatewayIntentBits, ActivityType, AuditLogEvent, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, ChannelType } = require('discord.js')
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
  'muschi','vagina','ficken','fickt', 'bitch', 'sklave',
  'arschloch', 'wixxer', 'wickser', 'nehga'
]

const ipRegex = /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.|:)){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b|(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4})/;

const discordLinkRegex = /(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite)\/[^\s]+/i;

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
    if (normalizedContent.includes(normalize(word))) return { type: 'word' }
  }

  if (ipRegex.test(content)) return { type: 'ip' }

  if (discordLinkRegex.test(content)) return { type: 'discord' }

  return false
}

let ticketCounter = 0
const ticketCategories = {
  support: "1393207709117186178",
  apply: "1393207737747247184",
  ban: "1393207740020555936"
};
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
const TICKET_LOG_CHANNEL = "1413910870886584333"

client.once('ready', () => {
  console.log(`Bot online as ${client.user.tag}`)
  client.user.setPresence({
    activities: [{
      name: '[+] Security | 👑 LuxifySMP.net',
      type: ActivityType.Streaming,
      url: 'https://twitch.tv/luxifysmp'
    }],
    status: 'dnd'
  })
})

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return

  const now = Date.now()
  const key = `${message.guild.id}-${message.author.id}`

  if (!messageLogs.has(key)) messageLogs.set(key, [])
  const logs = messageLogs.get(key)
  logs.push({ content: message.content, time: now })
  const recent = logs.filter(l => now - l.time < 5000)
  messageLogs.set(key, recent)

  if (message.content.startsWith('+')) {
    const args = message.content.slice(1).split(/ +/)
    if (whitelist.whitelistedUsers.includes(message.author.id)) {
      try {
        await handleCommand(message, args, whitelist, fs, TEAM_CHANNEL, () => { securityActive = true }, () => { securityActive = false }, securityActive, supabase, allowedRoles)
      } catch (err) {
        await message.channel.send(`Error: ${err.message}`)
      }
    } else {
      await message.channel.send('You are not allowed to use this bot.')
    }
  }

  if (!securityActive) return

  const result = isBlacklisted(message.content)
  if (result) {
    if (!whitelist.whitelistedUsers.includes(message.author.id) && !punishedUsers.has(message.author.id)) {
      punishedUsers.add(message.author.id)
      try {
        await message.delete()
        if (result.type === 'ip') {
          await message.member.timeout(10 * 60 * 1000, 'Sending IPs is not allowed')
          await message.channel.send(`${message.author.tag} was timed out for 10m (IP sent)`)
        } else if (result.type === 'discord') {
          await message.member.timeout(5 * 60 * 1000, 'Sending Discord links is not allowed')
          await message.channel.send(`${message.author.tag} was timed out for 5m (Discord link sent)`)
        } else {
          await message.member.timeout(30 * 60 * 1000, 'User used blacklisted words')
          await message.channel.send(`${message.author.tag} was timed out for 30m (blacklisted words)`)
        }
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
  const channel = interaction.channel

  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
    await interaction.deferReply({ ephemeral: true })
    ticketCounter++
    const ticketNumber = String(ticketCounter).padStart(3, "0")
    const type = interaction.values[0]
    
    const categoryId = ticketCategories[type];
    if (!categoryId) {
      await interaction.editReply("❌ Category not found!");
      return;
    }

    try {
      const guild = interaction.guild
      const overwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] }
      ]
      const ownerMember = await guild.members.fetch(guild.ownerId).catch(() => null)
      if (ownerMember) overwrites.push({ id: ownerMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })
      for (const roleId of allowedRoles) {
        const role = await guild.roles.fetch(roleId).catch(() => null)
        if (role) overwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })
      }

      const ticketChannel = await guild.channels.create({
        name: `ticket-${ticketNumber}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: overwrites
      })

      const embed = new EmbedBuilder()
        .setTitle(`🎫 Ticket #${ticketNumber}`)
        .setDescription(`${interaction.user} created this ${type} ticket.\nA team member will be with you shortly.`)
        .setColor("Blurple")
        .setTimestamp()

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("claim_ticket").setLabel("Claim").setStyle(ButtonStyle.Success)
      )

      const sentMessage = await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [buttons] })
      await interaction.editReply(`✅ Your ticket has been created: ${ticketChannel}`)

      ticketChannel.ticketMessages = []
      ticketChannel.ticketOwner = interaction.user
      const msgCollector = ticketChannel.createMessageCollector({})
      msgCollector.on("collect", m => ticketChannel.ticketMessages.push(`${m.author.tag}: ${m.content}`))

      ticketChannel.claimer = null
      ticketChannel.ticketType = type
      ticketChannel.ticketNumber = ticketNumber
      ticketChannel.ticketMessage = sentMessage
    } catch (err) {
      await interaction.editReply(`❌ Error creating ticket: ${err.message}`)
    }
    return
  }

  if (interaction.isButton()) {
    if (!channel || !channel.ticketMessages) return

    const memberRoles = interaction.member.roles.cache.map(r => r.id)
    const isStaff = memberRoles.some(r => allowedRoles.includes(r))

    if (!interaction.user.id === channel.ticketOwner.id && !isStaff) {
      return await interaction.reply({ content: "You cannot interact with this ticket.", ephemeral: true })
    }

    if (interaction.customId === "claim_ticket") {
      if (!isStaff) return await interaction.reply({ content: "Only staff can claim tickets.", ephemeral: true })
      if (channel.claimer) {
        await interaction.reply({ content: `Ticket already claimed by ${channel.claimer.tag}`, ephemeral: true })
      } else {
        channel.claimer = interaction.user
        await interaction.update({ components: interaction.message.components })
        await channel.send(`✅ Ticket claimed by ${interaction.user} !`)
      }
      return
    }

    if (interaction.customId === "close_ticket") {
      if (!isStaff) return await interaction.reply({ content: "Only staff can close tickets.", ephemeral: true })
      const confirmButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("confirm_close").setLabel("Close").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("cancel_close").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
      )
      await interaction.reply({ content: "Close Ticket?", components: [confirmButtons], ephemeral: true })
      return
    }

    if (interaction.customId === "confirm_close") {
      if (!isStaff) return await interaction.reply({ content: "Only staff can confirm close.", ephemeral: true })

      const modal = new ModalBuilder()
        .setCustomId("close_modal")
        .setTitle("Close Ticket")

      const reasonInput = new TextInputBuilder()
        .setCustomId("close_reason")
        .setLabel("Reason for closing the ticket")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)

      const row = new ActionRowBuilder().addComponents(reasonInput)
      modal.addComponents(row)

      await interaction.showModal(modal)
      return
    }

    if (interaction.customId === "cancel_close") {
      await interaction.update({ content: "Ticket close cancelled.", components: [] })
      return
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === "close_modal") {
    if (!channel || !channel.ticketMessages) return
    const memberRoles = interaction.member.roles.cache.map(r => r.id)
    const isStaff = memberRoles.some(r => allowedRoles.includes(r))
    if (!isStaff) return await interaction.reply({ content: "Only staff can close tickets.", ephemeral: true })

    await interaction.reply({ content: "Closing ticket...", ephemeral: true })

    setImmediate(async () => {
      const reason = interaction.fields.getTextInputValue("close_reason")
      const chatLog = channel.ticketMessages.join("\n")
      const fileName = `ticket-${channel.ticketNumber}.txt`
      fs.writeFileSync(`/tmp/${fileName}`, chatLog)

      const closeEmbed = new EmbedBuilder()
        .setTitle(`🎫 ${channel.ticketType} Ticket Closed`)
        .setDescription(`Your ${channel.ticketType} ticket has been closed for reason:\n${reason}\nView the log attached.`)
        .setColor("Red")
        .setTimestamp()

      await channel.ticketOwner.send({ embeds: [closeEmbed], files: [`/tmp/${fileName}`] }).catch(() => {})

      const logChannel = await channel.guild.channels.fetch(TICKET_LOG_CHANNEL)
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`🎫 ${channel.ticketType} Ticket Log`)
          .setDescription(`The ticket (${channel.ticketNumber}) was claimed by ${channel.claimer ? channel.claimer.tag : "No one"} and closed by ${interaction.user.tag} with reason:\n${reason}`)
          .setColor("Orange")
          .setTimestamp()
        await logChannel.send({ embeds: [logEmbed], files: [`/tmp/${fileName}`] })
      }

      setTimeout(() => channel.delete().catch(() => {}), 1000)
    })
  }
})

client.login(DISCORD_TOKEN)
