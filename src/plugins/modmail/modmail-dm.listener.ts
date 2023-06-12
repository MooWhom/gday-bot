import { Message, ChannelType } from 'discord.js'
import { ThreadManager } from './ModmailThread.model';
import { useEvent } from '../../hooks/useEvent';
import { useClient } from '../../hooks/useClient';

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