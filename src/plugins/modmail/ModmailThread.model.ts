import { model, Schema } from "mongoose";
import cryptoRandomString from "crypto-random-string";
import { IModmailMessage, modMailMessage } from "./ModmailMessage.model";

export interface IModmailThread {
    _id: string;
    authorDiscordId: string; 
    channelDiscordId: string;
    isActive: boolean;  // Set to true if the thread is not closed.
    messages: IModmailMessage[];
    addMessage: (msg: IModmailMessage) => Promise<void>;
}

const modmailThreadSchema = new Schema<IModmailThread>({
    _id: String,
    authorDiscordId: { type: String, required: true },
    channelDiscordId: { type: String, required: true },
    isActive: { type: Boolean, required: true, default: true },
    messages: [{ type: String, ref: 'Message', default: [] }],
});

modmailThreadSchema.pre("save", async function () {
    if (!this.isNew) return;
    let id;
    do {
        id = cryptoRandomString({length: 10, type: "distinguishable"});
    } while (await ModmailThread.findOne({"_id": id}));
    this._id = id;
});

modmailThreadSchema.methods.addMessage = async function(msg: IModmailMessage) {
    const message = new modMailMessage(msg);
    await message.save();
    console.log(`message._id type: ${typeof message._id}, value: ${message._id}`);
    this.messages.push(message._id);
    await this.save();
}

export const ModmailThread = model<IModmailThread>("ModmailThread", modmailThreadSchema);
