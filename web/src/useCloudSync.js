import { useEffect, useRef, useState } from 'react'
import { auth, db, githubProvider, googleProvider, hasFirebaseConfig } from './lib/firebase'
import { markSyncQueueItemsDone, markSyncQueueItemsFailed, readPendingSyncQueue } from './lib/indexedDbStore.js'

const USER_COLLECTIONS = ['decks', 'cards', 'templates', 'dailyLogs', 'reviewLogs']
const COLLECTION_KEY_NAMES = {
  decks: 'id',
  cards: 'id',
  templates: 'id',
  dailyLogs: 'date',
  reviewLogs: 'id',
}
const BATCH_LIMIT = 450

function getAccountLabel(user) {
  if (!user) return '当前账号'
  return user.email || user.displayName || '当前账号'
}

function mapAuthError(error) {
  switch (error?.code) {
    case 'auth/email-already-in-use': return '这个邮箱已经注册过，可以直接登录。'
    case 'auth/invalid-email': return '邮箱格式不太对。'
    case 'auth/missing-password': return '请输入密码。'
    case 'auth/weak-password': return '密码至少需要 6 位。'
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password': return '邮箱或密码不正确。'
    case 'auth/popup-closed-by-user': return '登录窗口已关闭。'
    case 'auth/too-many-requests': return '尝试次数太多，稍后再试。'
    case 'auth/network-request-failed': return '网络连接失败，稍后再试。'
    case 'auth/configuration-not-found': return 'Firebase Authentication 还没启用，请在 Firebase 控制台打开 Authentication 并启用登录方式。'
    case 'auth/operation-not-allowed': return '这个登录方式还没启用，请在 Firebase Authentication 的 Sign-in method 里打开。'
    case 'auth/unauthorized-domain': return '当前域名还没有加入 Firebase 授权域名，请在 Authentication 设置里添加。'
    case 'permission-denied': return '云端权限被拒绝，请检查 Firestore 规则。'
    default: return error?.message || '账号操作失败，请稍后再试。'
  }
}

function isPermissionDenied(error) {
  return error?.code === 'permission-denied' || error?.message?.includes('permission-denied')
}

function validateEmailPassword(email, password, { allowEmptyPassword = false } = {}) {
  const cleanEmail = email.trim()
  if (!cleanEmail) return '请输入邮箱。'
  if (!allowEmptyPassword && !password) return '请输入密码。'
  if (!allowEmptyPassword && password.length < 6) return '密码至少需要 6 位。'
  return ''
}

function toMillis(value) {
  if (!value) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value instanceof Date) return value.getTime()
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1000000)
  return Number(value) || 0
}

function itemTime(item) {
  return Math.max(toMillis(item?.updatedAt), toMillis(item?.createdAt), toMillis(item?.reviewedAt), toMillis(item?.startedAt), toMillis(item?.redeemedAt), toMillis(item?.deletedAt))
}

function normalizeFirestoreValue(value) {
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue)
  if (value && typeof value === 'object') {
    if (typeof value.toMillis === 'function' || typeof value.seconds === 'number') return toMillis(value)
    return Object.entries(value).reduce((next, [key, fieldValue]) => {
      next[key] = normalizeFirestoreValue(fieldValue)
      return next
    }, {})
  }
  return value
}

function sanitizeForFirestore(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (Array.isArray(value)) return value.map(sanitizeForFirestore).filter((item) => item !== undefined)
  if (typeof value === 'object') {
    return Object.entries(value).reduce((next, [key, fieldValue]) => {
      const cleanValue = sanitizeForFirestore(fieldValue)
      if (cleanValue !== undefined) next[key] = cleanValue
      return next
    }, {})
  }
  return value
}

function stableStringify(value) {
  try {
    return JSON.stringify(sanitizeForFirestore(value) ?? null)
  } catch {
    return ''
  }
}

function normalizeDataShape(data = {}) {
  return {
    ...data,
    profile: data.profile && typeof data.profile === 'object' ? data.profile : {},
    decks: Array.isArray(data.decks) ? data.decks : [],
    cards: Array.isArray(data.cards) ? data.cards : [],
    templates: Array.isArray(data.templates) ? data.templates : [],
    dailyLogs: Array.isArray(data.dailyLogs) ? data.dailyLogs : [],
    reviewLogs: Array.isArray(data.reviewLogs) ? data.reviewLogs : [],
    activity: data.activity && typeof data.activity === 'object' ? data.activity : {},
  }
}

function mapBy(items = [], keyName = 'id') {
  const map = new Map()
  for (const item of items) {
    const key = item?.[keyName]
    if (key) map.set(String(key), item)
  }
  return map
}

function activeItems(items = []) {
  return items.filter((item) => !item?.deletedAt)
}

function deletedKeys(items = [], keyName = 'id') {
  return new Set(items.filter((item) => item?.deletedAt && item?.[keyName]).map((item) => String(item[keyName])))
}

function mergeById(localItems = [], remoteItems = [], keyName = 'id') {
  const items = new Map()
  for (const item of remoteItems) {
    const key = item?.[keyName]
    if (key) items.set(String(key), item)
  }
  for (const item of localItems) {
    const key = item?.[keyName]
    if (!key) continue
    const existing = items.get(String(key))
    if (!existing || itemTime(item) >= itemTime(existing)) items.set(String(key), item)
  }
  return Array.from(items.values()).sort((a, b) => itemTime(b) - itemTime(a))
}

function mergeDailyLogs(localLogs = [], remoteLogs = []) {
  return mergeById(localLogs, remoteLogs, 'date').sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

function mergeNumberMaps(localMap = {}, remoteMap = {}) {
  const keys = new Set([...Object.keys(remoteMap ?? {}), ...Object.keys(localMap ?? {})])
  return Array.from(keys).reduce((next, key) => {
    next[key] = Math.max(Number(localMap?.[key]) || 0, Number(remoteMap?.[key]) || 0)
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
  return { ...remoteProfile, ...localProfile, ...preferred, redeemedRewards: Array.from(rewardMap.values()).sort((a, b) => itemTime(b) - itemTime(a)) }
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
  const local = normalizeDataShape(localData)
  const remote = normalizeDataShape(remoteData)
  return {
    ...remote,
    ...local,
    profile: mergeProfile(local.profile, remote.profile),
    decks: mergeById(local.decks, remote.decks),
    cards: mergeById(local.cards, remote.cards),
    templates: mergeById(local.templates, remote.templates),
    reviewLogs: mergeById(local.reviewLogs, remote.reviewLogs).slice(0, 800),
    dailyLogs: mergeDailyLogs(local.dailyLogs, remote.dailyLogs),
    activity: mergeActivity(local.activity, remote.activity),
  }
}

function buildCloudData(parts, fallbackData = {}) {
  const fallback = normalizeDataShape(fallbackData)
  return {
    ...fallback,
    profile: parts.profile ?? fallback.profile,
    decks: activeItems(parts.decks),
    cards: activeItems(parts.cards),
    templates: activeItems(parts.templates),
    dailyLogs: activeItems(parts.dailyLogs),
    reviewLogs: activeItems(parts.reviewLogs),
    activity: parts.activity ?? fallback.activity,
  }
}

function mergeCloudIntoLocal(localData, parts) {
  const local = normalizeDataShape(localData)
  const prunedLocal = {
    ...local,
    decks: local.decks.filter((deck) => !deletedKeys(parts.decks).has(String(deck.id))),
    cards: local.cards.filter((card) => !deletedKeys(parts.cards).has(String(card.id))),
    templates: local.templates.filter((template) => !deletedKeys(parts.templates).has(String(template.id))),
    dailyLogs: local.dailyLogs.filter((log) => !deletedKeys(parts.dailyLogs, 'date').has(String(log.date))),
    reviewLogs: local.reviewLogs.filter((log) => !deletedKeys(parts.reviewLogs).has(String(log.id))),
  }
  return mergeMemorizerData(prunedLocal, buildCloudData(parts, local))
}

function makeActiveDocument(item, serverTimestamp) {
  const clean = sanitizeForFirestore(item) ?? {}
  return { ...clean, createdAt: clean.createdAt ?? serverTimestamp, updatedAt: serverTimestamp, deletedAt: null }
}

function makeDeletedDocument(keyName, key, serverTimestamp) {
  return { [keyName]: key, updatedAt: serverTimestamp, deletedAt: serverTimestamp }
}

function enqueueCollectionDiff(ops, fns, uid, collectionName, previousItems, nextItems, keyName = 'id') {
  const previous = mapBy(previousItems, keyName)
  const next = mapBy(nextItems, keyName)
  for (const [key, item] of next.entries()) {
    if (stableStringify(item) === stableStringify(previous.get(key))) continue
    ops.push({ ref: fns.doc(db, 'users', uid, collectionName, key), data: makeActiveDocument(item, fns.serverTimestamp()) })
  }
  for (const key of previous.keys()) {
    if (next.has(key)) continue
    ops.push({ ref: fns.doc(db, 'users', uid, collectionName, key), data: makeDeletedDocument(keyName, key, fns.serverTimestamp()) })
  }
}

async function commitOps(fns, ops) {
  for (let index = 0; index < ops.length; index += BATCH_LIMIT) {
    const batch = fns.writeBatch(db)
    for (const op of ops.slice(index, index + BATCH_LIMIT)) batch.set(op.ref, op.data, { merge: true })
    await batch.commit()
  }
}

async function persistDataDiff(uid, previousData, nextData) {
  const fns = await import('firebase/firestore')
  const previous = normalizeDataShape(previousData)
  const next = normalizeDataShape(nextData)
  const ops = []
  enqueueCollectionDiff(ops, fns, uid, 'decks', previous.decks, next.decks)
  enqueueCollectionDiff(ops, fns, uid, 'cards', previous.cards, next.cards)
  enqueueCollectionDiff(ops, fns, uid, 'templates', previous.templates, next.templates)
  enqueueCollectionDiff(ops, fns, uid, 'dailyLogs', previous.dailyLogs, next.dailyLogs, 'date')
  enqueueCollectionDiff(ops, fns, uid, 'reviewLogs', previous.reviewLogs, next.reviewLogs)
  if (stableStringify(previous.profile) !== stableStringify(next.profile)) ops.push({ ref: fns.doc(db, 'users', uid, 'profile', 'main'), data: makeActiveDocument(next.profile, fns.serverTimestamp()) })
  if (stableStringify(previous.activity) !== stableStringify(next.activity)) ops.push({ ref: fns.doc(db, 'users', uid, 'activity', 'main'), data: makeActiveDocument(next.activity, fns.serverTimestamp()) })
  if (ops.length === 0) return false
  await commitOps(fns, ops)
  return true
}

async function hasModernData(uid, fns) {
  for (const collectionName of USER_COLLECTIONS) {
    const snap = await fns.getDocs(fns.query(fns.collection(db, 'users', uid, collectionName), fns.limit(1)))
    if (!snap.empty) return true
  }
  const profileSnap = await fns.getDoc(fns.doc(db, 'users', uid, 'profile', 'main'))
  if (profileSnap.exists()) return true
  const activitySnap = await fns.getDoc(fns.doc(db, 'users', uid, 'activity', 'main'))
  return activitySnap.exists()
}

async function migrateLegacyPayload(uid, user, fns) {
  const stateRef = fns.doc(db, 'users', uid, 'migration', 'state')
  const stateSnap = await fns.getDoc(stateRef)
  if (stateSnap.exists() && stateSnap.data()?.payloadSplitCompleted) return
  const alreadyModern = await hasModernData(uid, fns)
  let payload = null
  let legacySource = 'memorizerUsers-payload'
  try {
    const legacySnap = await fns.getDoc(fns.doc(db, 'memorizerUsers', uid))
    payload = legacySnap.data()?.payload ?? null
    if (!payload) legacySource = 'no-legacy-payload'
  } catch (error) {
    if (!isPermissionDenied(error)) throw error
    legacySource = 'legacy-path-permission-denied'
  }
  if (!alreadyModern && payload?.decks && payload?.cards) await persistDataDiff(uid, normalizeDataShape({}), normalizeDataShape(payload))
  await fns.setDoc(stateRef, {
    payloadSplitCompleted: true,
    source: alreadyModern ? 'modern-data-exists' : legacySource,
    owner: { uid, email: user.email ?? null, displayName: user.displayName ?? null },
    updatedAt: fns.serverTimestamp(),
  }, { merge: true })
}

function readCollectionSnapshot(snapshot) {
  return snapshot.docs.map((document) => ({ id: document.id, ...normalizeFirestoreValue(document.data()) }))
}

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000
const INITIAL_SYNC_DELAY_MS = 6000

async function fetchCloudParts(uid, fns) {
  const parts = { profile: null, activity: null, decks: [], cards: [], templates: [], dailyLogs: [], reviewLogs: [] }
  const profileSnap = await fns.getDoc(fns.doc(db, 'users', uid, 'profile', 'main'))
  const activitySnap = await fns.getDoc(fns.doc(db, 'users', uid, 'activity', 'main'))
  parts.profile = profileSnap.exists() ? normalizeFirestoreValue(profileSnap.data()) : null
  parts.activity = activitySnap.exists() ? normalizeFirestoreValue(activitySnap.data()) : null
  for (const collectionName of USER_COLLECTIONS) {
    const snap = await fns.getDocs(fns.collection(db, 'users', uid, collectionName))
    parts[collectionName] = readCollectionSnapshot(snap)
  }
  return parts
}

function makeDataSignature(data = {}) {
  const normalized = normalizeDataShape(data)
  const collectionSignature = (items = [], keyName = 'id') => `${items.length}:${items.reduce((max, item) => Math.max(max, itemTime(item)), 0)}:${items.slice(0, 12).map((item) => item?.[keyName]).join('|')}`
  return [
    collectionSignature(normalized.decks),
    collectionSignature(normalized.cards),
    collectionSignature(normalized.templates),
    collectionSignature(normalized.dailyLogs, 'date'),
    collectionSignature(normalized.reviewLogs),
    itemTime(normalized.profile),
    itemTime(normalized.activity),
  ].join('::')
}

export function useCloudSync(data, setData) {
  const [user, setUser] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [lastReadAt, setLastReadAt] = useState(null)
  const [lastWriteAt, setLastWriteAt] = useState(null)
  const [lastErrorAt, setLastErrorAt] = useState(null)
  const [lastErrorMessage, setLastErrorMessage] = useState('')
  const [message, setMessage] = useState(hasFirebaseConfig ? '请登录账号，登录后每 5 分钟自动同步一次；也可以点同步按钮立即同步。' : '还没配置 Firebase，所以当前只会保存在本机浏览器。')
  const [syncState, setSyncState] = useState(hasFirebaseConfig ? 'signed-out' : 'disabled')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')

  const readyRef = useRef(false)
  const latestDataRef = useRef(data)
  const latestSignatureRef = useRef(makeDataSignature(data))
  const lastPersistedDataRef = useRef(normalizeDataShape(data))
  const lastPersistedSignatureRef = useRef(makeDataSignature(data))
  const autoSyncPausedRef = useRef(false)
  const cloudPausedRef = useRef(false)
  const dirtyRef = useRef(false)
  const syncingRef = useRef(false)
  const initialTimerRef = useRef(null)
  const intervalRef = useRef(null)
  const activeUidRef = useRef(null)

  useEffect(() => {
    latestDataRef.current = data
    const signature = makeDataSignature(data)
    if (signature !== latestSignatureRef.current) {
      latestSignatureRef.current = signature
      if (hasFirebaseConfig && user && readyRef.current && !autoSyncPausedRef.current && !cloudPausedRef.current) {
        dirtyRef.current = true
        setSyncState((current) => current === 'syncing' ? current : 'pending')
        setMessage('本地改动已保存，将在 5 分钟内自动同步；也可以点同步立即上传。')
      }
    }
  }, [data, user])

  function clearSyncTimers() {
    if (initialTimerRef.current) clearTimeout(initialTimerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    initialTimerRef.current = null
    intervalRef.current = null
  }

  async function readCloudAndMerge(uid, fns, { writeBack = false, label = '云端数据已读取' } = {}) {
    const parts = await fetchCloudParts(uid, fns)
    const cloudData = buildCloudData(parts, normalizeDataShape({}))
    const merged = mergeCloudIntoLocal(latestDataRef.current, parts)
    const mergedSignature = makeDataSignature(merged)
    const localSignature = makeDataSignature(latestDataRef.current)

    setLastReadAt(Date.now())
    if (mergedSignature !== localSignature) {
      latestDataRef.current = merged
      latestSignatureRef.current = mergedSignature
      setData(merged)
    }

    if (writeBack && mergedSignature !== makeDataSignature(cloudData)) {
      const wrote = await persistDataDiff(uid, lastPersistedDataRef.current, merged)
      if (wrote) setLastWriteAt(Date.now())
    }

    lastPersistedDataRef.current = normalizeDataShape(merged)
    lastPersistedSignatureRef.current = mergedSignature
    dirtyRef.current = false
    const now = Date.now()
    setLastSyncedAt(now)
    setSyncState('synced')
    setMessage(`${label}：${getAccountLabel(auth.currentUser)}`)
    return merged
  }

  async function flushQueuedSync() {
    if (!hasFirebaseConfig || !user) return false
    const fns = await import('firebase/firestore')
    const items = await readPendingSyncQueue(450)
    if (items.length === 0) return true
    try {
      const ops = items.map((item) => {
        const keyName = COLLECTION_KEY_NAMES[item.collection] ?? 'id'
        const docKey = item.key || item.payload?.[keyName] || item.payload?.id
        return { ref: fns.doc(db, 'users', user.uid, item.collection, String(docKey)), data: item.action === 'delete' ? makeDeletedDocument(keyName, docKey, fns.serverTimestamp()) : makeActiveDocument(item.payload, fns.serverTimestamp()) }
      })
      await commitOps(fns, ops)
      await markSyncQueueItemsDone(items.map((item) => item.id))
      setLastWriteAt(Date.now())
      return true
    } catch (error) {
      const text = mapAuthError(error)
      await markSyncQueueItemsFailed(items, text)
      setAuthError(text); setLastErrorAt(Date.now()); setLastErrorMessage(text); setSyncState('error'); setMessage('队列同步失败，本地数据仍然可用。')
      return false
    }
  }

  async function runScheduledSync(reason = 'auto') {
    if (!hasFirebaseConfig || !user || !readyRef.current || autoSyncPausedRef.current || cloudPausedRef.current || syncingRef.current) return false
    syncingRef.current = true
    setSyncState('syncing')
    setMessage(reason === 'manual' ? '正在手动同步...' : '正在执行 5 分钟定时同步...')
    try {
      const fns = await import('firebase/firestore')
      const queued = await flushQueuedSync()
      if (!queued) return false

      if (dirtyRef.current || makeDataSignature(latestDataRef.current) !== lastPersistedSignatureRef.current) {
        const nextData = normalizeDataShape(latestDataRef.current)
        const wrote = await persistDataDiff(user.uid, lastPersistedDataRef.current, nextData)
        lastPersistedDataRef.current = nextData
        lastPersistedSignatureRef.current = makeDataSignature(nextData)
        dirtyRef.current = false
        const now = Date.now()
        if (wrote) setLastWriteAt(now)
        setLastSyncedAt(now)
        setSyncState('synced')
        setMessage(wrote ? `已按 5 分钟节奏写入云端：${getAccountLabel(user)}` : `本地与云端已一致：${getAccountLabel(user)}`)
        return true
      }

      await readCloudAndMerge(user.uid, fns, { writeBack: false, label: reason === 'manual' ? '手动同步完成' : '5 分钟定时同步完成' })
      return true
    } catch (error) {
      const text = mapAuthError(error)
      setAuthError(text); setLastErrorAt(Date.now()); setLastErrorMessage(text); setSyncState('error'); setMessage('这次同步没有成功，但本地数据仍然可用。')
      return false
    } finally {
      syncingRef.current = false
    }
  }

  function startFiveMinuteTimer() {
    clearSyncTimers()
    initialTimerRef.current = setTimeout(() => { runScheduledSync('auto') }, INITIAL_SYNC_DELAY_MS)
    intervalRef.current = setInterval(() => { runScheduledSync('auto') }, AUTO_SYNC_INTERVAL_MS)
  }

  useEffect(() => {
    if (!hasFirebaseConfig) return undefined
    let alive = true
    let stopAuth = () => {}
    ;(async () => {
      const fns = await import('firebase/firestore')
      const { onAuthStateChanged } = await import('firebase/auth')
      stopAuth = onAuthStateChanged(auth, async (nextUser) => {
        if (!alive) return
        clearSyncTimers()
        setUser(nextUser)
        setAuthError('')
        readyRef.current = false
        cloudPausedRef.current = false
        autoSyncPausedRef.current = false
        dirtyRef.current = false
        activeUidRef.current = nextUser?.uid ?? null

        if (!nextUser) {
          setMessage('已退出云同步，当前继续使用本地数据。')
          setSyncState('signed-out')
          return
        }

        setMessage('正在读取云端数据；之后改为每 5 分钟同步一次，不再实时监听。')
        setSyncState('connecting')
        try {
          await migrateLegacyPayload(nextUser.uid, nextUser, fns)
          await readCloudAndMerge(nextUser.uid, fns, { writeBack: true, label: '云端数据已读取' })
          readyRef.current = true
          startFiveMinuteTimer()
          setMessage(`已连接：${getAccountLabel(nextUser)}。自动同步频率：每 5 分钟一次。`)
        } catch (error) {
          const text = mapAuthError(error)
          cloudPausedRef.current = true
          setAuthError(text); setLastErrorAt(Date.now()); setLastErrorMessage(text); setSyncState('error'); setMessage('云端读取失败，已暂停自动同步；当前继续使用本地数据。')
        }
      })
    })()
    return () => { alive = false; clearSyncTimers(); stopAuth() }
  }, [setData])

  async function runAuthAction(action, pendingMessage) {
    if (!hasFirebaseConfig || !auth) { setAuthError('还没配置 Firebase，暂时只能使用本地模式。'); return false }
    setAuthBusy(true); setAuthError(''); setMessage(pendingMessage)
    try { await action(); return true } catch (error) { setAuthError(mapAuthError(error)); setMessage('账号操作没有完成。'); return false } finally { setAuthBusy(false) }
  }

  const signInWithGoogle = () => runAuthAction(async () => { const { signInWithPopup } = await import('firebase/auth'); await signInWithPopup(auth, googleProvider) }, '正在打开 Google 登录...')
  const signInWithGithub = () => runAuthAction(async () => { const { signInWithPopup } = await import('firebase/auth'); await signInWithPopup(auth, githubProvider) }, '正在打开 GitHub 登录...')
  const signInWithEmail = ({ email, password }) => { const err = validateEmailPassword(email, password); if (err) { setAuthError(err); return false } return runAuthAction(async () => { const { signInWithEmailAndPassword } = await import('firebase/auth'); await signInWithEmailAndPassword(auth, email.trim(), password) }, '正在登录...') }
  const signUpWithEmail = ({ email, password }) => { const err = validateEmailPassword(email, password); if (err) { setAuthError(err); return false } return runAuthAction(async () => { const { createUserWithEmailAndPassword } = await import('firebase/auth'); await createUserWithEmailAndPassword(auth, email.trim(), password) }, '正在创建账号...') }
  const resetPassword = ({ email }) => { const err = validateEmailPassword(email, '', { allowEmptyPassword: true }); if (err) { setAuthError(err); return false } return runAuthAction(async () => { const { sendPasswordResetEmail } = await import('firebase/auth'); await sendPasswordResetEmail(auth, email.trim()); setMessage('重置密码邮件已发送，请查看邮箱。') }, '正在发送重置邮件...') }
  const signOutNow = async () => { if (!auth) return; const { signOut } = await import('firebase/auth'); await signOut(auth) }

  const manualSyncNow = async () => {
    if (!hasFirebaseConfig || !auth || !db) { setAuthError('还没配置 Firebase，暂时只能使用本地模式。'); return false }
    if (!user) { setAuthError('请先登录账号再同步。'); setMessage('请先登录账号再同步。'); return false }
    autoSyncPausedRef.current = false
    cloudPausedRef.current = false
    setAuthError('')
    return runScheduledSync('manual')
  }

  return {
    enabled: hasFirebaseConfig,
    user,
    accountLabel: getAccountLabel(user),
    lastSyncedAt,
    lastReadAt,
    lastWriteAt,
    lastErrorAt,
    lastErrorMessage,
    message,
    syncState,
    authBusy,
    authError,
    autoSyncPaused: autoSyncPausedRef.current,
    onClearAuthError: () => setAuthError(''),
    onSignInWithGoogle: signInWithGoogle,
    onSignInWithGithub: signInWithGithub,
    onSignInWithEmail: signInWithEmail,
    onSignUpWithEmail: signUpWithEmail,
    onResetPassword: resetPassword,
    onManualSync: manualSyncNow,
    onFlushQueuedSync: flushQueuedSync,
    onPauseAutoSync: (reason = '导入期间暂停自动同步。') => { autoSyncPausedRef.current = true; if (initialTimerRef.current) clearTimeout(initialTimerRef.current); setSyncState('paused'); setMessage(reason) },
    onResumeAutoSync: async () => { autoSyncPausedRef.current = false; dirtyRef.current = true; setSyncState('pending'); setMessage('自动同步已恢复，将按 5 分钟节奏同步，不会立刻拖慢页面。'); startFiveMinuteTimer() },
    onSignOut: signOutNow,
  }
}
