const { Telegraf, Input } = require("telegraf");
const { OpenAI } = require("openai");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_APIKEY, // This is the default and can be omitted
});
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://eugkengntgifflrroxwa.supabase.co";
const supabaseKey = process.env.supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey);

async function chatgpt(msg, chat_id, ctx) {
  // trd_id == thread_id
  let trd_id = "";

  //check supabase if it's a new user before creating a new thread
  const { data: userData, error: userDataError } = await supabase
    .from("User")
    .select()
    .eq("chat_id", chat_id);
  if (userData.length == 0) {
    const thread = await openai.beta.threads.create();
    const thread_id = thread.id;
    const name = ctx.chat.first_name;
    const username = ctx.chat.username;
    const { data, error } = await supabase.from("User").insert([
      {
        name,
        chat_id,
        username,
        thread_id,
      },
    ]);
    if (error) return null;
    trd_id = thread_id;
  } else {
    trd_id = userData[0].thread_id;
  }

  if (trd_id == "") return null;

  //create/send new message
  bot.telegram.sendChatAction(chat_id, "typing");
  await openai.beta.threads.messages.create(trd_id, {
    role: "user",
    content: msg,
  });

  bot.telegram.sendChatAction(chat_id, "typing");
  const run = await openai.beta.threads.runs.create(trd_id, {
    assistant_id: "asst_8Hr2pKGwbyXiFMSn1L8sCLtP",
  });

  const waitForCompletion = async () => {
    bot.telegram.sendChatAction(chat_id, "typing");
    const runUpdate = await openai.beta.threads.runs.retrieve(trd_id, run.id);
    const status = runUpdate.status;
    // console.log("status", status);

    if (status === "completed") {
      const messages = await openai.beta.threads.messages.list(trd_id);
      const reply = messages.data[0].content[0].text.value;
      // console.log("reply:", reply);

      // send to telegram
      if (reply != null) {
        ctx.reply(reply);
      } else {
        const text =
          "<blockquote><i>An error occurred. If this issue persists please contact us through our help center at grokontg@gmail.com</i></blockquote>";
        ctx.replyWithHTML(text);
      }

      return reply;
    } else if (status === "queued" || status === "in_progress") {
      //Run is not yet completed, waiting for 1 second...
      bot.telegram.sendChatAction(chat_id, "typing");
      setTimeout(waitForCompletion, 100); // Check again after 1 second
    }
  };
  await waitForCompletion();
}

//For group chat
bot.use(async (ctx, next) => {
  if (
    ctx.message &&
    ctx.message.chat.type == "private" &&
    ctx.message.text != "/start"
  ) {
    ctx.sendChatAction("typing");
    const chat_id = ctx.chat.id;
    await chatgpt(ctx.message.text, chat_id, ctx);
  }

  // Continue with the next middleware
  next();
});

bot.command("start", async (ctx) => {
  const msg = `Hi ${ctx.chat.first_name}`;
  ctx.replyWithHTML(msg);
});

// Start the bot
bot.launch();
