const { Telegraf, Input } = require("telegraf");
const { OpenAI } = require("openai");
const axios = require("axios");

const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
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
  let mode = "";

  //check supabase if it's a new user before creating a new thq`7890-=read
  const { data: userData, error: userDataError } = await supabase
    .from("User")
    .select()
    .eq("chat_id", chat_id);

  const name = ctx.chat.first_name;
  const username = ctx.chat.username;

  if (userData.length == 0) {
    const thread = await openai.beta.threads.create();
    const thread_id = thread.id;
    const { data, error } = await supabase.from("User").insert([
      {
        name,
        chat_id,
        username,
      },
    ]);
    if (error) return null;
    trd_id = thread_id;
    mode = data[0].mode;
  } else if (userData[0].thread_id == null) {
    const thread = await openai.beta.threads.create();
    const thread_id = thread.id;
    const { data, error } = await supabase
      .from("User")
      .update({ thread_id })
      .eq("chat_id", ctx.chat.id)
      .select();
    if (error) return null;
    trd_id = thread_id;
    mode = data[0].mode;
  } else {
    trd_id = userData[0].thread_id;
    mode = userData[0].mode;
  }

  if (trd_id == "") return null;

  //create/send new message
  // bot.telegram.sendChatAction(chat_id, "typing");
  await openai.beta.threads.messages.create(trd_id, {
    role: "user",
    content: msg,
  });

  let asst_id;
  if (mode == "regular_mode") {
    asst_id = "asst_9iWJ5TWqJbvyTeFDhJsj5vgS";
  } else if (mode == "fun_mode") {
    asst_id = "asst_C2wSEjnHNz01Xl25Bw7DYfUN";
  }
  //asst_C2wSEjnHNz01Xl25Bw7DYfUN
  const run = await openai.beta.threads.runs.create(trd_id, {
    assistant_id: asst_id,
  });

  const waitForCompletion = async () => {
    bot.telegram.sendChatAction(chat_id, "typing");
    const runUpdate = await openai.beta.threads.runs.retrieve(trd_id, run.id);
    const status = runUpdate.status;

    if (status === "completed") {
      const messages = await openai.beta.threads.messages.list(trd_id);
      const reply = messages.data[0].content[0].text.value;

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
    ctx.message.text != "/start" &&
    !ctx.message.text.includes("weather")
  ) {
    ctx.sendChatAction("typing");
    console.log("hey");
    const chat_id = ctx.chat.id;
    await chatgpt(ctx.message.text, chat_id, ctx);
  }

  // Continue with the next middleware
  next();
});

bot.command("weather", async (ctx) => {
  // ctx.reply(ctx.message.text);

  const chatId = ctx.chat.id;
  const msg = ctx.message.text;
  const location = msg.replace(/^\/weather\s+/, "");

  if (location == "") {
    ctx.reply("Pls provide a city");
    return null;
  }

  console.log(location);
  ctx.sendChatAction("find_location");

  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=c7e48fce0c58e339f68616c06d62c787
      `
    );
    const data = response.data;
    const weather = data.weather[0].description;
    const temperature = data.main.temp - 273.15;
    const city = data.name;
    const humidity = data.main.humidity;
    const pressure = data.main.pressure;
    const windSpeed = data.wind.speed;
    const message = `The weather in ${city} is ${weather} with a temperature of ${temperature.toFixed(
      2
    )}°C. The humidity is ${humidity}%, the pressure is ${pressure}hPa, and the wind speed is ${windSpeed}m/s.`;

    // ctx.reply(message);
    ctx.sendChatAction("find_location");
    ctx.replyWithHTML(
      `Grok The Weather Forecaster☁🌡\n\n<pre>City:           ${city}\nWeather:        ${weather}\nTemperature:    ${temperature.toFixed(
        2
      )}°C\nHumidity        ${humidity}%\nPressure:       ${pressure}hPa\nWindSpeed:      ${windSpeed}m/s</pre>`
    );
  } catch (error) {
    console.log(error);
    ctx.reply("City doesn't exist.🙃");
  }
});

bot.command("start", async (ctx) => {
  let mode;
  const chat_id = ctx.chat.id;
  const name = ctx.chat.first_name;
  const username = ctx.chat.username;
  const { data: userData, error: userDataError } = await supabase
    .from("User")
    .select()
    .eq("chat_id", chat_id);
  if (userData.length == 0) {
    const { data, error } = await supabase.from("User").insert([
      {
        name,
        chat_id,
        username,
      },
    ]);
    mode = "fun_mode";
    if (error) return null;
  } else {
    mode = userData[0].mode;
  }

  const msg = `Hi ${ctx.chat.first_name}, i'm Grok your Conversational AI here on Telegram.\n\nElon gave access to Grok for only premium user on X but we stole the algorithm and brought it to Telegram for you😉\n\nGrok Something`;
  const menu = ctx.replyWithHTML(msg, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `😎Fun Mode ${mode == "fun_mode" ? "✅" : ""}`,
            callback_data: "fun_mode",
          },
          {
            text: `😐Regular Mode ${mode == "regular_mode" ? "✅" : ""}`,
            callback_data: "regular_mode",
          },
        ],
      ],
    },
  });

  // ctx.editMessageReplyMarkup()
});

bot.on("callback_query", async (ctx) => {
  if (ctx.callbackQuery == undefined) return;
  const mode = ctx.callbackQuery.data;

  const menuid = ctx.callbackQuery.message.message_id;

  await supabase
    .from("User")
    .update({ mode })
    .eq("chat_id", ctx.chat.id)
    .select();

  bot.telegram
    .editMessageReplyMarkup(ctx.chat.id, menuid, menuid, {
      inline_keyboard: [
        [
          {
            text: `😎Fun Mode ${mode == "fun_mode" ? "✅" : ""}`,
            callback_data: "fun_mode",
          },
          {
            text: `😐Regular Mode ${mode == "regular_mode" ? "✅" : ""}`,
            callback_data: "regular_mode",
          },
        ],
      ],
    })
    .catch((error) => console.error("Error in editmessage:", error));
});
// Start the bot
bot.launch();

//
//
