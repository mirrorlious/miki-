import { useEffect, useRef, useState } from 'react'
import { auth, db, githubProvider, googleProvider, hasFirebaseConfig } from './lib/firebase'

const USER_COLLECTIONS = ['decks', 'cards', 'dailyLogs', 'reviewLogs']
const COLLECTION_KEY_NAMES = {
  decks: 'id',
  cards: 'id',
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
  return Math.max(
    toMillis(item?.updatedAt),
    toMillis(item?.createdAt),
    toMillis(item?.reviewedAt),
    toMillis(item?.startedAt),
    toMillis(item?.redeemedAt),
    toMillis(item?.deletedAt),
  )
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
  return JSON.stringify(sanitizeForFirestore(value) ?? null)
}

function normalizeDataShape(data = {}) {
  return {
    ...data,
    profile: data.profile && typeof data.profile === 'object' ? data.profile : {},
    decks: Array.isArray(data.decks) ? data.decks : [],
    cards: Array.isArray(data.cards) ? data.cards : [],
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

function activeKeys(items = [], keyName = 'id') {
  return new Set(activeItems(items).map((item) => item?.[keyName]).filter(Boolean).map(String))
}

function createPendingDeletedState() {
  return {
    decks: new Set(),
    cards: new Set(),
    dailyLogs: new Set(),
    reviewLogs: new Set(),
  }
}

function rememberPendingDeletedKeys(pendingDeleted, previousData, nextData) {
  const previous = normalizeDataShape(previousData)
  const next = normalizeDataShape(nextData)

  for (const collectionName of USER_COLLECTIONS) {
    const keyName = COLLECTION_KEY_NAMES[collectionName] ?? 'id'
    const previousKeys = activeKeys(previous[collectionName], keyName)
    const nextKeys = activeKeys(next[collectionName], keyName)
    const pending = pendingDeleted[collectionName]

    for (const key of nextKeys) pending.delete(key)
    for (const key of previousKeys) {
      if (!nextKeys.has(key)) pending.add(key)
    }
  }
}

function applyPendingDeletedKeys(parts, pendingDeleted) {
  const nextParts = { ...parts }
  const now = Date.now()

  for (const collectionName of USER_COLLECTIONS) {
    const keyName = COLLECTION_KEY_NAMES[collectionName] ?? 'id'
    const pending = pendingDeleted[collectionName]
    const items = Array.isArray(parts[collectionName]) ? parts[collectionName] : []
    if (!pending?.size) {
      nextParts[collectionName] = items
      continue
    }

    nextParts[collectionName] = [
      ...items.filter((item) => !pending.has(String(item?.[keyName]))),
      ...Array.from(pending).map((key) => makeDeletedDocument(keyName, key, now)),
    ]
  }

  return nextParts
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
  const local = normalizeDataShape(localData)
  const remote = normalizeDataShape(remoteData)

  return {
    ...remote,
    ...local,
    profile: mergeProfile(local.profile, remote.profile),
    decks: mergeById(local.decks, remote.decks),
    cards: mergeById(local.cards, remote.cards),
    reviewLogs: mergeById(local.reviewLogs, remote.reviewLogs).slice(0, 400),
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
    dailyLogs: local.dailyLogs.filter((log) => !deletedKeys(parts.dailyLogs, 'date').has(String(log.date))),
    reviewLogs: local.reviewLogs.filter((log) => !deletedKeys(parts.reviewLogs).has(String(log.id))),
  }

  return mergeMemorizerData(prunedLocal, buildCloudData(parts, local))
}

function makeActiveDocument(item, serverTimestamp) {
  const clean = sanitizeForFirestore(item) ?? {}
  return {
    ...clean,
    createdAt: clean.createdAt ?? serverTimestamp,
    updatedAt: serverTimestamp,
    deletedAt: null,
  }
}

function makeDeletedDocument(keyName, key, serverTimestamp) {
  return {
    [keyName]: key,
    updatedAt: serverTimestamp,
    deletedAt: serverTimestamp,
  }
}

function enqueueCollectionDiff(ops, fns, uid, collectionName, previousItems, nextItems, keyName = 'id') {
  const previous = mapBy(previousItems, keyName)
  const next = mapBy(nextItems, keyName)

  for (const [key, item] of next.entries()) {
    if (stableStringify(item) === stableStringify(previous.get(key))) continue
    ops.push({
      ref: fns.doc(db, 'users', uid, collectionName, key),
      data: makeActiveDocument(item, fns.serverTimestamp()),
    })
  }

  for (const key of previous.keys()) {
    if (next.has(key)) continue
    ops.push({
      ref: fns.doc(db, 'users', uid, collectionName, key),
      data: makeDeletedDocument(keyName, key, fns.serverTimestamp()),
    })
  }
}

async function commitOps(fns, ops) {
  for (let index = 0; index < ops.length; index += BATCH_LIMIT) {
    const batch = fns.writeBatch(db)
    for (const op of ops.slice(index, index + BATCH_LIMIT)) {
      batch.set(op.ref, op.data, { merge: true })
    }
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
  enqueueCollectionDiff(ops, fns, uid, 'dailyLogs', previous.dailyLogs, next.dailyLogs, 'date')
  enqueueCollectionDiff(ops, fns, uid, 'reviewLogs', previous.reviewLogs, next.reviewLogs)

  if (stableStringify(previous.profile) !== stableStringify(next.profile)) {
    ops.push({
      ref: fns.doc(db, 'users', uid, 'profile', 'main'),
      data: makeActiveDocument(next.profile, fns.serverTimestamp()),
    })
  }

  if (stableStringify(previous.activity) !== stableStringify(next.activity)) {
    ops.push({
      ref: fns.doc(db, 'users', uid, 'activity', 'main'),
      data: makeActiveDocument(next.activity, fns.serverTimestamp()),
    })
  }

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

  if (!alreadyModern && payload?.decks && payload?.cards) {
    await persistDataDiff(uid, normalizeDataShape({}), normalizeDataShape(payload))
  }

  await fns.setDoc(stateRef, {
    payloadSplitCompleted: true,
    source: alreadyModern ? 'modern-data-exists' : legacySource,
    owner: {
      uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
    },
    updatedAt: fns.serverTimestamp(),
  }, { merge: true })
}

function readCollectionSnapshot(snapshot) {
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...normalizeFirestoreValue(document.data()),
  }))
}

export function useCloudSync(data, setData) {
  const [user, setUser] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [lastReadAt, setLastReadAt] = useState(null)
  const [lastWriteAt, setLastWriteAt] = useState(null)
  const [lastErrorAt, setLastErrorAt] = useState(null)
  const [lastErrorMessage, setLastErrorMessage] = useState('')
  const [message, setMessage] = useState(hasFirebaseConfig ? '请登录账号，登录后手机和电脑会同步同一份数据。' : '还没配置 Firebase，所以当前只会保存在本机浏览器。')
  const [syncState, setSyncState] = useState(hasFirebaseConfig ? 'signed-out' : 'disabled')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const readyRef = useRef(false)
  const latestDataRef = useRef(data)
  const lastPersistedDataRef = useRef(normalizeDataShape(data))
  const timerRef = useRef(null)
  const activeUidRef = useRef(null)
  const pendingDeletedRef = useRef(createPendingDeletedState())
  const cloudPartsRef = useRef({
    profile: null,
    activity: null,
    decks: [],
    cards: [],
    dailyLogs: [],
    reviewLogs: [],
  })

  useEffect(() => {
    latestDataRef.current = data
  }, [data])

  useEffect(() => {
    if (!hasFirebaseConfig) return
    let alive = true
    let stopAuth = () => {}
    let stopCloud = () => {}

    ;(async () => {
      const fns = await import('firebase/firestore')
      const { onAuthStateChanged } = await import('firebase/auth')

      stopAuth = onAuthStateChanged(auth, async (nextUser) => {
        if (!alive) return
        setUser(nextUser)
        setAuthError('')
        readyRef.current = false
        activeUidRef.current = nextUser?.uid ?? null
        pendingDeletedRef.current = createPendingDeletedState()
        cloudPartsRef.current = {
          profile: null,
          activity: null,
          decks: [],
          cards: [],
          dailyLogs: [],
          reviewLogs: [],
        }
        stopCloud()

        if (!nextUser) {
          setMessage('已退出云同步，当前继续使用本地数据。')
          setSyncState('signed-out')
          return
        }

        setMessage('正在连接云端数据...')
        setSyncState('connecting')

        try {
          await migrateLegacyPayload(nextUser.uid, nextUser, fns)
        } catch (error) {
          if (!alive) return
          const text = mapAuthError(error)
          setAuthError(text)
          setLastErrorAt(Date.now())
          setLastErrorMessage(text)
          setSyncState('error')
          setMessage('旧数据迁移失败，请检查 Firestore 规则。')
          return
        }

        const loaded = {
          profile: false,
          activity: false,
          decks: false,
          cards: false,
          dailyLogs: false,
          reviewLogs: false,
        }
        const unsubscribers = []

        function allLoaded() {
          return Object.values(loaded).every(Boolean)
        }

        async function applyCloudSnapshot(isInitial = false) {
          const uid = activeUidRef.current
          if (!alive || !uid) return

          const cloudParts = applyPendingDeletedKeys(cloudPartsRef.current, pendingDeletedRef.current)
          const cloudData = buildCloudData(cloudParts, normalizeDataShape({}))
          const merged = mergeCloudIntoLocal(latestDataRef.current, cloudParts)

          lastPersistedDataRef.current = cloudData
          setLastReadAt(Date.now())
          setLastSyncedAt(Date.now())
          setSyncState('synced')
          setMessage(`云端数据已读取：${getAccountLabel(nextUser)}`)

          if (stableStringify(merged) !== stableStringify(latestDataRef.current)) {
            setData(merged)
          }

          if (isInitial && stableStringify(merged) !== stableStringify(cloudData)) {
            try {
              const wrote = await persistDataDiff(uid, cloudData, merged)
              if (wrote) {
                lastPersistedDataRef.current = merged
                setLastWriteAt(Date.now())
                setLastSyncedAt(Date.now())
                setMessage(`本地未上传的数据已补写到云端：${getAccountLabel(nextUser)}`)
              }
            } catch (error) {
              const text = mapAuthError(error)
              setAuthError(text)
              setLastErrorAt(Date.now())
              setLastErrorMessage(text)
              setSyncState('error')
              setMessage('补写本地数据失败。')
            }
          }
        }

        function markLoaded(name) {
          loaded[name] = true
          if (allLoaded() && !readyRef.current) {
            readyRef.current = true
            applyCloudSnapshot(true)
          }
        }

        function handleSnapshotError(error) {
          const text = mapAuthError(error)
          setAuthError(text)
          setLastErrorAt(Date.now())
          setLastErrorMessage(text)
          setSyncState('error')
          setMessage('云同步连接失败，请检查 Firebase 配置或网络。')
        }

        unsubscribers.push(fns.onSnapshot(fns.doc(db, 'users', nextUser.uid, 'profile', 'main'), (snap) => {
          cloudPartsRef.current.profile = snap.exists() ? normalizeFirestoreValue(snap.data()) : null
          if (readyRef.current) applyCloudSnapshot()
          markLoaded('profile')
        }, handleSnapshotError))

        unsubscribers.push(fns.onSnapshot(fns.doc(db, 'users', nextUser.uid, 'activity', 'main'), (snap) => {
          cloudPartsRef.current.activity = snap.exists() ? normalizeFirestoreValue(snap.data()) : null
          if (readyRef.current) applyCloudSnapshot()
          markLoaded('activity')
        }, handleSnapshotError))

        for (const collectionName of USER_COLLECTIONS) {
          unsubscribers.push(fns.onSnapshot(fns.collection(db, 'users', nextUser.uid, collectionName), (snap) => {
            cloudPartsRef.current[collectionName] = readCollectionSnapshot(snap)
            if (readyRef.current) applyCloudSnapshot()
            markLoaded(collectionName)
          }, handleSnapshotError))
        }

        stopCloud = () => {
          unsubscribers.forEach((unsubscribe) => unsubscribe())
        }
      })
    })()

    return () => {
      alive = false
      stopCloud()
      stopAuth()
    }
  }, [setData])

  useEffect(() => {
    if (!hasFirebaseConfig || !user || !readyRef.current) return
    const nextData = normalizeDataShape(data)
    const previousData = lastPersistedDataRef.current
    if (stableStringify(nextData) === stableStringify(previousData)) return
    rememberPendingDeletedKeys(pendingDeletedRef.current, previousData, nextData)
    if (timerRef.current) clearTimeout(timerRef.current)
    setSyncState('syncing')
    setMessage('正在同步本机变动...')

    timerRef.current = setTimeout(async () => {
      try {
        const wrote = await persistDataDiff(user.uid, previousData, nextData)
        lastPersistedDataRef.current = nextData
        const now = Date.now()
        if (wrote) {
          setLastWriteAt(now)
          setLastSyncedAt(now)
          setMessage(`已写入云端：${getAccountLabel(user)}`)
        } else {
          setLastSyncedAt(now)
          setMessage(`云端数据已是最新：${getAccountLabel(user)}`)
        }
        setSyncState('synced')
      } catch (error) {
        const text = mapAuthError(error)
        setAuthError(text)
        setLastErrorAt(Date.now())
        setLastErrorMessage(text)
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

  const manualSyncNow = async () => {
    if (!hasFirebaseConfig || !auth || !db) {
      setAuthError('还没配置 Firebase，暂时只能使用本地模式。')
      return false
    }
    if (!user) {
      setAuthError('请先登录账号再同步。')
      setMessage('请先登录账号再同步。')
      return false
    }

    setAuthError('')
    setSyncState('syncing')
    setMessage('正在手动同步云端数据...')

    try {
      const previousData = lastPersistedDataRef.current
      const nextData = normalizeDataShape(latestDataRef.current)
      rememberPendingDeletedKeys(pendingDeletedRef.current, previousData, nextData)
      const wrote = await persistDataDiff(user.uid, previousData, nextData)
      lastPersistedDataRef.current = nextData
      const now = Date.now()
      setLastWriteAt(wrote ? now : lastWriteAt)
      setLastSyncedAt(now)
      setSyncState('synced')
      setMessage(wrote ? `手动同步完成：${getAccountLabel(user)}` : `云端数据已是最新：${getAccountLabel(user)}`)
      return true
    } catch (error) {
      const text = mapAuthError(error)
      setAuthError(text)
      setLastErrorAt(Date.now())
      setLastErrorMessage(text)
      setSyncState('error')
      setMessage('手动同步失败，请稍后再试。')
      return false
    }
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
    onClearAuthError: () => setAuthError(''),
    onSignInWithGoogle: signInWithGoogle,
    onSignInWithGithub: signInWithGithub,
    onSignInWithEmail: signInWithEmail,
    onSignUpWithEmail: signUpWithEmail,
    onResetPassword: resetPassword,
    onManualSync: manualSyncNow,
    onSignOut: signOutNow,
  }
}
