const submitBtn = document.getElementById("submitBtn");
const newsText = document.getElementById("newsText");
const statusDiv = document.getElementById("status");
const resultSection = document.getElementById("resultSection");
const resultText = document.getElementById("resultText");

submitBtn.addEventListener("click", async () => {
  const inputText = newsText.value.trim();

  if (!inputText) {
    alert("請先貼上新聞文字或社群轉傳內容。");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "分析中...";
  statusDiv.textContent = "系統正在擷取核心主張並進行查核分析，請稍候。";
  resultSection.classList.add("hidden");
  resultText.textContent = "";

  try {
    const response = await fetch("/api/check-news", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        newsText: inputText
      })
    });

    const data = await response.json();

    if (!response.ok) {
      resultSection.classList.remove("hidden");
      resultText.textContent =
        "分析失敗：\n" + JSON.stringify(data, null, 2);
      return;
    }

    const output = extractDifyOutput(data);

    resultSection.classList.remove("hidden");
    resultText.textContent = output;

    statusDiv.textContent = "分析完成。";

  } catch (error) {
    console.error(error);
    resultSection.classList.remove("hidden");
    resultText.textContent = "系統發生錯誤，請稍後再試。";
    statusDiv.textContent = "分析失敗。";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "開始查證分析";
  }
});

function extractDifyOutput(data) {
  if (data.data && data.data.outputs) {
    const outputs = data.data.outputs;

    if (typeof outputs === "string") {
      return outputs;
    }

    if (typeof outputs === "object") {
      let text = "";

      for (const key in outputs) {
        text += `【${key}】\n`;
        text += `${outputs[key]}\n\n`;
      }

      return text;
    }
  }

  return JSON.stringify(data, null, 2);
}