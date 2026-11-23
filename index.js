

require("dotenv").config();

const express = require("express");
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
// RENDER WEB SERVER
// ======================================================

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
    res.status(200).send("Los Angeles Roleplay Bot is online!");
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "Los Angeles Roleplay Bot",
        timestamp: new Date().toISOString(),
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

// ======================================================
// CONFIGURATION
// ======================================================

const CONFIG = {
    token: process.env.BOT_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,

    prefix: process.env.PREFIX || "!",
    secretTicketCommand:
        process.env.SECRET_TICKET_COMMAND || "1!sndticketpanel",

    serverName: process.env.SERVER_NAME || "Los Angeles Roleplay",
    brandColor: parseInt(process.env.BRAND_COLOR || "49B9F5", 16),
    footer: process.env.FOOTER_TEXT || "Los Angeles Roleplay",
    banner: process.env.BANNER_URL || "",
    footerBanner: process.env.FOOTER_BANNER_URL || "",
    sessionBanner: process.env.SESSION_BANNER_URL || "",
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

    erlcServerName:
        process.env.ERLC_SERVER_NAME || "Los Angeles Roleplay",
    erlcServerCode: process.env.ERLC_SERVER_CODE || "Not configured",
    serverOwner: process.env.SERVER_OWNER || "Not configured",
};

if (!CONFIG.token || !CONFIG.clientId || !CONFIG.guildId) {
    console.error(
        "Missing BOT_TOKEN, CLIENT_ID, or GUILD_ID in your environment variables."
    );
    process.exit(1);
}

// ======================================================
// DISCORD CLIENT
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
// DATA STORAGE
// ======================================================

const DATA_FILE = path.join(__dirname, "bot-data.json");

function loadData() {
    try {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

        return {
            tickets: parsed.tickets || {},
            session: parsed.session || null,
            sessionNotifications: parsed.sessionNotifications || [],
            erlcStatusMessage: parsed.erlcStatusMessage || null,
        };
    } catch {
        return {
            tickets: {},
            session: null,
            sessionNotifications: [],
            erlcStatusMessage: null,
        };
    }
}

const data = loadData();

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Could not save bot data:", error);
    }
}

// ======================================================
// CUSTOM EMOJIS
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
    assistance:
        "<:a948f079a2d146e1ade323d5694fc625:1574139938037956758>",
    information:
        "<:6be15ef27e88409c8ccec3db6666597d:1574139903359590492>",
};

// ======================================================
// GENERAL HELPERS
// ======================================================

function hasRole(member, roleId) {
    if (!roleId || !member?.roles?.cache) return false;
    return member.roles.cache.has(roleId);
}

function isAdmin(member) {
    return Boolean(
        member?.permissions?.has(PermissionFlagsBits.Administrator)
    );
}

function isStaff(member) {
    return (
        isAdmin(member) ||
        hasRole(member, CONFIG.moderatorRole) ||
        hasRole(member, CONFIG.ticketStaff) ||
        hasRole(member, CONFIG.sessionStaff) ||
        hasRole(member, CONFIG.promotionStaff) ||
        hasRole(member, CONFIG.infractionStaff)
    );
}

function staffCheck(interaction, roleId) {
    return (
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        ) || hasRole(interaction.member, roleId)
    );
}

function timestamp() {
    try {
        return new Date().toLocaleString("en-GB", {
            timeZone: CONFIG.timezone,
            dateStyle: "medium",
            timeStyle: "short",
        });
    } catch {
        return new Date().toLocaleString("en-GB");
    }
}

function safeText(value) {
    return String(value || "Not provided").slice(0, 1000);
}

async function getTextChannel(id) {
    if (!id) return null;

    const channel = await client.channels.fetch(id).catch(() => null);

    if (!channel?.isTextBased?.()) return null;

    return channel;
}

function v2Container(lines, components = []) {
    const container = new ContainerBuilder()
        .setAccentColor(CONFIG.brandColor);

    for (const line of lines) {
        if (line === null || line === undefined) continue;

        const content = String(line);

        if (!content.length) continue;

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(content)
        );
    }

    if (components.length) {
        container.addSeparatorComponents(new SeparatorBuilder());

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

async function replyV2(
    interaction,
    lines,
    components = [],
    ephemeral = true
) {
    return interaction.reply({
        components: [v2Container(lines, components)],
        flags:
            MessageFlags.IsComponentsV2 |
            (ephemeral ? MessageFlags.Ephemeral : 0),
    });
}

async function logTo(channelId, lines) {
    const channel = await getTextChannel(channelId);

    if (channel) {
        await sendV2(channel, lines).catch(console.error);
    }
}

function addBanner(container, url) {
    if (!url) return;

    try {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(url)
            )
        );
    } catch (error) {
        console.error("Could not add banner:", error.message);
    }
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
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member being promoted")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("rank")
                .setDescription("New rank")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for promotion")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("infraction")
        .setDescription("Issue an infraction")
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member receiving the infraction")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("type")
                .setDescription("Infraction type")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the infraction")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member")
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to ban")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user")
        .addStringOption(option =>
            option
                .setName("userid")
                .setDescription("Discord user ID")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member")
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to kick")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Timeout a member")
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to timeout")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("minutes")
                .setDescription("Timeout duration in minutes")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove a member timeout")
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to untimeout")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Delete messages")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Number of messages to delete")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),
].map(command => command.toJSON());

// ======================================================
// REGISTER SLASH COMMANDS
// ======================================================

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(CONFIG.token);

    await rest.put(
        Routes.applicationGuildCommands(
            CONFIG.clientId,
            CONFIG.guildId
        ),
        { body: commands }
    );

    console.log("Slash commands registered successfully.");
}

// ======================================================
// ER:LC API
// ======================================================

let erlcClient = null;

async function initializeERLC() {
    if (!CONFIG.erlcKey) {
        console.log(
            "ERLC_SERVER_KEY is missing. ER:LC integration is disabled."
        );
        return;
    }

    try {
        const { ErlcClient } = await import("erlc-api");

        erlcClient = new ErlcClient({
            serverKey: CONFIG.erlcKey,
        });

        const server = await erlcClient.server.get();

        console.log(
            `Connected to ER:LC: ${server.Name} ` +
            `(${server.CurrentPlayers}/${server.MaxPlayers})`
        );
    } catch (error) {
        erlcClient = null;
        console.error("ER:LC connection failed:", error.message);
    }
}

async function getERLCStatus() {
    if (!erlcClient) {
        throw new Error(
            "ER:LC is not connected. Check ERLC_SERVER_KEY."
        );
    }

    return erlcClient.server.get({
        include: ["players", "queue", "staff"],
    });
}

function getArrayCount(server, ...keys) {
    for (const key of keys) {
        const value = server?.[key];

        if (Array.isArray(value)) return value.length;
        if (typeof value === "number") return value;
    }

    return 0;
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
            `**Players:** ${server.CurrentPlayers ?? 0}/${server.MaxPlayers ?? 0}`,
            `**Updated:** ${timestamp()}`,
            `-# Live information provided by the ER:LC API`,
        ];

        if (data.erlcStatusMessage) {
            const oldMessage = await channel.messages
                .fetch(data.erlcStatusMessage)
                .catch(() => null);

            if (oldMessage) {
                await oldMessage.edit({
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

function ticketMenu() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("ticket_create")
            .setPlaceholder("Select a category to open a ticket")
            .addOptions(
                {
                    label: "General Support",
                    description:
                        "Questions, in-game appeals, and player reports",
                    value: "general",
                    emoji: EMOJIS.general,
                },
                {
                    label: "High Rank Support",
                    description:
                        "Ban appeals, supporter perks, and staff reports",
                    value: "high",
                    emoji: EMOJIS.high,
                },
                {
                    label: "Senior High Rank Support",
                    description:
                        "Leadership concerns and serious appeals",
                    value: "senior",
                    emoji: EMOJIS.senior,
                }
            )
    );
}

async function sendTicketPanel(channel) {
    const container = new ContainerBuilder()
        .setAccentColor(0x49B9F5);

    addBanner(container, CONFIG.banner);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${EMOJIS.assistance} Assistance\n` +
            "Get help from the Los Angeles Roleplay team. " +
            "Choose the category that best matches your request."
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
            `${EMOJIS.information} Submit one ticket per issue. ` +
            "Provide accurate information so our team can assist you."
        )
    );

    addBanner(container, CONFIG.footerBanner);

    container.addActionRowComponents(ticketMenu());

    return channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ======================================================
// CREATE TICKET
// ======================================================

async function createTicket(interaction, category) {
    await interaction.deferReply({ ephemeral: true });

    const categorySettings = {
        general: {
            name: "general",
            label: "General Support",
            parent: CONFIG.ticketGeneral,
        },
        high: {
            name: "high",
            label: "High Rank Support",
            parent: CONFIG.ticketHighRank,
        },
        senior: {
            name: "senior",
            label: "Senior High Rank Support",
            parent: CONFIG.ticketSenior,
        },
    };

    const selected = categorySettings[category];

    if (!selected) {
        return interaction.editReply("Invalid ticket category.");
    }

    if (!selected.parent) {
        return interaction.editReply(
            `The category for ${selected.label} has not been configured.`
        );
    }

    const existing = Object.entries(data.tickets).find(
        ([channelId, ticket]) =>
            ticket.userId === interaction.user.id &&
            ticket.open === true
    );

    if (existing) {
        const existingChannel = await interaction.guild.channels
            .fetch(existing[0])
            .catch(() => null);

        if (existingChannel) {
            return interaction.editReply(
                `You already have an open ticket: ${existingChannel}`
            );
        }

        delete data.tickets[existing[0]];
        saveData();
    }

    const parent = await interaction.guild.channels
        .fetch(selected.parent)
        .catch(() => null);

    if (!parent || parent.type !== ChannelType.GuildCategory) {
        return interaction.editReply(
            `The configured ${selected.label} category is not a valid Discord category.`
        );
    }

    const permissionOverwrites = [
        {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            id: interaction.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
        {
            id: client.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
            ],
        },
    ];

    if (CONFIG.ticketStaff) {
        permissionOverwrites.push({
            id: CONFIG.ticketStaff,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
            ],
        });
    }

    let ticketChannel;

    try {
        ticketChannel = await interaction.guild.channels.create({
            name: `${selected.name}-${interaction.user.username}`
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "")
                .slice(0, 90),
            type: ChannelType.GuildText,
            parent: parent.id,
            topic: `Support ticket for ${interaction.user.tag} (${interaction.user.id})`,
            permissionOverwrites,
            reason: `Support ticket opened by ${interaction.user.tag}`,
        });
    } catch (error) {
        console.error("Ticket creation failed:", error);

        return interaction.editReply(
            "I couldn't create your ticket. Check that I have Manage Channels permission and access to the selected category."
        );
    }

    data.tickets[ticketChannel.id] = {
        userId: interaction.user.id,
        category,
        categoryName: selected.label,
        claimedBy: null,
        open: true,
        createdAt: new Date().toISOString(),
    };

    saveData();

    const ticketButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_claim")
            .setLabel("Claim Ticket")
            .setEmoji("🙋")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Close Ticket")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger)
    );

    await sendV2(
        ticketChannel,
        [
            `# ${EMOJIS.assistance} ${selected.label}`,
            `Welcome ${interaction.user}!`,
            "Please describe your issue below. A member of our team will assist you as soon as possible.",
            "",
            `**Opened by:** ${interaction.user}`,
            `**Category:** ${selected.label}`,
            `**Created:** ${timestamp()}`,
        ],
        [ticketButtons]
    );

    await logTo(CONFIG.ticketLog, [
        "# Ticket Opened",
        `**Channel:** ${ticketChannel}`,
        `**Owner:** ${interaction.user}`,
        `**Category:** ${selected.label}`,
        `**Date:** ${timestamp()}`,
    ]);

    return interaction.editReply(
        `Your ticket has been created: ${ticketChannel}`
    );
}

// ======================================================
// SESSION PANEL
// ======================================================

async function sessionPanel(channel) {
    let server = null;

    if (erlcClient) {
        try {
            server = await erlcClient.server.get({
                include: ["players", "staff", "queue"],
            });
        } catch (error) {
            console.error("Session panel ER:LC error:", error.message);
        }
    }

    const active = Boolean(data.session?.active);
    const players = server?.CurrentPlayers ?? 0;
    const maxPlayers = server?.MaxPlayers ?? 0;
    const queue = getArrayCount(server, "Queue", "queue");
    const staff = getArrayCount(server, "Staff", "staff");

    const container = new ContainerBuilder()
        .setAccentColor(0x49B9F5);

    addBanner(
        container,
        CONFIG.sessionBanner || CONFIG.banner
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🗄️ Los Angeles Sessions\n` +
            "Join our community for organized, staff-led roleplay. " +
            "Review the server regulations and follow staff instructions.\n\n" +
            `**Server:** ${CONFIG.erlcServerName}\n` +
            `**Code:** ${CONFIG.erlcServerCode}\n` +
            `**Owner:** ${CONFIG.serverOwner}\n\n` +
            (
                active
                    ? "🟢 **A session is currently running.**"
                    : "❌ **No session is currently running.**"
            )
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            "**Players**\n" +
            "Players currently in-game\n\n" +
            "**Queue**\n" +
            "Players waiting to join\n\n" +
            "**Staff**\n" +
            "Staff currently moderating in-game"
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

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `Last updated ${timestamp()}`
        )
    );

    addBanner(container, CONFIG.footerBanner);

    return channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ======================================================
// SESSION ACTIONS
// ======================================================

async function startSession(channel, startedBy) {
    data.session = {
        active: true,
        updatedAt: new Date().toISOString(),
        startedBy: startedBy.id,
        votes: [],
    };

    saveData();

    const target =
        await getTextChannel(CONFIG.sessionAnnouncement) || channel;

    await sendV2(target, [
        `# 🟢 ${CONFIG.serverName} | SESSION STARTED`,
        "The server session is now starting!",
        "",
        `**Started by:** ${startedBy}`,
        `**Time:** ${timestamp()}`,
        "",
        "Join the server and follow staff instructions.",
    ]);

    const subscribers = [...new Set(data.sessionNotifications || [])];

    if (subscribers.length) {
        await target.send({
            content:
                "🔔 **Session notification!** " +
                subscribers.map(id => `<@${id}>`).join(" "),
            allowedMentions: {
                users: subscribers,
            },
        });
    }
}

async function shutdownSession(channel, shutdownBy) {
    data.session = {
        active: false,
        updatedAt: new Date().toISOString(),
        shutdownBy: shutdownBy.id,
        votes: [],
    };

    saveData();

    const target =
        await getTextChannel(CONFIG.sessionAnnouncement) || channel;

    await sendV2(target, [
        `# 🔴 ${CONFIG.serverName} | SESSION SHUTDOWN`,
        "The server session has been shut down.",
        "",
        `**Shut down by:** ${shutdownBy}`,
        `**Time:** ${timestamp()}`,
        `-# ${CONFIG.footer}`,
    ]);
}

async function startVote(channel) {
    data.session = data.session || {
        active: false,
        updatedAt: new Date().toISOString(),
        votes: [],
    };

    data.session.votes = [];
    data.session.voteMessageId = null;
    saveData();

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

    const message = await sendV2(
        channel,
        [
            `# ${CONFIG.serverName} | Session Vote`,
            "Should a server session begin?",
            "",
            "**Yes:** 0",
            "**No:** 0",
            "",
            "Cast your vote below. You can only vote once.",
        ],
        [buttons]
    );

    data.session.voteMessageId = message.id;
    data.session.voteChannelId = channel.id;
    saveData();
}

async function updateVoteMessage() {
    if (!data.session?.voteMessageId || !data.session?.voteChannelId) {
        return;
    }

    const channel = await getTextChannel(data.session.voteChannelId);
    if (!channel) return;

    const message = await channel.messages
        .fetch(data.session.voteMessageId)
        .catch(() => null);

    if (!message) return;

    const votes = data.session.votes || [];
    const yes = votes.filter(vote => vote.vote === "yes").length;
    const no = votes.filter(vote => vote.vote === "no").length;

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

    await message.edit({
        components: [
            v2Container(
                [
                    `# ${CONFIG.serverName} | Session Vote`,
                    "Should a server session begin?",
                    "",
                    `**Yes:** ${yes}`,
                    `**No:** ${no}`,
                    "",
                    "Cast your vote below. You can only vote once.",
                ],
                [buttons]
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ======================================================
// PROMOTIONS
// ======================================================

async function announcePromotion(interaction) {
    const member = interaction.options.getUser("member");
    const rank = interaction.options.getString("rank");
    const reason = interaction.options.getString("reason");

    const channel = await getTextChannel(CONFIG.promotionChannel);

    if (!channel) {
        return interaction.reply({
            content: "Promotion channel is not configured correctly.",
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

    return interaction.reply({
        content: "Promotion announcement sent.",
        ephemeral: true,
    });
}

// ======================================================
// INFRACTIONS
// ======================================================

async function announceInfraction(interaction) {
    const member = interaction.options.getUser("member");
    const type = interaction.options.getString("type");
    const reason = interaction.options.getString("reason");

    const channel = await getTextChannel(CONFIG.infractionChannel);

    if (!channel) {
        return interaction.reply({
            content: "Infraction channel is not configured correctly.",
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

    return interaction.reply({
        content: "Infraction announcement sent.",
        ephemeral: true,
    });
}

// ======================================================
// MODERATION LOGGING
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

// ======================================================
// MODERATION COMMAND HANDLER
// ======================================================

async function handleModeration(interaction, command) {
    if (!staffCheck(interaction, CONFIG.moderatorRole)) {
        return interaction.reply({
            content: "You do not have permission to use this command.",
            ephemeral: true,
        });
    }

    const reason =
        interaction.options.getString("reason") || "No reason provided";

    try {
        if (command === "ban") {
            const user = interaction.options.getUser("member");

            await interaction.guild.members.ban(user.id, {
                reason,
            });

            await moderationLog(
                "Ban",
                user.tag,
                reason,
                interaction.user
            );
        }

        if (command === "unban") {
            const userId = interaction.options.getString("userid");

            await interaction.guild.members.unban(userId, reason);

            await moderationLog(
                "Unban",
                userId,
                reason,
                interaction.user
            );
        }

        if (command === "kick") {
            const member = await interaction.guild.members
                .fetch(interaction.options.getUser("member").id)
                .catch(() => null);

            if (!member) {
                return interaction.reply({
                    content: "That member is not in this server.",
                    ephemeral: true,
                });
            }

            if (!member.kickable) {
                return interaction.reply({
                    content:
                        "I cannot kick that member. Check my role position and permissions.",
                    ephemeral: true,
                });
            }

            await member.kick(reason);

            await moderationLog(
                "Kick",
                member.user.tag,
                reason,
                interaction.user
            );
        }

        if (command === "mute") {
            const member = await interaction.guild.members
                .fetch(interaction.options.getUser("member").id)
                .catch(() => null);

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
            const member = await interaction.guild.members
                .fetch(interaction.options.getUser("member").id)
                .catch(() => null);

            if (!member || !member.moderatable) {
                return interaction.reply({
                    content: "I cannot remove that member's timeout.",
                    ephemeral: true,
                });
            }

            await member.timeout(null, "Timeout removed");

            await moderationLog(
                "Timeout removed",
                member.user.tag,
                "Timeout removed",
                interaction.user
            );
        }

        if (command === "purge") {
            const amount = interaction.options.getInteger("amount");

            const deleted = await interaction.channel.bulkDelete(
                amount,
                true
            );

            return interaction.reply({
                content: `Deleted ${deleted.size} messages.`,
                ephemeral: true,
            });
        }

        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({
                content: `${command} completed successfully.`,
                ephemeral: true,
            });
        }
    } catch (error) {
        console.error(`Moderation error (${command}):`, error);

        const message = `The command failed: ${error.message}`;

        if (interaction.replied || interaction.deferred) {
            return interaction.editReply({ content: message }).catch(() => {});
        }

        return interaction.reply({
            content: message,
            ephemeral: true,
        }).catch(() => {});
    }
}

// ======================================================
// READY EVENT
// ======================================================

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    try {
        await registerCommands();
    } catch (error) {
        console.error("Slash command registration failed:", error);
    }

    await initializeERLC();

    if (erlcClient && CONFIG.erlcStatusChannel) {
        await updateERLCStatus();

        setInterval(() => {
            updateERLCStatus().catch(console.error);
        }, CONFIG.erlcRefresh * 1000);
    }

    console.log("Los Angeles Roleplay Bot is ready.");
});

// ======================================================
// PREFIX COMMANDS
// ONLY !say AND 1!sndticketpanel
// ======================================================

client.on("messageCreate", async message => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.trim();

    if (content === CONFIG.secretTicketCommand) {
        if (!isStaff(message.member)) {
            return message.reply("You do not have permission.");
        }

        const channel =
            await getTextChannel(CONFIG.ticketPanelChannel) ||
            message.channel;

        try {
            await sendTicketPanel(channel);
            return message.reply("Ticket panel sent.");
        } catch (error) {
            console.error("Ticket panel error:", error);
            return message.reply(
                "Could not send the ticket panel. Check my channel permissions."
            );
        }
    }

    const sayCommand = `${CONFIG.prefix}say`;

    if (
        content === sayCommand ||
        content.startsWith(`${sayCommand} `)
    ) {
        if (!isStaff(message.member)) {
            return message.reply("You do not have permission.");
        }

        const text = content.slice(sayCommand.length).trim();

        if (!text) {
            return message.reply(`Usage: ${sayCommand} <message>`);
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
        // ----------------------------------------------
        // TICKET SELECT MENU
        // ----------------------------------------------

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "ticket_create") {
                return createTicket(
                    interaction,
                    interaction.values[0]
                );
            }
        }

        // ----------------------------------------------
        // BUTTONS
        // ----------------------------------------------

        if (interaction.isButton()) {
            const id = interaction.customId;

            // Ticket claim
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
                        content:
                            `This ticket has already been claimed by <@${ticket.claimedBy}>.`,
                        ephemeral: true,
                    });
                }

                ticket.claimedBy = interaction.user.id;
                saveData();

                await logTo(CONFIG.ticketLog, [
                    "# Ticket Claimed",
                    `**Channel:** ${interaction.channel}`,
                    `**Claimed By:** ${interaction.user}`,
                    `**Date:** ${timestamp()}`,
                ]);

                return replyV2(interaction, [
                    "## Ticket claimed",
                    `This ticket has been claimed by ${interaction.user}.`,
                ]);
            }

            // Ticket close
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
                        content:
                            "Only the ticket owner or staff can close this ticket.",
                        ephemeral: true,
                    });
                }

                ticket.open = false;
                ticket.closedBy = interaction.user.id;
                ticket.closedAt = new Date().toISOString();
                saveData();

                await logTo(CONFIG.ticketLog, [
                    "# Ticket Closed",
                    `**Channel:** ${interaction.channel}`,
                    `**Owner:** <@${ticket.userId}>`,
                    `**Closed By:** ${interaction.user}`,
                    `**Date:** ${timestamp()}`,
                ]);

                await interaction.reply({
                    content:
                        "Ticket closed. This channel will be deleted in 5 seconds.",
                    ephemeral: true,
                });

                setTimeout(() => {
                    interaction.channel.delete("Ticket closed").catch(() => {});
                }, 5000);

                return;
            }

            // Session notification toggle
            if (id === "session_notify") {
                data.sessionNotifications ||= [];

                const index = data.sessionNotifications.indexOf(
                    interaction.user.id
                );

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
                    content:
                        "🔔 You will be notified when a new session starts!",
                    ephemeral: true,
                });
            }

            // Start session button
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

                return startSession(
                    interaction.channel,
                    interaction.user
                );
            }

            // Yes/no vote buttons
            if (id === "vote_yes" || id === "vote_no") {
                if (!data.session) {
                    data.session = {
                        active: false,
                        updatedAt: new Date().toISOString(),
                        votes: [],
                    };
                }

                data.session.votes ||= [];

                if (
                    data.session.votes.some(
                        vote => vote.userId === interaction.user.id
                    )
                ) {
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

                await interaction.reply({
                    content: "Your vote has been recorded.",
                    ephemeral: true,
                });

                await updateVoteMessage();
                return;
            }
        }

        // ----------------------------------------------
        // SLASH COMMANDS
        // ----------------------------------------------

        if (!interaction.isChatInputCommand()) return;

        const command = interaction.commandName;

        if (command === "ticketpanel") {
            if (!isStaff(interaction.member)) {
                return interaction.reply({
                    content: "You do not have permission.",
                    ephemeral: true,
                });
            }

            const channel =
                await getTextChannel(CONFIG.ticketPanelChannel) ||
                interaction.channel;

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

            const channel =
                await getTextChannel(CONFIG.sessionChannel) ||
                interaction.channel;

            await sessionPanel(channel);

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

            return startSession(
                interaction.channel,
                interaction.user
            );
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

            return shutdownSession(
                interaction.channel,
                interaction.user
            );
        }

        if (command === "sessionvote") {
            if (!staffCheck(interaction, CONFIG.sessionStaff)) {
                return interaction.reply({
                    content: "You do not have permission.",
                    ephemeral: true,
                });
            }

            await interaction.reply({
                content: "Session vote started.",
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
                        `Players: **${server.CurrentPlayers ?? 0}/${server.MaxPlayers ?? 0}**\n` +
                        `Queue: **${getArrayCount(server, "Queue", "queue")}**\n` +
                        `Staff: **${getArrayCount(server, "Staff", "staff")}**`,
                });
            } catch (error) {
                return interaction.editReply({
                    content:
                        `Could not retrieve ER:LC status: ${error.message}`,
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

        if (
            [
                "ban",
                "unban",
                "kick",
                "mute",
                "unmute",
                "purge",
            ].includes(command)
        ) {
            return handleModeration(interaction, command);
        }
    } catch (error) {
        console.error("Interaction error:", error);

        if (
            interaction.isRepliable() &&
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction.reply({
                content:
                    "Something went wrong while processing that action. Check the bot logs.",
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
