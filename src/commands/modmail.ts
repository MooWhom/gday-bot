import {useChatCommand} from "../hooks/useChatCommand";
import {SlashCommandBuilder, SlashCommandScope,} from "../builders/SlashCommandBuilder";
import {
    ActionRowBuilder,
    ChatInputCommandInteraction,
    ModalActionRowComponentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";
import { ModmailThread } from "../database/ModmailThread";

const closeBuilder = new SlashCommandBuilder()
    .setName("close")
    .setDescription("Closes a modmail thread when run in a thread channel.")
    .setScope(SlashCommandScope.STAFF_SERVER);

useChatCommand(closeBuilder, async (interaction: ChatInputCommandInteraction) => {
    let threadChannel = interaction.channel;
    if (!threadChannel) return null;
    
    let thread = await ModmailThread.findOne({
        "channelDiscordId": threadChannel.id,
        "isActive": true
    });

    if (!thread) {
        return "Sorry mate, this doesn't seem to be a thread channel."
    }

    await thread.update({
        "isActive": false
    })

    await threadChannel.delete();

    return null;
});
