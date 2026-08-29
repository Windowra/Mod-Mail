require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, PermissionsBitField, REST, Routes } = require('discord.js');
const express = require('express');

// --- FIX RENDER WARNING ---
const app = express();
app.get('/', (req,res)=>res.send('✅ WIN-modmail is alive!'));
app.listen(process.env.PORT || 10000, ()=>console.log("🌐 Web server live"));

// --- CONFIG - EDIT THESE AFTER YOU COPY ID ---
const GUILD_ID = "PASTE_YOUR_SERVER_ID_HERE"; // Right-click Windowra server icon -> Copy ID
const MODMAIL_CATEGORY_ID = "PASTE_MODMAIL_CATEGORY_ID_HERE"; // Right-click your Modmail/Ticket created category -> Copy ID
const STAFF_ROLE_NAME = "Staff";
const LOG_CHANNEL_NAME = "logs";

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const slashCommands = [
    { name: "reply", description: "Reply to modmail user", options: [{ name: "message", description: "Message to send", type: 3, required: true }] },
    { name: "close", description: "Close this modmail ticket" },
    { name: "anonreply", description: "Reply anonymously", options: [{ name: "message", description: "Message", type: 3, required: true }] }
];

client.on('ready', async () => {
    console.log(`✅ ${client.user.tag} ONLINE - WIN-modmail v1`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands }); console.log("✅ Slash: /reply /close /anonreply"); } catch(e){ console.error(e); }
});

// --- DM HANDLER -> CREATE MODMAIL CHANNEL ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // User DMing the bot
    if (message.channel.type === 1) { // DM
        const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
        if (!guild) return message.reply("Bot not in any server yet.");

        const category = guild.channels.cache.get(MODMAIL_CATEGORY_ID) || guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory && c.name.toLowerCase().includes("modmail") || c.name.toLowerCase().includes("ticket"));

        // Find existing modmail channel for this user
        let channel = guild.channels.cache.find(c => c.topic && c.topic.includes(message.author.id) && c.name.includes("modmail"));

        if (!channel) {
            channel = await guild.channels.create({
                name: `modmail-${message.author.username.toLowerCase()}`,
                type: ChannelType.GuildText,
                parent: category?.id || null,
                topic: `Modmail for ${message.author.tag} | ID: ${message.author.id}`,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: guild.roles.cache.find(r=>r.name===STAFF_ROLE_NAME)?.id || guild.roles.cache.find(r=>r.permissions.has(PermissionsBitField.Flags.ManageMessages))?.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            }).catch(()=>null);
            if(channel){
                const openEmbed = new EmbedBuilder().setColor("#57F287").setTitle("📩 New Modmail").setDescription(`**User:** ${message.author} (${message.author.tag})\n**ID:** ${message.author.id}`).setTimestamp();
                channel.send({ content: `<@&${guild.roles.cache.find(r=>r.name===STAFF_ROLE_NAME)?.id||''}>`, embeds: [openEmbed] });
            }
        }

        if (channel) {
            const embed = new EmbedBuilder().setColor("Blurple").setAuthor({name: message.author.tag, iconURL: message.author.displayAvatarURL()}).setDescription(message.content || "*Attachment*").setTimestamp().setFooter({text: "User DM"});
            if(message.attachments.size>0) embed.addFields({name: "Attachments", value: message.attachments.map(a=>a.url).join("\n")});
            channel.send({ embeds: [embed] });
            message.reply("✅ Message sent to staff! They will reply here soon.");
        }
    }
});

// --- STAFF REPLY IN SERVER ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.channel.name?.startsWith("modmail-")) return interaction.reply({content: "This command only works in modmail channels!", ephemeral: true});

    const userId = interaction.channel.topic?.match(/\d{17,19}/)?.[0];
    if (!userId) return interaction.reply({content: "Can't find user ID in channel topic!", ephemeral: true});
    const user = await client.users.fetch(userId).catch(()=>null);
    if (!user) return interaction.reply({content: "User not found!", ephemeral: true});

    if (interaction.commandName === "reply") {
        const msg = interaction.options.getString("message");
        const embed = new EmbedBuilder().setColor("Green").setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(msg).setTimestamp();
        await user.send({ embeds: [embed] }).catch(()=> interaction.channel.send("❌ Could not DM user (DMs closed)"));
        await interaction.reply({content: `✅ Replied to ${user.tag}: ${msg}`});
    }
    if (interaction.commandName === "anonreply") {
        const msg = interaction.options.getString("message");
        const embed = new EmbedBuilder().setColor("Grey").setTitle("Staff Response").setDescription(msg).setTimestamp();
        await user.send({ embeds: [embed] }).catch(()=>{});
        await interaction.reply({content: `✅ Anonymous reply sent`});
    }
    if (interaction.commandName === "close") {
        await user.send("🔒 Your modmail ticket has been closed. If you need more help, DM again!").catch(()=>{});
        await interaction.reply("Closing in 3s...");
        setTimeout(()=> interaction.channel.delete().catch(()=>{}), 3000);
    }
});

client.login(process.env.TOKEN);
