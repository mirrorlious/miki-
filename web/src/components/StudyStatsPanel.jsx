import React, { useMemo } from 'react';

const STAT_ITEMS = [
  {
    key: 'round',
    label: '本轮复习',
    getValue: (p) => p.reviewed ?? 0,
    getDetail: (p) => (p.sessionTotal ? `进度 ${p.progressPercent}%` : '尚未开始'),
    iconColor: 'text-indigo-500',
    iconBg: 'bg-indigo-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    )
  },
  {
    key: 'due',
    label: '即将到期',
    getValue: (p) => p.dueCount ?? 0,
    getDetail: (p) => (p.isDrill ? '抽背中' : '等待队列'),
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    key: 'learned',
    label: '已学卡片',
    getValue: (p) => p.reviewedCount ?? 0,
    getDetail: (p) => `含 ${p.newCardCount ?? 0} 张新卡`,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    key: 'stable',
    label: '稳固记忆',
    getValue: (p) => p.masteredCount ?? 0,
    getDetail: () => '间隔 7 天+',
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    )
  },
];

const generateMockHeatmapData = () => {
  const data = [];
  const today = new Date();
  for (let i = 0; i < 84; i++) { 
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 15), 
    });
  }
  return data.reverse();
};

export default function StudyStatsPanel({
  reviewed, dueCount, isDrill, progressPercent,
  reviewedCount, newCardCount, masteredCount, sessionTotal,
}) {
  const props = { reviewed, dueCount, isDrill, progressPercent, reviewedCount, newCardCount, masteredCount, sessionTotal };
  
  const heatmapData = useMemo(() => generateMockHeatmapData(), []);
  const getColorIntensity = (count) => {
    if (count === 0) return 'bg-slate-100'; 
    if (count < 3) return 'bg-emerald-200';
    if (count < 7) return 'bg-emerald-300';
    if (count < 12) return 'bg-emerald-400';
    return 'bg-emerald-500'; 
  };

  return (
    <section className="mb-6 bg-white rounded-[1.25rem] border border-slate-200 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
      
      {/* 核心改动：摒弃 lg 媒体查询，使用 flex-wrap 让它具备容器感知能力 */}
      <div className="flex flex-wrap">
        
        {/* 左侧：4个核心数据面板。设定 basis-[320px] 保证它的最小健康可读宽度 */}
        <div className="flex-[3] basis-[320px] min-w-[280px] p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-slate-800 tracking-wide">学习概览</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-x-3 gap-y-6">
            {STAT_ITEMS.map((item) => (
              <div key={item.key} className="flex flex-col min-w-0"> {/* min-w-0 防止 flex 子项被撑爆 */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-md ${item.iconBg} ${item.iconColor} shrink-0`}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-semibold text-slate-500 truncate">{item.label}</span>
                </div>
                
                <div className="flex items-baseline gap-2">
                  <h4 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight truncate">
                    {item.getValue(props)}
                  </h4>
                </div>
                
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                  {item.getDetail(props)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：热力图。去掉了死板的宽度，完全靠背景色区分边界，空间不够会自动掉到第二行 */}
        <div className="flex-[2] basis-[280px] min-w-[280px] p-5 lg:p-6 bg-slate-50/70 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-sm font-bold text-slate-800 tracking-wide">近12周趋势</h2>
             <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-full shrink-0">
               持续记录
             </span>
          </div>
          
          <div className="flex flex-col gap-2">
            {/* 加入了 w-full 和 overflow-x-auto，如果容器真的被压缩到了极限，热力图内部可横向滑动，绝不挤压变形 */}
            <div className="w-full overflow-x-auto pb-1 scrollbar-hide">
              <div className="grid grid-rows-7 grid-flow-col gap-1 w-max">
                {heatmapData.map((day, index) => (
                  <div
                    key={index}
                    className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[2px] ${getColorIntensity(day.count)} transition-all hover:scale-125 cursor-pointer`}
                    title={`${day.date}: ${day.count} 次`}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-1">
              <span className="text-[10px] text-slate-400 font-medium">{heatmapData[0]?.date.slice(5)}</span>
              <div className="flex items-center gap-1.5 opacity-80 shrink-0">
                <span className="text-[9px] text-slate-400">少</span>
                <div className="flex gap-[2px]">
                  <div className="w-2 h-2 rounded-[1px] bg-slate-100"></div>
                  <div className="w-2 h-2 rounded-[1px] bg-emerald-200"></div>
                  <div className="w-2 h-2 rounded-[1px] bg-emerald-300"></div>
                  <div className="w-2 h-2 rounded-[1px] bg-emerald-400"></div>
                  <div className="w-2 h-2 rounded-[1px] bg-emerald-500"></div>
                </div>
                <span className="text-[9px] text-slate-400">多</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}