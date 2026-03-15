export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(405).json({ error: "Method not allowed" })
}

try {

const { ticker } = req.body

// Yahoo Finance
const stock = await fetch(
`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}.T`
)

const stockData = await stock.json()

const data = stockData.quoteResponse.result[0]

const name = data.longName
const price = data.regularMarketPrice
const per = data.trailingPE
const pbr = data.priceToBook
const marketCap = data.marketCap

// AI分析プロンプト
const prompt = `
あなたは優秀な株式アナリストです。

企業
${name}

株価
${price}

PER
${per}

PBR
${pbr}

以下を分析してください

1 事業モデル
2 投資魅力
3 リスク

中級投資家向けに説明してください。
`

// OpenAI API
const ai = await fetch("https://api.openai.com/v1/chat/completions", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
},
body: JSON.stringify({
model: "gpt-4o-mini",
messages: [
{
role: "user",
content: prompt
}
]
})
})

const aiData = await ai.json()

const analysis = aiData.choices[0].message.content

res.status(200).json({
name,
price,
per,
pbr,
marketCap,
analysis
})

} catch (error) {

res.status(500).json({
error: "データ取得エラー"
})

}

}