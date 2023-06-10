import {Message, ChannelType, User, EmbedBuilder} from 'discord.js'
import {useClient, useEvent} from "../hooks";
import { IModmailThread, ModmailThread } from '../database/ModmailThread';
import { MODMAIL_CONFIG, STAFF_GUILD_ID } from '../globals';
import { IModmailMessage } from '../database/ModmailMessage';

// Handles new DMs from a user to
useEvent("messageCreate", (async (message: Message) => {
    if (message.channel.type !== ChannelType.DM) {
        return;
    }

    let thread = await ModmailThread.findOne({"authorDiscordId": message.author.id, "isActive": true});
    if (!thread) {
        try {
            thread = await createNewThread(message.author)
        } catch (error) {
            console.log(error);
            return;
        }
    }

    const modmailMessage: IModmailMessage = {
        _id: "", // This will be auto-generated in the pre-save hook
        discordMessageId: message.id,
        authorId: message.author.id,
        isMod: false, // Message to the bot is guaranteed to be a user.
        datetime: message.createdAt.toUTCString(),
        content: `${message.cleanContent}`,
    }
    thread.addMessage(modmailMessage)

    postMessageToThread(thread, message);
}));

// Creates a Discord embed for a message thread.
const createMessageEmbedForThread = (
    message: Message
) => {
    return new EmbedBuilder()
        .setAuthor({"name": message.author.username, "iconURL": message.author.displayAvatarURL({extension: "png", size: 1024})})
        .setDescription(message.cleanContent)
        .setColor("Green")
        .setFooter({text: `<t:${message.createdAt.valueOf()}>`})
}

const postMessageToThread = async (
    thread: IModmailThread,
    message: Message
) => {
    const {client} = useClient();

    const staffServer = client.guilds.cache.get(STAFF_GUILD_ID);
    if (!staffServer) {
        throw new Error("Could not find staff server.");
    }

    let threadChannel = await staffServer.channels.fetch(thread.channelDiscordId);
    if (!threadChannel || threadChannel.type != ChannelType.GuildText) {
        // TODO: In this case, we should probably mark the thread as inactive in the DB
        // to avoid a Jakey where a thread is stuck in perpetuity. 
        throw new Error("Could not find associated thread.")
    }

    const replyEmbed = createMessageEmbedForThread(message);
    await threadChannel.send({embeds: [replyEmbed]});
};

const createNewThread = async (
    author: User,
) => {
    const {client} = useClient();

    const staffServer = client.guilds.cache.get(STAFF_GUILD_ID);
    if (!staffServer) {
        throw new Error("Could not find staff server.");
    }

    let channel = await staffServer.channels.create({
        // Usernames are now unique, so we are guaranteed only 1 channel per user.
        name: author.username,
        type: ChannelType.GuildText,
        parent: MODMAIL_CONFIG.category_id
    })
    if (!channel) {
        throw new Error("Error when creating channel.");
    }
    
    return ModmailThread.create({
        ...{
            authorDiscordId: author.id,
            channelDiscordId: channel.id
        }
    });

};
