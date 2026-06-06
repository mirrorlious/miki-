import { useState, useEffect } from 'react'
import { X, LogIn, GitBranch } from 'lucide-react'

export default function AuthDialog({ open, cloud, onClose }) {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '' })

  useEffect(() => {
    if (!open) return
    setMode('signin')
    setForm({ email: '', password: '' })
  }, [open])

  useEffect(() => {
    if (open && cloud.user) onClose()
  }, [open, cloud.user, onClose])

  if (!open) return null

  const title = mode === 'signup' ? '创建账号' : mode === 'reset' ? '找回密码' : '登录账号'
  const subtitle = mode === 'signup' ? '邮箱账号会自动绑定当前云同步。' : mode === 'reset' ? '输入邮箱后会收到重置链接。' : '登录后会切换到你的云端数据。'
  const primaryLabel = mode === 'signup' ? '注册并登录' : mode === 'reset' ? '发送重置邮件' : '登录'

  async function handleSubmit(event) {
    event.preventDefault()
    const payload = { email: form.email, password: form.password }
    const ok = mode === 'signup'
      ? await cloud.onSignUpWithEmail(payload)
      : mode === 'reset'
        ? await cloud.onResetPassword(payload)
        : await cloud.onSignInWithEmail(payload)

    if (ok && mode === 'reset') {
      setMode('signin')
      setForm((current) => ({ ...current, password: '' }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-gray-300">Account</p>
            <h2 className="text-2xl font-black text-gray-950">{title}</h2>
            <p className="mt-1 text-sm font-bold text-gray-400">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200" title="关闭">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-gray-500">邮箱</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
              placeholder="you@example.com"
            />
          </label>

          {mode !== 'reset' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-gray-500">密码</span>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-900 outline-none focus:border-blue-400 focus:bg-white"
                placeholder="至少 6 位"
              />
            </label>
          )}

          {cloud.authError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{cloud.authError}</p>}

          <button type="submit" disabled={cloud.authBusy} className="mt-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-black text-white shadow-sm hover:bg-gray-800 disabled:bg-gray-300">
            <LogIn size={15} />
            {cloud.authBusy ? '处理中...' : primaryLabel}
          </button>
        </form>

        {mode !== 'reset' && (
          <>
            <div className="my-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-gray-300">
              <span className="h-px flex-1 bg-gray-100" />
              or
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={cloud.onSignInWithGoogle} disabled={cloud.authBusy} className="flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300">
                使用 Google 登录
              </button>
              <button type="button" onClick={cloud.onSignInWithGithub} disabled={cloud.authBusy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-300">
                <GitBranch size={15} />
                使用 GitHub 登录
              </button>
            </div>
          </>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs font-black">
          {mode === 'signin' ? (
            <>
              <button type="button" onClick={() => setMode('signup')} className="text-blue-600 hover:text-blue-700">创建新账号</button>
              <button type="button" onClick={() => setMode('reset')} className="text-gray-400 hover:text-gray-700">忘记密码</button>
            </>
          ) : (
            <button type="button" onClick={() => setMode('signin')} className="text-blue-600 hover:text-blue-700">返回登录</button>
          )}
        </div>
      </div>
    </div>
  )
}
