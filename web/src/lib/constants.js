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

export { DECK_COLOR_OPTIONS, DEFAULT_DECK_SECTIONS, UNGROUPED_SECTION, PROFESSIONAL_SECTIONS, ANNOTATION_TYPES, CHAPTER_MILESTONE_SECONDS, BUILTIN_DYL_PACK_ID, PIXEL_ITEM_BADGES, REWARD_OPTIONS }
