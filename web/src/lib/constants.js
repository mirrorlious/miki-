const DECK_COLOR_OPTIONS = [
  { value: 'sun', label: '鏆栭粍', cardClass: 'bg-yellow-50/80 border-yellow-100/50', pillClass: 'bg-yellow-100 text-yellow-700' },
  { value: 'sea', label: '娴呰摑', cardClass: 'bg-blue-50/80 border-blue-100/50', pillClass: 'bg-blue-100 text-blue-700' },
  { value: 'rose', label: '娴呯矇', cardClass: 'bg-rose-50/80 border-rose-100/50', pillClass: 'bg-rose-100 text-rose-700' },
  { value: 'mint', label: '钖勮嵎', cardClass: 'bg-emerald-50/80 border-emerald-100/50', pillClass: 'bg-emerald-100 text-emerald-700' },
]

const DEFAULT_DECK_SECTIONS = ['娉曠悊', '瀹硶', '姘戞硶', '鍒戞硶', '娉曞埗鍙?, '鏀挎不', '鑻辫', '瑙勫緥涓撻']
const UNGROUPED_SECTION = '鏈垎缁?
const PROFESSIONAL_SECTIONS = ['娉曠悊', '瀹硶', '姘戞硶', '鍒戞硶', '娉曞埗鍙?]
const ANNOTATION_TYPES = ['鐞嗚В', '鏄撻敊', '鍙ｈ瘈', '娉曟潯', '妗堜緥', '瀵规瘮']
const CHAPTER_MILESTONE_SECONDS = 10 * 60
const BUILTIN_DYL_PACK_ID = 'dyl-exam'
const PIXEL_ITEM_BADGES = {
  card: {
    palette: { d: '#244938', g: '#34c759', l: '#9ff2b1', y: '#f9d96b', w: '#fff7d6' },
    pixels: ['...........', '..ddddddd..', '.dgggggggd.', '.dglgglggd.', '.dgggggggd.', '.dggdddggd.', '.dgggggggd.', '.dglgglggd.', '.dgggggggd.', '..ddddddd..', '...........'],
  },
  calendar: {
    palette: { d: '#23384f', s: '#63b3ed', l: '#d8f3ff', r: '#ff6b6b', w: '#ffffff', y: '#fde047' },
    pixels: ['...........', '...r...r...', '..ddddddd..', '.dsssssssd.', '.dslssslsd.', '.dsssssssd.', '.dsllyllsd.', '.dsssssssd.', '.dsssssssd.', '..ddddddd..', '...........'],
  },
  review: {
    palette: { d: '#4a3424', r: '#ef4444', y: '#fde68a', b: '#38bdf8', w: '#fff7d6' },
    pixels: ['.....d.....', '...ddddd...', '..dwwwwwd..', '.dwwrwwwd..', '.dwwrrwwd..', 'dwwwwywwwd.', '.dwwbbwwd..', '.dwwwbwwd..', '..dwwwwwd..', '...ddddd...', '.....d.....'],
  },
  note: {
    palette: { d: '#4b2f5f', p: '#c084fc', l: '#f3e8ff', y: '#facc15', w: '#ffffff' },
    pixels: ['...........', '..dd...dd..', '.dppdddppd.', '.dpppppppd.', '.dplllpppd.', '.dpppppppd.', '.dplllpppd.', '.dpppppppd.', '.dppdddppd.', '..dd...dd..', '...........'],
  },
  link: {
    palette: { d: '#164e63', c: '#22d3ee', l: '#a5f3fc', w: '#ecfeff' },
    pixels: ['...........', '..dddd.....', '.dccccd....', 'dcc...ccd..', 'dcc...ccd..', '.dccccd....', '...dddd....', '....dccccd.', '..dcc...ccd', '..dcc...ccd', '....dddd...'],
  },
  folder: {
    palette: { d: '#5b3718', b: '#a16207', y: '#fbbf24', l: '#fde68a', k: '#3f2a16' },
    pixels: ['...........', '...ddddd...', '..dyyyyyd..', '.dyyyyyyyd.', '.dllllllld.', '.dbbbbbbbd.', '.dbbbybbbd.', '.dbbbybbbd.', '.dbbbbbbbd.', '..ddddddd..', '...kkkkk...'],
  },
  flame: {
    palette: { d: '#4b1d1d', r: '#ef4444', o: '#f97316', y: '#fde047', b: '#7c2d12' },
    pixels: ['.....r.....', '....ror....', '...royor...', '...royyo...', '..royyyor..', '.droyyyord.', '.droyoyord.', '..dorrodd..', '...dbbbd...', '...dbbbd...', '....ddd....'],
  },
  focus: {
    palette: { d: '#213547', b: '#3b82f6', c: '#93c5fd', w: '#f8fafc', y: '#facc15' },
    pixels: ['..d.....d..', '....ddd....', '...dbbbd...', '..dbbbbbd..', '..dbcbcbd..', '.dbbbbbbbd.', '.dbbbbbbbd.', '..ddddddd..', '..dyyyyd...', '....dyd....', '...........'],
  },
  timer: {
    palette: { d: '#2f2a3f', p: '#a78bfa', l: '#ddd6fe', w: '#ffffff', g: '#34c759' },
    pixels: ['...........', '..ddddddd..', '...dwwwd...', '...dwlwd...', '....dld....', '.....d.....', '....dgd....', '...dglgd...', '...dgggd...', '..ddddddd..', '...........'],
  },
}


const ACHIEVEMENTS = [
  {
    id: 'first-card',
    title: '鐭ヨ瘑缁跨爾',
    description: '閾稿嚭绗?1 鍧楃煡璇嗙爾',
    points: 10,
    icon: 'card',
    color: '#34c759',
    isEarned: (data) => data.cards.length >= 1,
    progress: (data) => `${Math.min(data.cards.length, 1)}/1`,
  },
  {
    id: 'daily-review',
    title: '鏃ュ巻鐭崇',
    description: '鍦ㄤ粖澶╃珛涓嬩竴鍧楀鐩樼煶纰?,
    points: 10,
    icon: 'calendar',
    color: '#007aff',
    isEarned: (data) => Boolean(getDailyLog(data, todayKey())?.content?.trim()),
    progress: (data) => (getDailyLog(data, todayKey())?.content?.trim() ? '1/1' : '0/1'),
  },
  {
    id: 'first-review',
    title: '澶嶄範缃楃洏',
    description: '鐐逛寒绗?1 娆″涔犺瘎鍒?,
    points: 15,
    icon: 'review',
    color: '#ff9f0a',
    isEarned: (data) => getReviewLogs(data).length >= 1,
    progress: (data) => `${Math.min(getReviewLogs(data).length, 1)}/1`,
  },
  {
    id: 'first-note',
    title: '鎵规敞鍗疯酱',
    description: '鍐欎笅绗?1 鏉＄悊瑙ｆ壒娉?,
    points: 10,
    icon: 'note',
    color: '#af52de',
    isEarned: (data) => getCardAnnotationCount(data) >= 1,
    progress: (data) => `${Math.min(getCardAnnotationCount(data), 1)}/1`,
  },
  {
    id: 'first-link',
    title: '绾跨储閿侀摼',
    description: '鎶?2 寮犵浉鍏冲崱鐗囨墸鎴愪竴鐜?,
    points: 15,
    icon: 'link',
    color: '#5ac8fa',
    isEarned: (data) => getLinkedPairCount(data) >= 1,
    progress: (data) => `${Math.min(getLinkedPairCount(data), 1)}/1`,
  },
  {
    id: 'first-folder',
    title: '褰掓。瀹濈',
    description: '鎶?1 涓崱缁勬斁杩涙澘鍧楀疂绠?,
    points: 10,
    icon: 'folder',
    color: '#5856d6',
    isEarned: (data) => data.decks.some((deck) => getDeckSection(deck) !== UNGROUPED_SECTION),
    progress: (data) => `${Math.min(data.decks.filter((deck) => getDeckSection(deck) !== UNGROUPED_SECTION).length, 1)}/1`,
  },
  {
    id: 'three-days',
    title: '涓夋棩钀ョ伀',
    description: '杩炵画鐐硅捣 3 澶╁涔犵伀鍏?,
    points: 20,
    icon: 'flame',
    color: '#ff3b30',
    isEarned: (data) => getActiveStudyDays(data).length >= 3,
    progress: (data) => `${Math.min(getActiveStudyDays(data).length, 3)}/3`,
  },
  {
    id: 'first-focus',
    title: '涓撴敞鍒濆搷',
    description: '寮€鍚 1 娆″涔犱笓娉?,
    points: 10,
    icon: 'focus',
    color: '#007aff',
    isEarned: (data) => getActivity(data).focusSessions >= 1,
    progress: (data) => `${Math.min(getActivity(data).focusSessions, 1)}/1`,
  },
  {
    id: 'chapter-clock',
    title: '绔犺妭娌欐紡',
    description: '浠讳竴绔犺妭绱瀛︿範 10 鍒嗛挓',
    points: 20,
    icon: 'timer',
    color: '#af52de',
    isEarned: (data) => getTopChapterTimeRows(data, 1).some((row) => row.seconds >= CHAPTER_MILESTONE_SECONDS),
    progress: (data) => `${Math.min(Math.floor((getTopChapterTimeRows(data, 1)[0]?.seconds ?? 0) / 60), 10)}/10 鍒嗛挓`,
  },
]

const REWARD_OPTIONS = [
  {
    id: 'focus-pass',
    title: '涓撴敞閫氳璇?,
    description: '缁欎粖澶╃殑瀛︿範椤佃В閿佷竴鏋氫笓娉ㄥ窘绔犮€?,
    cost: 20,
    badge: 'Focus',
  },
  {
    id: 'profile-frame',
    title: '瀛︿範璐寸焊',
    description: '鍦ㄤ釜浜洪〉鏍囪涓€鏋氬凡鍏戞崲瀛︿範璐寸焊銆?,
    cost: 40,
    badge: 'Sticker',
  },
  {
    id: 'vip-week',
    title: '浼氬憳浣撻獙鍒?,
    description: '棰勭暀缁欏悗缁珮绾у姛鑳界殑 7 澶╀綋楠岃祫鏍笺€?,
    cost: 80,
    badge: 'VIP',
  },
]

export { DECK_COLOR_OPTIONS, DEFAULT_DECK_SECTIONS, UNGROUPED_SECTION, PROFESSIONAL_SECTIONS, ANNOTATION_TYPES, CHAPTER_MILESTONE_SECONDS, BUILTIN_DYL_PACK_ID, PIXEL_ITEM_BADGES, ACHIEVEMENTS, REWARD_OPTIONS }
