export default async function handler(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: "証券コードを入力してください" });
    }

    const symbol = code + ".T";

    // -----------------------------
    // ① Yahooから株価＆会社名
    // -----------------------------
    const yahooRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
    );
    const yahooData = await yahooRes.json();

    const meta = yahooData.chart.result[0].meta;

    const price = meta.regularMarketPrice;
    const companyName = meta.symbol;

    // -----------------------------
    // ② ニュース（企業名ベース）
    // -----------------------------
    const newsRes = await fetch(
      `https://newsapi.org/v2/everything?q=${companyName}&apiKey=${process.env.NEWS_API_KEY}`
    );
    const newsData = await newsRes.json();

    const newsText = newsData.articles
      ?.slice(0, 5)
      .map(n => n.title)
      .join("\n") || "";

    // -----------------------------
    // ③ AI分析
    // -----------------------------
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "あなたはプロの株式アナリストです。"
          },
          {
            role: "user",
            content: `
企業コード: ${code}

以下を推定して分析してください：

① 会社の事業内容
② セグメント構造
③ 中期的な成長戦略
④ リスク

参考ニュース:
${newsText}
`
          }
        ]
      })
    });

    const aiData = await openaiRes.json();
    const analysis = aiData.choices[0].message.content;

    res.status(200).json({
      price,
      company: companyName,
      analysis
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
