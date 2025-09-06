const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js")

module.exports = async (message, args, whitelist, fs, TEAM_CHANNEL, activate, pause, securityActive, supabase) => {
  const command = args.shift()?.toLowerCase()

  if (command === 'ping') {
    const sent = await message.channel.send('Pinging...')
    const latency = sent.createdTimestamp - message.createdTimestamp
    await sent.edit(`Pong! Latency: ${latency}ms`)
  }

  if (command === 'pausear') {
    pause()
    return message.channel.send('Security system paused.')
  }

  if (command === 'ar') {
    activate()
    return message.channel.send('Security system activated.')
  }

  if (command === 'ban') {
    try {
      const user = message.mentions.members.first()
      if (!user) return message.channel.send('Please mention a user.')
      if (!user.bannable) return message.channel.send('I cannot ban this user.')
      await user.ban()
      message.channel.send(`${user.user.tag} banned successfully.`)
    } catch (err) {
      message.channel.send(`Couldn't ban user: ${err.message}`)
    }
  }

  if (command === 'kick') {
    try {
      const user = message.mentions.members.first()
      if (!user) return message.channel.send('Please mention a user.')
      if (!user.kickable) return message.channel.send('I cannot kick this user.')
      await user.kick()
      message.channel.send(`${user.user.tag} kicked successfully.`)
    } catch (err) {
      message.channel.send(`Couldn't kick user: ${err.message}`)
    }
  }

  if (command === 'timeout') {
    try {
      const user = message.mentions.members.first()
      const duration = parseInt(args[0]) * 1000
      if (!user || isNaN(duration)) return message.channel.send('Usage: +timeout @user seconds')
      await user.timeout(duration, 'Timeout by Security Bot')
      message.channel.send(`${user.user.tag} timed out for ${args[0]}s`)
    } catch (err) {
      message.channel.send(`Couldn't timeout user: ${err.message}`)
    }
  }

  if (command === 'purge') {
    try {
      if (args.length === 1) {
        const count = parseInt(args[0])
        if (isNaN(count) || count < 1 || count > 100) return message.channel.send('Enter a number between 1 and 100.')
        const messages = await message.channel.bulkDelete(count + 1, true)
        const sent = await message.channel.send(`${messages.size - 1} messages deleted.`)
        setTimeout(() => sent.delete().catch(() => {}), 3000)
      } else if (args.length === 2) {
        const userId = args[0]
        const count = parseInt(args[1])
        if (isNaN(count) || count < 1 || count > 100) return message.channel.send('Enter a number between 1 and 100.')
        const fetched = await message.channel.messages.fetch({ limit: 100 })
        const messagesToDelete = fetched.filter(m => m.author.id === userId).first(count)
        if (messagesToDelete.length === 0) return message.channel.send('No messages found for that user.')
        await message.channel.bulkDelete(messagesToDelete, true)
        const sent = await message.channel.send(`${messagesToDelete.length} messages from <@${userId}> deleted.`)
        setTimeout(() => sent.delete().catch(() => {}), 3000)
      } else {
        return message.channel.send('Usage: +purge {amount} OR +purge {userid} {amount}')
      }
    } catch (err) {
      message.channel.send(`Couldn't purge messages: ${err.message}`)
    }
  }

  if (command === 'createwebhook') {
    try {
      const channel = message.mentions.channels.first()
      if (!channel) return message.channel.send('Please mention a channel.')
      const webhook = await channel.createWebhook({ name: 'Webhook' })
      message.channel.send(`Webhook created!\nURL: ${webhook.url}`)
    } catch (err) {
      message.channel.send(`Couldn't create webhook: ${err.message}`)
    }
  }

  if (command === 'whitelist') {
    const ownerId = '1217846372372316172'
    if (message.author.id !== ownerId) return message.channel.send('Only the bot owner can manage the whitelist.')
    const action = args.shift()
    const userId = args.shift()
    if (!['add','remove'].includes(action) || !userId) return message.channel.send('Usage: +whitelist add/remove {userId}')
    if (action === 'add') {
      if (!whitelist.whitelistedUsers.includes(userId)) {
        whitelist.whitelistedUsers.push(userId)
        fs.writeFileSync('./whitelist.json', JSON.stringify(whitelist, null, 2))
        message.channel.send(`User ${userId} added to whitelist.`)
      } else {
        message.channel.send(`User ${userId} is already whitelisted.`)
      }
    }
    if (action === 'remove') {
      if (whitelist.whitelistedUsers.includes(userId)) {
        whitelist.whitelistedUsers = whitelist.whitelistedUsers.filter(id => id !== userId)
        fs.writeFileSync('./whitelist.json', JSON.stringify(whitelist, null, 2))
        message.channel.send(`User ${userId} removed from whitelist.`)
      } else {
        message.channel.send(`User ${userId} is not in whitelist.`)
      }
    }
  }

  if (command === 'si') {
    try {
      const guild = message.guild
      const info = {
        id: guild.id,
        name: guild.name,
        description: guild.description,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
        large: guild.large,
        premiumTier: guild.premiumTier,
        premiumSubscriptionCount: guild.premiumSubscriptionCount,
        afkTimeout: guild.afkTimeout,
        afkChannelId: guild.afkChannelId,
        systemChannelId: guild.systemChannelId,
        verificationLevel: guild.verificationLevel,
        mfaLevel: guild.mfaLevel,
        nsfwLevel: guild.nsfwLevel,
        vanityURLCode: guild.vanityURLCode,
        preferredLocale: guild.preferredLocale,
        rulesChannelId: guild.rulesChannelId,
        publicUpdatesChannelId: guild.publicUpdatesChannelId,
        createdAt: guild.createdAt,
        iconURL: guild.iconURL({ dynamic: true, size: 4096 }),
        bannerURL: guild.bannerURL({ size: 4096 }),
        splashURL: guild.splashURL({ size: 4096 }),
        discoverySplashURL: guild.discoverySplashURL({ size: 4096 })
      }
      message.channel.send('```json\n' + JSON.stringify(info, null, 2) + '\n```')
    } catch (err) {
      message.channel.send(`Couldn't fetch server info: ${err.message}`)
    }
  }

  if (command === 'ui') {
    try {
      const userId = args[0]
      if (!userId) return message.channel.send('Usage: +ui {userid}')
      const member = await message.guild.members.fetch(userId).catch(() => null)
      if (!member) return message.channel.send('User not found in this server.')
      const user = member.user
      const info = {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        tag: user.tag,
        bot: user.bot,
        createdAt: user.createdAt,
        avatarURL: user.displayAvatarURL({ dynamic: true, size: 4096 }),
        nickname: member.nickname,
        joinedAt: member.joinedAt,
        roles: member.roles.cache.map(r => ({ id: r.id, name: r.name })),
        pending: member.pending,
        premiumSince: member.premiumSince,
        deaf: member.voice?.deaf || false,
        mute: member.voice?.mute || false
      }
      message.channel.send('```json\n' + JSON.stringify(info, null, 2) + '\n```')
    } catch (err) {
      message.channel.send(`Couldn't fetch user info: ${err.message}`)
    }
  }

  if (command === 'search') {
    const query = args.join(' ')
    if (!query) return message.channel.send('Bitte gib einen User oder eine IP ein.')
    const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(query)
    const type = isIP ? 'ip' : 'user'
    const { data, error } = await supabase.from('search_data').select('*').eq('type', type).ilike('query', query)
    if (error) return message.channel.send('Datenbank Fehler: ' + error.message)
    if (!data.length) return message.channel.send(`Keine Infos gefunden für ${query}`)
    data.forEach(entry => {
      message.channel.send('```json\n' + JSON.stringify(entry, null, 2) + '\n```')
    })
  }

  if (command === 'sendticketpanel') {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Ticket Panel")
      .setDescription("Please select a ticket:")
      .setColor("Blurple")
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_menu")
      .setPlaceholder("Select a ticket")
      .addOptions([
        {
          label: "Support Ticket",
          description: "Support",
          value: "support"
        },
        {
          label: "Media",
          description: "Bewerbung für Media",
          value: "media"
        },
        {
          label: "Ban Appeal",
          description: "Einspruch gegen Bann",
          value: "ban"
        }
      ])
    const row = new ActionRowBuilder().addComponents(menu)
    await message.channel.send({ embeds: [embed], components: [row] })
  }
}
