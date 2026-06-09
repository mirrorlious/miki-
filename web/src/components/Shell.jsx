import { useState, useContext } from 'react'
import { Link } from 'react-router-dom'
import { Layers3, Sun, Moon, Maximize2, Cloud, CloudOff, LogIn, LogOut, LayoutDashboard, AlignLeft, FolderOpen, Target, User, GitBranch, BookOpen, X } from 'lucide-react'
import { stats, STORAGE_KEY } from '../data.js'
import { ThemeContext } from '../lib/theme.js'
import { getProfile } from '../lib/profile.js'
import ToolbarButton from './ToolbarButton.jsx'
import AuthDialog from './AuthDialog.jsx'
import WebChoiceBank from './WebChoiceBank.jsx'

const SHELL_WIDTH_STORAGE_KEY = `${STORAGE_KEY}:shellWidth`

function formatSyncTime(timestamp) {
  if (!timestamp) return '尚未同步'
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function formatCompactSyncTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Shell({ children, data, cloud, studyDeckId, wide = false }) {
  const { theme, toggleTheme } = useContext(ThemeContext)
  const summary = stats(data)
  const firstDeckId = studyDeckId ?? data.decks[0]?.id
  const latestSyncAt = cloud.lastWriteAt ?? cloud.lastReadAt ?? cloud.lastSyncedAt
  const syncLabel = !cloud.enabled
    ? '本地'
    : !cloud.user
      ? '待登录'
      : cloud.syncState === 'error'
        ? '失败'
        : cloud.syncState === 'connecting'
          ? '连接'
          : '同步'
  const syncTimeLabel = cloud.enabled && cloud.user
    ? (latestSyncAt ? formatCompactSyncTime(latestSyncAt) : '--:--')
    : ''
  const syncTitle = [
    cloud.message,
    cloud.lastWriteAt ? `上次写入：${formatSyncTime(cloud.lastWriteAt)}` : '',
    cloud.lastReadAt ? `上次读取：${formatSyncTime(cloud.lastReadAt)}` : '',
    cloud.lastErrorMessage ? `错误：${cloud.lastErrorMessage}` : '',
  ].filter(Boolean).join('\n')
  const syncIconClass = cloud.syncState === 'error'
    ? 'text-red-500'
    : cloud.user
      ? 'text-[#34c759]'
      : 'text-gray-300'
  const syncPillClass = cloud.syncState === 'error'
    ? 'bg-red-50 text-red-600 hover:bg-red-50'
    : cloud.user
      ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
      : 'bg-gray-50 text-gray-400'
  const profile = getProfile(data, cloud)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [choiceBankOpen, setChoiceBankOpen] = useState(false)
  const [shellWidth, setShellWidth] = useState(() => {
    try { return localStorage.getItem(SHELL_WIDTH_STORAGE_KEY) || (wide ? 'wide' : 'normal') }
    catch { return wide ? 'wide' : 'normal' }
  })
  const isDarkTheme = theme === 'dark'

  const navItems = [
    { to: '/decks', icon: LayoutDashboard, label: '卡组' },
    { to: '/browse', icon: AlignLeft, label: '浏览', disabled: !firstDeckId },
    { to: '/map', icon: GitBranch, label: '图谱', disabled: !firstDeckId },
    { to: '/organize', icon: FolderOpen, label: '整理', disabled: !firstDeckId },
    { to: '/app', icon: Target, label: '统计' },
    { to: '/profile', icon: User, label: '个人' },
  ]

  function openAuthDialog() {
    cloud.onClearAuthError?.()
    setAuthDialogOpen(true)
  }

  function cycleShellWidth() {
    const presets = wide ? ['narrow', 'wide', 'full'] : ['narrow', 'normal', 'full']
    const idx = presets.indexOf(shellWidth)
    const next = presets[(idx + 1) % presets.length]
    setShellWidth(next)
    try { localStorage.setItem(SHELL_WIDTH_STORAGE_KEY, next) } catch {}
  }

  const syncBusy = cloud.syncState === 'syncing' || cloud.syncState === 'connecting'
  const canOpenChoiceBank = Boolean(cloud.user)

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f5f5f7] text-gray-950 font-sans">
      <AuthDialog open={authDialogOpen} cloud={cloud} onClose={() => setAuthDialogOpen(false)} />
      <header className="sticky top-0 z-40 border-b border-white/70 bg-[#f5f5f7]/90 backdrop-blur-xl">
        <div className={`mx-auto flex w-full max-w-full ${shellWidth === 'narrow' ? 'sm:max-w-5xl' : shellWidth === 'full' ? 'sm:max-w-none' : (wide ? 'sm:max-w-[1400px]' : 'sm:max-w-6xl')} items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-5`}>
          <Link to="/decks" className="flex items-center gap-3 text-sm font-black text-gray-950">
            <span className="brand-logo" aria-label="mik!">
              <span className="brand-letter brand-letter-m">m</span>
              <span className="brand-letter brand-letter-i">i</span>
              <span className="brand-letter brand-letter-k">k</span>
              <span className="brand-letter brand-letter-bang">!</span>
            </span>
            <span>
              <span className="brand-word" aria-label="mik!">
                <span className="brand-letter brand-letter-m">m</span>
                <span className="brand-letter brand-letter-i">i</span>
                <span className="brand-letter brand-letter-k">k</span>
                <span className="brand-letter brand-letter-bang">!</span>
              </span>
              <span className="hidden sm:block text-[11px] font-semibold text-gray-400 leading-tight">Spaced repetition desk</span>
            </span>
          </Link>

          <nav className="hidden h-11 rounded-xl bg-gray-200/70 p-1 lg:flex items-center gap-1">
            {navItems.map((item) => (
              <ToolbarButton key={item.to} to={item.disabled ? '/decks' : item.to} icon={item.icon} label={item.label} disabled={item.disabled} />
            ))}
            {canOpenChoiceBank && (
              <button
                type="button"
                onClick={() => setChoiceBankOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black text-gray-600 transition-colors hover:bg-white hover:text-[#007aff]"
                title="打开内置网站版选择题库"
              >
                <BookOpen size={15} />
                题库
              </button>
            )}
          </nav>

          <div className="flex min-w-0 shrink items-center justify-end gap-1 text-xs text-gray-500 sm:gap-2">
            <div className="flex min-w-0 items-center gap-1 rounded-2xl bg-white/85 px-1.5 py-1 shadow-sm ring-1 ring-white/80">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2 text-[11px] font-black text-gray-700" title={`今日待复习 ${summary.dueToday} 张`}>
                <Layers3 size={13} className="text-gray-400" />
                <span className="hidden sm:inline">待复习</span>
                <span>{summary.dueToday}</span>
              </span>
              {canOpenChoiceBank && (
                <button
                  type="button"
                  onClick={() => setChoiceBankOpen(true)}
                  title="内置题库"
                  className="grid h-8 w-8 place-items-center rounded-xl text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 lg:hidden"
                >
                  <BookOpen size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                title={isDarkTheme ? '切换到浅色' : '切换到深色'}
                aria-label={isDarkTheme ? '切换到浅色' : '切换到深色'}
                className="grid h-8 w-8 place-items-center rounded-xl text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                {isDarkTheme ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <button
                type="button"
                onClick={cycleShellWidth}
                title={`宽度：${shellWidth === 'narrow' ? '窄' : shellWidth === 'full' ? '全宽' : '默认'} → 点此切换`}
                className="grid h-8 w-8 place-items-center rounded-xl text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <Maximize2 size={14} />
              </button>
            {cloud.enabled && cloud.user ? (
              <button
                type="button"
                onClick={cloud.onManualSync}
                disabled={syncBusy}
                title={syncTitle}
                className={`grid h-8 w-[74px] grid-cols-[14px_1fr] items-center gap-1.5 rounded-xl px-2 text-[11px] font-black transition-colors disabled:cursor-wait disabled:opacity-70 sm:w-[94px] sm:grid-cols-[14px_1fr_auto] ${syncPillClass}`}
              >
                <Cloud size={14} className={syncIconClass} />
                <span className="whitespace-nowrap">{syncLabel}</span>
                <span className="hidden font-mono text-[10px] font-black tabular-nums text-gray-400 sm:inline">{syncTimeLabel}</span>
              </button>
            ) : (
              <span className={`grid h-8 w-[78px] grid-cols-[14px_1fr] items-center gap-1.5 rounded-xl px-2 text-[11px] font-black ${syncPillClass}`} title={syncTitle || cloud.message}>
                {cloud.enabled ? <Cloud size={14} className={syncIconClass} /> : <CloudOff size={14} className={syncIconClass} />}
                <span className="whitespace-nowrap">{syncLabel}</span>
              </span>
            )}
            <Link to="/profile" className="flex h-8 max-w-[64px] min-w-[34px] items-center rounded-xl px-2 transition-colors hover:bg-gray-50 sm:max-w-[104px] sm:min-w-[48px]" title={profile.nickname}>
              <span className="block truncate text-[11px] font-black text-gray-800">{profile.nickname}</span>
            </Link>
            {cloud.enabled && !cloud.user && (
              <button type="button" onClick={openAuthDialog} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2 text-[11px] font-black text-gray-700 transition-colors hover:bg-gray-50">
                <LogIn size={13} /> 登录
              </button>
            )}
            {cloud.enabled && cloud.user && (
              <button type="button" onClick={cloud.onSignOut} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2 text-[11px] font-black text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900" title={`退出 ${cloud.accountLabel}`}>
                <LogOut size={13} />
                <span className="hidden xl:inline">退出</span>
              </button>
            )}
            </div>
            {latestSyncAt && <span className="sr-only">最近同步 {formatSyncTime(latestSyncAt)}</span>}
          </div>
        </div>

        <nav className={`mx-auto flex w-full max-w-full ${shellWidth === 'narrow' ? 'sm:max-w-5xl' : shellWidth === 'full' ? 'sm:max-w-none' : (wide ? 'sm:max-w-[1400px]' : 'sm:max-w-6xl')} gap-2 overflow-x-auto px-4 pb-3 sm:px-5 lg:hidden`}>
          {navItems.map((item) => (
            <ToolbarButton key={item.to} to={item.disabled ? '/decks' : item.to} icon={item.icon} label={item.label} disabled={item.disabled} />
          ))}
          {canOpenChoiceBank && (
            <button
              type="button"
              onClick={() => setChoiceBankOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-black text-blue-600 shadow-sm ring-1 ring-white/80"
            >
              <BookOpen size={14} /> 题库
            </button>
          )}
        </nav>
      </header>

      <main data-shell-width={shellWidth} className={`shell-main mx-auto w-full max-w-full overflow-x-hidden ${shellWidth === 'narrow' ? 'sm:max-w-5xl' : shellWidth === 'full' ? 'sm:max-w-none' : (wide ? 'sm:max-w-[1400px]' : 'sm:max-w-6xl')} px-4 py-5 sm:px-5 sm:py-6`}>
        {children}
      </main>

      {choiceBankOpen && canOpenChoiceBank && (
        <div className="fixed inset-0 z-[80] bg-gray-950/30 p-2 backdrop-blur-sm sm:p-4" onClick={() => setChoiceBankOpen(false)}>
          <section className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-[28px] bg-[#f5f5f7] shadow-2xl ring-1 ring-white/60" onClick={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-white/80 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-5">
              <div>
                <p className="text-xs font-black text-blue-600">内置题库</p>
                <h2 className="text-base font-black text-gray-950">27法硕 ZH2000 题库</h2>
              </div>
              <button
                type="button"
                onClick={() => setChoiceBankOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-900"
                aria-label="关闭题库"
              >
                <X size={17} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
              <WebChoiceBank currentUser={cloud.user} isAuthenticated={Boolean(cloud.user)} />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}


export default Shell
