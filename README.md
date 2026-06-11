# AI 新聞查證分析工具
本專案是一套結合 Dify Workflow、LLM 與網頁介面的 AI 新聞查證工具。使用者可貼上新聞或社群轉傳訊息，系統會自動擷取核心主張、搜尋並比對相關證據，產生包含新聞摘要、可信度評分、查核結論與使用者提醒的分析報告。

系統以前端網頁作為操作介面，後端使用 Node.js / Express 串接 Dify Workflow API，並部署於 Render。此工具的目標不是直接取代專業查核機構，而是提供一個具可解釋性的初步查核流程，協助使用者提升資訊判讀與媒體識讀能力。

[Visit NewsChecker website](https://newschecker-qqtw.onrender.com/)
