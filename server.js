const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

app.post("/api/check-news", async (req, res) => {
  try {
    const { newsText } = req.body;

    if (!newsText || newsText.trim() === "") {
      return res.status(400).json({
        error: "請輸入新聞文字或社群轉傳內容。"
      });
    }

    if (!process.env.DIFY_API_KEY) {
      return res.status(500).json({
        error: "伺服器尚未設定 DIFY_API_KEY。"
      });
    }

    const difyResponse = await fetch("http://140.136.177.53/v1/workflows/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DIFY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: {
          news_content: newsText
        },
        response_mode: "blocking",
        user: "news-checker-demo-user"
      })
    });

    const data = await difyResponse.json();

    if (!difyResponse.ok) {
      console.error("Dify API Error:", data);
      return res.status(difyResponse.status).json({
        error: "Dify Workflow 執行失敗。",
        detail: data
      });
    }

    return res.json(data);

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      error: "伺服器發生錯誤，請稍後再試。"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});