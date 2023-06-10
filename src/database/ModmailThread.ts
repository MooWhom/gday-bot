import { model, Schema } from "mongoose";
import cryptoRandomString from "crypto-random-string";
import { IModmailMessage, modMailMessage } from "./ModmailMessage";

export interface IModmailThread {
    _id: string;
    authorDiscordId: number; 
    channelDiscordId: number;
    isActive: boolean;  // Set to true if the thread is not closed.
    messages: IModmailMessage[];
    addMessage: (msg: IModmailMessage) => Promise<void>;
}

const modmailThreadSchema = new Schema<IModmailThread>({
    _id: String,
    authorDiscordId: { type: Number, required: true },
    channelDiscordId: { type: Number, required: true },
    isActive: { type: Boolean, required: true, default: true },
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message', default: [] }],
});

modmailThreadSchema.pre("save", async function () {
    if (!this.isNew) return;
    let id;
    do {
        id = cryptoRandomString({length: 10, type: "distinguishable"});
    } while (await ModmailThread.findById(id));
    this._id = id;
});

modmailThreadSchema.methods.addMessage = async function(msg: IModmailMessage) {
    const message = new modMailMessage(msg);
    await message.save();
    this.messages.push(message);
    await this.save();
}

export const ModmailThread = model<IModmailThread>("ModmailThread", modmailThreadSchema);
