import { Message, ChannelType } from 'discord.js'
import { IModmailReply, MODMAIL_CONFIG, ThreadManager } from './ModmailThread.model';
import { useEvent } from '../../hooks/useEvent';
import { useClient } from '../../hooks/useClient';

// Listens for messages in thread channels to add to modnotes.
useEvent("messageCreate", (async (message: Message) => {
    // Back out if there's no chance of it being a modmail thread to avoid unncessary DB calls.
    if (message.channel.type !== ChannelType.GuildText) return;
    if (message.channel.parentId === MODMAIL_CONFIG.category_id) return;

    // Ignore bot messages.
    const { client } = useClient();
    if (message.author.id === client.user!.id) return;

    const thread = await ThreadManager.getThreadAssociatedWithThreadChannel(message.channel);
    if (!thread) return;

    const messageWrapper: IModmailReply = {
        messageId: message.id,
        createdAt: message.createdAt,
        author: message.author,
        content: message.content,
        isModnote: true // messages in the channel are guaranteed to be modnotes.
    }

    await thread.addModMessageToThread(messageWrapper);
}));