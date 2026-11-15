// Vetted English → Vietnamese glossary for words heritage learners commonly reach for.
// Single source of truth for BOTH the ElevenLabs agent prompt (scripts/sync-agent.ts injects it)
// and the Gemini analysis (server/src/gemini.ts), so the voice and the on-screen chips agree.
//
// Line format:  english | variants = Southern Vietnamese [~ Northern variant] [# short English note] [!]
// A trailing "!" marks a word whose meaning depends on context: it is only a hint for the model,
// never auto-translated.

const RAW = `
# --- school & work ---
school = trường # "đi học" = go to school !
class | classes = lớp học
homework = bài tập về nhà # often shortened to "bài tập"
midterm | midterms = bài thi giữa kỳ # or just "thi giữa kỳ"
finals | final exam | final exams = bài thi cuối kỳ
exam | exams = bài thi
test | tests = bài kiểm tra
quiz | quizzes = bài kiểm tra ngắn
grade | grades = điểm
study | studying | studied = học # "học bài" = study for class
teacher | teachers = thầy cô
professor | professors = giáo sư
college | university = đại học
major = ngành học !
graduate | graduating | graduated | graduation = tốt nghiệp
semester = học kỳ
quarter = học kỳ !
scholarship = học bổng
tuition = học phí
group project = bài tập nhóm
project | projects = dự án
presentation = bài thuyết trình
essay | essays = bài luận
library = thư viện
dorm | dorms = ký túc xá
math = toán
science = khoa học
history = lịch sử
internship = thực tập # as a noun: "kỳ thực tập" !
intern = thực tập sinh
job = việc làm
job interview = phỏng vấn xin việc
interview = phỏng vấn
boss = sếp
coworker | coworkers | colleague | colleagues = đồng nghiệp
teammate | teammates = bạn cùng nhóm
meeting | meetings = cuộc họp
salary = lương
tech company = công ty công nghệ
company = công ty
office = văn phòng
busy = bận
deadline = hạn chót # many speakers just say "deadline"
promotion = thăng chức
day off = ngày nghỉ
vacation = kỳ nghỉ # "đi chơi" = go on vacation !
weekend = cuối tuần
software engineer = kỹ sư phần mềm
engineer = kỹ sư
nurse = y tá
lazy = làm biếng ~ lười
hardworking = siêng năng ~ chăm chỉ
smart = thông minh
difficult | hard = khó !
easy = dễ

# --- feelings & health ---
stressed | stress | stressful | stressed out = căng thẳng
tired = mệt
exhausted = kiệt sức
nervous = hồi hộp
worried | worry | worrying = lo
excited = háo hức
happy = vui
sad = buồn
angry | mad = giận
scared | afraid = sợ
bored | boring = chán
proud = tự hào
lonely = cô đơn
homesick = nhớ nhà
sick = bệnh ~ ốm
headache = nhức đầu ~ đau đầu
stomachache = đau bụng
a cold = cảm
fever = sốt
cough | coughing = ho
medicine = thuốc
doctor = bác sĩ
hospital = bệnh viện
dentist = nha sĩ
appointment = lịch hẹn
allergic | allergy | allergies = dị ứng
healthy = khỏe mạnh
exercise | work out | working out = tập thể dục
gym = phòng tập
nap = ngủ trưa
stay up late | staying up late = thức khuya

# --- food & restaurant ---
breakfast = bữa sáng
lunch = bữa trưa
dinner = bữa tối
snack | snacks = đồ ăn vặt
hungry = đói bụng
thirsty = khát nước
delicious | yummy = ngon
spicy = cay
sweet = ngọt !
salty = mặn
sour = chua
bitter = đắng
fried chicken = gà chiên ~ gà rán
fried rice = cơm chiên ~ cơm rang
chicken rice = cơm gà
chicken = gà
beef = thịt bò
pork = thịt heo ~ thịt lợn
fish = cá
shrimp = tôm
egg | eggs = trứng # Southern speakers also say "hột gà"
rice = cơm
noodles = mì !
soup = canh !
vegetables | veggies = rau
fruit | fruits = trái cây ~ hoa quả
spring rolls = gỏi cuốn
egg rolls = chả giò ~ nem rán
herbs = rau thơm
bean sprouts = giá ~ giá đỗ
cilantro = ngò ~ rau mùi
basil = húng quế
onion | onions = hành
garlic = tỏi
lime = chanh
chili | chili pepper | chili peppers = ớt
fish sauce = nước mắm
soy sauce = nước tương ~ xì dầu
hot sauce = tương ớt
peanut | peanuts = đậu phộng ~ lạc
meatball | meatballs = bò viên
rare beef = tái
brisket = gầu
iced tea = trà đá
iced coffee with milk | iced coffee với milk | iced coffee với sữa | iced milk coffee = cà phê sữa đá
iced coffee = cà phê đá
coffee = cà phê
milk = sữa
milk tea | bubble tea | boba = trà sữa
water = nước
ice = đá !
bowl | bowls = tô ~ bát
plate | plates = dĩa ~ đĩa
spoon = muỗng ~ thìa
fork = nĩa ~ dĩa
chopsticks = đũa
cup | glass = ly ~ cốc !
large size | large = lớn ~ to
small size | small = nhỏ
medium size | medium = vừa !
extra = thêm
to-go box | to go box | takeout box = hộp mang về
to-go | to go | takeout | take out = mang về
the check | the bill = tính tiền
check = tính tiền !
tip = tiền boa !
menu = thực đơn # many speakers just say "menu"
order | ordering = gọi món !
restaurant = nhà hàng
cook | cooking | cooked = nấu ăn !
grocery shopping = đi chợ
groceries = đồ ăn !
grocery store | supermarket = siêu thị
vegetarian = ăn chay !
leftovers = đồ ăn dư ~ đồ ăn thừa

# --- family & people ---
best friend | best friends = bạn thân
friend | friends = bạn
boyfriend = bạn trai
girlfriend = bạn gái
roommate | roommates = bạn cùng phòng
neighbor | neighbors = hàng xóm
cousin | cousins = anh chị em họ
family = gia đình
relatives = bà con ~ họ hàng
wedding = đám cưới
birthday = sinh nhật
party = bữa tiệc
gift | gifts | present | presents = quà !
visit | visiting = thăm
hug = ôm
text | texting | texted = nhắn tin !
call | calling | called = gọi điện !
baby = em bé
kids | children = con nít ~ trẻ con
Thanksgiving = Lễ Tạ Ơn
Christmas = Giáng Sinh
Lunar New Year = Tết
holiday | holidays = ngày lễ
church = nhà thờ
temple = chùa

# --- daily life ---
apartment = căn hộ # the building is "chung cư"
housing = chỗ ở
city = thành phố
room = phòng
kitchen = nhà bếp
bathroom | restroom = nhà vệ sinh
garden = vườn
move | moving | moved = dọn nhà ~ chuyển nhà !
rent = tiền thuê nhà !
laundry = giặt đồ ~ giặt quần áo !
clean | cleaning = dọn dẹp !
dishes = rửa chén ~ rửa bát !
trash = rác
car = xe hơi ~ ô tô
drive | driving | drove = lái xe
traffic = kẹt xe ~ tắc đường
parking = chỗ đậu xe ~ chỗ đỗ xe
bus = xe buýt
airport = sân bay
flight = chuyến bay
ticket | tickets = vé
late = trễ ~ muộn
early = sớm
today = hôm nay
tomorrow = ngày mai
yesterday = hôm qua
next week = tuần sau
last week = tuần trước
this week = tuần này
next month = tháng sau
next year = năm sau
morning = buổi sáng !
afternoon = buổi chiều !
evening = buổi tối !
summer = mùa hè
winter = mùa đông
weather = thời tiết
rain | raining | rainy = mưa
money = tiền
expensive = mắc ~ đắt
cheap = rẻ
shopping = mua sắm
store = tiệm ~ cửa hàng
phone = điện thoại
computer = máy tính
movie | movies = phim
music = nhạc
song | songs = bài hát
game | games = trò chơi !
book | books = sách !
dog = chó
cat = mèo
fun = vui
help | helping = giúp # Southern speakers also say "phụ" for chores
because = tại vì
but = nhưng mà
maybe = chắc là
actually = thật ra
usually = thường
sometimes = đôi khi
always = luôn luôn
never = không bao giờ
also = cũng
understand = hiểu
remember = nhớ
forget | forgot = quên
try | trying = ráng ~ cố gắng !
hope = hy vọng
promise = hứa
sorry = xin lỗi
thank you | thanks = cảm ơn
congratulations | congrats = chúc mừng
good luck = chúc may mắn
goodbye | bye = chào # to elders: "con chào" + their title !
`;

export interface GlossaryEntry {
  /** English forms, lowercased; the first is the headword. */
  en: string[];
  /** Southern Vietnamese (default). */
  vi: string;
  /** Northern variant, when it differs. */
  north?: string;
  /** Short usage note, in English. */
  note?: string;
  /** Meaning depends on context: hint only, never auto-translate. */
  ambiguous?: boolean;
}

export const GLOSSARY: GlossaryEntry[] = RAW.split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((line) => {
    const ambiguous = line.endsWith("!");
    const body = ambiguous ? line.slice(0, -1).trim() : line;
    const eq = body.indexOf(" = ");
    const left = body.slice(0, eq);
    const right = body.slice(eq + 3);
    const hash = right.indexOf(" # ");
    const beforeNote = hash < 0 ? right : right.slice(0, hash);
    const note = hash < 0 ? undefined : right.slice(hash + 3);
    const [vi, north] = beforeNote.split(" ~ ");
    const e: GlossaryEntry = { en: left.split("|").map((s) => s.trim().toLowerCase()), vi: vi.trim() };
    if (north) e.north = north.trim();
    if (note) e.note = note.trim();
    if (ambiguous) e.ambiguous = true;
    return e;
  });

export interface GlossaryMatch {
  entry: GlossaryEntry;
  /** Exact substring of the text. */
  english: string;
  start: number;
  end: number;
}

const FORMS = GLOSSARY.flatMap((entry) => entry.en.map((form) => ({ form, entry }))).sort((a, b) => b.form.length - a.form.length);
const isLetter = (ch: string | undefined) => !!ch && /[\p{L}\p{M}]/u.test(ch);

/** Find glossary phrases in a text: case-insensitive, whole words, longest match first, no overlaps. */
export function matchGlossary(text: string): GlossaryMatch[] {
  const lower = text.toLowerCase();
  if (lower.length !== text.length) return []; // case-folding changed offsets; skip (never for Vietnamese/English)
  const out: GlossaryMatch[] = [];
  for (const { form, entry } of FORMS) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(form, from);
      if (i < 0) break;
      const end = i + form.length;
      from = i + 1;
      if (isLetter(lower[i - 1]) || isLetter(lower[end])) continue;
      if (out.some((m) => i < m.end && end > m.start)) continue;
      out.push({ entry, english: text.slice(i, end), start: i, end });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** "fried chicken = gà chiên (North: gà rán)" lines, for prompts. */
export const glossaryLine = (e: GlossaryEntry) =>
  `${e.en[0]} = ${e.vi}${e.north ? ` (North: ${e.north})` : ""}${e.note ? ` [${e.note}]` : ""}`;

/** Chip note for a glossary entry. */
export const glossaryNote = (e: GlossaryEntry) =>
  [e.north ? `Northern: ${e.north}` : "", e.note ?? ""].filter(Boolean).join("; ") || undefined;
