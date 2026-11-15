// Generates fixture JSON files. Run: node fixtures/build.mjs
import { writeFileSync } from "node:fs";

const mk = (id, scenarioId, lines, analyses) => {
  let t = 0;
  const turns = lines.map(([speaker, text], i) => {
    t += 2500 + text.length * 60;
    return { id: `${id}-t${i}`, speaker: speaker === "A" ? "agent" : "user", text, t };
  });
  const session = {
    id,
    scenarioId,
    startedAt: "2026-11-15T03:00:00.000Z",
    endedAt: new Date(Date.parse("2026-11-15T03:00:00.000Z") + t + 2000).toISOString(),
    turns,
  };
  if (analyses) session.analyses = analyses(turns);
  writeFileSync(new URL(`./session.${scenarioId}.json`, import.meta.url), JSON.stringify(session, null, 2) + "\n");
  return session;
};

mk(
  "fx-ngoai",
  "call-ba-ngoai",
  [
    ["A", "Alô, con hả? Ngoại nè! Con ăn cơm chưa?"],
    ["U", "Dạ con chào Ngoại. Con ăn rồi, con ăn... um... chicken rice với friends."],
    ["A", "À, con ăn cơm gà với bạn hả? Ngon không con?"],
    ["U", "Dạ ngon. Ngoại ơi, tuần này con có midterm, nên con hơi stressed."],
    ["A", "Ờ, con có bài kiểm tra giữa kỳ hả? Con đừng căng thẳng quá nghe. Con có ngủ đủ không?"],
    ["U", "Dạ không đủ. Con thức khuya để study."],
    ["A", "Trời ơi, học khuya hoài là mệt lắm đó con. Chừng nào con về thăm Ngoại?"],
    ["U", "Con về Thanksgiving. Con nhớ Ngoại lắm."],
    ["A", "Ngoại cũng nhớ con lắm! Lễ Tạ Ơn con về, Ngoại nấu canh chua cho con ăn nghe."],
    ["U", "Dạ yay! Con thích canh chua nhất. Ngoại khỏe không? Cái garden của Ngoại sao rồi?"],
    ["A", "Ngoại khỏe. Vườn của Ngoại năm nay trồng được nhiều rau thơm lắm, có húng quế, ngò gai nữa."],
    ["U", "Wow, con muốn help Ngoại trong vườn khi con về."],
    ["A", "Được chứ, con về phụ Ngoại tưới cây nghe. Thôi con đi học đi, nhớ ăn uống đầy đủ nha con."],
    ["U", "Dạ, con thương Ngoại. Bye Ngoại!"],
  ],
  (turns) => [
    { turnId: turns[1].id, vietnameseRatio: 0.67, fullVietnamese: "Dạ con chào Ngoại. Con ăn rồi, con ăn cơm gà với bạn.", spans: [
      { english: "chicken rice", vietnamese: "cơm gà" },
      { english: "friends", vietnamese: "bạn", note: "“bạn bè” is also common for friends in general." },
    ] },
    { turnId: turns[3].id, vietnameseRatio: 0.8, fullVietnamese: "Dạ ngon. Ngoại ơi, tuần này con có bài kiểm tra giữa kỳ, nên con hơi căng thẳng.", spans: [
      { english: "midterm", vietnamese: "bài kiểm tra giữa kỳ" },
      { english: "stressed", vietnamese: "căng thẳng" },
    ] },
    { turnId: turns[5].id, vietnameseRatio: 0.86, fullVietnamese: "Dạ không đủ. Con thức khuya để học bài.", spans: [
      { english: "study", vietnamese: "học bài" },
    ] },
    { turnId: turns[7].id, vietnameseRatio: 0.88, fullVietnamese: "Con về dịp Lễ Tạ Ơn. Con nhớ Ngoại lắm.", spans: [
      { english: "Thanksgiving", vietnamese: "Lễ Tạ Ơn" },
    ] },
    { turnId: turns[9].id, vietnameseRatio: 0.88, fullVietnamese: "Dạ hay quá! Con thích canh chua nhất. Ngoại khỏe không? Vườn của Ngoại sao rồi?", spans: [
      { english: "garden", vietnamese: "vườn", note: "“Cái vườn” works, but “vườn của Ngoại” sounds more natural." },
    ] },
    { turnId: turns[11].id, vietnameseRatio: 0.82, fullVietnamese: "Con muốn phụ Ngoại làm vườn khi con về.", spans: [
      { english: "help", vietnamese: "phụ", note: "Southern; Northern speakers say “giúp”." },
    ] },
    { turnId: turns[13].id, vietnameseRatio: 0.83, fullVietnamese: "Dạ, con thương Ngoại. Con chào Ngoại!", spans: [] },
  ],
);

mk("fx-pho", "order-pho", [
  ["A", "Chào con! Mấy người? Con ăn gì nè?"],
  ["U", "Dạ, bốn người. Con muốn hai tô phở tái, large size."],
  ["A", "Hai tô lớn phở tái nha. Còn hai người kia ăn gì con?"],
  ["U", "Một tô phở gà, và một tô... um... the one with meatballs, small."],
  ["A", "Một tô phở gà, một tô nhỏ phở bò viên. Uống gì không con?"],
  ["U", "Dạ cho con bốn ly trà đá. Và extra herbs được không cô?"],
  ["A", "Được, cô cho thêm rau thơm nha. Đợi chút xíu nghe con."],
  ["U", "Dạ cảm ơn cô. Lát nữa cho con the check nha."],
  ["A", "Ừ, ăn xong con kêu tính tiền là được."],
]);

mk("fx-me", "tell-parents-news", [
  ["A", "Con về rồi hả? Sao hôm nay con vui vậy?"],
  ["U", "Mẹ ơi, con có tin vui! Con được một internship ở Seattle."],
  ["A", "Trời, con được đi thực tập hả? Công ty gì vậy con?"],
  ["U", "Một tech company, con sẽ làm software engineer."],
  ["A", "Giỏi quá! Mà lương có được không con? Ở đó con ở đâu?"],
  ["U", "Lương tốt lắm Mẹ. Công ty cho con housing nữa."],
  ["A", "Vậy thì Mẹ đỡ lo. Nhưng con nhớ ăn uống đàng hoàng, đừng ăn mì gói hoài nghe."],
  ["U", "Dạ, con hứa. Mẹ đừng worry quá."],
]);

// Sample report for the Ngoại session: lets the report UI be built before Gemini is wired up.
const report = {
  summary:
    "You held a full catch-up call with Bà Ngoại and stayed in Vietnamese for most of it. Your kinship pronouns (con/Ngoại) and polite “Dạ” were consistent throughout. You reached for English mostly on school words and everyday nouns.",
  vietnameseRatio: 0.82,
  missingWords: [
    { english: "midterm", vietnamese: "bài kiểm tra giữa kỳ", example: "Tuần này con có bài kiểm tra giữa kỳ.", count: 1 },
    { english: "stressed", vietnamese: "căng thẳng", example: "Con hơi căng thẳng.", count: 1 },
    { english: "study", vietnamese: "học bài", example: "Con thức khuya để học bài.", count: 1 },
    { english: "garden", vietnamese: "vườn", example: "Vườn của Ngoại sao rồi?", count: 1 },
    { english: "help", vietnamese: "phụ (South) / giúp (North)", example: "Con muốn phụ Ngoại làm vườn.", count: 1 },
    { english: "Thanksgiving", vietnamese: "Lễ Tạ Ơn", example: "Con về dịp Lễ Tạ Ơn.", count: 1 },
    { english: "chicken rice", vietnamese: "cơm gà", example: "Con ăn cơm gà với bạn.", count: 1 },
    { english: "friends", vietnamese: "bạn / bạn bè", example: "Con đi ăn với bạn bè.", count: 1 },
  ],
  wins: [
    "“Con nhớ Ngoại lắm”: natural and warm, with “lắm” placed exactly right.",
    "“Con thích canh chua nhất”: correct superlative with “nhất”.",
    "Opened every reply with “Dạ”, which is perfect politeness for talking to a grandparent.",
  ],
  corrections: [
    { said: "Cái garden của Ngoại sao rồi?", better: "Vườn của Ngoại sao rồi?", why: "“Cái” is fine but unnecessary here; dropping it sounds more natural." },
    { said: "Bye Ngoại!", better: "Con chào Ngoại!", why: "With elders, “con chào …” is the respectful goodbye." },
  ],
  pronunciationTips: [
    "Practice the hỏi tone in “khỏe” (dip then rise). It's easy to flatten into a ngang tone.",
    "“Thương” ends in “-ương”: round your lips at the end.",
  ],
  nextSteps: [
    "Review the 8 missing words with flashcards; try school vocab first.",
    "Next call, try to describe your week without “study” or “midterm”.",
  ],
  nextScenarioSuggestion: "tell-parents-news",
};
writeFileSync(new URL("./report.call-ba-ngoai.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log("fixtures written");
