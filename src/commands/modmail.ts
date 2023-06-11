import {useChatCommand} from "../hooks/useChatCommand";
import {SlashCommandBuilder, SlashCommandScope,} from "../builders/SlashCommandBuilder";
import {
    ChannelType,
    ChatInputCommandInteraction,
} from "discord.js";
import { IModmailReply, ThreadManager } from "../plugins/modmail"

const replyBuilder = new SlashCommandBuilder()
    .setName("reply")
    .setDescription("Reply to a user in a modmail thread.")
    .addStringOption(option =>
        option.setName("reply")
            .setDescription("The content of the reply.")
            .setRequired(true))
    .setScope(SlashCommandScope.STAFF_SERVER)
    .setEphemeral(true);

useChatCommand(replyBuilder, async (interaction: ChatInputCommandInteraction) => {
    let threadChannel = interaction.channel;
    if (!threadChannel || threadChannel.type !== ChannelType.GuildText) return null;
    
    const thread = await ThreadManager.getThreadAssociatedWithThreadChannel(threadChannel);

    if (!thread) {
        return "Sorry mate, this doesn't seem to be a thread channel."
    }

    const modmailReply: IModmailReply = {
        messageId: interaction.id,
        createdAt: interaction.createdAt,
        author: interaction.user,
        content: interaction.options.getString("reply", true)

    }

    await thread.addModMessageToThread(modmailReply);

    return 'Successfully sent your reply.';
});


const closeBuilder = new SlashCommandBuilder()
    .setName("close")
    .setDescription("Closes a modmail thread when run in a thread channel.")
    .setScope(SlashCommandScope.STAFF_SERVER);

useChatCommand(closeBuilder, async (interaction: ChatInputCommandInteraction) => {
    let threadChannel = interaction.channel;
    if (!threadChannel || threadChannel.type !== ChannelType.GuildText) return null;
    
    const thread = await ThreadManager.getThreadAssociatedWithThreadChannel(threadChannel);

    if (!thread) {
        return "Sorry mate, this doesn't seem to be a thread channel."
    }

    await thread.closeThread();
    return null;
});
