import type { Scenario } from "./types";

// Rehearsal scenarios. Passed to the ElevenLabs agent as dynamic variables (see agent/prompt.md).
export const SCENARIOS: Scenario[] = [
  {
    id: "call-ba-ngoai",
    title: "Weekly call with Grandma",
    titleVi: "Gọi điện cho Bà Ngoại",
    description: "Catch up with Bà Ngoại: school, food, and when you're visiting next.",
    persona: "Bà Ngoại (maternal grandmother), 78, from Sài Gòn, speaks Southern Vietnamese, warm, a little hard of hearing, loves to ask if you've eaten",
    agentCallsUser: "con",
    userCallsAgent: "Bà / Ngoại",
    firstMessage: "Alô, con hả? Ngoại nè! Con ăn cơm chưa?",
    situation:
      "Weekly phone call. Ask whether they have eaten, how school is going, whether they are sleeping enough, and when they will visit. Share a small update about your garden.",
    targetVocab: [
      { vi: "ăn cơm", en: "eat (a meal)" },
      { vi: "trường", en: "school" },
      { vi: "bài kiểm tra", en: "test / exam" },
      { vi: "nhớ", en: "miss (someone)" },
      { vi: "về thăm", en: "come back to visit" },
    ],
  },
  {
    id: "order-pho",
    title: "Ordering at the phở shop",
    titleVi: "Gọi món ở tiệm phở",
    description: "Order for your family at a phở restaurant where the owner only speaks Vietnamese.",
    persona: "Cô Lan, owner of a busy phở restaurant, 50s, friendly and quick, Southern Vietnamese",
    agentCallsUser: "con",
    userCallsAgent: "Cô",
    firstMessage: "Chào con! Mấy người? Con ăn gì nè?",
    situation:
      "The user is ordering for their family of four. Ask about size (nhỏ/lớn), meat (tái, chín, gầu, bò viên), drinks, and whether they want extra herbs. End with the bill.",
    targetVocab: [
      { vi: "tô lớn / tô nhỏ", en: "large / small bowl" },
      { vi: "tái", en: "rare beef" },
      { vi: "rau thơm", en: "herbs" },
      { vi: "trà đá", en: "iced tea" },
      { vi: "tính tiền", en: "the check, please" },
    ],
  },
  {
    id: "tell-parents-news",
    title: "Telling Mẹ about your new job",
    titleVi: "Kể cho Mẹ nghe về việc làm mới",
    description: "Share good news about an internship offer and answer Mẹ's many questions.",
    persona: "Mẹ (mom), 52, proud but worried, asks practical questions about pay, location, and food",
    agentCallsUser: "con",
    userCallsAgent: "Mẹ",
    firstMessage: "Con về rồi hả? Sao hôm nay con vui vậy?",
    situation:
      "The user just got an internship offer in another city. Mẹ asks where it is, how much it pays, where they will live, whether they will eat well, and when they will come home.",
    targetVocab: [
      { vi: "thực tập", en: "internship" },
      { vi: "công ty", en: "company" },
      { vi: "lương", en: "salary" },
      { vi: "thành phố", en: "city" },
      { vi: "lo", en: "to worry" },
    ],
  },
];

export const getScenario = (id: string) => SCENARIOS.find((s) => s.id === id);
