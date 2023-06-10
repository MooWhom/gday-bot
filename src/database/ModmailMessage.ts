import { model, Schema } from "mongoose";
import cryptoRandomString from "crypto-random-string";

export interface IModmailMessage {
    _id: string;
    discordMessageId: Number; 
    authorId: Number;
    isMod: boolean;
    datetime: string;
    content: string;
    threadId: string;
}

const modmailMessageSchema = new Schema<IModmailMessage>({
    _id: String,
    discordMessageId: { type: Number, required: true },
    authorId: { type: Number, required: true },
    isMod: { type: Boolean, required: true },
    datetime: {
        type: String,
        default: function() {
            return new Date().toISOString();
        },
    },
    content: { type: String, required: true }
})

modmailMessageSchema.pre("save", async function () {
    if (!this.isNew) return;

    let id;
    do {
        id = cryptoRandomString({length: 10, type: "distinguishable"});
    } while (await modMailMessage.findById(id));
    this._id = id;
})

export const modMailMessage = model<IModmailMessage>("ModmailMessage", modmailMessageSchema);