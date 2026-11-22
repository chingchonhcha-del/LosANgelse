
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    MediaGalleryBuilder,
MediaGalleryItemBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SlashCommandBuilder,
    REST,
    Routes,
} = require("discord.js");

// ======================================================
// CONFIGURATION
// ======================================================

const CONFIG = {
    token: process.env.BOT_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,

    prefix: process.env.PREFIX || "!",
    secretTicketCommand: process.env.SECRET_TICKET_COMMAND || "1!sndticketpanel",

    serverName: process.env.SERVER_NAME || "Los Angeles Roleplay",
    brandColor: parseInt(process.env.BRAND_COLOR || "3498DB", 16),
    footer: process.env.FOOTER_TEXT || "Los Angeles Roleplay",
    banner: process.env.BANNER_URL || "",
    timezone: process.env.TIMEZONE || "Europe/Mariehamn",

    ticketPanelChannel: process.env.TICKET_PANEL_CHANNEL_ID,
    ticketGeneral: process.env.TICKET_CATEGORY_GENERAL,
    ticketHighRank: process.env.TICKET_CATEGORY_HIGH_RANK,
    ticketSenior: process.env.TICKET_CATEGORY_SENIOR_HIGH_RANK,
    ticketLog: process.env.TICKET_LOG_CHANNEL_ID,
    ticketStaff: process.env.TICKET_STAFF_ROLE_ID,

    sessionChannel: process.env.SESSION_CHANNEL_ID,
    sessionAnnouncement: process.env.SESSION_ANNOUNCEMENT_CHANNEL_ID,
    sessionStaff: process.env.SESSION_STAFF_ROLE_ID,

    promotionChannel: process.env.PROMOTION_CHANNEL_ID,
    promotionStaff: process.env.PROMOTION_STAFF_ROLE_ID,

    infractionChannel: process.env.INFRACTION_CHANNEL_ID,
    infractionStaff: process.env.INFRACTION_STAFF_ROLE_ID,

    modLog: process.env.MOD_LOG_CHANNEL_ID,
    moderatorRole: process.env.MODERATOR_ROLE_ID,

    erlcKey: process.env.ERLC_SERVER_KEY,
    erlcRefresh: Math.max(
        30,
        Number(process.env.ERLC_REFRESH_SECONDS || 60)
    ),
    erlcStatusChannel: process.env.ERLC_STATUS_CHANNEL_ID,
};

if (!CONFIG.token || !CONFIG.clientId || !CONFIG.guildId) {
    console.error("Missing BOT_TOKEN, CLIENT_ID, or GUILD_ID in .env");
    process.exit(1);
}

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel],
});

// ======================================================
// STORAGE
// ======================================================

const DATA_FILE = path.join(__dirname, "bot-data.json");

function loadData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
        return { tickets: {}, session: null };
    }
}

const data = loadData();

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ======================================================
// HELPERS
// ======================================================

function hasRole(member, roleId) {
    if (!roleId) return false;
    return member.roles.cache.has(roleId);
}

function isStaff(member) {
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        hasRole(member, CONFIG.moderatorRole) ||
        hasRole(member, CONFIG.ticketStaff) ||
        hasRole(member, CONFIG.sessionStaff) ||
        hasRole(member, CONFIG.promotionStaff) ||
        hasRole(member, CONFIG.infractionStaff)
    );
}

function timestamp() {
    return new Date().toLocaleString("en-GB", {
        timeZone: CONFIG.timezone,
        dateStyle: "medium",
        timeStyle: "short",
    });
}


function v2Container(lines, components = []) {
    const container = new ContainerBuilder()
        .setAccentColor(CONFIG.brandColor);

    const safeLines = lines
        .filter(line => line !== null && line !== undefined)
        .map(line => String(line));

    for (const line of safeLines) {
        if (line.length > 0) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(line)
            );
        }
    }

    if (components.length) {
        container.addSeparatorComponents(
            new SeparatorBuilder()
        );

        for (const component of components) {
            container.addActionRowComponents(component);
        }
    }

    return container;
}


async function sendV2(channel, lines, components = []) {
    return channel.send({
        components: [v2Container(lines, components)],
        flags: MessageFlags.IsComponentsV2,
    });
}

async function replyV2(interaction, lines, components = [], ephemeral = true) {
    return interaction.reply({
        components: [v2Container(lines, components)],
        flags:
            MessageFlags.IsComponentsV2 |
            (ephemeral ? MessageFlags.Ephemeral : 0),
    });
}

async function getTextChannel(id) {
    if (!id) return null;
    return client.channels.fetch(id).catch(() => null);
}

async function logTo(channelId, lines) {
    const channel = await getTextChannel(channelId);
    if (channel) await sendV2(channel, lines);
}

function staffCheck(interaction, roleId) {
    return (
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        ) ||
        hasRole(interaction.member, roleId)
    );
}

function safeText(value) {
    return String(value || "Not provided").slice(0, 1000);
}

// ======================================================
// SLASH COMMANDS
// ======================================================

const commands = [
    new SlashCommandBuilder()
        .setName("ticketpanel")
        .setDescription("Send the support ticket panel"),

    new SlashCommandBuilder()
        .setName("sessionpanel")
        .setDescription("Send the session information panel"),

    new SlashCommandBuilder()
        .setName("sessionstart")
        .setDescription("Start a server session"),

    new SlashCommandBuilder()
        .setName("sessionshutdown")
        .setDescription("Announce a session shutdown"),

    new SlashCommandBuilder()
        .setName("sessionvote")
        .setDescription("Start a session vote"),

    new SlashCommandBuilder()
        .setName("serverstatus")
        .setDescription("Show live ER:LC server information"),

    new SlashCommandBuilder()
        .setName("promote")
        .setDescription("Announce a promotion")
        .addUserOption(o =>
            o.setName("member").setDescription("Member").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("rank").setDescription("New rank").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("infraction")
        .setDescription("Issue an infraction")
        .addUserOption(o =>
            o.setName("member").setDescription("Member").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("type").setDescription("Infraction type").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member")
        .addUserOption(o =>
            o.setName("member").setDescription("Member").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user")
        .addStringOption(o =>
            o.setName("userid").setDescription("Discord user ID").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member")
        .addUserOption(o =>
            o.setName("member").setDescription("Member").setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Timeout a member")
        .addUserOption(o =>
            o.setName("member").setDescription("Member").setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("minutes").setDescription("Timeout duration").setRequired(true)
                .setMinValue(1).setMaxValue(40320)
        )
        .addStringOption(o =>
            o.setName("reason").setDescription("Reason").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove a member timeout")
        .addUserOption(o =>
            o.setName("member").setDescription("Member").setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Delete messages")
        .addIntegerOption(o =>
            o.setName("amount").setDescription("Number of messages")
                .setRequired(true).setMinValue(1).setMaxValue(100)
        ),
].map(command => command.toJSON());

// ======================================================
// REGISTER COMMANDS
// ======================================================

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(CONFIG.token);

    await rest.put(
        Routes.applicationGuildCommands(CONFIG.clientId, CONFIG.guildId),
        { body: commands }
    );

    console.log("Slash commands registered.");
}

// ======================================================
// ER:LC API
// ======================================================

let erlcClient = null;
let erlcError = null;

async function initializeERLC() {
    if (!CONFIG.erlcKey) {
        console.log("ERLC_SERVER_KEY missing. ER:LC integration disabled.");
        return;
    }

    try {
        const { ErlcClient } = await import("erlc-api");

        erlcClient = new ErlcClient({
            serverKey: CONFIG.erlcKey,
        });

        const server = await erlcClient.server.get();

        console.log(
            `Connected to ER:LC: ${server.Name} (${server.CurrentPlayers}/${server.MaxPlayers})`
        );
    } catch (error) {
        erlcError = error;
        console.error("ER:LC connection failed:", error.message);
    }
}

async function getERLCStatus() {
    if (!erlcClient) {
        throw new Error("ER:LC integration is not configured or connected.");
    }

    return erlcClient.server.get({
        include: ["players", "queue", "staff"],
    });
}

async function updateERLCStatus() {
    if (!erlcClient || !CONFIG.erlcStatusChannel) return;

    try {
        const server = await erlcClient.server.get();
        const channel = await getTextChannel(CONFIG.erlcStatusChannel);

        if (!channel) return;

        const lines = [
            `# ${CONFIG.serverName} | Live Server Status`,
            `**Server:** ${server.Name || CONFIG.serverName}`,
            `**Players:** ${server.CurrentPlayers}/${server.MaxPlayers}`,
            `**Updated:** ${timestamp()}`,
            `-# Live information provided by the ER:LC API`,
        ];

        const savedMessageId = data.erlcStatusMessage;

        if (savedMessageId) {
            const message = await channel.messages.fetch(savedMessageId).catch(() => null);

            if (message) {
                await message.edit({
                    components: [v2Container(lines)],
                    flags: MessageFlags.IsComponentsV2,
                });
                return;
            }
        }

        const message = await sendV2(channel, lines);
        data.erlcStatusMessage = message.id;
        saveData();

    } catch (error) {
        console.error("ER:LC status update failed:", error.message);
    }
}

// ======================================================
// TICKET PANEL
// ======================================================


const EMOJIS = {
    general: {
        id: "1574139960737530066",
        name: "f5ab339f763a4201bf0f26979b0d2d83",
    },
    high: {
        id: "1574139950054645881",
        name: "e79109d4bc7f44f38d52394b686aaf1c",
    },
    senior: {
        id: "1574139922695200768",
        name: "a2aec6c66d9b453ab8d7fee4b6d68ce3",
    },
    assistance: "<:a948f079a2d146e1ade323d5694fc625:1574139938037956758>",
    information: "<:6be15ef27e88409c8ccec3db6666597d:1574139903359590492>",
};

function ticketMenu() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("ticket_create")
            .setPlaceholder("Select a category to open a ticket")
            .addOptions(
                {
                    label: "General Support",
                    description: "Questions, in-game appeals, and player reports",
                    value: "general",
                    emoji: EMOJIS.general,
                },
                {
                    label: "High Rank Support",
                    description: "Ban appeals, supporter perks, and staff reports",
                    value: "high",
                    emoji: EMOJIS.high,
                },
                {
                    label: "Senior High Rank Support",
                    description: "Leadership concerns, blacklist appeals, partnerships",
                    value: "senior",
                    emoji: EMOJIS.senior,
                }
            )
    );
}

async function sendTicketPanel(channel) {
    const container = new ContainerBuilder()
        .setAccentColor(0x49B9F5);

    if (CONFIG.banner) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(CONFIG.banner)
            )
        );
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${EMOJIS.assistance} Assistance\n` +
            "Get help from the Los Angeles Roleplay team. Choose the category that best matches your request and provide the details in the form."
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## <:f5ab339f763a4201bf0f26979b0d2d83:1574139960737530066> General Support\n` +
            "› General questions\n" +
            "› In-game appeals\n" +
            "› Player reports"
        )
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## <:e79109d4bc7f44f38d52394b686aaf1c:1574139950054645881> High Rank Support\n` +
            "› Ban appeals\n" +
            "› Supporter perks\n" +
            "› Staff reports"
        )
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## <:a2aec6c66d9b453ab8d7fee4b6d68ce3:1574139922695200768> Senior High Rank Support\n` +
            "› Leadership concerns\n" +
            "› Blacklist appeals\n" +
            "› Partnership requests"
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${EMOJIS.information} Submit one ticket per issue and provide accurate information. Your ticket is visible to the assigned team and server administrators.`
        )
    );

    if (process.env.FOOTER_BANNER_URL) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(process.env.FOOTER_BANNER_URL)
            )
        );
    }

    container.addActionRowComponents(ticketMenu());

    await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}


// ======================================================
// SESSION SYSTEM
// ======================================================


async function sessionPanel(channel) {
    let server = null;

    try {
        if (erlcClient) {
            server = await erlcClient.server.get({
                include: ["players", "staff", "queue"],
            });
        }
    } catch (error) {
        console.error("Session panel ERLC update:", error.message);
    }

    const count = (...keys) => {
        for (const key of keys) {
            const value = server?.[key];
            if (Array.isArray(value)) return value.length;
            if (typeof value === "number") return value;
        }
        return 0;
    };

    data.sessionNotifications ||= [];

    const active = Boolean(data.session?.active);
    const players = server?.CurrentPlayers ?? 0;
    const maxPlayers = server?.MaxPlayers ?? 0;
    const queue = count("Queue", "queue");
    const staff = count("Staff", "staff");

    const container = new ContainerBuilder()
        .setAccentColor(0x49B9F5);

    // MAIN BANNER
    const sessionBanner =
        process.env.SESSION_BANNER_URL || CONFIG.banner;

    if (sessionBanner) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(sessionBanner)
            )
        );
    }

    // TITLE AND DESCRIPTION
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🗄️ Los Angeles Sessions\n` +
            "Join our community for organized, staff-led roleplay. Review the server regulations before entering and follow all directions from the session team.\n\n" +
            `**Server:** ${process.env.ERLC_SERVER_NAME || "Los Angeles Roleplay | Strict | Realistic"}\n` +
            `**Code:** ${process.env.ERLC_SERVER_CODE || "Not configured"}\n` +
            `**Owner:** ${process.env.SERVER_OWNER || "Not configured"}\n\n` +
            `${active ? "🟢 **A session is currently running.** Join the server and follow staff instructions." : "❌ **No session is currently running.** Enable notifications below to hear when our next session opens."}`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    // PLAYER STATISTICS
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Players**\n` +
            `Players currently in-game\n\n` +
            `**Queue**\n` +
            `Players waiting to join\n\n` +
            `**Staff**\n` +
            `Staff currently moderating in-game`
        )
    );

    const stats = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("session_players")
            .setLabel(`${players} / ${maxPlayers}`)
            .setEmoji("👤")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),

        new ButtonBuilder()
            .setCustomId("session_queue")
            .setLabel(String(queue))
            .setEmoji("📋")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),

        new ButtonBuilder()
            .setCustomId("session_staff")
            .setLabel(String(staff))
            .setEmoji("🛡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );

    container.addActionRowComponents(stats);
    container.addSeparatorComponents(new SeparatorBuilder());

    // SESSION BUTTONS
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("session_offline")
            .setLabel(active ? "Session Online" : "Offline")
            .setEmoji(active ? "🟢" : "❌")
            .setStyle(active ? ButtonStyle.Success : ButtonStyle.Danger)
            .setDisabled(true),

        new ButtonBuilder()
            .setCustomId("session_start")
            .setLabel("Start a session")
            .setEmoji("🚀")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(active),

        new ButtonBuilder()
            .setCustomId("session_notify")
            .setLabel("Notify me for Sessions")
            .setEmoji("📢")
            .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(buttons);

    // LAST UPDATED
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `Last updated ${timestamp()}`
        )
    );

    // FOOTER BANNER
    const footerBanner = process.env.FOOTER_BANNER_URL;

    if (footerBanner) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(footerBanner)
            )
        );
    }

    await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}



async function startSession(channel) {
    data.session = {
        active: true,
        updatedAt: timestamp(),
        votes: [],
    };

    saveData();

    const target =
        await getTextChannel(CONFIG.sessionAnnouncement) || channel;

    const subscribers = (data.sessionNotifications || [])
        .map(id => `<@${id}>`)
        .join(" ");

    await sendV2(target, [
        `# 🟢 ${CONFIG.serverName} | SESSION STARTED`,
        "The server session is now starting!",
        "",
        `**Started by:** ${channel.guild.members.me}`,
        `**Time:** ${timestamp()}`,
        "",
        "Join the server and follow staff instructions.",
    ]);

    if (subscribers) {
        await target.send({
            content: `🔔 **Session notification!** ${subscribers}`,
            allowedMentions: {
                users: data.sessionNotifications,
            },
        });
    }
}


async function shutdownSession(channel) {
    data.session = {
        active: false,
        updatedAt: timestamp(),
        votes: [],
    };

    saveData();

    const target = await getTextChannel(CONFIG.sessionAnnouncement) || channel;

    await sendV2(target, [
        `# 🔴 ${CONFIG.serverName} | SESSION SHUTDOWN`,
        "The server session has been shut down.",
        "",
        `**Time:** ${timestamp()}`,
        `-# ${CONFIG.footer}`,
    ]);
}

async function startVote(channel) {
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("vote_yes")
            .setLabel("Yes")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("vote_no")
            .setLabel("No")
            .setStyle(ButtonStyle.Danger)
    );

    data.session = data.session || {
        active: false,
        updatedAt: timestamp(),
        votes: [],
    };

    data.session.votes = [];
    saveData();

    await sendV2(channel, [
        `# ${CONFIG.serverName} | Session Vote`,
        "Should a server session begin?",
        "",
        "**Yes:** 0",
        "**No:** 0",
        "",
        "Cast your vote below. You can only vote once.",
    ], [buttons]);
}

// ======================================================
// PROMOTIONS AND INFRACTIONS
// ======================================================

async function announcePromotion(interaction) {
    const member = interaction.options.getUser("member");
    const rank = interaction.options.getString("rank");
    const reason = interaction.options.getString("reason");

    const channel = await getTextChannel(CONFIG.promotionChannel);

    if (!channel) {
        return interaction.reply({
            content: "Promotion channel is not configured.",
            ephemeral: true,
        });
    }

    await sendV2(channel, [
        `# 🏅 ${CONFIG.serverName} | PROMOTION`,
        `**Member:** ${member}`,
        `**New Rank:** ${rank}`,
        `**Reason:** ${reason}`,
        `**Promoted By:** ${interaction.user}`,
        `**Date:** ${timestamp()}`,
        "",
        `-# ${CONFIG.footer}`,
    ]);

    await interaction.reply({
        content: "Promotion announcement sent.",
        ephemeral: true,
    });
}

async function announceInfraction(interaction) {
    const member = interaction.options.getUser("member");
    const type = interaction.options.getString("type");
    const reason = interaction.options.getString("reason");

    const channel = await getTextChannel(CONFIG.infractionChannel);

    if (!channel) {
        return interaction.reply({
            content: "Infraction channel is not configured.",
            ephemeral: true,
        });
    }

    await sendV2(channel, [
        `# ⚠️ ${CONFIG.serverName} | INFRACTION`,
        `**Member:** ${member}`,
        `**Infraction:** ${type}`,
        `**Reason:** ${reason}`,
        `**Issued By:** ${interaction.user}`,
        `**Date:** ${timestamp()}`,
        "",
        `-# ${CONFIG.footer}`,
    ]);

    await interaction.reply({
        content: "Infraction announcement sent.",
        ephemeral: true,
    });
}

// ======================================================
// MODERATION
// ======================================================

async function moderationLog(action, member, reason, moderator) {
    await logTo(CONFIG.modLog, [
        `# Moderation | ${action}`,
        `**Member:** ${member}`,
        `**Moderator:** ${moderator}`,
        `**Reason:** ${safeText(reason)}`,
        `**Date:** ${timestamp()}`,
    ]);
}

async function handleModeration(interaction, command) {
    if (!staffCheck(interaction, CONFIG.moderatorRole)) {
        return interaction.reply({
            content: "You do not have permission to use this command.",
            ephemeral: true,
        });
    }

    const reason = interaction.options.getString("reason") || "No reason provided";

    try {
        if (command === "ban") {
            const user = interaction.options.getUser("member");
            await interaction.guild.members.ban(user.id, { reason });
            await moderationLog("Ban", user.tag, reason, interaction.user);
        }

        if (command === "unban") {
            const userId = interaction.options.getString("userid");
            await interaction.guild.members.unban(userId, reason);
            await moderationLog("Unban", userId, reason, interaction.user);
        }

        if (command === "kick") {
            const member = interaction.options.getMember("member");

            if (!member) {
                return interaction.reply({
                    content: "That member is not in this server.",
                    ephemeral: true,
                });
            }

            if (!member.kickable) {
                return interaction.reply({
                    content: "I cannot kick that member. Check my role position and permissions.",
                    ephemeral: true,
                });
            }

            await member.kick(reason);
            await moderationLog("Kick", member.user.tag, reason, interaction.user);
        }

        if (command === "mute") {
            const member = interaction.options.getMember("member");
            const minutes = interaction.options.getInteger("minutes");

            if (!member || !member.moderatable) {
                return interaction.reply({
                    content: "I cannot timeout that member.",
                    ephemeral: true,
                });
            }

            await member.timeout(minutes * 60 * 1000, reason);
            await moderationLog(
                `Timeout (${minutes} minutes)`,
                member.user.tag,
                reason,
                interaction.user
            );
        }

        if (command === "unmute") {
            const member = interaction.options.getMember("member");

            if (!member || !member.moderatable) {
                return interaction.reply({
                    content: "I cannot remove that member's timeout.",
                    ephemeral: true,
                });
            }

            await member.timeout(null);
            await moderationLog("Timeout removed", member.user.tag, "Timeout removed", interaction.user);
        }

        if (command === "purge") {
            const amount = interaction.options.getInteger("amount");
            const deleted = await interaction.channel.bulkDelete(amount, true);

            return interaction.reply({
                content: `Deleted ${deleted.size} messages.`,
                ephemeral: true,
            });
        }

        if (!interaction.replied) {
            await interaction.reply({
                content: `${command} completed successfully.`,
                ephemeral: true,
            });
        }

    } catch (error) {
        console.error(`Moderation error (${command}):`, error);

        if (!interaction.replied) {
            await interaction.reply({
                content: `The command failed: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

// ======================================================
// READY
// ======================================================

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    try {
        await registerCommands();
    } catch (error) {
        console.error("Command registration failed:", error);
    }

    await initializeERLC();

    if (erlcClient && CONFIG.erlcStatusChannel) {
        await updateERLCStatus();

        setInterval(
            updateERLCStatus,
            CONFIG.erlcRefresh * 1000
        );
    }
});

// ======================================================
// PREFIX COMMANDS
// ONLY !say AND SECRET TICKET PANEL
// ======================================================

client.on("messageCreate", async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith(CONFIG.secretTicketCommand)) {
        if (!isStaff(message.member)) {
            return message.reply("You do not have permission.");
        }

        const channel = await getTextChannel(CONFIG.ticketPanelChannel) || message.channel;
        await sendTicketPanel(channel);
        return;
    }

    if (message.content.startsWith(`${CONFIG.prefix}say`)) {
        if (!isStaff(message.member)) {
            return message.reply("You do not have permission.");
        }

        const text = message.content.slice(
            `${CONFIG.prefix}say`.length
        ).trim();

        if (!text) {
            return message.reply("Usage: !say <message>");
        }

        await message.delete().catch(() => {});
        await message.channel.send({
            content: text,
            allowedMentions: { parse: [] },
        });
    }
});

// ======================================================
// INTERACTIONS
// ======================================================

client.on("interactionCreate", async interaction => {
    try {
        // ------------------------------
        // SELECT MENUS
        // ------------------------------

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "ticket_create") {
                return createTicket(interaction, interaction.values[0]);
            }
        }

        // ------------------------------
        // BUTTONS
        // ------------------------------

        if (interaction.isButton()) {
            const id = interaction.customId;

            if (id === "ticket_claim") {
                const ticket = data.tickets[interaction.channelId];

                if (!ticket || !ticket.open) {
                    return interaction.reply({
                        content: "This ticket is not open.",
                        ephemeral: true,
                    });
                }

                if (!isStaff(interaction.member)) {
                    return interaction.reply({
                        content: "Only staff can claim tickets.",
                        ephemeral: true,
                    });
                }

                if (ticket.claimedBy) {
                    return interaction.reply({
                        content: `Already claimed by <@${ticket.claimedBy}>.`,
                        ephemeral: true,
                    });
                }

                ticket.claimedBy = interaction.user.id;
                saveData();

                return replyV2(interaction, [
                    `## Ticket claimed`,
                    `This ticket has been claimed by ${interaction.user}.`,
                ]);
            }

            if (id === "ticket_close") {
                const ticket = data.tickets[interaction.channelId];

                if (!ticket || !ticket.open) {
                    return interaction.reply({
                        content: "This ticket is already closed.",
                        ephemeral: true,
                    });
                }

                const isOwner = ticket.userId === interaction.user.id;

                if (!isOwner && !isStaff(interaction.member)) {
                    return interaction.reply({
                        content: "Only the ticket owner or staff can close this ticket.",
                        ephemeral: true,
                    });
                }

                ticket.open = false;
                saveData();

                await logTo(CONFIG.ticketLog, [
                    "# Ticket Closed",
                    `**Channel:** ${interaction.channel}`,
                    `**Owner:** <@${ticket.userId}>`,
                    `**Closed By:** ${interaction.user}`,
                    `**Date:** ${timestamp()}`,
                ]);

                await interaction.reply({
                    content: "Ticket closed. This channel will be deleted in 5 seconds.",
                    ephemeral: true,
                });

                setTimeout(() => {
                    interaction.channel.delete().catch(() => {});
                }, 5000);

                return;
            }

if (id === "session_notify") {
    data.sessionNotifications ||= [];

    const index = data.sessionNotifications.indexOf(interaction.user.id);

    if (index !== -1) {
        data.sessionNotifications.splice(index, 1);

        saveData();

        return interaction.reply({
            content: "Session notifications disabled.",
            ephemeral: true,
        });
    }

    data.sessionNotifications.push(interaction.user.id);
    saveData();

    return interaction.reply({
        content: "🔔 You will be notified when a new session starts!",
        ephemeral: true,
    });
}

            if (id === "session_start") {
                if (!staffCheck(interaction, CONFIG.sessionStaff)) {
                    return interaction.reply({
                        content: "You do not have permission.",
                        ephemeral: true,
                    });
                }

                await interaction.reply({
                    content: "Starting session...",
                    ephemeral: true,
                });

                return startSession(interaction.channel);
            }

            if (id === "session_shutdown") {
                if (!staffCheck(interaction, CONFIG.sessionStaff)) {
                    return interaction.reply({
                        content: "You do not have permission.",
                        ephemeral: true,
                    });
                }

                await interaction.reply({
                    content: "Shutting down session...",
                    ephemeral: true,
                });

                return shutdownSession(interaction.channel);
            }

            if (id === "session_vote") {
                if (!staffCheck(interaction, CONFIG.sessionStaff)) {
                    return interaction.reply({
                        content: "You do not have permission.",
                        ephemeral: true,
                    });
                }

                await interaction.reply({
                    content: "Vote started.",
                    ephemeral: true,
                });

                return startVote(interaction.channel);
            }

            if (id === "vote_yes" || id === "vote_no") {
                if (!data.session) {
                    data.session = {
                        active: false,
                        updatedAt: timestamp(),
                        votes: [],
                    };
                }

                data.session.votes ||= [];

                if (data.session.votes.some(v => v.userId === interaction.user.id)) {
                    return interaction.reply({
                        content: "You have already voted.",
                        ephemeral: true,
                    });
                }

                data.session.votes.push({
                    userId: interaction.user.id,
                    vote: id === "vote_yes" ? "yes" : "no",
                });

                saveData();

                const yes = data.session.votes.filter(v => v.vote === "yes").length;
                const no = data.session.votes.filter(v => v.vote === "no").length;

                await interaction.reply({
                    content: `Vote recorded. Yes: ${yes} | No: ${no}`,
                    ephemeral: true,
                });

                return;
            }
        }

        // ------------------------------
        // SLASH COMMANDS
        // ------------------------------

        if (!interaction.isChatInputCommand()) return;

        const command = interaction.commandName;

        if (command === "ticketpanel") {
            if (!isStaff(interaction.member)) {
                return interaction.reply({
                    content: "You do not have permission.",
                    ephemeral: true,
                });
            }

            const channel = await getTextChannel(CONFIG.ticketPanelChannel) || interaction.channel;
            await sendTicketPanel(channel);

            return interaction.reply({
                content: "Ticket panel sent.",
                ephemeral: true,
            });
        }

        if (command === "sessionpanel") {
            if (!staffCheck(interaction, CONFIG.sessionStaff)) {
                return interaction.reply({
                    content: "You do not have permission.",
                    ephemeral: true,
                });
            }

            await sessionPanel(interaction.channel);

            return interaction.reply({
                content: "Session panel sent.",
                ephemeral: true,
            });
        }

        if (command === "sessionstart") {
            if (!staffCheck(interaction, CONFIG.sessionStaff)) {
                return interaction.reply({
                    content: "You do not have permission.",
                    ephemeral: true,
                });
            }

            await interaction.reply({
                content: "Starting session...",
                ephemeral: true,
            });

            return startSession(interaction.channel);
        }

        if (command === "sessionshutdown") {
            if (!staffCheck(interaction, CONFIG.sessionStaff)) {
                return interaction.reply({
                    content: "You do not have permission.",
                    ephemeral: true,
                });
            }

            await interaction.reply({
                content: "Shutting down session...",
                ephemeral: true,
            });

            return shutdownSession(interaction.channel);
        }

        if (command === "sessionvote") {
            if (!staffCheck(interaction, CONFIG.sessionStaff)) {
                return interaction.reply({
                    content: "You do not have permission.",
                    ephemeral: true,
                });
            }

            await interaction.reply({
                content: "Vote started.",
                ephemeral: true,
            });

            return startVote(interaction.channel);
        }

        if (command === "serverstatus") {
            await interaction.deferReply({ ephemeral: true });

            try {
                const server = await getERLCStatus();

                return interaction.editReply({
                    content:
                        `**${server.Name || CONFIG.serverName}**\n` +
                        `Players: **${server.CurrentPlayers}/${server.MaxPlayers}**`,
                });
            } catch (error) {
                return interaction.editReply({
                    content: `Could not retrieve ER:LC status: ${error.message}`,
                });
            }
        }

        if (command === "promote") {
            if (!staffCheck(interaction, CONFIG.promotionStaff)) {
                return interaction.reply({
                    content: "You do not have permission.",
                    ephemeral: true,
                });
            }

            return announcePromotion(interaction);
        }

        if (command === "infraction") {
            if (!staffCheck(interaction, CONFIG.infractionStaff)) {
                return interaction.reply({
                    content: "You do not have permission.",
                    ephemeral: true,
                });
            }

            return announceInfraction(interaction);
        }

        if (["ban", "unban", "kick", "mute", "unmute", "purge"].includes(command)) {
            return handleModeration(interaction, command);
        }

    } catch (error) {
        console.error("Interaction error:", error);

        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "Something went wrong while processing that action.",
                ephemeral: true,
            }).catch(() => {});
        }
    }
});

// ======================================================
// ERROR HANDLING
// ======================================================

process.on("unhandledRejection", error => {
    console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", error => {
    console.error("Uncaught exception:", error);
});

// ======================================================
// LOGIN
// ======================================================

client.login(CONFIG.token);
