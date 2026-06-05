export const STORAGE_KEY='yang-memorizer-mvp'
const MAX_REVIEW_INTERVAL_DAYS=365
export const dateKey=(value=new Date())=>{
  const date=new Date(value)
  const year=date.getFullYear()
  const month=String(date.getMonth()+1).padStart(2,'0')
  const day=String(date.getDate()).padStart(2,'0')
  return `${year}-${month}-${day}`
}
export const todayKey=()=>dateKey()

export const seedData=()=>({
  profile:{
    name:'mik!',
    nickname:'mik!',
    avatarUrl:'',
    bio:'把今天能记住的一点点先留下来。',
    examDate:'',
    dailyGoalMinutes:45,
    redeemedRewards:[],
    streak:6,
  },
  decks:[
    {id:'deck-english',name:'考研英语高频词',description:'先把最常错的词反复压熟。',section:'英语',chapter:'词汇',color:'sun',createdAt:Date.now()-86400000*8},
    {id:'deck-history',name:'中国近代史时间线',description:'事件、年份、意义一起记。',section:'法制史',chapter:'近现代法制',color:'sea',createdAt:Date.now()-86400000*4},
  ],
  cards:[
    {id:'card-1',deckId:'deck-english',front:'abandon',back:'放弃；丢弃',createdAt:Date.now()-86400000*8,review:{dueDate:todayKey(),interval:0,ease:2.5,reps:0,lapses:0,lastGrade:null}},
    {id:'card-2',deckId:'deck-english',front:'constraint',back:'限制；约束条件',createdAt:Date.now()-86400000*7,review:{dueDate:todayKey(),interval:0,ease:2.5,reps:0,lapses:0,lastGrade:null}},
    {id:'card-3',deckId:'deck-history',front:'辛亥革命爆发于哪一年？',back:'1911 年。它推翻了清王朝统治，推动中国进入共和时代。',createdAt:Date.now()-86400000*4,review:{dueDate:todayKey(),interval:0,ease:2.5,reps:0,lapses:0,lastGrade:null}},
  ],
  reviewLogs:[],
  dailyLogs:[],
})

export function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY)
    if(!raw)return seedData()
    const parsed=JSON.parse(raw)
    return parsed?.decks&&parsed?.cards?parsed:seedData()
  }catch{return seedData()}
}

const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)}

export function scheduleReview(review,grade){
  const r=review??{dueDate:todayKey(),interval:0,ease:2.5,reps:0,lapses:0,lastGrade:null}
  let ease=r.ease??2.5,reps=r.reps??0,lapses=r.lapses??0,interval=r.interval??0
  if(grade===0){ease=Math.max(1.3,ease-0.2);reps=0;lapses+=1;interval=1}
  else if(grade===1){ease=Math.max(1.3,ease-0.15);reps+=1;interval=Math.max(1,Math.round((interval||1)*1.2))}
  else if(grade===2){ease=Math.max(1.3,ease+0.05);reps+=1;interval=reps<=1?1:reps===2?3:Math.round(Math.max(4,interval*ease))}
  else{ease=Math.max(1.3,ease+0.15);reps+=1;interval=reps<=1?2:reps===2?5:Math.round(Math.max(6,interval*(ease+0.15)))}
  interval=Math.min(interval,MAX_REVIEW_INTERVAL_DAYS)
  return {dueDate:addDays(todayKey(),interval),interval,ease:Number(ease.toFixed(2)),reps,lapses,lastGrade:grade}
}

export const stats=(data)=>({
  dueToday:data.cards.filter(x=>x.review.dueDate<=todayKey()).length,
  learned:data.cards.filter(x=>x.review.reps>0).length,
  mastered:data.cards.filter(x=>x.review.interval>=7).length,
})

export const themeClass=(c)=>({sun:'theme-sun',sea:'theme-sea',rose:'theme-rose'}[c]??'theme-sun')
