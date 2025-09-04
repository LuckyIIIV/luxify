module.exports = async (message, args, whitelist, fs, TEAM_CHANNEL) => {
  const { guild } = message
  const command = args.shift()?.toLowerCase()

  if (command === 'ping') {
    const sent = await message.channel.send('Pinging...')
    const latency = sent.createdTimestamp - message.createdTimestamp
    await sent.edit(`Pong! Latency: ${latency}ms`)
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
      const count = parseInt(args[0])
      if (isNaN(count) || count < 1 || count > 100) return message.channel.send('Enter a number between 1 and 100.')
      const messages = await message.channel.bulkDelete(count + 1, true)
      const sent = await message.channel.send(`${messages.size - 1} messages deleted.`)
      setTimeout(() => sent.delete().catch(() => {}), 3000)
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
}
