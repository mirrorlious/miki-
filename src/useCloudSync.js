import { useEffect, useRef, useState } from 'react'
import { auth, db, googleProvider, hasFirebaseConfig } from './lib/firebase'

export function useCloudSync(data,setData){
  const [user,setUser]=useState(null)
  const [lastSyncedAt,setLastSyncedAt]=useState(null)
  const [message,setMessage]=useState(hasFirebaseConfig?'请先用 Google 登录，登录后手机和电脑会同步同一份数据。':'还没配置 Firebase，所以当前只会保存在本机浏览器。')
  const readyRef=useRef(false)
  const lastSerializedRef=useRef('')
  const latestDataRef=useRef(data)
  const timerRef=useRef(null)

  useEffect(()=>{latestDataRef.current=data},[data])

  useEffect(()=>{
    if(!hasFirebaseConfig)return
    let alive=true,stopAuth=()=>{},stopSnap=()=>{}
    ;(async()=>{
      const {onAuthStateChanged}=await import('firebase/auth')
      const {doc,onSnapshot,setDoc,serverTimestamp}=await import('firebase/firestore')
      stopAuth=onAuthStateChanged(auth,(nextUser)=>{
        if(!alive)return
        setUser(nextUser);readyRef.current=false;stopSnap()
        if(!nextUser){setMessage('已退出云同步，当前继续使用本地数据。');return}
        setMessage('正在连接云端数据...')
        const ref=doc(db,'memorizerUsers',nextUser.uid)
        stopSnap=onSnapshot(ref,async(snap)=>{
          if(!alive)return
          const payload=snap.data()?.payload
          if(snap.exists()&&payload?.decks&&payload?.cards){
            lastSerializedRef.current=JSON.stringify(payload)
            readyRef.current=true
            setData(payload)
            setLastSyncedAt(Date.now())
            setMessage(`云端数据已连接：${nextUser.email||nextUser.displayName||'当前账号'}`)
            return
          }
          const local=latestDataRef.current
          lastSerializedRef.current=JSON.stringify(local)
          await setDoc(ref,{payload:local,owner:{uid:nextUser.uid,email:nextUser.email??null,displayName:nextUser.displayName??null},updatedAt:serverTimestamp()})
          readyRef.current=true
          setLastSyncedAt(Date.now())
          setMessage('云端文档已初始化，后续会自动同步。')
        })
      })
    })()
    return ()=>{alive=false;stopSnap();stopAuth()}
  },[setData])

  useEffect(()=>{
    if(!hasFirebaseConfig||!user||!readyRef.current)return
    const serialized=JSON.stringify(data)
    if(serialized===lastSerializedRef.current)return
    if(timerRef.current)clearTimeout(timerRef.current)
    timerRef.current=setTimeout(async()=>{
      const {doc,setDoc,serverTimestamp}=await import('firebase/firestore')
      await setDoc(doc(db,'memorizerUsers',user.uid),{payload:data,owner:{uid:user.uid,email:user.email??null,displayName:user.displayName??null},updatedAt:serverTimestamp()})
      lastSerializedRef.current=serialized
      setLastSyncedAt(Date.now())
      setMessage(`已同步到云端：${user.email||user.displayName||'当前账号'}`)
    },500)
    return ()=>timerRef.current&&clearTimeout(timerRef.current)
  },[data,user])

  const signIn=async()=>{if(!hasFirebaseConfig)return;const {signInWithPopup}=await import('firebase/auth');await signInWithPopup(auth,googleProvider)}
  const signOutNow=async()=>{if(!auth)return;const {signOut}=await import('firebase/auth');await signOut(auth)}
  return {enabled:hasFirebaseConfig,user,lastSyncedAt,message,onSignIn:signIn,onSignOut:signOutNow}
}