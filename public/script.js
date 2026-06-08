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
  resultText.innerHTML = "";

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
      resultText.innerHTML = `
        <div class="error-box">
          <h3>分析失敗</h3>
          <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>
        </div>
      `;
      return;
    }

    const report = extractDifyReport(data);

    resultSection.classList.remove("hidden");
    resultText.innerHTML = renderReport(report);

    statusDiv.textContent = "分析完成。";

  } catch (error) {
    console.error(error);
    resultSection.classList.remove("hidden");
    resultText.innerHTML = `
      <div class="error-box">
        <h3>系統發生錯誤</h3>
        <p>請稍後再試，或檢查 Render Logs。</p>
      </div>
    `;
    statusDiv.textContent = "分析失敗。";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "開始查證分析";
  }
});

function extractDifyReport(data) {
  console.log("Full Dify response:", data);

  if (!data.data || !data.data.outputs) {
    return {
      title: "查核結果",
      final_label: "資料格式錯誤",
      summary: "未取得 Dify outputs。",
      raw_text: JSON.stringify(data, null, 2)
    };
  }

  const outputs = data.data.outputs;
  console.log("Dify outputs:", outputs);

  /*
    你的 Dify 目前使用 structured_output，
    所以這裡一定要優先抓 outputs.structured_output。
  */
  let report =
    outputs.structured_output ||
    outputs.report_json ||
    outputs.final_report ||
    outputs.result ||
    outputs.output ||
    outputs.text ||
    outputs.answer;

  /*
    如果 outputs 本身就是完整報告，也直接使用。
  */
  if (!report && isReportObject(outputs)) {
    report = outputs;
  }

  /*
    如果 outputs 只有一個欄位，就抓第一個欄位。
  */
  if (!report && typeof outputs === "object") {
    const keys = Object.keys(outputs);
    if (keys.length === 1) {
      report = outputs[keys[0]];
    }
  }

  report = unwrapDifyReport(report);

  console.log("Parsed report:", report);
  console.log("Parsed report type:", typeof report);

  if (!isReportObject(report)) {
    return {
      title: "無法顯示報告",
      final_label: "格式錯誤",
      summary: "回傳資料格式不是有效的 JSON 物件。",
      raw_text:
        typeof report === "string"
          ? report
          : JSON.stringify(report || outputs, null, 2)
    };
  }

  return report;
}

function isReportObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (
      "summary" in value ||
      "claims" in value ||
      "credibility" in value ||
      "conclusion" in value ||
      "suggestion" in value ||
      "final_label" in value ||
      "title" in value ||
      "core_claims" in value ||
      "credibility_score" in value
    )
  );
}

function unwrapDifyReport(value) {
  let current = value;

  for (let i = 0; i < 5; i++) {
    if (typeof current === "string") {
      current = cleanJsonString(current);

      try {
        current = JSON.parse(current);
        continue;
      } catch {
        return current;
      }
    }

    if (isReportObject(current)) {
      return current;
    }

    if (current && typeof current === "object" && !Array.isArray(current)) {
      if (current.structured_output) {
        current = current.structured_output;
        continue;
      }

      if (current.report_json) {
        current = current.report_json;
        continue;
      }

      if (current.final_report) {
        current = current.final_report;
        continue;
      }

      if (current.text) {
        current = current.text;
        continue;
      }

      if (current.output) {
        current = current.output;
        continue;
      }

      if (current.result) {
        current = current.result;
        continue;
      }

      if (current.answer) {
        current = current.answer;
        continue;
      }
    }

    break;
  }

  return current;
}

function cleanJsonString(text) {
  let cleaned = String(text)
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/<output>/g, "")
    .replace(/<\/output>/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function renderReport(report) {
  if (report && report.raw_text) {
    return `
      <div class="error-box">
        <h3>${escapeHtml(report.title || "JSON 解析失敗")}</h3>
        <p>${escapeHtml(report.summary || "Dify 有回傳內容，但前端無法解析成報告格式。")}</p>
        <pre>${escapeHtml(report.raw_text)}</pre>
      </div>
    `;
  }

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return `
      <div class="error-box">
        <h3>無法顯示報告</h3>
        <p>回傳資料格式不是有效的 JSON 物件。</p>
        <pre>${escapeHtml(String(report))}</pre>
      </div>
    `;
  }

  /*
    你的 Dify structured_output 目前沒有 final_label，
    所以這裡用 credibility.overall 當作右上角標籤。
  */
  const finalLabel =
    report.final_label ||
    convertOverallToLabel(report.credibility?.overall) ||
    "未提供查核結果";

  const labelClass = getLabelClass(finalLabel);

  return `
    <div class="report-header">
      <div>
        <h3>${escapeHtml(report.title || "最終事實查核報告")}</h3>
        <p class="summary">${escapeHtml(report.summary || "未提供摘要。")}</p>
      </div>

      <div class="final-label ${labelClass}">
        ${escapeHtml(finalLabel)}
      </div>
    </div>

    <div class="report-section">
      <h4>一、核心主張與證據比對</h4>
      ${renderCoreClaims(report.claims || report.core_claims)}
    </div>

    <div class="report-section">
      <h4>二、整體查核結論</h4>
      <p>${escapeHtml(report.conclusion || report.detailed_analysis || "未提供整體查核結論。")}</p>
    </div>

    <div class="report-section">
      <h4>三、可信度評分</h4>
      ${renderCredibilityScore(report.credibility || report.credibility_score)}
    </div>

    <div class="report-section reminder">
      <h4>四、使用者提醒</h4>
      <p>${escapeHtml(report.suggestion || report.user_reminder || "建議使用者進一步查詢官方來源、原始資料與多家可信媒體報導。")}</p>
    </div>
  `;
}

function renderCoreClaims(claims) {
  if (!Array.isArray(claims) || claims.length === 0) {
    return `<p>未提供核心主張。</p>`;
  }

  return claims.map((item, index) => {
    /*
      你的 Dify claims 目前可能只是 string array，
      也可能是 object array。
      這裡兩種都支援。
    */
    if (typeof item === "string") {
      return `
        <div class="claim-card">
          <div class="claim-title">
            <span>主張 ${index + 1}</span>
          </div>
          <p class="claim-text">${escapeHtml(item)}</p>
        </div>
      `;
    }

    return `
      <div class="claim-card">
        <div class="claim-title">
          <span>主張 ${index + 1}</span>
          <strong>${escapeHtml(item.judgment || item.label || "未提供判斷")}</strong>
        </div>

        <p class="claim-text">${escapeHtml(item.claim || item.title || "未提供主張內容。")}</p>

        <div class="claim-detail">
          <p><b>比對結果：</b>${escapeHtml(item.evidence_comparison || item.analysis || "未提供。")}</p>
          <p><b>支持證據：</b>${escapeHtml(item.supporting_evidence || "查無足夠資料。")}</p>
          <p><b>反駁證據：</b>${escapeHtml(item.contradicting_evidence || "查無足夠資料。")}</p>
        </div>
      </div>
    `;
  }).join("");
}

function renderCredibilityScore(score) {
  if (!score || typeof score !== "object") {
    return `<p>未提供可信度評分。</p>`;
  }

  return `
    <div class="score-grid">
      <div class="score-item">
        <span>來源透明度</span>
        <strong>${escapeHtml(String(score.source_transparency ?? score.source_quality ?? "未提供"))}/5</strong>
      </div>

      <div class="score-item">
        <span>證據一致性</span>
        <strong>${escapeHtml(String(score.evidence_consistency ?? "未提供"))}/5</strong>
      </div>

      <div class="score-item">
        <span>數據可驗證性</span>
        <strong>${escapeHtml(String(score.data_verifiability ?? score.claim_verifiability ?? "未提供"))}/5</strong>
      </div>

      <div class="score-item">
        <span>情緒煽動程度</span>
        <strong>${escapeHtml(String(score.emotional_language ?? "未提供"))}/5</strong>
      </div>

      <div class="score-item">
        <span>整體可信度</span>
        <strong>${escapeHtml(String(score.overall ?? score.overall_score ?? "未提供"))}</strong>
      </div>
    </div>
  `;
}

function renderSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return `<p>未提供參考來源。</p>`;
  }

  return `
    <div class="source-list">
      ${sources.map(source => {
        const name = source.source_name || "未命名來源";
        const url = source.url || "";
        const relevance = source.relevance || "未提供關聯說明。";

        return `
          <div class="source-item">
            <h5>${escapeHtml(name)}</h5>
            ${
              url
                ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
                : `<p>未提供網址。</p>`
            }
            <p>${escapeHtml(relevance)}</p>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function convertOverallToLabel(overall) {
  if (!overall) return "";

  if (overall === "高") return "可信度高";
  if (overall === "中") return "可信度中";
  if (overall === "低") return "可信度低";

  return overall;
}

function getLabelClass(label) {
  if (!label) return "label-unknown";

  if (label.includes("完全真實")) return "label-true";
  if (label.includes("可信度高")) return "label-true";
  if (label === "高") return "label-true";

  if (label.includes("部分真實")) return "label-partial";
  if (label.includes("可信度中")) return "label-partial";
  if (label === "中") return "label-partial";

  if (label.includes("虛假錯誤")) return "label-false";
  if (label.includes("可信度低")) return "label-false";
  if (label === "低") return "label-false";

  if (label.includes("證據不足")) return "label-unknown";

  return "label-unknown";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}