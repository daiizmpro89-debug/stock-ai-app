export default async function handler(req, res) {

  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "証券コードが必要です" });
  }

  try {

    const yahooUrl =
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + code + ".T";

    const yahooRes = await fetch(yahooUrl);
    const yahooData = await yahooRes.json();

    const result = yahooData.quoteResponse.result[0];

    const price = result.regularMarketPrice;
    const name = result.longName || result.shortName;
    const marketCap = result.marketCap;

    const prompt = `
この企業を投資家向けに簡潔にまとめてください。

会社名: ${name}

出力形式
①事業内容
②強み
③弱み
④投資視点
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY
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
    });

    const aiData = await aiRes.json();

    const analysis = aiData.choices[0].message.content;

    res.status(200).json({
      name,
      price,
      marketCap,
      analysis
    });

  } catch (error) {
    res.status(500).json({ error: "サーバーエラー", detail: error.toString() });
  }
}
