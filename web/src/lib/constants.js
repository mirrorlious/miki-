const DECK_COLOR_OPTIONS = [
  { value: 'sun', label: '暖黄', cardClass: 'bg-yellow-50/80 border-yellow-100/50', pillClass: 'bg-yellow-100 text-yellow-700' },
  { value: 'sea', label: '浅蓝', cardClass: 'bg-blue-50/80 border-blue-100/50', pillClass: 'bg-blue-100 text-blue-700' },
  { value: 'rose', label: '浅粉', cardClass: 'bg-rose-50/80 border-rose-100/50', pillClass: 'bg-rose-100 text-rose-700' },
  { value: 'mint', label: '薄荷', cardClass: 'bg-emerald-50/80 border-emerald-100/50', pillClass: 'bg-emerald-100 text-emerald-700' },
]

const DEFAULT_DECK_SECTIONS = ['法理', '宪法', '民法', '刑法', '法制史', '政治', '英语', '规律专题']
const UNGROUPED_SECTION = '未分组'
const PROFESSIONAL_SECTIONS = ['法理', '宪法', '民法', '刑法', '法制史']
const ANNOTATION_TYPES = ['理解', '易错', '口诀', '法条', '案例', '对比']
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
    title: '知识绿砖',
    description: '铸出第 1 块知识砖',
    points: 10,
    icon: 'card',
    color: '#34c759',
    isEarned: (data) => data.cards.length >= 1,
    progress: (data) => `${Math.min(data.cards.length, 1)}/1`,
  },
  {
    id: 'daily-review',
    title: '日历石碑',
    description: '在今天立下一块复盘石碑',
    points: 10,
    icon: 'calendar',
    color: '#007aff',
    isEarned: (data) => Boolean(getDailyLog(data, todayKey())?.content?.trim()),
    progress: (data) => (getDailyLog(data, todayKey())?.content?.trim() ? '1/1' : '0/1'),
  },
  {
    id: 'first-review',
    title: '复习罗盘',
    description: '点亮第 1 次复习评分',
    points: 15,
    icon: 'review',
    color: '#ff9f0a',
    isEarned: (data) => getReviewLogs(data).length >= 1,
    progress: (data) => `${Math.min(getReviewLogs(data).length, 1)}/1`,
  },
  {
    id: 'first-note',
    title: '批注卷轴',
    description: '写下第 1 条理解批注',
    points: 10,
    icon: 'note',
    color: '#af52de',
    isEarned: (data) => getCardAnnotationCount(data) >= 1,
    progress: (data) => `${Math.min(getCardAnnotationCount(data), 1)}/1`,
  },
  {
    id: 'first-link',
    title: '线索锁链',
    description: '把 2 张相关卡片扣成一环',
    points: 15,
    icon: 'link',
    color: '#5ac8fa',
    isEarned: (data) => getLinkedPairCount(data) >= 1,
    progress: (data) => `${Math.min(getLinkedPairCount(data), 1)}/1`,
  },
  {
    id: 'first-folder',
    title: '归档宝箱',
    description: '把 1 个卡组放进板块宝箱',
    points: 10,
    icon: 'folder',
    color: '#5856d6',
    isEarned: (data) => data.decks.some((deck) => getDeckSection(deck) !== UNGROUPED_SECTION),
    progress: (data) => `${Math.min(data.decks.filter((deck) => getDeckSection(deck) !== UNGROUPED_SECTION).length, 1)}/1`,
  },
  {
    id: 'three-days',
    title: '三日营火',
    description: '连续点起 3 天学习火光',
    points: 20,
    icon: 'flame',
    color: '#ff3b30',
    isEarned: (data) => getActiveStudyDays(data).length >= 3,
    progress: (data) => `${Math.min(getActiveStudyDays(data).length, 3)}/3`,
  },
  {
    id: 'first-focus',
    title: '专注初响',
    description: '开启第 1 次学习专注',
    points: 10,
    icon: 'focus',
    color: '#007aff',
    isEarned: (data) => getActivity(data).focusSessions >= 1,
    progress: (data) => `${Math.min(getActivity(data).focusSessions, 1)}/1`,
  },
  {
    id: 'chapter-clock',
    title: '章节沙漏',
    description: '任一章节累计学习 10 分钟',
    points: 20,
    icon: 'timer',
    color: '#af52de',
    isEarned: (data) => getTopChapterTimeRows(data, 1).some((row) => row.seconds >= CHAPTER_MILESTONE_SECONDS),
    progress: (data) => `${Math.min(Math.floor((getTopChapterTimeRows(data, 1)[0]?.seconds ?? 0) / 60), 10)}/10 分钟`,
  },
]

const REWARD_OPTIONS = [
  {
    id: 'focus-pass',
    title: '专注通行证',
    description: '给今天的学习页解锁一枚专注徽章。',
    cost: 20,
    badge: 'Focus',
  },
  {
    id: 'profile-frame',
    title: '学习贴纸',
    description: '在个人页标记一枚已兑换学习贴纸。',
    cost: 40,
    badge: 'Sticker',
  },
  {
    id: 'vip-week',
    title: '会员体验券',
    description: '预留给后续高级功能的 7 天体验资格。',
    cost: 80,
    badge: 'VIP',
  },
]

export { DECK_COLOR_OPTIONS, DEFAULT_DECK_SECTIONS, UNGROUPED_SECTION, PROFESSIONAL_SECTIONS, ANNOTATION_TYPES, CHAPTER_MILESTONE_SECONDS, BUILTIN_DYL_PACK_ID, PIXEL_ITEM_BADGES, ACHIEVEMENTS, REWARD_OPTIONS }
