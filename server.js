"use strict";

const line = require("@line/bot-sdk");
const express = require("express");
const flex_template = require("./flex_template.json");
const fire_flex_template = require("./fire_flex_template.json");
require("dotenv").config(); // load .env file

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.Client(config);

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

// Setup socket.io
const http = require("http").createServer(app);
const io = require("socket.io")(http);

let socket = null;

io.on("connection", (sock) => {
  socket = sock;
  console.log("Client is connected!");
  socket.on("disconnect", () => {
    console.log("Client is disconnected!");
  });

  socket.on("msg", (msg) => {
    console.log(msg);
    client.broadcast({ type: "text", text: msg }).catch((err) => {
      console.error(err);
    });
  });

  socket.on("fire", (data) => {
    fire_flex_template.body.contents[1].contents[0].contents[1].text =
      data["CO"].toString().substr(0, 12) + " ppm";
    fire_flex_template.body.contents[1].contents[1].contents[1].text =
      data["GAS_LPG"].toString().substr(0, 12) + " ppm";
    fire_flex_template.body.contents[1].contents[2].contents[1].text =
      data["SMOKE"].toString().substr(0, 12) + " ppm";
    fire_flex_template.hero.url = data["link"];
    client.broadcast({
      type: "flex",
      altText: "你家著火了！！",
      contents: fire_flex_template,
    });
  });

  socket.on("img", (imgUrl) => {
    client.broadcast({
      type: "image",
      originalContentUrl: imgUrl,
      previewImageUrl: imgUrl,
    });
  });

  socket.on("watched", (data) => {
    console.log("Watched: ", data);
  });
});

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post("/callback", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// event handler
function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  if (event.message.text === "查看住家狀態中...") {
    if (socket) {
      const res = new Promise((resolve) =>
        socket.emit("watch", (data) => resolve(data))
      );
      res
        .then((data) => {
          console.log(data);
          flex_template.body.contents[1].contents[0].contents[1].text =
            data["CO"].toString().substr(0, 12) + " ppm";
          flex_template.body.contents[1].contents[1].contents[1].text =
            data["GAS_LPG"].toString().substr(0, 12) + " ppm";
          flex_template.body.contents[1].contents[2].contents[1].text =
            data["SMOKE"].toString().substr(0, 12) + " ppm";
          flex_template.hero.url = data["link"];
          flex_template.footer.contents[0].action.uri = data["analysis_link"];
          return client.replyMessage(event.replyToken, {
            type: "flex",
            altText: "住家狀態",
            contents: flex_template,
          });
        })
        .catch((err) => {
          console.log(err);
        });
    }
  } else if (event.message.text === "關閉門窗") {
    if (socket) {
      const res = new Promise((resolve) =>
        socket.emit("close_door", (data) => resolve(data))
      );
      res.then((data) => {
        if (data.OK) {
          return client.replyMessage(event.replyToken, {
            type: "text",
            text: "已關閉門窗",
          });
        }
      });
    }
  } else if (event.message.text === "關閉警鈴") {
    if (socket) socket.emit("close_alert");
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "已關閉警鈴",
    });
  } else if (event.message.text === "測試") {
    if (socket) {
      const res = new Promise((resolve) =>
        socket.emit("test", (data) => resolve(data))
      );
      res.then((data) => {
        let replyMsg = "";
        if (data.OK) {
          replyMsg = "測試成功";
        } else replyMsg = "測試有問題";
        return client.replyMessage(event.replyToken, {
          type: "text",
          text: replyMsg,
        });
      });
    }
  }
}

// listen on port
const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log(`listening on ${port}`);
});
