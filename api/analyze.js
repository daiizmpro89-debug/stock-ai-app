export default async function handler(req, res) {
  try {
    let { input } = req.query;

    if (!input) {
      return res.status(400).json({ error: "企業名または証券コードを入力してください" });
    }

    input = input.trim();

    // -----------------------------
    // ① 簡易企業DB（ここは増やせる）
    // -----------------------------
    const companyMap = {
      "トヨタ": "7203",
      "トヨタ自動車": "7203",
      "ソニー": "6758",
      "ソニーグループ": "6758",
      "ソフトバンク": "9984",
      "トライアル": "141A"
    };

    let code;

    // 数字ならそのまま
    if (/^\d+$/.test(input)) {
      code = input;
    } else {
      code = companyMap[input];
    }

    if (!code) {
      return res.status(200).json({
        company: "不明",
        price: "-",
        analysis: "企業が見つかりません。正式名称または証券コードを入力してください。"
      });
    }

    const symbol = code + ".T";

    // -----------------------------
    // ② 株価取得（複数ソース）
    // -----------------------------
    const results = await Promise.allSettled([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`),
      fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`)
    ]);

    let price = null;
    let companyName = null;

    if (results[0].status === "fulfilled") {
      const data = await results[0].value.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta) {
        price = meta.regularMarketPrice;
        companyName = meta.longName;
      }
    }

    if ((!price || !companyName) && results[1].status === "fulfilled") {
      const data = await results[1].value.json();
      const result = data?.quoteSummary?.result?.[0];
      if (result) {
        price = result.price?.regularMarketPrice?.raw;
        companyName = result.price?.longName;
      }
    }

    // -----------------------------
    // ③ ニュース取得（最近の動き）
    // -----------------------------
    let newsText = "";

    try {
      const newsRes = await fetch(
        `https://newsapi.org/v2/everything?q=${companyName}&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`
      );
      const newsData = await newsRes.json();

      newsText = newsData.articles
        ?.map(n => `・${n.title}`)
        .join("\n") || "";
    } catch (e) {
      newsText = "ニュース取得なし";
    }

    // -----------------------------
    // ④ AI分析（超重要）
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
            content: "あなたはプロの株式アナリストです。必ず事実ベースで分析してください。"
          },
          {
            role: "user",
            content: `
企業名: ${companyName}
証券コード: ${code}

【最新ニュース】
${newsText}

以下を分析してください：

① 事業内容（簡潔に）
② セグメント構造（売上％・利益％を具体的に）
③ 最近の動き（ニュースベースで）
④ 株価が動いた理由（直近数ヶ月）
⑤ 今後の成長性とリスク

※不明な場合は「不明」と書く
※推測しすぎない
`
          }
        ]
      })
    });

    const aiData = await openaiRes.json();
    const analysis = aiData.choices[0].message.content;

    // -----------------------------
    // ⑤ 返却
    // -----------------------------
    res.status(200).json({
      company: companyName,
      code,
      price,
      analysis
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
