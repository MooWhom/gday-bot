import {SlashCommandBuilder, SlashCommandScope} from "../../builders/SlashCommandBuilder";
import {ChatInputCommandInteraction, codeBlock, PermissionFlagsBits} from "discord.js";
import {useChatCommand} from "../../hooks/useChatCommand";
import {bingoItems} from "./bingoItems";
import {BingoCheck} from "./BingoCheck.model";
import {Bingo} from "./Bingo.model";
import {useClient} from "../../hooks";

const options = Array.from(bingoItems.keys()).map((key) => ({
    name: key,
    value: key
}));

const builder = new SlashCommandBuilder()
    .setName("bingocheck")
    .setDescription("Checks/unchecks a bingo item")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
        option.setName("bingo_id")
            .setDescription("Bingo item ID")
            .setRequired(true)
            .setChoices(...options))
    .setScope(SlashCommandScope.MAIN_GUILD);



useChatCommand(builder as SlashCommandBuilder, async (interaction: ChatInputCommandInteraction) => {
    const id = interaction.options.getString("bingo_id", true);
    const check = await BingoCheck.findOne() ?? await BingoCheck.create({});
    let current = check.bingoEntries.get(id) ?? false;
    check.bingoEntries.set(id, !current);
    await check.save();
    return `Successfully ${current ? "un" : ""}checked \`${id}\``
    /*const bingos = await Bingo.find();
    const check = await BingoCheck.findOne() ?? await BingoCheck.create({});
    const filteredBingos = bingos.filter((bingo) => {
        const {board} = bingo;
        //board is a 2D array of columns
        const topLeftDiag = [];
        const topRightDiag = [];
        for (let n = 0; n < 5; n++) {
            //Check the nth column
            if (board[n].every(card => check.bingoEntries.get(card))) return true;
            //Check the nth row (access n from each column)
            const nthRow = [];
            for (const col of board) {
                nthRow.push(col[n])
            }
            if (nthRow.every(card => check.bingoEntries.get(card))) return true;

            //Add to diagonals (top left = board[0][0], board[1][1], ...) (top right = board[5][0], board[4][1], ...)
            topLeftDiag.push(board[n][n])
            topRightDiag.push(board[4 - n][n])
        }

        //Check diagonals
        if (topLeftDiag.every(card => check.bingoEntries.get(card))) return true;
        if (topRightDiag.every(card => check.bingoEntries.get(card))) return true;
    })
    const rApple = await useClient().client.guilds.fetch("332309672486895637");
    for (const bingo of filteredBingos) {
        const member = await rApple.members.fetch(bingo.user);
        await member.roles.add("1115364645696454726")
    }
    return `Added role for ${filteredBingos.length} entries`*/
});
