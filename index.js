const express = require("express");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

const token = "7802153967:AAEIb067DFs8u40H1HhIGTZswPRUnYadXq4";
const admin = "7801025601";
const DATABASE_URL = "https://polimage-56d11-default-rtdb.firebaseio.com"; 
const WEBHOOK_URL = "https://image-generator-bot-five.vercel.app/";

const bot = new TelegramBot(token, { webHook: { port: false } });
const app = express();
app.use(express.json());
bot.setWebHook(WEBHOOK_URL);

const broadcastSessions = {};

async function saveUserToFirebase(user) {
  const url = `${DATABASE_URL}/users/${user.id}.json`;
  const payload = {
    id: user.id,
    first_name: user.first_name || "",
    username: user.username || "",
    timestamp: Date.now()
  };
  await fetch(url, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });
}

async function getTotalUsers() {
  const url = `${DATABASE_URL}/users.json`;
  const res = await fetch(url);
  const data = await res.json();
  return data ? Object.keys(data).length : 0;
}

app.post("/", async (req, res) => {
  const update = req.body;
  bot.processUpdate(update);
  const msg = update.message;
  if (!msg) return res.end("OK");

  const chatId = msg.chat.id;
  const user = msg.from;

  if (msg.text === "/start") {
  const userUrl = `${DATABASE_URL}/users/${user.id}.json`;
  const response = await fetch(userUrl);
  const exists = await response.json();

  const text = `*👋 Welcome* [${user.first_name}](tg://user?id=${user.id})\n\n*🤗 Using Me You Can Create Image, So Share Me Your Thoughts*`;

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_to_message_id: msg.message_id
  });

  if (!exists) {
    await saveUserToFirebase(user);
    const totalUsers = await getTotalUsers();
    const newUserMsg =
      "➕ <b>New User Notification</b> ➕\n\n" +
      "👤<b>User:</b> <a href='tg://user?id=" +
      user.id +
      "'>" +
      user.first_name +
      "</a>\n\n" +
      "🆔<b>User ID:</b> <code>" +
      user.id +
      "</code>\n\n" +
      "🌝 <b>Total Users Count: " +
      totalUsers +
      "</b>";
    await bot.sendMessage(admin, newUserMsg, { parse_mode: "HTML" });
  }
}
   else if (msg.text === "/broadcast" && user.id.toString() === admin) {
    await bot.sendMessage(chatId, "<b>Enter Broadcast Message Here 👇</b>", {
      parse_mode: "HTML"
    });
    broadcastSessions[chatId] = true;
  } else if (broadcastSessions[chatId] && user.id.toString() === admin) {
    delete broadcastSessions[chatId];
    const usersUrl = `${DATABASE_URL}/users.json`;
    const resUsers = await fetch(usersUrl);
    const data = await resUsers.json();
    if (data) {
      const userIds = Object.keys(data);
      let successCount = 0;
      let failCount = 0;

      for (const id of userIds) {
        try {
          await bot.copyMessage(id, chatId, msg.message_id);
          successCount++;
        } catch (e) {
          failCount++;
        }
      }
      await bot.sendMessage(chatId, `✅ Broadcast completed.\n\n📤 Sent to: ${successCount} users\n❌ Failed to send: ${failCount} users`);
    } else {
      await bot.sendMessage(chatId, "❌ No users found to broadcast.");
    }
  } else if (msg.text) {
    await bot.sendChatAction(chatId, "upload_photo");
    const apiUrl =
      "https://flex-image-generator.vercel.app?prompt=" +
      encodeURIComponent(msg.text) +
      "&token=bf518688ee04d17&id=8061974905";

    try {
      const { data } = await axios.get(apiUrl);
      const photoUrl = data.download_url;
      const caption =
        "*👆 Here Is Your Generated Image\n\n💭 Your Prompt:*\n`" +
        msg.text +
        "`\n\n*🧑‍💻 Created By:* [Polimage](https://telegram.dog/polimage)";
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🧑‍💻 Developer", url: "https://telegram.dog/unknownzop" }]
          ]
        },
        parse_mode: "Markdown",
        reply_to_message_id: msg.message_id
      };
      await bot.sendPhoto(chatId, photoUrl, { ...keyboard, caption });
    } catch {
      await bot.sendMessage(chatId, "❌ Failed to generate image. Try again later.");
    }
  }

  res.end("OK");
});

app.get("/", (req, res) => {
  res.send("OK");
});

module.exports = app;
