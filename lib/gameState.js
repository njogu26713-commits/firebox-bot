/**
 * Firebox Bot Game State Manager
 * In-memory session store for active game sessions.
 * Each JID (chat) holds one active game at a time; sessions expire after 10 min.
 */

const sessions = new Map();
const TTL = 10 * 60 * 1000; // 10 minutes

// ─── Session CRUD ────────────────────────────────────────────────────────────
function setGame(jid, type, data) {
    sessions.set(jid, { type, data, startTime: Date.now() });
}

function getGame(jid) {
    const session = sessions.get(jid);
    if (!session) return null;
    if (Date.now() - session.startTime > TTL) {
        sessions.delete(jid);
        return null;
    }
    return session;
}

function clearGame(jid) {
    sessions.delete(jid);
}

// ─── Master Router ───────────────────────────────────────────────────────────
async function processGameInput({ sock, jid, sender, text, msg, session }) {
    const { type, data } = session;
    try {
        if (type === "trivia" || type === "quiz") return await handleTriviaInput({ sock, jid, sender, text, data });
        if (type === "math")      return await handleMathInput({ sock, jid, sender, text, data });
        if (type === "guess")     return await handleGuessInput({ sock, jid, sender, text, data });
        if (type === "riddle")    return await handleRiddleInput({ sock, jid, sender, text, data });
        if (type === "hangman")   return await handleHangmanInput({ sock, jid, sender, text, data });
        if (type === "tictactoe") return await handleTictactoeInput({ sock, jid, sender, text, data });
    } catch (err) {
        console.error(`[GameState] Error in ${type}:`, err.message);
    }
}

// ─── Trivia / Quiz ───────────────────────────────────────────────────────────
async function handleTriviaInput({ sock, jid, sender, text, data }) {
    const answer = text.trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(answer)) return;      // ignore non-answers

    const { correct, options } = data;
    const correctLetter = ["A", "B", "C", "D"][options.indexOf(correct)];
    clearGame(jid);

    if (answer === correctLetter) {
        await sock.sendMessage(jid, {
            text: `✅ *CORRECT!* Well done @${sender.split("@")[0]}!\n🎯 Answer: *${correctLetter}. ${correct}*\n\n_Keep playing with .trivia!_`,
            mentions: [sender]
        });
    } else {
        await sock.sendMessage(jid, {
            text: `❌ *WRONG!* Better luck next time, @${sender.split("@")[0]}.\n🎯 Correct answer: *${correctLetter}. ${correct}*\n\n_Try again with .trivia!_`,
            mentions: [sender]
        });
    }
}

// ─── Math ────────────────────────────────────────────────────────────────────
async function handleMathInput({ sock, jid, sender, text, data }) {
    const userAnswer = parseFloat(text.trim());
    if (isNaN(userAnswer)) return;

    const { answer, question } = data;
    clearGame(jid);

    if (Math.abs(userAnswer - answer) < 0.001) {
        await sock.sendMessage(jid, {
            text: `✅ *CORRECT!* @${sender.split("@")[0]} cracked it!\n🧮 *${question} = ${answer}*\n\n_Try another with .math!_`,
            mentions: [sender]
        });
    } else {
        await sock.sendMessage(jid, {
            text: `❌ *WRONG!* @${sender.split("@")[0]}, that's not right.\n🧮 *${question} = ${answer}*\n\n_Try again with .math!_`,
            mentions: [sender]
        });
    }
}

// ─── Number Guess ────────────────────────────────────────────────────────────
async function handleGuessInput({ sock, jid, sender, text, data }) {
    const guess = parseInt(text.trim());
    if (isNaN(guess)) return;

    const { target, attempts, max } = data;
    const newAttempts = attempts + 1;

    if (guess < 1 || guess > 100) {
        return await sock.sendMessage(jid, { text: "⚠️ Guess a number between *1 and 100*." });
    }

    if (guess === target) {
        clearGame(jid);
        return await sock.sendMessage(jid, {
            text: `🎉 *CORRECT!* @${sender.split("@")[0]} got it in *${newAttempts}* ${newAttempts === 1 ? "try" : "tries"}!\n🎯 The number was *${target}*\n\n_Play again with .guess!_`,
            mentions: [sender]
        });
    }

    if (newAttempts >= max) {
        clearGame(jid);
        return await sock.sendMessage(jid, {
            text: `💀 *GAME OVER!* @${sender.split("@")[0]} ran out of guesses.\n🎯 The number was *${target}*\n\n_Try again with .guess!_`,
            mentions: [sender]
        });
    }

    setGame(jid, "guess", { target, attempts: newAttempts, max });
    const hint = guess < target ? "📈 *Higher!*" : "📉 *Lower!*";
    await sock.sendMessage(jid, {
        text: `${hint} You guessed *${guess}*\n⚡ Attempt *${newAttempts}/${max}*  •  ${max - newAttempts} left`
    });
}

// ─── Riddle ──────────────────────────────────────────────────────────────────
async function handleRiddleInput({ sock, jid, sender, text, data }) {
    const input = text.trim().toLowerCase();
    const { answer, hint } = data;

    if (input === "hint") {
        return await sock.sendMessage(jid, {
            text: `💡 *Hint:* ${hint}\n\n_Keep guessing!_`
        });
    }

    if (input.includes(answer.toLowerCase()) || answer.toLowerCase().includes(input)) {
        clearGame(jid);
        return await sock.sendMessage(jid, {
            text: `✅ *CORRECT!* @${sender.split("@")[0]} solved the riddle!\n💡 *Answer:* ${answer}\n\n_Try another with .riddle!_`,
            mentions: [sender]
        });
    }

    await sock.sendMessage(jid, { text: `❌ *Wrong!* Keep trying!\n_Type \`hint\` for a clue._` });
}

// ─── Hangman ─────────────────────────────────────────────────────────────────
const GALLOWS = [
    " +---+\n |   |\n     |\n     |\n     |\n     |\n=====",
    " +---+\n |   |\n O   |\n     |\n     |\n     |\n=====",
    " +---+\n |   |\n O   |\n |   |\n     |\n     |\n=====",
    " +---+\n |   |\n O   |\n/|   |\n     |\n     |\n=====",
    " +---+\n |   |\n O   |\n/|\\  |\n     |\n     |\n=====",
    " +---+\n |   |\n O   |\n/|\\  |\n/    |\n     |\n=====",
    " +---+\n |   |\n O   |\n/|\\  |\n/ \\  |\n     |\n====="
];

function buildWordDisplay(word, guessed) {
    return word.split("").map(ch => (/[a-z]/i.test(ch) ? (guessed.includes(ch.toLowerCase()) ? ch.toUpperCase() : "＿") : ch)).join(" ");
}

async function handleHangmanInput({ sock, jid, sender, text, data }) {
    const input = text.trim().toLowerCase();
    if (!/^[a-z]$/.test(input)) return;

    const { word, guessed, wrong } = data;

    if (guessed.includes(input)) {
        return await sock.sendMessage(jid, { text: `⚠️ Already guessed *"${input.toUpperCase()}"*! Try another letter.` });
    }

    const newGuessed = [...guessed, input];
    const isCorrect = word.toLowerCase().includes(input);
    const newWrong = isCorrect ? wrong : [...wrong, input];
    const display = buildWordDisplay(word, newGuessed);
    const won = !display.includes("＿");
    const lost = newWrong.length >= 6;

    if (won) {
        clearGame(jid);
        return await sock.sendMessage(jid, {
            text: `\`\`\`${GALLOWS[newWrong.length]}\`\`\`\n\n🎉 *YOU WIN!* @${sender.split("@")[0]} guessed it!\n✅ The word was: *${word.toUpperCase()}*\n\n_Play again with .hangman!_`,
            mentions: [sender]
        });
    }

    if (lost) {
        clearGame(jid);
        return await sock.sendMessage(jid, {
            text: `\`\`\`${GALLOWS[6]}\`\`\`\n\n💀 *GAME OVER!*\nThe word was: *${word.toUpperCase()}*\n\n_Try again with .hangman!_`
        });
    }

    setGame(jid, "hangman", { word, guessed: newGuessed, wrong: newWrong });
    const wrongLetters = newWrong.map(l => l.toUpperCase()).join("  ") || "None";

    await sock.sendMessage(jid, {
        text:
            `\`\`\`${GALLOWS[newWrong.length]}\`\`\`\n\n` +
            `📝 *${display}*\n\n` +
            `❌ *Wrong:* ${wrongLetters}\n` +
            `❤️ *Lives:* ${"💚".repeat(6 - newWrong.length)}${"🖤".repeat(newWrong.length)}\n\n` +
            `_Type a letter to guess!_`
    });
}

// ─── Tic-Tac-Toe ─────────────────────────────────────────────────────────────
const CELL = (v) => v === 1 ? "❌" : v === 2 ? "⭕" : "⬜";

function renderBoard(board) {
    return [0, 3, 6].map(r => board.slice(r, r + 3).map(CELL).join("")).join("\n");
}

function checkWinner(b) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,x,c] of wins) if (b[a] && b[a] === b[x] && b[a] === b[c]) return b[a];
    return b.every(v => v) ? "draw" : null;
}

async function handleTictactoeInput({ sock, jid, sender, text, data }) {
    const cleaned = text.trim().replace(/^\.?move\s*/i, "");
    const pos = parseInt(cleaned);
    if (isNaN(pos) || pos < 1 || pos > 9) return;

    const { board, players, turn } = data;

    if (sender !== players[turn]) {
        return await sock.sendMessage(jid, {
            text: `⚠️ Not your turn! Waiting for @${players[turn].split("@")[0]} to move.`,
            mentions: [players[turn]]
        });
    }

    const idx = pos - 1;
    if (board[idx]) {
        return await sock.sendMessage(jid, { text: `⚠️ Cell *${pos}* is occupied! Pick another (1-9).` });
    }

    const newBoard = [...board];
    newBoard[idx] = turn === 0 ? 1 : 2;
    const winner = checkWinner(newBoard);

    if (winner === "draw") {
        clearGame(jid);
        return await sock.sendMessage(jid, {
            text: `${renderBoard(newBoard)}\n\n🤝 *IT'S A DRAW!* Great game!\n\n_Play again with .tictactoe @user!_`,
            mentions: players
        });
    }

    if (winner) {
        clearGame(jid);
        const winnerJid = winner === 1 ? players[0] : players[1];
        return await sock.sendMessage(jid, {
            text: `${renderBoard(newBoard)}\n\n🏆 *@${winnerJid.split("@")[0]} WINS!* 🎉\n\n_Play again with .tictactoe @user!_`,
            mentions: [winnerJid]
        });
    }

    const nextTurn = turn === 0 ? 1 : 0;
    setGame(jid, "tictactoe", { board: newBoard, players, turn: nextTurn });

    await sock.sendMessage(jid, {
        text:
            `${renderBoard(newBoard)}\n\n` +
            `${nextTurn === 0 ? "❌" : "⭕"} @${players[nextTurn].split("@")[0]}'s turn!\n` +
            `_Type 1-9 to place your piece_\n` +
            `1️⃣2️⃣3️⃣\n4️⃣5️⃣6️⃣\n7️⃣8️⃣9️⃣`,
        mentions: [players[nextTurn]]
    });
}

// ─── Auto-Sweeper to prevent memory leaks ──────────────────────────────────────
setInterval(() => {
    const now = Date.now();
    let evictedCount = 0;
    for (const [jid, session] of sessions.entries()) {
        if (now - session.startTime > TTL) {
            sessions.delete(jid);
            evictedCount++;
        }
    }
    if (evictedCount > 0) {
        console.log(`🎮 GameState: Swept ${evictedCount} stale game session(s) from memory.`);
    }
}, 5 * 60 * 1000); // Sweep every 5 minutes

module.exports = { setGame, getGame, clearGame, processGameInput };
