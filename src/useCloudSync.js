import { useEffect, useRef, useState } from 'react'
import { auth, db, githubProvider, googleProvider, hasFirebaseConfig } from './lib/firebase'

function getAccountLabel(user) {
  if (!user) return '当前账号'
  return user.email || user.displayName || '当前账号'
}

function mapAuthError(error) {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return '这个邮箱已经注册过，可以直接登录。'
    case 'auth/invalid-email':
      return '邮箱格式不太对。'
    case 'auth/missing-password':
      return '请输入密码。'
    case 'auth/weak-password':
      return '密码至少需要 6 位。'
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return '邮箱或密码不正确。'
    case 'auth/popup-closed-by-user':
      return '登录窗口已关闭。'
    case 'auth/too-many-requests':
      return '尝试次数太多，稍后再试。'
    case 'auth/network-request-failed':
      return '网络连接失败，稍后再试。'
    case 'auth/configuration-not-found':
      return 'Firebase Authentication 还没启用，请在 Firebase 控制台打开 Authentication 并启用登录方式。'
    case 'auth/operation-not-allowed':
      return '这个登录方式还没启用，请在 Firebase Authentication 的 Sign-in method 里打开。'
    case 'auth/unauthorized-domain':
      return '当前域名还没有加入 Firebase 授权域名，请在 Authentication 设置里添加。'
    case 'permission-denied':
      return '云端权限被拒绝，请检查 Firestore 规则。'
    default:
      return error?.message || '账号操作失败，请稍后再试。'
  }
}

function validateEmailPassword(email, password, { allowEmptyPassword = false } = {}) {
  const cleanEmail = email.trim()
  if (!cleanEmail) return '请输入邮箱。'
  if (!allowEmptyPassword && !password) return '请输入密码。'
  if (!allowEmptyPassword && password.length < 6) return '密码至少需要 6 位。'
  return ''
}

function itemTime(item) {
  return Number(item?.updatedAt ?? item?.createdAt ?? item?.reviewedAt ?? item?.startedAt ?? item?.redeemedAt ?? 0) || 0
}

function mergeById(localItems = [], remoteItems = []) {
  const items = new Map()

  for (const item of remoteItems) {
    if (item?.id) items.set(item.id, item)
  }

  for (const item of localItems) {
    if (!item?.id) continue
    const existing = items.get(item.id)
    if (!existing || itemTime(item) >= itemTime(existing)) {
      items.set(item.id, item)
    }
  }

  return Array.from(items.values()).sort((a, b) => itemTime(b) - itemTime(a))
}

function mergeDailyLogs(localLogs = [], remoteLogs = []) {
  const logs = new Map()

  for (const log of remoteLogs) {
    if (log?.date) logs.set(log.date, log)
  }

  for (const log of localLogs) {
    if (!log?.date) continue
    const existing = logs.get(log.date)
    if (!existing || itemTime(log) >= itemTime(existing)) {
      logs.set(log.date, log)
    }
  }

  return Array.from(logs.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

function mergeNumberMaps(localMap = {}, remoteMap = {}, mode = 'max') {
  const keys = new Set([...Object.keys(remoteMap ?? {}), ...Object.keys(localMap ?? {})])
  return Array.from(keys).reduce((next, key) => {
    const localValue = Number(localMap?.[key]) || 0
    const remoteValue = Number(remoteMap?.[key]) || 0
    next[key] = mode === 'sum' ? localValue + remoteValue : Math.max(localValue, remoteValue)
    return next
  }, {})
}

function mergeProfile(localProfile = {}, remoteProfile = {}) {
  const localRewards = Array.isArray(localProfile.redeemedRewards) ? localProfile.redeemedRewards : []
  const remoteRewards = Array.isArray(remoteProfile.redeemedRewards) ? remoteProfile.redeemedRewards : []
  const rewardMap = new Map()

  for (const reward of [...remoteRewards, ...localRewards]) {
    if (!reward?.rewardId) continue
    const existing = rewardMap.get(reward.rewardId)
    if (!existing || itemTime(reward) >= itemTime(existing)) rewardMap.set(reward.rewardId, reward)
  }

  const preferred = itemTime(localProfile) >= itemTime(remoteProfile) ? localProfile : remoteProfile
  return {
    ...remoteProfile,
    ...localProfile,
    ...preferred,
    redeemedRewards: Array.from(rewardMap.values()).sort((a, b) => itemTime(b) - itemTime(a)),
  }
}

function mergeActivity(localActivity = {}, remoteActivity = {}) {
  const focusLog = mergeById(localActivity.focusLog, remoteActivity.focusLog).slice(0, 300)
  return {
    ...remoteActivity,
    ...localActivity,
    siteSeconds: Math.max(Number(localActivity.siteSeconds) || 0, Number(remoteActivity.siteSeconds) || 0),
    dailySiteSeconds: mergeNumberMaps(localActivity.dailySiteSeconds, remoteActivity.dailySiteSeconds),
    deckSeconds: mergeNumberMaps(localActivity.deckSeconds, remoteActivity.deckSeconds),
    focusLog,
    focusSessions: Math.max(Number(localActivity.focusSessions) || 0, Number(remoteActivity.focusSessions) || 0, focusLog.length),
    updatedAt: Math.max(itemTime(localActivity), itemTime(remoteActivity)),
  }
}

function mergeMemorizerData(localData, remoteData) {
  if (!remoteData?.decks || !remoteData?.cards) return localData
  if (!localData?.decks || !localData?.cards) return remoteData

  return {
    ...remoteData,
    ...localData,
    profile: mergeProfile(localData.profile, remoteData.profile),
    decks: mergeById(localData.decks, remoteData.decks),
    cards: mergeById(localData.cards, remoteData.cards),
    reviewLogs: mergeById(localData.reviewLogs, remoteData.reviewLogs).slice(0, 400),
    dailyLogs: mergeDailyLogs(localData.dailyLogs, remoteData.dailyLogs),
    activity: mergeActivity(localData.activity, remoteData.activity),
  }
}

export function useCloudSync(data, setData) {
  const [user, setUser] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [message, setMessage] = useState(hasFirebaseConfig ? '请登录账号，登录后手机和电脑会同步同一份数据。' : '还没配置 Firebase，所以当前只会保存在本机浏览器。')
  const [syncState, setSyncState] = useState(hasFirebaseConfig ? 'signed-out' : 'disabled')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const readyRef = useRef(false)
  const lastSerializedRef = useRef('')
  const latestDataRef = useRef(data)
  const timerRef = useRef(null)

  useEffect(() => {
    latestDataRef.current = data
  }, [data])

  useEffect(() => {
    if (!hasFirebaseConfig) return
    let alive = true
    let stopAuth = () => {}
    let stopSnap = () => {}

    ;(async () => {
      const { onAuthStateChanged } = await import('firebase/auth')
      const { doc, onSnapshot, setDoc, serverTimestamp } = await import('firebase/firestore')

      stopAuth = onAuthStateChanged(auth, (nextUser) => {
        if (!alive) return
        setUser(nextUser)
        setAuthError('')
        readyRef.current = false
        stopSnap()

        if (!nextUser) {
          setMessage('已退出云同步，当前继续使用本地数据。')
          setSyncState('signed-out')
          return
        }

        setMessage('正在连接云端数据...')
        setSyncState('connecting')
        const ref = doc(db, 'memorizerUsers', nextUser.uid)

        stopSnap = onSnapshot(ref, async (snap) => {
          if (!alive) return

          try {
            const payload = snap.data()?.payload
            if (snap.exists() && payload?.decks && payload?.cards) {
              const merged = mergeMemorizerData(latestDataRef.current, payload)
              const mergedSerialized = JSON.stringify(merged)
              const remoteSerialized = JSON.stringify(payload)
              lastSerializedRef.current = mergedSerialized
              readyRef.current = true
              setData(merged)
              setLastSyncedAt(Date.now())
              setSyncState('synced')
              setMessage(`云端数据已合并：${getAccountLabel(nextUser)}`)
              if (mergedSerialized !== remoteSerialized) {
                await setDoc(ref, {
                  payload: merged,
                  owner: {
                    uid: nextUser.uid,
                    email: nextUser.email ?? null,
                    displayName: nextUser.displayName ?? null,
                  },
                  updatedAt: serverTimestamp(),
                }, { merge: true })
              }
              return
            }

            const local = latestDataRef.current
            lastSerializedRef.current = JSON.stringify(local)
            await setDoc(ref, {
              payload: local,
              owner: {
                uid: nextUser.uid,
                email: nextUser.email ?? null,
                displayName: nextUser.displayName ?? null,
              },
              updatedAt: serverTimestamp(),
            }, { merge: true })
            readyRef.current = true
            setLastSyncedAt(Date.now())
            setSyncState('synced')
            setMessage('云端文档已初始化，后续会自动同步。')
          } catch (error) {
            setAuthError(mapAuthError(error))
            setSyncState('error')
            setMessage('云同步失败，请检查 Firebase 配置。')
          }
        }, (error) => {
          setAuthError(mapAuthError(error))
          setSyncState('error')
          setMessage('云同步连接失败，请检查 Firebase 配置。')
        })
      })
    })()

    return () => {
      alive = false
      stopSnap()
      stopAuth()
    }
  }, [setData])

  useEffect(() => {
    if (!hasFirebaseConfig || !user || !readyRef.current) return
    const serialized = JSON.stringify(data)
    if (serialized === lastSerializedRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    setSyncState('syncing')

    timerRef.current = setTimeout(async () => {
      try {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
        await setDoc(doc(db, 'memorizerUsers', user.uid), {
          payload: data,
          owner: {
            uid: user.uid,
            email: user.email ?? null,
            displayName: user.displayName ?? null,
          },
          updatedAt: serverTimestamp(),
        }, { merge: true })
        lastSerializedRef.current = serialized
        setLastSyncedAt(Date.now())
        setSyncState('synced')
        setMessage(`已同步到云端：${getAccountLabel(user)}`)
      } catch (error) {
        setAuthError(mapAuthError(error))
        setSyncState('error')
        setMessage('这次同步没有成功。')
      }
    }, 500)

    return () => timerRef.current && clearTimeout(timerRef.current)
  }, [data, user])

  async function runAuthAction(action, pendingMessage) {
    if (!hasFirebaseConfig || !auth) {
      setAuthError('还没配置 Firebase，暂时只能使用本地模式。')
      return false
    }

    setAuthBusy(true)
    setAuthError('')
    setMessage(pendingMessage)

    try {
      await action()
      return true
    } catch (error) {
      setAuthError(mapAuthError(error))
      setMessage('账号操作没有完成。')
      return false
    } finally {
      setAuthBusy(false)
    }
  }

  const signInWithGoogle = () => runAuthAction(async () => {
    const { signInWithPopup } = await import('firebase/auth')
    await signInWithPopup(auth, googleProvider)
  }, '正在打开 Google 登录...')

  const signInWithGithub = () => runAuthAction(async () => {
    const { signInWithPopup } = await import('firebase/auth')
    await signInWithPopup(auth, githubProvider)
  }, '正在打开 GitHub 登录...')

  const signInWithEmail = ({ email, password }) => {
    const validationError = validateEmailPassword(email, password)
    if (validationError) {
      setAuthError(validationError)
      return false
    }

    return runAuthAction(async () => {
      const { signInWithEmailAndPassword } = await import('firebase/auth')
      await signInWithEmailAndPassword(auth, email.trim(), password)
    }, '正在登录...')
  }

  const signUpWithEmail = ({ email, password }) => {
    const validationError = validateEmailPassword(email, password)
    if (validationError) {
      setAuthError(validationError)
      return false
    }

    return runAuthAction(async () => {
      const { createUserWithEmailAndPassword } = await import('firebase/auth')
      await createUserWithEmailAndPassword(auth, email.trim(), password)
    }, '正在创建账号...')
  }

  const resetPassword = ({ email }) => {
    const validationError = validateEmailPassword(email, '', { allowEmptyPassword: true })
    if (validationError) {
      setAuthError(validationError)
      return false
    }

    return runAuthAction(async () => {
      const { sendPasswordResetEmail } = await import('firebase/auth')
      await sendPasswordResetEmail(auth, email.trim())
      setMessage('重置密码邮件已发送，请查看邮箱。')
    }, '正在发送重置邮件...')
  }

  const signOutNow = async () => {
    if (!auth) return
    const { signOut } = await import('firebase/auth')
    await signOut(auth)
  }

  return {
    enabled: hasFirebaseConfig,
    user,
    accountLabel: getAccountLabel(user),
    lastSyncedAt,
    message,
    syncState,
    authBusy,
    authError,
    onClearAuthError: () => setAuthError(''),
    onSignInWithGoogle: signInWithGoogle,
    onSignInWithGithub: signInWithGithub,
    onSignInWithEmail: signInWithEmail,
    onSignUpWithEmail: signUpWithEmail,
    onResetPassword: resetPassword,
    onSignOut: signOutNow,
  }
}
