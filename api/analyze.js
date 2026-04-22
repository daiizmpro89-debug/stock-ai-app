export default async function handler(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: "証券コードを入力してください" });
    }

    const symbol = code + ".T";

    // -----------------------------
    // ① 複数ソース取得
    // -----------------------------
    const results = await Promise.allSettled([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`),
      fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail`)
    ]);

    let price = null;
    let companyName = null;

    // Yahoo①
    if (results[0].status === "fulfilled") {
      const data = await results[0].value.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta) {
        price = meta.regularMarketPrice;
        companyName = meta.symbol;
      }
    }

    // Yahoo② fallback
    if ((!price || !companyName) && results[1].status === "fulfilled") {
      const data = await results[1].value.json();
      const result = data?.quoteSummary?.result?.[0];
      if (result) {
        price = result.price?.regularMarketPrice?.raw;
        companyName = result.price?.longName;
      }
    }

    if (!price) {
      return res.status(200).json({
        company: "不明",
        price: "取得不可",
        analysis: "データ取得に失敗しました。証券コードを確認してください。"
      });
    }

    // -----------------------------
    // ② AI分析（セグメント含む）
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

以下を分析してください：

① 事業内容（わかりやすく）
② セグメント構造（売上比率％＋利益比率％で具体的に）
③ 中期成長戦略
④ リスク

※セグメントは可能な限り具体的な数値で推定してください
`
          }
        ]
      })
    });

    const aiData = await openaiRes.json();
    const analysis = aiData.choices[0].message.content;

    // -----------------------------
    // ③ 返却
    // -----------------------------
    res.status(200).json({
      company: companyName,
      price,
      analysis
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
