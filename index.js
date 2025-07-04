const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const express = require("express");
const qrcode = require("qrcode");
const P = require("pino");
const { Telegraf } = require("telegraf");

const app = express();
const port = process.env.PORT || 3000;

// Telegram setup
const TELEGRAM_BOT_TOKEN = "7277157537:AAFNn75vKddw_zuZo1ljJ0r5SASyuheJRCs";
const ADMIN_ID = 7210057243;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// WhatsApp
let qrCodeData = null;
let sock = null;

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("connection.update", async ({ connection, qr }) => {
    if (qr) {
      qrCodeData = qr;
      const image = await qrcode.toDataURL(qr);
      bot.telegram.sendPhoto(ADMIN_ID, { url: image }, { caption: "امسح رمز واتساب للربط" });
    }

    if (connection === "open") {
      qrCodeData = null;
      bot.telegram.sendMessage(ADMIN_ID, "✅ تم الاتصال بـ واتساب");
    }

    if (connection === "close") {
      bot.telegram.sendMessage(ADMIN_ID, "❌ تم فصل الاتصال");
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

app.get("/", async (req, res) => {
  if (qrCodeData) {
    const img = await qrcode.toDataURL(qrCodeData);
    res.send(`<img src="${img}" />`);
  } else {
    res.send(`<h1>✅ متصل بـ واتساب</h1>`);
  }
});

bot.start((ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.reply("مرحبًا بك في لوحة تحكم واتساب");
});

bot.command("status", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.reply(sock?.user ? "✅ متصل" : "❌ غير متصل");
});

bot.launch();
startWhatsAppBot();
app.listen(port, () => console.log("🌐 السيرفر شغال على بورت", port));
