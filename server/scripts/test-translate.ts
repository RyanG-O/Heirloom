// Quick look at analyze-turn output for tricky mixed-language sentences.
// Usage: npx tsx server/scripts/test-translate.ts [--model-too]   (cloud: NODE_USE_ENV_PROXY=1)
// Without --model-too, only sentences fully covered by the vetted glossary are run (no Gemini quota used).
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true, override: true });
const { analyzeTurn } = await import("../src/gemini");

const CASES: [string, string][] = [
  ["order-pho", "Ờ, ba người con ăn, ờ, fried chicken á."],
  ["order-pho", "Cho con một tô phở tái, large size, và extra bean sprouts."],
  ["order-pho", "Cô ơi, con bị allergic với peanuts."],
  ["order-pho", "Cô ơi, cho con một cái to-go box với the check."],
  ["order-pho", "Con muốn spicy, mà không có cilantro nha cô."],
  ["order-pho", "Cho con hai ly iced coffee với milk."],
  ["call-ba-ngoai", "Dạ con ăn rồi, con ăn chicken rice với friends."],
  ["call-ba-ngoai", "Tuần này con có midterm, nên con hơi stressed."],
  ["call-ba-ngoai", "Con về Thanksgiving. Con nhớ Ngoại lắm."],
  ["call-ba-ngoai", "Hôm qua con đi grocery shopping rồi con nấu dinner cho boyfriend."],
  ["call-ba-ngoai", "Con lái xe bị traffic nên con tới late."],
  ["call-ba-ngoai", "Tuần sau con có job interview, con hơi nervous."],
  ["call-ba-ngoai", "Con bị cảm, con phải đi doctor lấy medicine."],
  ["call-ba-ngoai", "À, dạ rồi. Con, ờ, cơm với thịt bò nướng."],
  ["call-ba-ngoai", "Yeah. Okay."],
  // these need the model (ambiguous or uncovered words)
  ["call-ba-ngoai", "Con mới move vô apartment mới với roommate."],
  ["call-ba-ngoai", "Dạ không đủ. Con thức khuya để study cho cái exam."],
  ["tell-parents-news", "Con có group project, mà teammate của con lazy quá Mẹ ơi."],
  ["order-pho", "Phở, ờ, không phải cơm đâu. Chỉ, ờ, gà chiên thôi. Okay, so there's a problem with that."],
  ["call-ba-ngoai", "I have so much homework to do this week, grandma."],
  ["tell-parents-news", "Mẹ ơi, con mới được promoted, salary của con tăng twenty percent."],
];
const modelToo = process.argv.includes("--model-too");
for (const [scenarioId, text] of CASES) {
  const t0 = Date.now();
  const probe = await analyzeTurn({ id: "t", speaker: "user", text, t: 0 }, [], scenarioId, []).catch((e) => ({ error: String(e) }) as any);
  if (!modelToo && probe.source && !["glossary", "none"].includes(probe.source)) continue;
  console.log(`\n${text}\n  [${probe.source} ${Date.now() - t0}ms ratio=${probe.vietnameseRatio?.toFixed(2)}]`);
  for (const s of probe.spans ?? []) console.log(`   ${s.english} → ${s.vietnamese}${s.note ? `   (${s.note})` : ""}`);
  if (probe.fullVietnamese) console.log(`   = ${probe.fullVietnamese}`);
}
