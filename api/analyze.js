export default async function handler(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: "証券コードを入力してください" });
    }

    const symbol = code + ".T";

    // -----------------------------
    // ① 株価（Yahoo）
    // -----------------------------
    const yahooRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
    );
    const yahooData = await yahooRes.json();
    const price = yahooData.chart.result[0].meta.regularMarketPrice;

    // -----------------------------
    // ② 企業情報（FMP）
    // -----------------------------
    const fmpRes = await fetch(
      `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${process.env.FMP_API_KEY}`
    );
    const fmpData = await fmpRes.json();

    const company = fmpData[0];

    // -----------------------------
    // ③ ニュース（NewsAPI）
    // -----------------------------
    const newsRes = await fetch(
      `https://newsapi.org/v2/everything?q=${company.companyName}&apiKey=${process.env.NEWS_API_KEY}`
    );
    const newsData = await newsRes.json();

    const newsText = newsData.articles
      .slice(0, 5)
      .map(n => n.title)
      .join("\n");

    // -----------------------------
    // ④ AI分析
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
以下の企業を分析してください

【企業情報】
会社名: ${company.companyName}
業種: ${company.industry}
事業内容: ${company.description}

【ニュース】
${newsText}

以下を出力：
① 事業内容（わかりやすく）
② 収益構造（推定OK）
③ 中期計画の方向性（推定OK）
④ 今後の成長性とリスク
`
          }
        ]
      })
    });

    const aiData = await openaiRes.json();
    const analysis = aiData.choices[0].message.content;

    // -----------------------------
    // ⑤ 返す
    // -----------------------------
    res.status(200).json({
      price,
      company: company.companyName,
      analysis
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
