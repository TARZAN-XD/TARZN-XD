const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const express = require("express");
const qrcode = require("qrcode");
const P = require("pino");
const { Telegraf } = require("telegraf");

const app = express();
const port = process.env.PORT || 3000;

// إعدادات بوت تيليجرام
const TELEGRAM_BOT_TOKEN = "7277157537:AAFNn75vKddw_zuZo1ljJ0r5SASyuheJRCs";
const ADMIN_ID = 7210057243;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// واتساب
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
      bot.telegram.sendPhoto(ADMIN_ID, { url: image }, { caption: "📲 امسح رمز واتساب للربط" });
    }

    if (connection === "open") {
      qrCodeData = null;
      console.log("✅ Connected to WhatsApp");
      bot.telegram.sendMessage(ADMIN_ID, "✅ تم ربط واتساب بنجاح.");
    }

    if (connection === "close") {
      bot.telegram.sendMessage(ADMIN_ID, "❌ تم قطع الاتصال بـ واتساب.");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // استجابة لأوامر من واتساب
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    const reply = (txt) => sock.sendMessage(msg.key.remoteJid, { text: txt });

    if (text.toLowerCase() === "ping") {
      reply("pong ✅");
    } else if (text.toLowerCase() === "مساعدة") {
      reply("الأوامر المتاحة:\n- ping\n- مساعدة");
    }
  });
}

// تيليجرام بوت – لوحة تحكم
bot.start((ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.reply("👋 أهلاً بك في لوحة تحكم بوت واتساب.");
});

bot.command("status", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  if (sock?.user) {
    ctx.reply("✅ البوت متصل بـ واتساب.");
  } else {
    ctx.reply("❌ البوت غير متصل.");
  }
});

bot.command("logout", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await sock.logout();
  ctx.reply("✅ تم تسجيل الخروج من واتساب.");
});

bot.command("say", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const parts = ctx.message.text.split(" ");
  if (parts.length < 3) return ctx.reply("❌ الصيغة:\n/say 966xxxxxxxx: رسالتك");

  const [jid, ...msgParts] = parts.slice(1).join(" ").split(":");
  const message = msgParts.join(":").trim();

  if (!jid || !message) return ctx.reply("❌ صيغة غير صحيحة");

  try {
    await sock.sendMessage(`${jid}@s.whatsapp.net`, { text: message });
    ctx.reply("✅ تم إرسال الرسالة.");
  } catch (e) {
    ctx.reply("❌ فشل في إرسال الرسالة.");
  }
});

// موقع QR
app.get("/", async (req, res) => {
  if (qrCodeData) {
    const qrImage = await qrcode.toDataURL(qrCodeData);
    res.send(`
      <html>
        <body style="text-align:center;background:#000;color:#fff">
          <h2>📲 امسح رمز QR للربط</h2>
          <img src="${qrImage}" />
        </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
        <body style="text-align:center;background:#000;color:#0f0">
          <h2>✅ واتساب متصل</h2>
        </body>
      </html>
    `);
  }
});

startWhatsAppBot();
bot.launch();
app.listen(port, () => console.log("🌐 الموقع يعمل على:", port));
