export default async function handler(req, res) {

  try {

    const { ticker } = req.body || {}

    if (!ticker) {
      return res.status(400).json({ error: "ticker required" })
    }

    const stock = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}.T`
    )

    const stockData = await stock.json()

    if (!stockData.quoteResponse || stockData.quoteResponse.result.length === 0) {
      return res.status(404).json({ error: "銘柄が見つかりません" })
    }

    const data = stockData.quoteResponse.result[0]

    const name = data.longName
    const price = data.regularMarketPrice
    const per = data.trailingPE
    const pbr = data.priceToBook
    const marketCap = data.marketCap

    const prompt = `
企業: ${name}
株価: ${price}
PER: ${per}
PBR: ${pbr}

この企業の
・事業内容
・投資魅力
・リスク
を日本語で分析してください。
`

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      })
    })

    const aiData = await ai.json()

    const analysis = aiData.choices?.[0]?.message?.content || "AI分析失敗"

    return res.status(200).json({
      name,
      price,
      per,
      pbr,
      marketCap,
      analysis
    })

  } catch (error) {

    return res.status(500).json({
      error: error.message
    })

  }
}
