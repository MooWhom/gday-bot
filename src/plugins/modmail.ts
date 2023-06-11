import {Message, ChannelType, User, EmbedBuilder, ColorResolvable, TextChannel} from 'discord.js'
import {useClient, useEvent} from "../hooks";
import { IModmailThread, ModmailThread } from '../database/ModmailThread';
import { MAIN_GUILD_ID, MODMAIL_CONFIG, STAFF_GUILD_ID } from '../globals';
import { IModmailMessage } from '../database/ModmailMessage';

// Handles new DMs from a user to the bot.
useEvent("messageCreate", (async (message: Message) => {
    if (message.channel.type !== ChannelType.DM) {
        return;
    }

    const {client} = useClient();
    // Ignore messages from the bot itself (ie, modmail replies.)
    if (message.author.id === client.user!.id) return;

    const thread = await ThreadManager.getOrCreateThread(message.author);
    thread.addUserMessageToThread(message, message.author)
}));

// An interface in substitute of a Message object, since mods interact with the bot via
// a `ChatInputCommandInteraction`, which we should avoid passing to the ThreadManager.
export interface IModmailReply {
    messageId: string;
    createdAt: Date;
    author: User;
    content: string;
}

// ThreadManager handles operations on the underlying ModmailThread and ModmaiLMessage models.
// Clients should create and interact with threads solely through ThreadManager.
// Avoid initalising a ThreadManager with the default constructor; instead, call `getOrCreateThread()`.
export class ThreadManager {
    threadId: string;

    private static systemColor: ColorResolvable = "Fuchsia";
    private static userColor: ColorResolvable = "Green";
    private static modColor: ColorResolvable = "Blue";

    constructor(threadId: string) {
        this.threadId = threadId;
    }

    // Returns a new ThreadManager. If an open thread does not exist, creates a new thread.
    public static async getOrCreateThread (author: User): Promise<ThreadManager> {
        let thread = await ModmailThread.findOne({"authorDiscordId": author.id, "isActive": true});
        let isNewThread = false;

        if (!thread) {
            thread = await ThreadManager.createThread(author);
            isNewThread = true;
        }

        const threadManager = new ThreadManager(thread._id);
        
        if (isNewThread) await threadManager.sendInitialThreadMessages();
        return threadManager;
    }

    // Returns a ThreadManager for a thread associated with a thread channel in the staff server.
    // If a thread is not associated with the channel, returns null.
    public static async getThreadAssociatedWithThreadChannel (channel: TextChannel): Promise<ThreadManager | null> {
        let thread = await ModmailThread.findOne({"channelDiscordId": channel.id, isActive: true});

        if (!thread) return null;

        return new ThreadManager(thread._id);
    }

    // Adds a mod reply to the thread and sends appropriate messages to the correct channels.
    public async addModMessageToThread (reply: IModmailReply) {
        const newModmailMessage: IModmailMessage = {
            _id: "", // This will be auto-generated in the pre-save hook
            discordMessageId: reply.messageId,
            authorId: reply.author.id,
            isMod: true, // 
            datetime: reply.createdAt.toUTCString(),
            content: reply.content
        }

        await this.saveMessageToThread(newModmailMessage, reply.author);
    }

    // Adds a Discord Message to the thread and sends appropriate messages to the correct channels.
    public async addUserMessageToThread (message: Message, author: User) {
        let content = message.cleanContent;
        if (!content.trim()) {
            content = "<Empty Message>"
        }

        const newModmailMessage: IModmailMessage = {
            _id: "", // This will be auto-generated in the pre-save hook
            discordMessageId: message.id,
            authorId: author.id,
            isMod: false, // User messages will always not be from a mod.
            datetime: message.createdAt.toUTCString(),
            content: content
        }

        await this.saveMessageToThread(newModmailMessage, author);
    }

    // Closes thread channel.
    public async closeThreadChannel () {
        const thread = await this.getThreadFromDb();
        if (!thread.isActive) throw new Error("Thread is already closed");

        await thread.updateOne({
            "isActive": false
        })

        const {client} = useClient();
        const staffServer = client.guilds.cache.get(STAFF_GUILD_ID);
        if (!staffServer) {
            throw new Error("Could not find staff server.");
        }

        let threadChannel = await staffServer.channels.fetch(thread.channelDiscordId);
        // This shouldn't ever happen since close needs to be executed from a valid thread channel.
        if (!threadChannel) throw new Error("Thread channel cannot be found.")

        await threadChannel.delete();

        let closedEmbed = new EmbedBuilder()
            .setTitle("Thread closed")
            .setDescription("Thanks for contacting the r/Apple mod team. This thread has been closed. If you still required assistance, messaging this bot will open a new thread with the mod team.")
            .setColor(ThreadManager.systemColor);

        this.sendMessageToUser(closedEmbed)
    }

    private static async createThread (author: User) {
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
        
        const thread = await ModmailThread.create({
            ...{
                authorDiscordId: author.id,
                channelDiscordId: channel.id
            }
        });

        return thread;
    }

    // Sends an initial embed to the user explaining the thread has been created, and an embed in the staff server with user details.
    // In an ideal world, this would be private/protected, but then we couldn't call this from our static creation methods.
    public async sendInitialThreadMessages () {
        // Embed sent to user.
        let userEmbed = new EmbedBuilder()
            .setTitle("New thread opened")
            .setDescription("Thanks for contacting the r/Apple mod team. You've created a new thread. Please be patient while the team gets back to you. Every message you send in this DM will be forwarded to the mod team. You will recieve replies here.")
            .setColor(ThreadManager.systemColor);

        await this.sendMessageToUser(userEmbed);

        const authorUser = await this.getModmailAuthorUser();
        const authorMember = await this.getModmailAuthorMember();
        const previousThreadCount = await this.getUserPreviousThreadCount();

        // Embed sent to the thread channel.
        let modEmbed = new EmbedBuilder()
            .setTitle("Thread Info")
            .setDescription(`
                **User**: ${authorUser.username}
                **Account Created** <t:${toUnixEpochTimestamp(authorUser.createdAt)}>
                **Joined Main Guild** <t:${toUnixEpochTimestamp(authorMember.joinedAt)}>

                **Number of previous threads**: ${previousThreadCount}
            `)
            .setColor(ThreadManager.systemColor);
        
        await this.sendMessageToThread(modEmbed);
    }

    // Adds a new message to the thread DB and sends to the appropriate channels.
    private async saveMessageToThread (message: IModmailMessage, author: User) {
        const thread = await this.getThreadFromDb();
        if (!thread.isActive) throw new Error (`Modmail ${thread._id} is not active.`)

        await thread.addMessage(message);

        const embed = new EmbedBuilder()
            .setAuthor({"name": author.username, "iconURL": author.displayAvatarURL({extension: "png", size: 1024})})
            .setDescription(message.content)
            .setColor(message.isMod ? ThreadManager.modColor : ThreadManager.userColor);

        // We always send messages to the modmail thread.
        await this.sendMessageToThread(embed);
        // Messages from a user should not be sent back to them, as this will duplicate in the DM thread.
        if (message.isMod) await this.sendMessageToUser(embed);
    }

    // Sends an embed to the thread channel in the staff server.
    private async sendMessageToThread (embed: EmbedBuilder) {
        const threadChannel = await this.getThreadChannel();
        await threadChannel.send({embeds: [embed]})
    }

    // Sends an embed to the user DM channel.
    private async sendMessageToUser (embed: EmbedBuilder) {
        const user = await this.getModmailAuthorUser();
        await user.send({embeds: [embed]});
    }

    // Returns total number of threads the author has previously created. 
    private async getUserPreviousThreadCount () {
        const thread = await this.getThreadFromDb();
        return await ModmailThread.count({authorDiscordId: thread.authorDiscordId, isActive: false});
    }

    private async getThreadChannel () {
        const thread = await this.getThreadFromDb();
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

        return threadChannel;
    }

    private async getModmailAuthorMember () {
        const thread = await this.getThreadFromDb();
        const {client} = useClient();

        const mainServer = client.guilds.cache.get(MAIN_GUILD_ID);
        if (!mainServer) throw new Error("Could not find main server.");

        const guildMember = await mainServer.members.fetch(thread.authorDiscordId);
        if (!guildMember) throw new Error("Could not find guild member.");

        return guildMember;
    }

    private async getModmailAuthorUser () {
        const thread = await this.getThreadFromDb();        
        const {client} = useClient();

        let user = client.users.cache.get(thread.authorDiscordId);
        if (!user) throw new Error("Modmail recipient could not be found");

        return user;
    }

    private async getThreadFromDb () {
        const thread = await ModmailThread.findOne({
            "_id": this.threadId
        })

        if (!thread) throw Error("Thread could not be found.");
        return thread;
    }
}

// Converts a Date to a Unix timestamp for <t:...> formatted timestamps.
const toUnixEpochTimestamp = (date: Date | null) => {
    // Handling date as potentially null isn't best practise but it avoids 
    // further complicating code for embeds which is already messy.
    if (!date) return 0;
    return Math.floor(date.getTime() / 1000)
}