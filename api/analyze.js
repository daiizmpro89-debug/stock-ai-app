// server.js
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALPHA_KEY = "YOUR_ALPHA_VANTAGE_KEY";

// ===== キャッシュ =====
const CACHE_FILE = "./cache.json";
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE));
}

// ===== ①企業特定 =====
async function resolveCompany(input) {
  if (/^\d+$/.test(input)) {
    return { symbol: input + ".T", name: input };
  }

  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${input}&apikey=${ALPHA_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.bestMatches?.length > 0) {
    return {
      symbol: data.bestMatches[0]["1. symbol"],
      name: data.bestMatches[0]["2. name"],
    };
  }
  return null;
}

// ===== ②企業データ =====
async function getOverview(symbol) {
  const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_KEY}`;
  const res = await fetch(url);
  return await res.json();
}

// ===== ③ EDINET検索 =====
async function getEdinetDoc(companyName) {
  const today = new Date().toISOString().slice(0,10);

  const url = `https://api.edinet-fsa.go.jp/api/v2/documents.json?date=${today}&type=2`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const doc = data.results?.find(d =>
      d.filerName?.includes(companyName)
    );

    return doc?.docID;
  } catch {
    return null;
  }
}

// ===== ④ セグメント抽出（AI fallback）=====
async function extractSegments(text) {
  const prompt = `
以下の文章から事業セグメントごとの売上構成をJSONで抽出してください。

${text}

形式:
{
 "segments":[
  {"name":"", "sales_ratio":""}
 ]
}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-5",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  return JSON.parse(res.choices[0].message.content);
}

// ===== ⑤ KPI計算 =====
function calcKPI(data) {
  return {
    PER: data.PERatio || "不明",
    marketCap: data.MarketCapitalization || "不明",
    revenue: data.RevenueTTM || "不明",
  };
}

// ===== ⑥ 分析 =====
async function analyze(companyName, rawData, segments, kpi) {
  const prompt = `
以下を基に投資分析してください。

【企業】
${companyName}

【KPI】
${JSON.stringify(kpi)}

【セグメント】
${JSON.stringify(segments)}

ルール:
- 不明は不明と書く
- 推測と事実を分ける

出力(JSON):
{
 "type":"",
 "segments_analysis":"",
 "growth":"",
 "plan":"",
 "score":0,
 "conclusion":""
}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-5",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  return JSON.parse(res.choices[0].message.content);
}

// ===== API =====
app.post("/analyze", async (req, res) => {
  const { input } = req.body;

  // キャッシュ
  if (cache[input]) {
    return res.json(cache[input]);
  }

  const company = await resolveCompany(input);
  if (!company) return res.json({ error: "企業不明" });

  const overview = await getOverview(company.symbol);

  const docId = await getEdinetDoc(company.name);

  let segments = { segments: [] };

  if (docId) {
    // 本来はZIP取得して解析するが簡略化
    segments = await extractSegments(company.name);
  }

  const kpi = calcKPI(overview);

  const analysis = await analyze(company.name, overview, segments, kpi);

  const result = {
    company,
    kpi,
    segments,
    analysis,
  };

  // 保存
  cache[input] = result;
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

  res.json(result);
});

app.listen(3000, () => console.log("RUNNING"));
