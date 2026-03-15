export default async function handler(req, res) {

try {

const code = req.query.code;

if(!code){
return res.status(400).json({error:"証券コードを入力してください"});
}

const symbol = code + ".T";

/* 株価取得 */

const yahoo = await fetch(
"https://query1.finance.yahoo.com/v8/finance/chart/" + symbol
);

const yahooData = await yahoo.json();

const price =
yahooData.chart.result[0].meta.regularMarketPrice;


/* AI分析 */

const prompt = `
日本株の企業分析をしてください。

証券コード: ${code}

出力

①事業内容
②強み
③弱み
④成長性
⑤投資視点
`;

/* 新API */

const ai = await fetch(
"https://api.openai.com/v1/responses",
{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:"Bearer " + process.env.OPENAI_API_KEY
},
body:JSON.stringify({
model:"gpt-4o-mini",
input:prompt
})
}
);

const aiData = await ai.json();

const analysis =
aiData.output[0].content[0].text;


/* 結果 */

res.status(200).json({

name: symbol,
price: price,

per:"取得予定",
pbr:"取得予定",
roe:"取得予定",
marketCap:"取得予定",
margin:"取得予定",

analysis: analysis

});

} catch(e){

res.status(500).json({error:e.toString()});

}

}
