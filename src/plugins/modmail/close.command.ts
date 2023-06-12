import {useChatCommand} from "../../hooks/useChatCommand";
import {SlashCommandBuilder, SlashCommandScope,} from "../../builders/SlashCommandBuilder";
import {
    ChannelType,
    ChatInputCommandInteraction,
} from "discord.js";
import {ThreadManager} from "./ModmailThread.model"

const builder = new SlashCommandBuilder()
    .setName("close")
    .setDescription("Closes a modmail thread when run in a thread channel.")
    .setScope(SlashCommandScope.STAFF_SERVER);

useChatCommand(builder, async (interaction: ChatInputCommandInteraction) => {
    let threadChannel = interaction.channel;
    if (!threadChannel || threadChannel.type !== ChannelType.GuildText) return null;
    
    const thread = await ThreadManager.getThreadAssociatedWithThreadChannel(threadChannel);

    if (!thread) {
        return "Sorry mate, this doesn't seem to be a thread channel."
    }

    await thread.closeThread();
    return null;
});