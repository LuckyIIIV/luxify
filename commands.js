module.exports = async (message, args, whitelist, fs, TEAM_CHANNEL) => {
  const { guild } = message
  const command = args.shift()?.toLowerCase()

  if (command === 'ping') {
    const sent = await message.reply('Pinging...')
    const latency = sent.createdTimestamp - message.createdTimestamp
    await sent.edit(`Pong! Latency: ${latency}ms`)
  }

  if (command === 'ban') {
    try {
      const user = message.mentions.members.first()
      if (!user) return message.reply('Please mention a user.')
      if (!user.bannable) return message.reply('I cannot ban this user.')
      await user.ban()
      message.reply(`${user.user.tag} banned successfully.`)
    } catch (err) {
      message.reply(`Couldn't ban user: ${err.message}`)
    }
  }

  if (command === 'kick') {
    try {
      const user = message.mentions.members.first()
      if (!user) return message.reply('Please mention a user.')
      if (!user.kickable) return message.reply('I cannot kick this user.')
      await user.kick()
      message.reply(`${user.user.tag} kicked successfully.`)
    } catch (err) {
      message.reply(`Couldn't kick user: ${err.message}`)
    }
  }

  if (command === 'timeout') {
    try {
      const user = message.mentions.members.first()
      const duration = parseInt(args[0]) * 1000
      if (!user || isNaN(duration)) return message.reply('Usage: +timeout @user seconds')
      await user.timeout(duration, 'Timeout by Security Bot')
      message.reply(`${user.user.tag} timed out for ${args[0]}s`)
    } catch (err) {
      message.reply(`Couldn't timeout user: ${err.message}`)
    }
  }

  if (command === 'purge') {
    try {
      const count = parseInt(args[0])
      if (isNaN(count) || count < 1 || count > 100) return message.reply('Enter a number between 1 and 100.')
      const messages = await message.channel.bulkDelete(count + 1, true)
      const sent = await message.reply(`${messages.size - 1} messages deleted.`)
      setTimeout(() => sent.delete().catch(() => {}), 3000)
    } catch (err) {
      message.reply(`Couldn't purge messages: ${err.message}`)
    }
  }

  if (command === 'createwebhook') {
    try {
      const channel = message.mentions.channels.first()
      if (!channel) return message.reply('Please mention a channel.')
      const webhook = await channel.createWebhook({ name: 'Webhook' })
      message.reply(`Webhook created!\nURL: ${webhook.url}`)
    } catch (err) {
      message.reply(`Couldn't create webhook: ${err.message}`)
    }
  }

  if (command === 'whitelist') {
    const ownerId = '1217846372372316172'
    if (message.author.id !== ownerId) return message.reply('Only the bot owner can manage the whitelist.')
    const action = args.shift()
    const userId = args.shift()
    if (!['add','remove'].includes(action) || !userId) return message.reply('Usage: +whitelist add/remove {userId}')

    if (action === 'add') {
      if (!whitelist.whitelistedUsers.includes(userId)) {
        whitelist.whitelistedUsers.push(userId)
        fs.writeFileSync('./whitelist.json', JSON.stringify(whitelist, null, 2))
        message.reply(`User ${userId} added to whitelist.`)
      } else {
        message.reply(`User ${userId} is already whitelisted.`)
      }
    }

    if (action === 'remove') {
      if (whitelist.whitelistedUsers.includes(userId)) {
        whitelist.whitelistedUsers = whitelist.whitelistedUsers.filter(id => id !== userId)
        fs.writeFileSync('./whitelist.json', JSON.stringify(whitelist, null, 2))
        message.reply(`User ${userId} removed from whitelist.`)
      } else {
        message.reply(`User ${userId} is not in whitelist.`)
      }
    }
  }
}
