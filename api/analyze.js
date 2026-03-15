export default async function handler(req,res){

try{

const code = req.query.code;

if(!code){
return res.status(400).json({error:"証券コードが必要"});
}

const symbol = code + ".T";

const url = "https://query1.finance.yahoo.com/v10/finance/quoteSummary/" + symbol + "?modules=defaultKeyStatistics,financialData,price";

const r = await fetch(url);

const d = await r.json();

const price = d.quoteSummary.result[0].price.regularMarketPrice.raw;

const name = d.quoteSummary.result[0].price.longName;

const marketCap = d.quoteSummary.result[0].price.marketCap.raw;

const per = d.quoteSummary.result[0].defaultKeyStatistics.trailingPE.raw;

const pbr = d.quoteSummary.result[0].defaultKeyStatistics.priceToBook.raw;

const roe = d.quoteSummary.result[0].financialData.returnOnEquity.raw;

const prompt = `

以下の企業を投資家向けに分析してください

企業名: ${name}

出力

①事業内容

②強み

③弱み

④成長性

⑤投資判断

`;

const ai = await fetch("https://api.openai.com/v1/chat/completions",{

method:"POST",

headers:{
"Content-Type":"application/json",
Authorization:"Bearer "+process.env.OPENAI_API_KEY
},

body:JSON.stringify({

model:"gpt-4o-mini",

messages:[
{role:"user",content:prompt}
]

})

});

const aiData = await ai.json();

const analysis = aiData.choices[0].message.content;

res.status(200).json({

name:name,

price:price,

marketCap:marketCap,

per:per,

pbr:pbr,

roe:roe,

margin:"取得準備中",

analysis:analysis

});

}catch(e){

res.status(500).json({error:e.toString()});

}

}
