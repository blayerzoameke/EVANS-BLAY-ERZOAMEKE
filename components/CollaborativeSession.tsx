import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Send, Users, Sparkles, LogOut, Copy, Check,
  Plus, Hash, Crown, Clock, X, Mic, MicOff, Camera, CameraOff,
  Video, VideoOff, Settings, BookOpen, Zap, ChevronLeft,
  Edit3, Trash2, MoreVertical, Download, Smile, Reply, Paperclip,
  Phone, PhoneOff, Volume2, VolumeX, GripVertical, Bot,
  CheckCheck, AlertCircle, Search, Bell, BellOff, Maximize2
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { doc, onSnapshot, updateDoc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import type { UserDetails, Toast, Note } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { useLanguage } from '../contexts/LanguageContext';

interface CollaborativeSessionProps {
  userDetails: UserDetails | null;
  addToast: (message: string, type: Toast['type']) => void;
  onActionAttempt: (action: () => Promise<void>) => void;
  activeCode: string | null;
  setActiveCode: (code: string | null) => void;
  notes: Note[];
  setNotes: (notes: Note[]) => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  type: 'text' | 'ai' | 'system' | 'audio' | 'image' | 'file' | 'poll_inline';
  audioDuration?: number;
  audioData?: string;
  reactions?: Record<string, string[]>;
  edited?: boolean;
  editedAt?: number;
  deleted?: boolean;
  replyTo?: { id: string; sender: string; text: string };
  pollData?: { question: string; options: { text: string; votes: string[] }[]; allowMultiple?: boolean; createdBy?: string; ts?: number; };
}

interface SessionMember { name: string; joinedAt: number; isHost: boolean; }
interface AIChatTurn { role: 'user' | 'ai'; text: string; ts: number; }

const AVATAR_COLORS = [
  ['#6366f1','#818cf8'], ['#0ea5e9','#38bdf8'], ['#10b981','#34d399'],
  ['#f59e0b','#fbbf24'], ['#ec4899','#f472b6'], ['#8b5cf6','#a78bfa'],
  ['#14b8a6','#2dd4bf'],
];
const avatarColor = (name: string) =>
  AVATAR_COLORS[name.split('').reduce((a,c)=>a+c.charCodeAt(0),0) % AVATAR_COLORS.length];

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const fmtDate = (ts: number) => {
  const d = new Date(ts), t = new Date(), y = new Date(t); y.setDate(t.getDate()-1);
  if (d.toDateString()===t.toDateString()) return 'Today';
  if (d.toDateString()===y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});
};
const sameDay = (a:number,b:number) => new Date(a).toDateString()===new Date(b).toDateString();
const genCode = () => Math.random().toString(36).substring(2,8).toUpperCase();
const EMOJIS = ['👍','🔥','💡','❤️','😂','👏','🎯','💯'];

const inlineFormat = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2,-2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1,-1)}</em>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{background:'rgba(0,0,0,.12)',padding:'1px 5px',borderRadius:4,fontSize:12,fontFamily:'monospace'}}>{part.slice(1,-1)}</code>;
    return part;
  });
};

const renderAIText = (text: string): React.ReactNode => {
  if (!text) return null;
  let t = text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_,m) => `[Math: ${m.trim()}]`)
    .replace(/\$([^$\n]+?)\$/g, (_,m) => `[${m.trim()}]`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_,m) => `[Math: ${m.trim()}]`)
    .replace(/\\\(([^\n)]+?)\\\)/g, (_,m) => `[${m.trim()}]`);
  const lines = t.split('\n');
  const result: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listOrdered = false;
  const flushList = (key: number) => {
    if (!listItems.length) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    result.push(<Tag key={`list-${key}`} style={{margin:'4px 0 4px 18px',padding:0}}>{listItems}</Tag>);
    listItems = [];
  };
  lines.forEach((line, i) => {
    const tr = line.trim();
    if (!tr) { flushList(i); return; }
    if (tr.startsWith('### ')) { flushList(i); result.push(<p key={i} style={{fontWeight:800,fontSize:13,margin:'8px 0 2px'}}>{inlineFormat(tr.slice(4))}</p>); }
    else if (tr.startsWith('## ')) { flushList(i); result.push(<p key={i} style={{fontWeight:900,fontSize:14,margin:'10px 0 3px'}}>{inlineFormat(tr.slice(3))}</p>); }
    else if (tr.startsWith('# ')) { flushList(i); result.push(<p key={i} style={{fontWeight:900,fontSize:15,margin:'12px 0 4px'}}>{inlineFormat(tr.slice(2))}</p>); }
    else if (/^[-*]\s/.test(tr)) { if (listOrdered && listItems.length) flushList(i); listOrdered = false; listItems.push(<li key={i} style={{marginBottom:2,fontSize:13,lineHeight:1.6}}>{inlineFormat(tr.slice(2))}</li>); }
    else if (/^\d+\.\s/.test(tr)) { if (!listOrdered && listItems.length) flushList(i); listOrdered = true; listItems.push(<li key={i} style={{marginBottom:2,fontSize:13,lineHeight:1.6}}>{inlineFormat(tr.replace(/^\d+\.\s/,''))}</li>); }
    else { flushList(i); result.push(<p key={i} style={{margin:'3px 0',fontSize:13,lineHeight:1.65}}>{inlineFormat(tr)}</p>); }
  });
  flushList(lines.length);
  return <>{result}</>;
};

const Av:React.FC<{name:string;size?:number;online?:boolean}> = ({name,size=36,online}) => {
  const [from,to] = avatarColor(name);
  return (
    <div style={{position:'relative',flexShrink:0,width:size,height:size}}>
      <div style={{width:size,height:size,borderRadius:'50%',background:`linear-gradient(135deg,${from},${to})`,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:size*0.38,boxShadow:`0 2px 8px ${from}55`}}>
        {name.charAt(0).toUpperCase()}
      </div>
      {online!==undefined && <span style={{position:'absolute',bottom:1,right:1,width:size*0.28,height:size*0.28,borderRadius:'50%',background:online?'#22c55e':'#9ca3af',border:`2px solid white`,boxShadow:online?'0 0 6px #22c55e88':'none'}}/>}
    </div>
  );
};

export function CollaborativeSession({userDetails,addToast,activeCode,setActiveCode}:CollaborativeSessionProps) {
  const {t} = useLanguage();

  const [screen,setScreen] = useState<'lobby'|'waiting'|'chat'>(activeCode?'chat':'lobby');
  const [joinInput,setJoinInput] = useState('');
  const [sessionCode,setSessionCode] = useState(activeCode||'');
  const [sessionName,setSessionName] = useState('Study Session');
  const [messages,setMessages] = useState<ChatMessage[]>([]);
  const [members,setMembers] = useState<SessionMember[]>([]);
  const [newMessage,setNewMessage] = useState('');
  const [isSending,setIsSending] = useState(false);
  const [isCreating,setIsCreating] = useState(false);
  const [isJoining,setIsJoining] = useState(false);
  const [codeCopied,setCodeCopied] = useState(false);
  const [showLeaveModal,setShowLeaveModal] = useState(false);

  const [showMembers,setShowMembers] = useState(false);
  const [showSettings,setShowSettings] = useState(false);
  const [showSearch,setShowSearch] = useState(false);
  const [searchQuery,setSearchQuery] = useState('');
  const [showAIPanel,setShowAIPanel] = useState(false);
  const [aiPanelWidth,setAIPanelWidth] = useState(340);
  const [isDraggingSplitter,setIsDraggingSplitter] = useState(false);

  const [contextMenu,setContextMenu] = useState<{msgId:string;x:number;y:number}|null>(null);
  const [editingId,setEditingId] = useState<string|null>(null);
  const [editText,setEditText] = useState('');
  const [replyTo,setReplyTo] = useState<ChatMessage|null>(null);
  const [emojiPicker,setEmojiPicker] = useState<string|null>(null);
  const [highlightedId,setHighlightedId] = useState<string|null>(null);

  const [aiInput,setAIInput] = useState('');
  const [aiHistory,setAIHistory] = useState<AIChatTurn[]>([]);
  const [isAIThinking,setIsAIThinking] = useState(false);
  const [aiNotify,setAINotify] = useState(false);

  const [isRecording,setIsRecording] = useState(false);
  const [recordingTime,setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingSecsRef = useRef<number>(0);

  const [cameraActive,setCameraActive] = useState(false);
  const [micActive,setMicActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream|null>(null);
  const [cameraStream,setCameraStream] = useState<MediaStream|null>(null);

  const [muted,setMuted] = useState(false);
  const [notificationsOn,setNotificationsOn] = useState(true);
  const [sessionTheme,setSessionTheme] = useState('#6366f1');
  const [lightboxImg,setLightboxImg] = useState<string|null>(null);
  const [showCameraModal,setShowCameraModal] = useState(false);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pendingSend,setPendingSend] = useState<{type:'photo'|'audio'|'file'|'image';data:string;name:string;duration?:number}|null>(null);
  const [showNotepad,setShowNotepad] = useState(false);
  const [notepadText,setNotepadText] = useState('');
  const notepadSaveTimer = useRef<any>(null);
  const [showPoll,setShowPoll] = useState(false);
  const [pollQuestion,setPollQuestion] = useState('');
  const [pollOptions,setPollOptions] = useState(['','']);
  const [pollAllowMultiple,setPollAllowMultiple] = useState(false);
  const [activePoll,setActivePoll] = useState<any>(null);
  const [chatBg,setChatBg] = useState<{color:string;pattern:string}>({color:'#e8edf8',pattern:'dots'});
  const [playingAudio,setPlayingAudio] = useState<string|null>(null);
  const [emojiForInput,setEmojiForInput] = useState(false);
  const [unread,setUnread] = useState(0);
  const [pastSessions,setPastSessions] = useState<any[]>([]);

  // ── NEW: mobile action tray ──
  const [showMoreActions,setShowMoreActions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{ if(activeCode){setSessionCode(activeCode);setScreen('chat');} },[activeCode]);
  useEffect(()=>{ try{const s=localStorage.getItem('eb_sessions');if(s)setPastSessions(JSON.parse(s));}catch{} },[]);
  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);
  useEffect(()=>{ aiEndRef.current?.scrollIntoView({behavior:'smooth'}); },[aiHistory]);
  useEffect(()=>{ if(screen==='chat') setTimeout(()=>inputRef.current?.focus(),150); },[screen]);

  useEffect(()=>{
    if(cameraStream && videoRef.current){
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(()=>{});
    }
  },[cameraStream]);

  useEffect(()=>{
    if(!sessionCode||(screen!=='chat' && screen!=='waiting')) return;
    const unsub = onSnapshot(doc(db,'sessions',sessionCode),(snap)=>{
      if(snap.exists()){
        const d=snap.data();
        const newMsgs = d.messages||[];
        setMessages(prev=>{
          if(newMsgs.length>prev.length && prev.length>0 && notificationsOn) setUnread(u=>u+(newMsgs.length-prev.length));
          return newMsgs;
        });
        setMembers(d.members||[]);
        if(d.name) setSessionName(d.name);
        if(d.notepad!==undefined) setNotepadText(d.notepad);
        if(d.activePoll!==undefined) setActivePoll(d.activePoll||null);
        if(screen==='waiting' && (d.members||[]).length >= 2) setScreen('chat');
        if(d.aiHistory) setAIHistory(d.aiHistory);
      }
    });
    return unsub;
  },[sessionCode,screen,notificationsOn]);

  useEffect(()=>{
    if(!isDraggingSplitter) return;
    const onMove=(e:MouseEvent)=>{
      const container = splitterRef.current?.parentElement;
      if(!container) return;
      const rect = container.getBoundingClientRect();
      setAIPanelWidth(Math.max(260,Math.min(600,rect.right - e.clientX)));
    };
    const onUp=()=>setIsDraggingSplitter(false);
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
    return()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);};
  },[isDraggingSplitter]);

  const toggleCamera = async()=>{
    if(cameraActive){
      localStreamRef.current?.getTracks().forEach(t=>t.stop());
      localStreamRef.current=null; setCameraStream(null); setCameraActive(false);
      if(videoRef.current) videoRef.current.srcObject=null;
      setShowCameraModal(false);
    } else {
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
        localStreamRef.current=stream; setCameraStream(stream); setCameraActive(true);
        setShowCameraModal(true);
        setTimeout(()=>{ if(videoRef.current){ videoRef.current.srcObject=stream; videoRef.current.play().catch(()=>{}); }},150);
      }catch(err){console.error(err);addToast('Camera access denied. Please allow camera permission.','error');}
    }
  };

  const capturePhoto = ()=>{
    const video=videoRef.current; const canvas=photoCanvasRef.current;
    if(!video||!canvas) return;
    canvas.width=video.videoWidth||640; canvas.height=video.videoHeight||480;
    const ctx=canvas.getContext('2d'); if(!ctx) return;
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL('image/jpeg',0.85);
    localStreamRef.current?.getTracks().forEach(t=>t.stop());
    localStreamRef.current=null; setCameraStream(null); setCameraActive(false);
    if(videoRef.current) videoRef.current.srcObject=null;
    setShowCameraModal(false);
    setPendingSend({type:'photo',data:dataUrl,name:'Photo'});
  };

  const confirmAndSend = async()=>{
    if(!pendingSend||!userDetails||!sessionCode) return;
    const {type,data,name,duration} = pendingSend;
    const isAudio = type==='audio';
    const isImgType = type==='photo'||type==='image';
    const msg:ChatMessage={
      id:Date.now().toString(), sender:userDetails.name, timestamp:Date.now(),
      text: type==='photo'?'📷 Photo': type==='audio'?`🎤 Voice message${duration?` (${duration}s)`:''}`:`${isImgType?'📷':'📎'} ${name}`,
      type: isImgType?'image' as any: isAudio?'audio' as any:'file' as any,
      audioData: data,
      ...(isAudio&&duration?{audioDuration:duration}:{}),
    };
    setPendingSend(null);
    try {
      const sessionRef = doc(db,'sessions',sessionCode);
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) return;
      const d = snap.data();
      let msgs: ChatMessage[] = d.messages || [];
      msgs.push(msg);
      let docSize = JSON.stringify(msgs).length;
      const MAX_SIZE = 900000;
      if (docSize > MAX_SIZE) {
        for (let i = 0; i < msgs.length; i++) {
          if (msgs[i].audioData && msgs[i].id !== msg.id) {
            msgs[i].audioData = undefined;
            msgs[i].text += ' [Storage limit reached - Attachment removed]';
            docSize = JSON.stringify(msgs).length;
            if (docSize < MAX_SIZE) break;
          }
        }
      }
      while (JSON.stringify(msgs).length > MAX_SIZE && msgs.length > 10) msgs.shift();
      await updateDoc(sessionRef, { messages: msgs, lastActivity: Date.now() });
      addToast(isAudio?'🎤 Voice sent!':isImgType?'📷 Photo sent!':'📎 File sent!','success');
    } catch(err: any) {
      console.error(err);
      addToast('Failed to send file. It might be too large.', 'error');
    }
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    fetch(dataUrl).then(res=>res.blob()).then(blob=>{
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    }).catch(e=>{ console.error("Download fail", e); addToast('Download failed', 'error'); });
  };

  const toggleMic = async()=>{
    if(micActive){ localStreamRef.current?.getAudioTracks().forEach(t=>t.stop()); setMicActive(false); }
    else {
      try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); localStreamRef.current=stream; setMicActive(true); }
      catch{ addToast('Microphone access denied.','error'); }
    }
  };

  const startRecording = async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);
      audioChunksRef.current=[]; recordingSecsRef.current=0;
      mr.ondataavailable=e=>audioChunksRef.current.push(e.data);
      mr.onstop=async()=>{
        const duration = recordingSecsRef.current;
        const blob=new Blob(audioChunksRef.current,{type:'audio/webm'});
        stream.getTracks().forEach(t=>t.stop());
        const reader=new FileReader();
        reader.onload=async()=>{ setPendingSend({type:'audio',data:reader.result as string,name:`Voice message (${duration}s)`,duration}); };
        reader.readAsDataURL(blob);
        setRecordingTime(0); recordingSecsRef.current=0;
      };
      mr.start(); mediaRecorderRef.current=mr; setIsRecording(true);
      recordingTimerRef.current=setInterval(()=>{ recordingSecsRef.current+=1; setRecordingTime(recordingSecsRef.current); },1000);
    }catch{ addToast('Cannot access microphone.','error'); }
  };

  const stopRecording=()=>{ mediaRecorderRef.current?.stop(); setIsRecording(false); clearInterval(recordingTimerRef.current); };

  const sendFile = async(file: File) => {
    if(!userDetails||!sessionCode) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const dataUrl = reader.result as string;
      setPendingSend({type:file.type.startsWith('image/')?'image':'file', data:dataUrl, name:file.name});
    };
    reader.readAsDataURL(file);
  };

  const createSession=async()=>{
    if(!userDetails){addToast('Set up profile first.','error');return;}
    setIsCreating(true);
    try{
      const code=genCode();
      const sysMsg:ChatMessage={id:Date.now().toString(),sender:'System',type:'system',timestamp:Date.now(),
        text:`📚 Session "${code}" created by ${userDetails.name}. Share the code to invite others!`};
      await setDoc(doc(db,'sessions',code),{
        code,name:'Study Session',host:userDetails.name,
        createdAt:Date.now(),lastActivity:Date.now(),
        members:[{name:userDetails.name,joinedAt:Date.now(),isHost:true}],
        messages:[sysMsg],aiHistory:[],
      });
      setSessionCode(code);setActiveCode(code);setScreen('waiting');
      addToast(`Session created! Share code: ${code}`,'success');
      savePast(code,'Study Session',userDetails.name,1,1);
    }catch(e:any){addToast('Failed to create session.','error');console.error(e);}
    finally{setIsCreating(false);}
  };

  const joinSession=async(codeOverride?:string)=>{
    const code=(codeOverride||joinInput).trim().toUpperCase();
    if(!code||code.length<4){addToast('Enter a valid code.','error');return;}
    if(!userDetails){addToast('Set up profile first.','error');return;}
    setIsJoining(true);
    try{
      const ref=doc(db,'sessions',code);
      const snap=await getDoc(ref);
      if(!snap.exists()){addToast('Session not found.','error');setIsJoining(false);return;}
      const d=snap.data();
      if(!(d.members||[]).some((m:SessionMember)=>m.name===userDetails.name)){
        const joinMsg:ChatMessage={id:Date.now().toString(),sender:'System',type:'system',timestamp:Date.now(),text:`👋 ${userDetails.name} joined the session.`};
        await updateDoc(ref,{members:arrayUnion({name:userDetails.name,joinedAt:Date.now(),isHost:false}),messages:arrayUnion(joinMsg),lastActivity:Date.now()});
      }
      setSessionCode(code);setActiveCode(code);setScreen('chat');
      addToast('Joined session!','success');
    }catch(e:any){addToast('Failed to join.','error');console.error(e);}
    finally{setIsJoining(false);}
  };

  const sendMessage=async()=>{
    if(!newMessage.trim()||!sessionCode||!userDetails||isSending) return;
    const text=newMessage.trim();
    setNewMessage('');setReplyTo(null);setIsSending(true);
    try{
      const msg:ChatMessage={id:Date.now().toString(),sender:userDetails.name,text,timestamp:Date.now(),type:'text',
        ...(replyTo?{replyTo:{id:replyTo.id,sender:replyTo.sender,text:replyTo.text.substring(0,80)}}:{})};
      await updateDoc(doc(db,'sessions',sessionCode),{messages:arrayUnion(msg),lastActivity:Date.now()});
    }catch(e:any){addToast('Failed to send.','error');setNewMessage(text);console.error(e);}
    finally{setIsSending(false);inputRef.current?.focus();}
  };

  const askAI=async(question?:string)=>{
    const q=(question||aiInput).trim();
    if(!q||isAIThinking) return;
    setAIInput('');setIsAIThinking(true);
    const userTurn:AIChatTurn={role:'user',text:q,ts:Date.now()};
    const optimisticHistory=[...aiHistory,userTurn];
    setAIHistory(optimisticHistory);
    const questionMsg:ChatMessage={id:`ai-q-${Date.now()}`,sender:userDetails?.name||'Member',text:`🤖 Asked AI: "${q}"`,timestamp:Date.now(),type:'system'};
    try{
      const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
      const chatCtx=messages.filter(m=>m.type==='text').slice(-8).map(m=>`${m.sender}: ${m.text}`).join('\n');
      const histCtx=optimisticHistory.slice(-6).map(t=>`${t.role==='user'?'Student':'EduBlay AI'}: ${t.text}`).join('\n');
      const prompt=`You are EduBlay AI — an expert academic assistant in a collaborative study session called "${sessionName}".\n\nRecent chat:\n${chatCtx}\n\nAI conversation so far:\n${histCtx}\n\nStudent asks: ${q}\n\nRespond clearly and educationally. Use markdown formatting (bold, lists) where helpful.`;
      const res=await ai.models.generateContent({model:'gemini-3.1-pro-preview',contents:prompt});
      const answer=res.text||'I could not generate a response.';
      const aiTurn:AIChatTurn={role:'ai',text:answer,ts:Date.now()};
      const newHistory=[...optimisticHistory,aiTurn];
      await updateDoc(doc(db,'sessions',sessionCode),{aiHistory:newHistory.slice(-40),lastActivity:Date.now(),messages:arrayUnion(questionMsg)});
      setAIHistory(newHistory);
      if(!showAIPanel) setAINotify(true);
    }catch(e:any){addToast('AI failed to respond.','error');console.error(e);}
    finally{setIsAIThinking(false);}
  };

  const saveEdit=async()=>{
    if(!editText.trim()||!sessionCode) return;
    try{
      const snap=await getDoc(doc(db,'sessions',sessionCode));
      if(!snap.exists()) return;
      const updated=(snap.data().messages||[]).map((m:ChatMessage)=>m.id===editingId?{...m,text:editText.trim(),edited:true,editedAt:Date.now()}:m);
      await updateDoc(doc(db,'sessions',sessionCode),{messages:updated});
    }catch(e:any){addToast('Edit failed.','error');console.error(e);}
    setEditingId(null);setEditText('');
  };

  const deleteMsg=async(id:string)=>{
    if(!sessionCode) return;
    try{
      const snap=await getDoc(doc(db,'sessions',sessionCode));
      if(!snap.exists()) return;
      const updated=(snap.data().messages||[]).map((m:ChatMessage)=>m.id===id?{...m,deleted:true,text:'This message was deleted'}:m);
      await updateDoc(doc(db,'sessions',sessionCode),{messages:updated});
    }catch(e:any){addToast('Delete failed.','error');console.error(e);}
    setContextMenu(null);
  };

  const addReaction=async(msgId:string,emoji:string)=>{
    if(!userDetails||!sessionCode) return;
    setEmojiPicker(null);
    try{
      const snap=await getDoc(doc(db,'sessions',sessionCode));
      if(!snap.exists()) return;
      const updated=(snap.data().messages||[]).map((m:ChatMessage)=>{
        if(m.id!==msgId) return m;
        const r={...(m.reactions||{})};
        const users:string[]=r[emoji]||[];
        if(users.includes(userDetails.name)) r[emoji]=users.filter(u=>u!==userDetails.name);
        else r[emoji]=[...users,userDetails.name];
        if(!r[emoji]?.length) delete r[emoji];
        return {...m,reactions:r};
      });
      await updateDoc(doc(db,'sessions',sessionCode),{messages:updated});
    }catch(e:any){console.error(e);}
  };

  const leaveSession=async()=>{
    setShowLeaveModal(false);
    try{
      if(sessionCode&&userDetails){
        const ref=doc(db,'sessions',sessionCode);
        const snap=await getDoc(ref);
        if(snap.exists()){
          const d=snap.data();
          const leaveMsg:ChatMessage={id:Date.now().toString(),sender:'System',type:'system',timestamp:Date.now(),text:`👋 ${userDetails.name} left the session.`};
          await updateDoc(ref,{members:(d.members||[]).filter((m:SessionMember)=>m.name!==userDetails.name),messages:arrayUnion(leaveMsg),lastActivity:Date.now()});
        }
      }
    }catch(e:any){console.error(e);}
    localStreamRef.current?.getTracks().forEach(t=>t.stop());
    setActiveCode(null);setSessionCode('');setMessages([]);setMembers([]);
    setAIHistory([]);setScreen('lobby');setJoinInput('');setShowAIPanel(false);
    setCameraActive(false);setMicActive(false);
  };

  const savePast=(code:string,name:string,host:string,members:number,messages:number)=>{
    try{
      const s=JSON.parse(localStorage.getItem('eb_sessions')||'[]');
      const updated=[{code,name,host,members,messages,ts:Date.now()},...s.filter((x:any)=>x.code!==code)].slice(0,15);
      localStorage.setItem('eb_sessions',JSON.stringify(updated));
      setPastSessions(updated);
    }catch{}
  };

  const deletePastSession=(e:React.MouseEvent,code:string)=>{
    e.stopPropagation();
    try{
      const updated=pastSessions.filter(s=>s.code!==code);
      localStorage.setItem('eb_sessions',JSON.stringify(updated));
      setPastSessions(updated);
      addToast('Session removed from history.','success');
    }catch{}
  };

  const copyCode=()=>{navigator.clipboard.writeText(sessionCode).then(()=>{setCodeCopied(true);setTimeout(()=>setCodeCopied(false),2000);});};

  const isHost=members.find(m=>m.name===userDetails?.name)?.isHost??false;
  const filteredMessages=searchQuery?messages.filter(m=>m.text.toLowerCase().includes(searchQuery.toLowerCase())):messages;

  const scrollToMsg=(id:string)=>{
    setHighlightedId(id);
    const el=document.getElementById(`msg-${id}`);
    if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>setHighlightedId(null),2000);
  };

  const syncNotepad=(text:string)=>{
    if(!sessionCode) return;
    clearTimeout(notepadSaveTimer.current);
    notepadSaveTimer.current=setTimeout(async()=>{
      try{await updateDoc(doc(db,'sessions',sessionCode),{notepad:text,lastActivity:Date.now()});}catch(e:any){console.error(e);}
    },700);
  };

  const createPoll=async()=>{
    if(!pollQuestion.trim()||pollOptions.filter(o=>o.trim()).length<2) return;
    if(!userDetails||!sessionCode) return;
    const poll={question:pollQuestion.trim(),options:pollOptions.filter(o=>o.trim()).map(o=>({text:o.trim(),votes:[]})),createdBy:userDetails.name,ts:Date.now(),allowMultiple:pollAllowMultiple};
    const msg:ChatMessage={id:Date.now().toString(),sender:userDetails.name,text:'📊 Launched a poll',timestamp:Date.now(),type:'poll_inline',pollData:poll};
    await updateDoc(doc(db,'sessions',sessionCode),{messages:arrayUnion(msg),lastActivity:Date.now()});
    setShowPoll(false);setPollQuestion('');setPollOptions(['','']);setPollAllowMultiple(false);
    addToast('📊 Poll launched!','success');
  };

  const votePoll=async(msgId:string,optIdx:number)=>{
    if(!userDetails||!sessionCode) return;
    const msg=messages.find(m=>m.id===msgId);
    if(!msg||!msg.pollData) return;
    let options=[...msg.pollData.options];
    const option=options[optIdx];
    const username=userDetails.name;
    const hasVoted=option.votes.includes(username);
    if(hasVoted){ options[optIdx]={...option,votes:option.votes.filter(v=>v!==username)}; }
    else{
      if(!msg.pollData.allowMultiple) options=options.map(o=>({...o,votes:o.votes.filter(v=>v!==username)}));
      options[optIdx]={...options[optIdx],votes:[...options[optIdx].votes,username]};
    }
    const updatedMsgs=messages.map(m=>m.id===msgId?{...m,pollData:{...m.pollData!,options}}:m);
    await updateDoc(doc(db,'sessions',sessionCode),{messages:updatedMsgs});
  };

  /* ════ LOBBY ════ */
  if(screen==='lobby') return (
    <div className="cs-flex-mobile" style={{display:'flex',height:'100%',minHeight:520,background:'var(--cs-surface,#f8faff)',borderRadius:16,overflow:'hidden',border:'1px solid rgba(99,102,241,.15)'}}>
      <style>{`
        @keyframes cs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes cs-fadein{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cs-card{background:white;border-radius:18px;padding:18px;border:1px solid rgba(99,102,241,.12);box-shadow:0 4px 20px rgba(0,0,0,.05);transition:box-shadow .2s,transform .2s;width:100%;box-sizing:border-box;}
        .cs-card:hover{box-shadow:0 10px 32px rgba(99,102,241,.16);transform:translateY(-2px);}
        .dark .cs-card{background:#1f2937;border-color:rgba(99,102,241,.2);}
        .cs-pri-btn{background:linear-gradient(135deg,#4338ca,#6366f1);color:white;border:none;border-radius:12px;padding:12px 20px;font-weight:800;font-size:14px;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;box-sizing:border-box;}
        .cs-pri-btn:hover:not(:disabled){filter:brightness(1.08);box-shadow:0 6px 20px rgba(99,102,241,.4);transform:translateY(-1px);}
        .cs-pri-btn:disabled{opacity:.5;cursor:not-allowed;}
        .cs-hist-row{padding:10px 12px;border-radius:12px;cursor:pointer;transition:background .15s;position:relative;}
        .cs-hist-row:hover{background:rgba(99,102,241,.07);}
        .dark .cs-hist-row:hover{background:rgba(99,102,241,.12);}
        .cs-hist-del{opacity:0;position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:6px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#ef4444;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;font-size:12px;line-height:1;}
        .cs-hist-row:hover .cs-hist-del{opacity:1;}
        .cs-hist-del:hover{background:rgba(239,68,68,.2)!important;border-color:rgba(239,68,68,.5)!important;transform:scale(1.1);}
        /* Scrollbar for recent sessions */
        .cs-sessions-scroll::-webkit-scrollbar{width:4px;}
        .cs-sessions-scroll::-webkit-scrollbar-track{background:transparent;}
        .cs-sessions-scroll::-webkit-scrollbar-thumb{background:rgba(99,102,241,.3);border-radius:4px;}
        .cs-sessions-scroll::-webkit-scrollbar-thumb:hover{background:rgba(99,102,241,.5);}
        @media(max-width:900px){
  .cs-flex-mobile{flex-direction:column!important;height:auto!important;min-height:calc(100dvh - 60px)!important;flex:1;margin:-16px;width:calc(100% + 32px);border-radius:0!important;border:none!important;}
  .cs-lobby-sidebar{width:100%!important;height:280px!important;max-height:280px!important;min-height:280px!important;border-left:none!important;border-top:1px solid rgba(99,102,241,0.12)!important;flex-shrink:0!important;overflow:hidden!important;}
  .cs-sessions-scroll{overflow-y:scroll!important;scrollbar-width:thin!important;scrollbar-color:rgba(99,102,241,.5) rgba(99,102,241,.1)!important;}
  .cs-sessions-scroll::-webkit-scrollbar{width:5px!important;display:block!important;}
  .cs-sessions-scroll::-webkit-scrollbar-track{background:rgba(99,102,241,.08)!important;border-radius:4px!important;}
  .cs-sessions-scroll::-webkit-scrollbar-thumb{background:rgba(99,102,241,.45)!important;border-radius:4px!important;}
  .cs-sessions-scroll::-webkit-scrollbar-thumb:hover{background:rgba(99,102,241,.7)!important;}
}
@media(max-width:480px){
  .cs-flex-mobile{margin:-12px;width:calc(100% + 24px);}
  .cs-card{padding:14px!important;border-radius:14px!important;}
  .cs-pri-btn{font-size:13px!important;padding:11px 16px!important;}
}
      `}</style>

      {/* Main lobby */}
      <div style={{flex:1,minWidth:0,width:'100%',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'2rem 1.5rem',overflowY:'auto'}} className="cs-fadein">
        <div style={{width:'100%',maxWidth:400,boxSizing:'border-box'}}>

          {/* Warning banner */}
          <div style={{marginBottom:20,marginTop:4,padding:'14px 16px',background:'rgba(251,191,36,.15)',border:'1.5px solid rgba(245,158,11,.35)',borderRadius:14,color:'#92400e',width:'100%',boxSizing:'border-box',overflow:'visible'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <span style={{fontSize:18,lineHeight:1.4,flexShrink:0}}>⚠️</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontWeight:800,fontSize:13,lineHeight:1.4,color:'#92400e'}}>Important Privacy Notice</p>
                <p style={{margin:'5px 0 0',fontSize:12,lineHeight:1.6,color:'#92400e',opacity:0.9,wordBreak:'break-word',whiteSpace:'normal'}}>
                  An AI assistant monitors chats to provide smart summaries and answers. Do not discuss highly confidential or secret information. If you require absolute privacy from AI, please do not use this session.
                </p>
              </div>
            </div>
          </div>

          <div style={{textAlign:'center',marginBottom:28}}>
            <div style={{display:'inline-flex',width:72,height:72,borderRadius:20,background:'linear-gradient(135deg,#4338ca,#6366f1)',alignItems:'center',justifyContent:'center',marginBottom:14,boxShadow:'0 8px 28px rgba(99,102,241,.4)',animation:'cs-float 4s ease-in-out infinite'}}>
              <Users style={{width:34,height:34,color:'white'}}/>
            </div>
            <h2 className="dark:text-white" style={{fontSize:24,fontWeight:900,margin:'0 0 6px',color:'#111827'}}>Collaborative Study</h2>
            <p style={{color:'#6b7280',fontSize:14,margin:0}}>Real-time sessions with chat, voice, camera & AI</p>
          </div>

          <div className="cs-card" style={{marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div style={{width:26,height:26,borderRadius:8,background:'rgba(99,102,241,.1)',display:'flex',alignItems:'center',justifyContent:'center'}}><Plus style={{width:13,height:13,color:'#6366f1'}}/></div>
              <span className="dark:text-white" style={{fontWeight:800,fontSize:12,textTransform:'uppercase',letterSpacing:'.06em',color:'#111827'}}>Create Session</span>
            </div>
            <p style={{color:'#9ca3af',fontSize:12,marginBottom:14}}>Start a new study room. A unique code will be generated.</p>
            <button className="cs-pri-btn" onClick={createSession} disabled={isCreating||!userDetails}>
              {isCreating?<><span style={{width:15,height:15,borderRadius:'50%',border:'2.5px solid rgba(255,255,255,.3)',borderTopColor:'white',display:'inline-block',animation:'spin .8s linear infinite'}}/> Creating…</>:<><Zap style={{width:14,height:14}}/> Create New Session</>}
            </button>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:10,margin:'12px 0'}}>
            <div style={{flex:1,height:1,background:'#e5e7eb'}} className="dark:bg-gray-600"/>
            <span style={{color:'#9ca3af',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em'}}>or join</span>
            <div style={{flex:1,height:1,background:'#e5e7eb'}} className="dark:bg-gray-600"/>
          </div>

          <div className="cs-card">
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div style={{width:26,height:26,borderRadius:8,background:'rgba(99,102,241,.1)',display:'flex',alignItems:'center',justifyContent:'center'}}><Hash style={{width:13,height:13,color:'#6366f1'}}/></div>
              <span className="dark:text-white" style={{fontWeight:800,fontSize:12,textTransform:'uppercase',letterSpacing:'.06em',color:'#111827'}}>Join Session</span>
            </div>
            <div style={{display:'flex',gap:8}}>
              <input type="text" value={joinInput} onChange={e=>setJoinInput(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==='Enter'&&joinSession()} maxLength={8} placeholder="Enter code e.g. AB12CD"
                className="dark:bg-gray-700 dark:text-white dark:border-gray-500"
                style={{flex:1,padding:'11px 14px',borderRadius:10,border:'1.5px solid #e5e7eb',background:'#f9fafb',fontSize:14,fontWeight:800,fontFamily:'monospace',letterSpacing:'.12em',textTransform:'uppercase',outline:'none',color:'#111827',transition:'border-color .2s'}}
                onFocus={e=>{e.target.style.borderColor='#6366f1';}} onBlur={e=>{e.target.style.borderColor='#e5e7eb';}}/>
              <button className="cs-pri-btn" style={{width:'auto',padding:'11px 18px'}} onClick={()=>joinSession()} disabled={isJoining||!joinInput.trim()||!userDetails}>
                {isJoining?<span style={{width:15,height:15,borderRadius:'50%',border:'2.5px solid rgba(255,255,255,.3)',borderTopColor:'white',display:'inline-block',animation:'spin .8s linear infinite'}}/>:'Join'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History sidebar */}
      <div className="cs-lobby-sidebar dark:bg-gray-800 dark:border-gray-700" style={{width:240,flexShrink:0,background:'#f0f4ff',borderLeft:'1px solid rgba(99,102,241,.12)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'14px 14px 10px',borderBottom:'1px solid rgba(99,102,241,.1)',flexShrink:0}} className="dark:border-gray-700">
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <Clock style={{width:13,height:13,color:'#6366f1'}}/>
            <span style={{fontWeight:800,fontSize:11,textTransform:'uppercase',letterSpacing:'.07em',color:'#374151'}} className="dark:text-gray-300">Recent Sessions</span>
          </div>
          <p style={{fontSize:10,color:'#9ca3af',marginTop:4,marginBottom:0,lineHeight:1.3}}>
            Only the last 15 sessions are saved. Older ones are removed automatically.
          </p>
        </div>
        <div className="cs-sessions-scroll" style={{flex:1,overflowY:'auto',padding:'8px',WebkitOverflowScrolling:'touch' as any,scrollbarWidth:'thin' as any,scrollbarColor:'rgba(99,102,241,.3) transparent' as any}}>
          {pastSessions.length===0?(
            <div style={{textAlign:'center',padding:'32px 12px',color:'#9ca3af'}}>
              <BookOpen style={{width:26,height:26,margin:'0 auto 8px',opacity:.35}}/>
              <p style={{fontSize:12,margin:0}}>No past sessions.<br/>Create one to start!</p>
            </div>
          ):pastSessions.map((s,i)=>(
            <div key={i} className="cs-hist-row dark:hover:bg-gray-700" onClick={()=>joinSession(s.code)}>
              <button className="cs-hist-del" onClick={e=>deletePastSession(e,s.code)} title="Remove from history">✕</button>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,paddingRight:28}}>
                <span style={{fontFamily:'monospace',fontWeight:800,fontSize:13,color:'#6366f1',letterSpacing:'.1em'}}>{s.code}</span>
                <span style={{fontSize:10,color:'#9ca3af'}}>{fmtDate(s.ts)}</span>
              </div>
              <p className="dark:text-gray-400" style={{fontSize:12,color:'#374151',fontWeight:600,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:4}}>{s.name||'Study Session'}</p>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
                <span style={{fontSize:11,color:'#9ca3af'}}>{s.members} members · {s.messages} msgs</span>
                <span style={{fontSize:10,fontWeight:700,color:'#6366f1',background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.2)',borderRadius:6,padding:'1px 6px',whiteSpace:'nowrap',flexShrink:0}}>Rejoin →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ════ GROUP MESSAGES ════ */
  const groups:{ date:number; msgs:ChatMessage[] }[]=[];
  filteredMessages.forEach((m,i)=>{
    if(i===0||!sameDay(m.timestamp,filteredMessages[i-1].timestamp)) groups.push({date:m.timestamp,msgs:[m]});
    else groups[groups.length-1].msgs.push(m);
  });

  /* ════ WAITING ════ */
  if(screen==='waiting') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#07050f 0%,#130f2e 50%,#07050f 100%)',padding:'2rem'}}>
      <style>{`@keyframes pulse-ring{0%{transform:scale(1);opacity:.6}50%{transform:scale(1.15);opacity:.2}100%{transform:scale(1);opacity:.6}}`}</style>
      <div style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(99,102,241,.3)',borderRadius:28,padding:'2.5rem 2rem',maxWidth:420,width:'100%',textAlign:'center',boxShadow:'0 0 80px rgba(99,102,241,.15)'}}>
        <div style={{position:'relative',width:88,height:88,margin:'0 auto 1.5rem'}}>
          <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'2.5px solid rgba(99,102,241,.4)',animation:'pulse-ring 2s ease-in-out infinite'}}/>
          <div style={{position:'absolute',inset:10,borderRadius:'50%',border:'2px solid rgba(99,102,241,.25)',animation:'pulse-ring 2s ease-in-out .6s infinite'}}/>
          <div style={{position:'absolute',inset:20,borderRadius:'50%',background:'linear-gradient(135deg,#4338ca,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 28px rgba(99,102,241,.55)'}}>
            <span style={{fontSize:22}}>👥</span>
          </div>
        </div>
        <h2 style={{fontSize:22,fontWeight:900,color:'white',margin:'0 0 .6rem'}}>Waiting for someone to join…</h2>
        <p style={{fontSize:14,color:'rgba(156,163,175,.85)',margin:'0 0 1.6rem',lineHeight:1.65}}>Share the code below with your classmates.<br/>The chat will open the moment someone joins.</p>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,background:'rgba(99,102,241,.12)',border:'1.5px solid rgba(99,102,241,.35)',borderRadius:18,padding:'14px 22px',marginBottom:'1.4rem'}}>
          <span style={{fontSize:26,fontFamily:'monospace',fontWeight:900,color:'#a5b4fc',letterSpacing:'.2em'}}>{sessionCode}</span>
          <button onClick={()=>{navigator.clipboard.writeText(sessionCode);addToast('Code copied!','success');}} style={{background:'rgba(99,102,241,.3)',border:'none',borderRadius:9,padding:'7px 14px',color:'white',fontWeight:800,fontSize:12,cursor:'pointer'}}>Copy</button>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:'1.6rem'}}>
          <span style={{width:9,height:9,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 10px #4ade80',display:'inline-block'}}/>
          <span style={{fontSize:13,color:'rgba(156,163,175,.9)',fontWeight:700}}>{members.length} in session</span>
        </div>
        <button onClick={()=>{localStreamRef.current?.getTracks().forEach(t=>t.stop());setScreen('lobby');setSessionCode('');setActiveCode(null);setMembers([]);}}
          style={{background:'rgba(239,68,68,.1)',border:'1.5px solid rgba(239,68,68,.3)',borderRadius:12,padding:'11px 28px',color:'#f87171',fontWeight:800,fontSize:13,cursor:'pointer'}}>
          Cancel Session
        </button>
      </div>
    </div>
  );

  /* ════ CHAT ════ */
  return (
    <>
      {/* LIGHTBOX */}
      {lightboxImg&&(
        <div onClick={()=>setLightboxImg(null)} style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.94)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(8px)'}}>
          <button onClick={()=>setLightboxImg(null)} style={{position:'absolute',top:16,right:16,background:'rgba(255,255,255,.18)',border:'none',borderRadius:'50%',width:46,height:46,cursor:'pointer',color:'white',fontSize:24,display:'flex',alignItems:'center',justifyContent:'center',zIndex:2}}>✕</button>
          <img src={lightboxImg} alt="Preview" onClick={e=>e.stopPropagation()} style={{maxWidth:'100%',maxHeight:'88vh',borderRadius:16,boxShadow:'0 24px 80px rgba(0,0,0,.7)',objectFit:'contain'}}/>
          <a href={lightboxImg} download="edublay-image.jpg" onClick={e=>e.stopPropagation()} style={{position:'absolute',bottom:22,right:22,background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.25)',borderRadius:12,padding:'9px 20px',color:'white',fontSize:13,fontWeight:700,textDecoration:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>⬇ Save Photo</a>
        </div>
      )}

      {/* CAMERA MODAL */}
      {showCameraModal&&(
        <div style={{position:'fixed',inset:0,zIndex:9998,background:'rgba(0,0,0,.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(4px)'}}>
          <div style={{background:'#0a0a0f',borderRadius:22,overflow:'hidden',maxWidth:500,width:'100%',boxShadow:'0 24px 80px rgba(0,0,0,.7)'}}>
            <div style={{padding:'13px 18px',background:'rgba(99,102,241,.15)',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(99,102,241,.2)'}}>
              <span style={{fontWeight:900,color:'white',fontSize:15}}>📷 Take a Photo</span>
              <button onClick={toggleCamera} style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',cursor:'pointer',fontSize:22}}>✕</button>
            </div>
            <video ref={videoRef} autoPlay playsInline muted style={{width:'100%',display:'block',maxHeight:360,objectFit:'cover',background:'#000'}}/>
            <canvas ref={photoCanvasRef} style={{display:'none'}}/>
            <div style={{padding:'14px 18px',display:'flex',gap:10,justifyContent:'center',background:'rgba(0,0,0,.5)'}}>
              <button onClick={capturePhoto} style={{flex:1,padding:'13px',borderRadius:14,background:'linear-gradient(135deg,#4338ca,#6366f1)',border:'none',color:'white',fontWeight:900,fontSize:15,cursor:'pointer',boxShadow:'0 6px 24px rgba(99,102,241,.45)'}}>📸 Capture Photo</button>
              <button onClick={toggleCamera} style={{padding:'13px 20px',borderRadius:14,background:'rgba(239,68,68,.15)',border:'1.5px solid rgba(239,68,68,.3)',color:'#f87171',fontWeight:800,fontSize:14,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM SEND */}
      {pendingSend&&(
        <div style={{position:'fixed',inset:0,zIndex:9997,background:'rgba(0,0,0,.72)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(6px)'}}>
          <div style={{background:'var(--cs-surface,#f0f4ff)',borderRadius:22,maxWidth:420,width:'100%',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.35)'}}>
            <div style={{padding:'14px 18px',background:'linear-gradient(135deg,#4338ca,#6366f1)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontWeight:900,color:'white',fontSize:15}}>
                {pendingSend.type==='photo'||pendingSend.type==='image'?'📷 Send Photo':pendingSend.type==='audio'?'🎤 Send Voice Message':'📎 Send File'}
              </span>
              <button onClick={()=>setPendingSend(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',cursor:'pointer',fontSize:20}}>✕</button>
            </div>
            <div style={{padding:'18px'}}>
              {(pendingSend.type==='photo'||pendingSend.type==='image')&&<img src={pendingSend.data} alt="Preview" style={{width:'100%',maxHeight:260,objectFit:'contain',borderRadius:12,marginBottom:14,background:'#000'}}/>}
              {pendingSend.type==='audio'&&(
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px',background:'rgba(99,102,241,.08)',borderRadius:14,marginBottom:14,border:'1.5px solid rgba(99,102,241,.15)'}}>
                  <span style={{fontSize:28}}>🎤</span>
                  <div><p style={{margin:0,fontWeight:800,fontSize:14,color:'#1f2937'}}>{pendingSend.name}</p><p style={{margin:'2px 0 0',fontSize:12,color:'#6b7280'}}>Ready to send to the group</p></div>
                </div>
              )}
              {pendingSend.type==='file'&&(
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px',background:'rgba(99,102,241,.08)',borderRadius:14,marginBottom:14,border:'1.5px solid rgba(99,102,241,.15)'}}>
                  <span style={{fontSize:28}}>📎</span>
                  <div><p style={{margin:0,fontWeight:800,fontSize:14,color:'#1f2937'}}>{pendingSend.name}</p><p style={{margin:'2px 0 0',fontSize:12,color:'#6b7280'}}>Ready to send to the group</p></div>
                </div>
              )}
              <p style={{fontSize:13,color:'#6b7280',margin:'0 0 16px',textAlign:'center'}}>Send to <strong style={{color:'#6366f1'}}>{sessionName}</strong>?</p>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setPendingSend(null)} style={{flex:1,padding:'12px',borderRadius:13,background:'rgba(0,0,0,.06)',border:'1.5px solid rgba(0,0,0,.1)',fontWeight:800,fontSize:14,cursor:'pointer',color:'#374151'}}>Discard</button>
                <button onClick={confirmAndSend} style={{flex:2,padding:'12px',borderRadius:13,background:'linear-gradient(135deg,#4338ca,#6366f1)',border:'none',color:'white',fontWeight:900,fontSize:14,cursor:'pointer',boxShadow:'0 4px 16px rgba(99,102,241,.4)'}}>
                  {pendingSend.type==='photo'||pendingSend.type==='image'?'📷 Send Photo':pendingSend.type==='audio'?'🎤 Send Voice':'📎 Send File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHARED NOTEPAD */}
      {showNotepad&&(
        <div style={{position:'fixed',inset:0,zIndex:9996,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'flex-end',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={()=>setShowNotepad(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'var(--cs-surface,#f0f4ff)',borderRadius:'22px 22px 0 0',width:'100%',maxWidth:700,padding:'1.5rem 1.5rem 2rem',boxShadow:'0 -10px 40px rgba(0,0,0,.2)',maxHeight:'72vh',display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div><span style={{fontWeight:900,fontSize:17,color:'#1f2937'}}>📝 Shared Notepad</span><span style={{fontSize:12,fontWeight:600,color:'#9ca3af',marginLeft:8}}>synced live for everyone</span></div>
              <button onClick={()=>setShowNotepad(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#9ca3af'}}>✕</button>
            </div>
            <textarea value={notepadText} onChange={e=>{setNotepadText(e.target.value);syncNotepad(e.target.value);}}
              placeholder="Type shared notes here… all members see this in real-time."
              style={{flex:1,minHeight:200,border:'2px solid rgba(99,102,241,.2)',borderRadius:14,padding:'14px',fontSize:14,outline:'none',resize:'none',fontFamily:'inherit',lineHeight:1.65,color:'#1f2937',background:'white'}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:'#9ca3af',fontWeight:600}}>✦ Auto-saves as you type</span>
              <button onClick={()=>{navigator.clipboard.writeText(notepadText);addToast('Notes copied!','success');}} style={{background:'rgba(99,102,241,.1)',border:'1.5px solid rgba(99,102,241,.2)',borderRadius:10,padding:'7px 16px',fontWeight:700,fontSize:13,cursor:'pointer',color:'#6366f1'}}>Copy All</button>
            </div>
          </div>
        </div>
      )}

      {/* POLL CREATOR */}
      {showPoll&&(
        <div style={{position:'fixed',inset:0,zIndex:9995,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(4px)'}} onClick={()=>setShowPoll(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'var(--cs-surface,#f0f4ff)',borderRadius:22,width:'100%',maxWidth:430,padding:'1.6rem',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
            <h3 style={{fontWeight:900,fontSize:18,margin:'0 0 1rem',color:'#1f2937'}}>📊 Create a Study Poll</h3>
            <input value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="e.g. Which topic should we focus on next?" maxLength={120}
              style={{width:'100%',border:'2px solid rgba(99,102,241,.2)',borderRadius:12,padding:'11px 13px',fontSize:14,outline:'none',marginBottom:12,boxSizing:'border-box',color:'#1f2937',background:'white'}}/>
            {pollOptions.map((opt,i)=>(
              <div key={i} style={{display:'flex',gap:8,marginBottom:9}}>
                <input value={opt} onChange={e=>{const o=[...pollOptions];o[i]=e.target.value;setPollOptions(o);}} placeholder={`Option ${i+1}`} maxLength={60}
                  style={{flex:1,border:'1.5px solid rgba(99,102,241,.15)',borderRadius:11,padding:'9px 13px',fontSize:13,outline:'none',color:'#1f2937',background:'white'}}/>
                {pollOptions.length>2&&<button onClick={()=>setPollOptions(pollOptions.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:20,padding:'0 4px'}}>✕</button>}
              </div>
            ))}
            {pollOptions.length<5&&<button onClick={()=>setPollOptions([...pollOptions,''])} style={{fontSize:13,fontWeight:700,color:'#6366f1',background:'rgba(99,102,241,.08)',border:'1.5px solid rgba(99,102,241,.2)',borderRadius:10,padding:'7px 15px',cursor:'pointer',marginBottom:16}}>+ Add Option</button>}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <input type="checkbox" id="allowMultiple" checked={pollAllowMultiple} onChange={e=>setPollAllowMultiple(e.target.checked)} style={{transform:'scale(1.2)',cursor:'pointer'}}/>
              <label htmlFor="allowMultiple" style={{fontSize:13,color:'#4b5563',cursor:'pointer',fontWeight:600}}>Allow multiple answers</label>
            </div>
            <div style={{display:'flex',gap:10,marginTop:6}}>
              <button onClick={()=>setShowPoll(false)} style={{flex:1,padding:'11px',borderRadius:13,background:'rgba(0,0,0,.06)',border:'1.5px solid rgba(0,0,0,.1)',fontWeight:700,fontSize:14,cursor:'pointer',color:'#374151'}}>Cancel</button>
              <button onClick={createPoll} style={{flex:2,padding:'11px',borderRadius:13,background:'linear-gradient(135deg,#4338ca,#6366f1)',border:'none',color:'white',fontWeight:900,fontSize:14,cursor:'pointer',boxShadow:'0 4px 16px rgba(99,102,241,.35)'}}>🚀 Launch Poll</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        :root{--cs-surface:#f0f4ff;--cs-chat-bg:#e8edf8;}
        .dark{--cs-surface:#0f1117;--cs-chat-bg:#1a1d2e;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes cs-msg-r{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
        @keyframes cs-msg-l{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
        @keyframes cs-pop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
        @keyframes bounce3{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
        @keyframes cs-highlight{0%,100%{background:transparent}50%{background:rgba(99,102,241,.18)}}
        .cs-msg-r{animation:cs-msg-r .2s ease both;}
        .cs-msg-l{animation:cs-msg-l .2s ease both;}
        .cs-pop{animation:cs-pop .18s ease both;}
        .cs-typing-dot{width:7px;height:7px;border-radius:50%;background:#a78bfa;animation:bounce3 1.3s ease infinite;}
        .cs-typing-dot:nth-child(2){animation-delay:.15s;}
        .cs-typing-dot:nth-child(3){animation-delay:.3s;}
        .cs-msg-highlighted{animation:cs-highlight 1.5s ease;}
        .cs-hdr-btn{display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 10px;border-radius:10px;border:none;font-weight:700;font-size:12px;cursor:pointer;transition:all .18s;white-space:nowrap;}
        .cs-hdr-btn:hover{filter:brightness(.92);transform:translateY(-1px);}
        .cs-ctx-item{display:flex;align-items:center;gap:8px;padding:9px 14px;cursor:pointer;font-size:13px;transition:background .12s;border-radius:8px;}
        .cs-ctx-item:hover{background:rgba(99,102,241,.07);}
        .cs-ctx-item.danger:hover{background:rgba(239,68,68,.07);color:#ef4444;}
        .cs-input-wrap{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:18px;background:#1e2435;border:1.5px solid rgba(99,102,241,.25);transition:box-shadow .2s,border-color .2s;flex:1;min-width:0;}
        .cs-input-wrap:focus-within{box-shadow:0 0 0 3px rgba(99,102,241,.15);border-color:rgba(99,102,241,.6);}
        .cs-input-wrap input{color:white!important;min-width:0;width:100%;border:none;background:transparent;outline:none;font-size:14px;}
        .cs-input-wrap input::placeholder{color:rgba(255,255,255,.35)!important;}
        .cs-send-btn{width:36px;height:36px;border-radius:10px;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .18s;flex-shrink:0;}
        .cs-send-btn:not(:disabled):hover{transform:scale(1.08);}
        .cs-send-btn:not(:disabled):active{transform:scale(.95);}
        .cs-splitter{width:5px;background:rgba(99,102,241,.12);cursor:col-resize;display:flex;align-items:center;justify-content:center;transition:background .15s;flex-shrink:0;}
        .cs-splitter:hover,.cs-splitter.active{background:rgba(99,102,241,.3);}
        .cs-ai-bubble{padding:12px 15px;border-radius:4px 16px 16px 16px;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.05));border:1px solid rgba(99,102,241,.18);font-size:13px;line-height:1.65;white-space:pre-wrap;color:#1f2937;}
        .dark .cs-ai-bubble{color:#e5e7eb;background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.08));}
        .cs-ai-user-bubble{padding:10px 14px;border-radius:16px 4px 16px 16px;background:linear-gradient(135deg,#4338ca,#6366f1);color:white;font-size:13px;line-height:1.5;max-width:85%;}
        .cs-member-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:12px;transition:background .15s;}
        .cs-member-row:hover{background:rgba(99,102,241,.06);}
        .dark .cs-member-row:hover{background:rgba(99,102,241,.1);}
        .cs-settings-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.05);}
        .dark .cs-settings-row{border-color:rgba(255,255,255,.05);}
        .cs-toggle{width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;position:relative;transition:background .2s;}
        .cs-toggle-knob{position:absolute;top:3px;width:16px;height:16px;border-radius:50%;background:white;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.2);}
        .cs-reaction-chip{display:flex;align-items:center;gap:3px;padding:2px 7px;border-radius:12px;font-size:12px;cursor:pointer;transition:all .15s;border:1px solid transparent;}
        .cs-reaction-chip:hover{transform:scale(1.1);}
        .cs-msg-r:hover .cs-msg-actions,.cs-msg-l:hover .cs-msg-actions{opacity:1!important;}
        .cs-msg-actions{transition:opacity 0.2s ease!important;}

        /* Mobile tray scrollbar hide */
        .cs-mobile-tray::-webkit-scrollbar{display:none;}
        .cs-mobile-tray{-ms-overflow-style:none;scrollbar-width:none;}

        /* Desktop: hide mobile-only, show desktop-only */
        .cs-mobile-plus{display:none!important;}
        .cs-mobile-only-btn{display:none!important;}
        .cs-desktop-actions{display:flex!important;}
        .cs-desktop-hint{display:block!important;}
        .cs-mobile-tray-wrap{display:none!important;}

        /* Chat wrapper */
        .cs-chat-wrapper{display:flex;height:100%;min-height:520px;border-radius:16px;overflow:hidden;border:1px solid rgba(99,102,241,.18);box-shadow:0 4px 32px rgba(0,0,0,.1);}

        /* MOBILE */
        /* MOBILE */
@media(max-width:900px){
  .cs-chat-wrapper{
    flex-direction:column!important;
    height:calc(100dvh - 60px)!important;
    min-height:unset!important;
    border-radius:0!important;
    border:none!important;
    margin:-16px!important;
    width:calc(100% + 32px)!important;
    overflow:hidden!important;
  }
  .cs-chat-sidebar{display:none!important;}
  .cs-splitter{display:none!important;}
  .cs-msg-actions{
    opacity:1!important;
    position:relative!important;
    top:auto!important;right:auto!important;left:auto!important;
    box-shadow:none!important;border:none!important;
    background:transparent!important;padding:2px!important;
    margin-top:4px!important;justify-content:flex-end;
  }
  .cs-hdr-btn{padding:5px 7px!important;font-size:11px!important;}
  /* Input bar — always docked at bottom, never cut off */
  .cs-input-bar{
    position:sticky!important;
    bottom:0!important;
    left:0!important;
    right:0!important;
    z-index:50!important;
    flex-shrink:0!important;
    padding:8px 10px 12px!important;
    padding-bottom:max(12px, env(safe-area-inset-bottom))!important;
  }
  .cs-input-wrap{padding:6px 10px!important;}
  .cs-input-wrap input{font-size:16px!important;}
  .cs-send-btn{width:38px!important;height:38px!important;border-radius:12px!important;}
  /* Show mobile, hide desktop */
  .cs-mobile-plus{display:flex!important;}
  .cs-mobile-only-btn{display:flex!important;}
  .cs-desktop-actions{display:none!important;}
  .cs-desktop-hint{display:none!important;}
  .cs-hide-text-mobile{display:none!important;}
  .cs-mobile-tray-wrap{display:block!important;}
}
@media(max-width:480px){
  .cs-hide-text-mobile{display:none!important;}
  .cs-chat-wrapper{margin:-12px!important;width:calc(100% + 24px)!important;}
}
      `}</style>

      <ConfirmationModal isOpen={showLeaveModal} onClose={()=>setShowLeaveModal(false)}
        onConfirm={leaveSession} title="Leave Session?"
        message="You'll leave this session. Rejoin anytime with the same code."
        confirmText="Leave" cancelText="Stay" confirmColor="red"/>

      {/* Context menu */}
      {contextMenu&&(
        <div className="cs-pop dark:bg-gray-800 dark:border-gray-700" onClick={e=>e.stopPropagation()}
          style={{position:'fixed',zIndex:9999,left:contextMenu.x,top:contextMenu.y,background:'white',borderRadius:14,padding:'6px',boxShadow:'0 12px 40px rgba(0,0,0,.18)',border:'1px solid #e5e7eb',minWidth:180}}>
          {[
            {icon:<Reply style={{width:14,height:14}}/>,label:'Reply',action:()=>{const m=messages.find(m=>m.id===contextMenu.msgId);if(m)setReplyTo(m);setContextMenu(null);}},
            {icon:<Copy style={{width:14,height:14}}/>,label:'Copy Text',action:()=>{const m=messages.find(m=>m.id===contextMenu.msgId);if(m)navigator.clipboard.writeText(m.text);setContextMenu(null);}},
            ...(messages.find(m=>m.id===contextMenu.msgId)?.sender===userDetails?.name?[
              {icon:<Edit3 style={{width:14,height:14}}/>,label:'Edit Message',action:()=>{const m=messages.find(m=>m.id===contextMenu.msgId);if(m){setEditingId(m.id);setEditText(m.text);}setContextMenu(null);}},
              {icon:<Trash2 style={{width:14,height:14}}/>,label:'Delete',action:()=>deleteMsg(contextMenu.msgId),danger:true},
            ]:[]),
            {icon:<Smile style={{width:14,height:14}}/>,label:'React',action:()=>{setEmojiPicker(contextMenu.msgId);setContextMenu(null);}},
          ].map((item,i)=>(
            <div key={i} className={`cs-ctx-item dark:hover:bg-gray-700 ${(item as any).danger?'danger':''}`} onClick={item.action} style={{color:(item as any).danger?'#ef4444':'#374151'}}>
              {item.icon}<span>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Emoji picker for reactions */}
      {emojiPicker&&(
        <div className="cs-pop" onClick={e=>e.stopPropagation()} style={{position:'fixed',zIndex:10000,bottom:90,left:'50%',transform:'translateX(-50%)',background:'white',borderRadius:16,padding:'10px 12px',boxShadow:'0 12px 40px rgba(0,0,0,.18)',display:'flex',gap:4}}>
          {EMOJIS.map(e=>(
            <button key={e} onClick={(ev)=>{ev.stopPropagation();addReaction(emojiPicker,e);}}
              style={{fontSize:22,background:'none',border:'none',cursor:'pointer',borderRadius:8,padding:'4px 6px',transition:'transform .15s'}}
              onMouseEnter={ev=>{(ev.target as any).style.transform='scale(1.4)';}} onMouseLeave={ev=>{(ev.target as any).style.transform='scale(1)';}}>
              {e}
            </button>
          ))}
          <button onClick={()=>setEmojiPicker(null)} style={{fontSize:14,background:'none',border:'none',cursor:'pointer',color:'#9ca3af',marginLeft:4}}>✕</button>
        </div>
      )}

      <div onClick={()=>{setContextMenu(null);setEmojiPicker(null);setEmojiForInput(false);setShowMoreActions(false);}}
        className="cs-chat-wrapper">

        {/* MEMBERS PANEL */}
        {showMembers&&(
          <div className="cs-chat-sidebar dark:bg-gray-800 dark:border-gray-700" style={{width:220,flexShrink:0,background:'#fafbff',borderRight:'1px solid rgba(99,102,241,.1)',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'12px 14px',borderBottom:'1px solid rgba(99,102,241,.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}} className="dark:border-gray-700">
              <span style={{fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',color:'#6b7280'}}>Members ({members.length})</span>
              <button onClick={()=>setShowMembers(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',padding:2,display:'flex'}}><X style={{width:14,height:14}}/></button>
            </div>
            {cameraActive&&cameraStream&&(
              <div style={{padding:'10px',borderBottom:'1px solid rgba(99,102,241,.08)'}} className="dark:border-gray-700">
                <p style={{fontSize:11,color:'#9ca3af',margin:'0 0 6px',fontWeight:600}}>MY CAMERA</p>
                <video ref={videoRef} autoPlay muted={muted} playsInline style={{width:'100%',aspectRatio:'16/9',objectFit:'cover',borderRadius:12,border:'2px solid rgba(99,102,241,.2)'}}/>
              </div>
            )}
            <div style={{flex:1,overflowY:'auto',padding:'6px'}}>
              {members.map((m,i)=>(
                <div key={i} className="cs-member-row">
                  <Av name={m.name} size={34} online={true}/>
                  <div style={{flex:1,minWidth:0}}>
                    <p className="dark:text-white" style={{fontSize:13,fontWeight:700,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</p>
                    <p style={{fontSize:11,color:m.isHost?'#6366f1':'#9ca3af',margin:0}}>{m.isHost?'👑 Host':'Member'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS PANEL */}
        {showSettings&&(
          <div className="dark:bg-gray-800 dark:border-gray-700" style={{width:240,flexShrink:0,background:'#fafbff',borderRight:'1px solid rgba(99,102,241,.1)',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'12px 14px',borderBottom:'1px solid rgba(99,102,241,.08)',display:'flex',alignItems:'center',justifyContent:'space-between'}} className="dark:border-gray-700">
              <span style={{fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',color:'#6b7280'}}>Settings</span>
              <button onClick={()=>setShowSettings(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',padding:2,display:'flex'}}><X style={{width:14,height:14}}/></button>
            </div>
            <div style={{padding:'12px 16px',flex:1,overflowY:'auto'}}>
              {[
                {label:'Notifications',icon:<Bell style={{width:14,height:14}}/>,val:notificationsOn,set:setNotificationsOn},
                {label:'Mute audio',icon:<VolumeX style={{width:14,height:14}}/>,val:muted,set:setMuted},
              ].map((row,i)=>(
                <div key={i} className="cs-settings-row">
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{color:sessionTheme}}>{row.icon}</span>
                    <span className="dark:text-gray-200" style={{fontSize:13,fontWeight:600,color:'#374151'}}>{row.label}</span>
                  </div>
                  <button className="cs-toggle" onClick={()=>row.set(!row.val)} style={{background:row.val?sessionTheme:'#d1d5db'}}>
                    <div className="cs-toggle-knob" style={{left:row.val?'21px':'3px'}}/>
                  </button>
                </div>
              ))}
              <div style={{marginTop:16}}>
                <p style={{fontSize:11,fontWeight:800,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>Chat Theme Colour</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#ef4444','#14b8a6'].map(c=>(
                    <button key={c} onClick={()=>setSessionTheme(c)}
                      style={{width:28,height:28,borderRadius:'50%',background:c,border:sessionTheme===c?'3px solid white':'3px solid transparent',outline:sessionTheme===c?`3px solid ${c}`:'none',cursor:'pointer',transition:'all .18s',boxShadow:sessionTheme===c?`0 0 0 3px ${c}55`:'none'}}/>
                  ))}
                  <label style={{width:28,height:28,borderRadius:'50%',background:'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                    <input type="color" value={sessionTheme} onChange={e=>setSessionTheme(e.target.value)} style={{opacity:0,width:0,height:0,position:'absolute'}}/>
                    <span style={{fontSize:12}}>+</span>
                  </label>
                </div>
              </div>
              <div style={{marginTop:16}}>
                <p style={{fontSize:11,fontWeight:800,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Chat Background</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {([
                    {id:'dots',label:'🔵 Dots',bg:'#e8edf8',pattern:'dots'},
                    {id:'clean',label:'☁️ Clean',bg:'#f0f4ff',pattern:'none'},
                    {id:'dark',label:'🌙 Dark',bg:'#1a1d2e',pattern:'grid'},
                    {id:'paper',label:'📄 Paper',bg:'#fdf6e3',pattern:'none'},
                    {id:'forest',label:'🌿 Forest',bg:'#d1fae5',pattern:'bubbles'},
                    {id:'ocean',label:'🌊 Ocean',bg:'#e0f2fe',pattern:'grid'},
                    {id:'rose',label:'🌸 Rose',bg:'#fce7f3',pattern:'dots'},
                    {id:'midnight',label:'🖤 Midnight',bg:'#0f172a',pattern:'grid'},
                  ] as any[]).map(opt=>(
                    <button key={opt.id} onClick={()=>setChatBg({color:opt.bg,pattern:opt.pattern})}
                      style={{padding:'7px 6px',borderRadius:9,border:chatBg.color===opt.bg?`2.5px solid ${sessionTheme}`:'2px solid transparent',background:opt.bg,cursor:'pointer',fontSize:11,fontWeight:700,color:opt.bg==='#1a1d2e'||opt.bg==='#0f172a'?'#e5e7eb':'#374151',transition:'all .15s'}}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {isHost&&(
                <div style={{marginTop:16}}>
                  <p style={{fontSize:11,fontWeight:800,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>Session Name</p>
                  <input className="dark:bg-gray-700 dark:text-white dark:border-gray-600" defaultValue={sessionName}
                    onBlur={async e=>{const n=e.target.value.trim();if(n&&n!==sessionName){setSessionName(n);await updateDoc(doc(db,'sessions',sessionCode),{name:n});}}}
                    style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${sessionTheme}`,fontSize:13,outline:'none',color:'#111827'}}/>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAIN CHAT */}
        <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,background:'var(--cs-surface)'}}>

          {/* HEADER */}
          <div style={{padding:'10px 14px',background:`linear-gradient(135deg,${sessionTheme}ee 0%,${sessionTheme}cc 50%,${sessionTheme} 100%)`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flex:1}}>
              <div style={{display:'flex',marginRight:2}} className="cs-mobile-avatars">
                {members.slice(0,3).map((m,i)=>(
                  <div key={i} style={{marginLeft:i>0?-8:0,zIndex:3-i}}><Av name={m.name} size={32} online/></div>
                ))}
              </div>
              <div style={{minWidth:0, flex: 1}}>
                <h2 style={{fontSize:15,fontWeight:900,color:'white',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sessionName}</h2>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:1,minWidth:0}}>
                  <button onClick={copyCode} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(255,255,255,.15)',border:'none',borderRadius:6,padding:'2px 8px',cursor:'pointer',minWidth:0}}
                    onMouseEnter={e=>{(e.currentTarget as any).style.background='rgba(255,255,255,.25)'}} onMouseLeave={e=>{(e.currentTarget as any).style.background='rgba(255,255,255,.15)'}}>
                    <Hash style={{width:10,height:10,color:'rgba(255,255,255,.8)',flexShrink:0}}/>
                    <span style={{fontSize:11,fontFamily:'monospace',fontWeight:800,color:'white',letterSpacing:'.12em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sessionCode}</span>
                    {codeCopied?<Check style={{width:10,height:10,color:'#4ade80',flexShrink:0}}/>:<Copy style={{width:10,height:10,color:'rgba(255,255,255,.6)',flexShrink:0}}/>}
                  </button>
                  <span className="cs-desktop-hint" style={{display:'flex',alignItems:'center',gap:3,fontSize:11,color:'rgba(255,255,255,.75)',flexShrink:0}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'#4ade80',display:'inline-block',boxShadow:'0 0 8px #4ade80'}}/>
                    {members.length} online
                  </span>
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:5,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
              <button className="cs-hdr-btn" onClick={()=>setShowSearch(s=>!s)} style={{background:showSearch?'rgba(255,255,255,.25)':'rgba(255,255,255,.12)',color:'white',border:'1px solid rgba(255,255,255,.2)'}}>
                <Search style={{width:13,height:13}}/>
              </button>
              <button className="cs-hdr-btn" onClick={()=>{setShowAIPanel(s=>!s);setAINotify(false);}} style={{background:showAIPanel?'rgba(167,139,250,.35)':'rgba(167,139,250,.18)',color:'#ddd6fe',border:'1px solid rgba(167,139,250,.3)',position:'relative'}}>
                <Bot style={{width:13,height:13}}/> <span className="cs-hide-text-mobile">AI</span>
                {aiNotify&&<span style={{position:'absolute',top:-4,right:-4,width:8,height:8,borderRadius:'50%',background:'#ef4444',border:'2px solid white'}}/>}
              </button>
              <button className="cs-hdr-btn" onClick={()=>{setShowMembers(s=>!s);setShowSettings(false);}} style={{background:showMembers?'rgba(255,255,255,.25)':'rgba(255,255,255,.12)',color:'white',border:'1px solid rgba(255,255,255,.2)'}}>
                <Users style={{width:13,height:13}}/> <span>{members.length}</span>
              </button>
              <button className="cs-hdr-btn" onClick={()=>{setShowSettings(s=>!s);setShowMembers(false);}} style={{background:showSettings?'rgba(255,255,255,.25)':'rgba(255,255,255,.12)',color:'white',border:'1px solid rgba(255,255,255,.2)'}}>
                <Settings style={{width:13,height:13}}/>
              </button>
              <button className="cs-hdr-btn" onClick={()=>setShowLeaveModal(true)} style={{background:'rgba(239,68,68,.2)',color:'#fca5a5',border:'1px solid rgba(239,68,68,.3)'}}>
                <LogOut style={{width:13,height:13}}/> <span className="cs-hide-text-mobile">Leave</span>
              </button>
            </div>
          </div>

          {/* SEARCH BAR */}
          {showSearch&&(
            <div className="dark:bg-gray-800 dark:border-gray-700" style={{padding:'8px 14px',background:'white',borderBottom:'1px solid rgba(99,102,241,.1)',display:'flex',alignItems:'center',gap:8}}>
              <Search style={{width:14,height:14,color:'#9ca3af',flexShrink:0}}/>
              <input autoFocus type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search messages…"
                className="dark:bg-transparent dark:text-white dark:placeholder-gray-500"
                style={{flex:1,border:'none',outline:'none',fontSize:14,background:'transparent',color:'#111827'}}/>
              {searchQuery&&<button onClick={()=>setSearchQuery('')} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',display:'flex'}}><X style={{width:14,height:14}}/></button>}
            </div>
          )}

          {/* REPLY BANNER */}
          {replyTo&&(
            <div className="dark:bg-gray-700 dark:border-gray-600" style={{padding:'6px 14px',background:'rgba(99,102,241,.06)',borderBottom:'1px solid rgba(99,102,241,.1)',display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:3,height:32,borderRadius:4,background:'#6366f1',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:11,fontWeight:800,color:'#6366f1',margin:0}}>{replyTo.sender}</p>
                <p className="dark:text-gray-400" style={{fontSize:12,color:'#6b7280',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{replyTo.text}</p>
              </div>
              <button onClick={()=>setReplyTo(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',display:'flex'}}><X style={{width:14,height:14}}/></button>
            </div>
          )}

          {/* MESSAGES */}
          <div ref={chatAreaRef} style={{flex:1,overflowY:'auto',minHeight:0,padding:'16px 14px 8px',background:chatBg.color,
            backgroundImage:chatBg.pattern==='dots'?`url("data:image/svg+xml,%3Csvg width='22' height='22' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.4' fill='%236366f1' opacity='0.09'/%3E%3C/svg%3E")`:chatBg.pattern==='grid'?`url("data:image/svg+xml,%3Csvg width='30' height='30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h30v1H0zm0 0v30h1V0z' fill='%236366f1' opacity='0.07'/%3E%3C/svg%3E")`:chatBg.pattern==='bubbles'?`url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='6' fill='none' stroke='%236366f1' stroke-width='1' opacity='0.08'/%3E%3C/svg%3E")`:'none'}}>
            {messages.length===0?(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',textAlign:'center',gap:12}}>
                <div style={{width:60,height:60,borderRadius:18,background:'linear-gradient(135deg,#4338ca,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 24px rgba(99,102,241,.35)'}}>
                  <MessageCircle style={{width:28,height:28,color:'white'}}/>
                </div>
                <h3 className="dark:text-white" style={{fontWeight:900,fontSize:16,margin:0,color:'#1f2937'}}>Start the conversation!</h3>
                <p style={{fontSize:13,color:'#9ca3af',margin:0}}>Share <strong style={{color:'#6366f1',fontFamily:'monospace'}}>{sessionCode}</strong> to invite classmates</p>
              </div>
            ):(
              groups.map((g,gi)=>(
                <div key={gi}>
                  <div style={{display:'flex',alignItems:'center',gap:10,margin:'12px 0',position:'sticky',top:0,zIndex:2}}>
                    <div style={{flex:1,height:1,background:'rgba(99,102,241,.2)'}}/>
                    <span style={{fontSize:11,fontWeight:700,color:'#6366f1',background:'rgba(99,102,241,.1)',padding:'3px 10px',borderRadius:20,border:'1px solid rgba(99,102,241,.2)',whiteSpace:'nowrap',backdropFilter:'blur(4px)'}}>{fmtDate(g.date)}</span>
                    <div style={{flex:1,height:1,background:'rgba(99,102,241,.2)'}}/>
                  </div>

                  {g.msgs.map((m)=>{
                    const isMe=m.sender===userDetails?.name;
                    const isSys=m.type==='system';
                    const isAI=m.type==='ai';
                    const isAudio=m.type==='audio';
                    const isDeleted=m.deleted;

                    if(isSys) return (
                      <div key={m.id} style={{display:'flex',justifyContent:'center',margin:'8px 0'}}>
                        <span className="dark:text-gray-500" style={{fontSize:12,color:'#6b7280',background:'rgba(255,255,255,.75)',padding:'4px 12px',borderRadius:20,border:'1px solid rgba(0,0,0,.06)',backdropFilter:'blur(4px)'}}>{m.text}</span>
                      </div>
                    );

                    if(isAI) return (
                      <div key={m.id} style={{display:'flex',gap:10,margin:'12px 0',maxWidth:'85%'}} className="cs-msg-l">
                        <div style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14,boxShadow:'0 4px 12px rgba(124,58,237,.3)'}}>✦</div>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                            <span style={{fontSize:12,fontWeight:800,color:'#7c3aed'}}>EduBlay AI</span>
                            <span style={{fontSize:10,color:'#9ca3af'}}>{fmtTime(m.timestamp)}</span>
                          </div>
                          <div className="cs-ai-bubble">{renderAIText(m.text)}</div>
                        </div>
                      </div>
                    );

                    return (
                      <div key={m.id} id={`msg-${m.id}`}
                        className={`${isMe?'cs-msg-r':'cs-msg-l'} ${highlightedId===m.id?'cs-msg-highlighted':''}`}
                        style={{display:'flex',flexDirection:isMe?'row-reverse':'row',alignItems:'flex-end',gap:7,margin:'5px 0',position:'relative'}}
                        onContextMenu={e=>{e.preventDefault();if(!isDeleted)setContextMenu({msgId:m.id,x:e.clientX,y:e.clientY});}}>

                        {!isMe&&<Av name={m.sender} size={30}/>}
                        <div style={{maxWidth:'72%',display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start'}}>
                          {!isMe&&<span style={{fontSize:11,fontWeight:700,color:'#6366f1',marginBottom:3,marginLeft:4}}>{m.sender}</span>}
                          {m.replyTo&&(
                            <div onClick={()=>scrollToMsg(m.replyTo!.id)} style={{padding:'5px 10px',borderRadius:'8px 8px 0 0',cursor:'pointer',marginBottom:-4,background:isMe?'rgba(255,255,255,.15)':'rgba(99,102,241,.07)',borderLeft:'3px solid #6366f1',maxWidth:'100%',overflow:'hidden'}}>
                              <p style={{fontSize:11,fontWeight:800,color:'#6366f1',margin:'0 0 1px'}}>{m.replyTo.sender}</p>
                              <p style={{fontSize:11,color:isMe?'rgba(255,255,255,.7)':'#9ca3af',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.replyTo.text}</p>
                            </div>
                          )}
                          <div style={{
                            padding:isAudio?'10px 14px':'9px 13px',
                            borderRadius:isMe?'18px 4px 18px 18px':'4px 18px 18px 18px',
                            wordBreak:'break-word',fontSize:14,lineHeight:1.5,
                            ...(isDeleted?{background:isMe?'rgba(99,102,241,.35)':'rgba(0,0,0,.06)',color:'#9ca3af',fontStyle:'italic'}
                              :isMe?{background:`linear-gradient(135deg,${sessionTheme}dd,${sessionTheme})`,color:'white',boxShadow:`0 4px 14px ${sessionTheme}55`}
                              :{background:'rgba(255,255,255,.92)',color:'#111827',boxShadow:'0 2px 10px rgba(0,0,0,.08)',border:'1px solid rgba(0,0,0,.04)'}),
                          }} className={!isMe&&!isDeleted?'dark:bg-gray-700 dark:text-gray-100':''}>

                            {!isDeleted&&(
                              <div className="cs-msg-actions" onClick={e=>e.stopPropagation()} style={{position:'absolute',top:-20,right:isMe?0:'auto',left:isMe?'auto':0,display:'flex',alignItems:'center',gap:4,background:'rgba(255,255,255,0.95)',padding:'4px 6px',borderRadius:12,boxShadow:'0 4px 12px rgba(0,0,0,0.15)',border:'1px solid #e5e7eb',zIndex:10,opacity:0}}>
                                <button onClick={()=>setReplyTo(m)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#4b5563'}}><Reply style={{width:14,height:14}}/></button>
                                <button onClick={()=>{navigator.clipboard.writeText(m.text);addToast('Copied','success');}} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#4b5563'}}><Copy style={{width:14,height:14}}/></button>
                                {isMe&&<button onClick={()=>{setEditingId(m.id);setEditText(m.text);}} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#4b5563'}}><Edit3 style={{width:14,height:14}}/></button>}
                                {isMe&&<button onClick={()=>deleteMsg(m.id)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#ef4444'}}><Trash2 style={{width:14,height:14}}/></button>}
                                <button onClick={()=>setEmojiPicker(m.id)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'#4b5563'}}><Smile style={{width:14,height:14}}/></button>
                              </div>
                            )}

                            {m.type==='poll_inline'&&m.pollData?(
                              <div style={{width:'280px',maxWidth:'100%',pointerEvents:'none'}}>
                                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,pointerEvents:'auto'}}>
                                  <span style={{fontSize:18}}>📊</span>
                                  <span style={{fontWeight:900,fontSize:14,color:isMe?'white':'#92400e'}}>{m.pollData.question}</span>
                                </div>
                                <div style={{pointerEvents:'auto'}}>
                                  {m.pollData.options.map((opt:any,i:number)=>{
                                    const totalVotes=m.pollData!.options.reduce((s:number,o:any)=>s+o.votes.length,0);
                                    const pct=totalVotes>0?Math.round((opt.votes.length/totalVotes)*100):0;
                                    const voted=opt.votes.includes(userDetails?.name||'');
                                    return (
                                      <button key={i} onClick={()=>votePoll(m.id,i)} style={{display:'block',width:'100%',textAlign:'left',marginBottom:7,background:voted?(isMe?'rgba(255,255,255,.25)':'rgba(99,102,241,.12)'):(isMe?'rgba(0,0,0,.15)':'rgba(0,0,0,.03)'),border:`1.5px solid ${voted?(isMe?'rgba(255,255,255,.5)':'rgba(99,102,241,.35)'):(isMe?'rgba(255,255,255,.1)':'rgba(0,0,0,.07)')}`,borderRadius:11,padding:'8px 11px',cursor:'pointer',position:'relative',overflow:'hidden',boxSizing:'border-box'}}>
                                        <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${pct}%`,background:isMe?'rgba(255,255,255,.15)':'rgba(99,102,241,.08)',transition:'width .4s ease'}}/>
                                        <span style={{position:'relative',fontWeight:700,fontSize:13,color:isMe?'white':'#1f2937'}}>{opt.text}</span>
                                        <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',fontSize:12,fontWeight:900,color:isMe?'rgba(255,255,255,.9)':'#6366f1'}}>{pct}%</span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <p style={{fontSize:11,color:isMe?'rgba(255,255,255,.7)':'#78716c',margin:'6px 0 0',fontWeight:600,pointerEvents:'auto'}}>
                                  Tap to vote {m.pollData.allowMultiple?'(multiple) ':''}· {m.pollData.options.reduce((s:number,o:any)=>s+o.votes.length,0)} vote(s)
                                </p>
                              </div>
                            ):isAudio&&!isDeleted?(
                              <div style={{display:'flex',alignItems:'center',gap:10}}>
                                <button onClick={()=>{
                                  if(m.audioData){
                                    if(playingAudio===m.id){setPlayingAudio(null);return;}
                                    setPlayingAudio(m.id);
                                    const a=new Audio(m.audioData);
                                    a.onended=()=>setPlayingAudio(null);
                                    a.play().catch(()=>setPlayingAudio(null));
                                  }
                                }} style={{width:34,height:34,borderRadius:'50%',background:playingAudio===m.id?'rgba(255,255,255,.4)':'rgba(255,255,255,.2)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                  {playingAudio===m.id?<span style={{width:10,height:10,borderRadius:2,background:isMe?'white':'#6366f1',display:'inline-block'}}/>:<Volume2 style={{width:14,height:14,color:isMe?'white':'#6366f1'}}/>}
                                </button>
                                <div>
                                  <div style={{width:120,height:3,borderRadius:4,background:isMe?'rgba(255,255,255,.3)':'rgba(99,102,241,.2)',marginBottom:4}}>
                                    <div style={{width:'60%',height:'100%',borderRadius:4,background:isMe?'rgba(255,255,255,.7)':'#6366f1'}}/>
                                  </div>
                                  <span style={{fontSize:11,color:isMe?'rgba(255,255,255,.7)':'#9ca3af'}}>{m.audioDuration}s</span>
                                </div>
                              </div>
                            ):(m.type as string)==='image'&&!isDeleted&&m.audioData?(
                              <div>
                                <img src={m.audioData} alt={m.text}
                                  style={{maxWidth:220,maxHeight:200,borderRadius:12,display:'block',cursor:'zoom-in',objectFit:'cover',boxShadow:'0 2px 12px rgba(0,0,0,.18)',border:'2px solid rgba(99,102,241,.15)',transition:'transform .15s'}}
                                  onMouseEnter={e=>(e.currentTarget as any).style.transform='scale(1.03)'}
                                  onMouseLeave={e=>(e.currentTarget as any).style.transform='scale(1)'}
                                  onClick={()=>setLightboxImg(m.audioData||null)}/>
                                <p style={{fontSize:11,margin:'4px 0 0',color:isMe?'rgba(255,255,255,.7)':'#9ca3af'}}>{m.text}</p>
                              </div>
                            ):(m.type as string)==='file'&&!isDeleted&&m.audioData?(
                              <button onClick={e=>{e.preventDefault();downloadDataUrl(m.audioData!,m.text.replace('📎 ',''));}}
                                style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:8,color:isMe?'white':'#6366f1',fontWeight:600,fontSize:13}}>
                                <span style={{fontSize:18}}>📎</span>
                                <span style={{textDecoration:'underline'}}>{m.text.replace('📎 ','')}</span>
                              </button>
                            ):editingId===m.id?(
                              <div>
                                <input value={editText} onChange={e=>setEditText(e.target.value)}
                                  onKeyDown={e=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape'){setEditingId(null);setEditText('');}}}
                                  autoFocus style={{background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',borderRadius:6,padding:'4px 8px',color:'white',fontSize:14,outline:'none',width:'100%'}}/>
                                <div style={{display:'flex',gap:6,marginTop:5}}>
                                  <button onClick={saveEdit} style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:6,background:'rgba(255,255,255,.25)',border:'none',cursor:'pointer',color:'white'}}>Save</button>
                                  <button onClick={()=>{setEditingId(null);setEditText('');}} style={{fontSize:11,padding:'3px 8px',borderRadius:6,background:'rgba(255,255,255,.1)',border:'none',cursor:'pointer',color:'rgba(255,255,255,.7)'}}>Cancel</button>
                                </div>
                              </div>
                            ):m.text}
                          </div>

                          {m.reactions&&Object.keys(m.reactions).length>0&&(
                            <div style={{display:'flex',gap:3,marginTop:3,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start'}}>
                              {Object.entries(m.reactions).map(([emoji,users])=>(users as string[]).length>0&&(
                                <button key={emoji} className="cs-reaction-chip" onClick={()=>addReaction(m.id,emoji)}
                                  style={{background:(users as string[]).includes(userDetails?.name||'')?'rgba(99,102,241,.15)':'rgba(0,0,0,.06)',borderColor:(users as string[]).includes(userDetails?.name||'')?'rgba(99,102,241,.4)':'transparent'}}>
                                  {emoji}<span style={{fontSize:11,fontWeight:700,color:'#6b7280'}}>{(users as string[]).length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <div style={{display:'flex',alignItems:'center',gap:4,marginTop:2,[isMe?'marginRight':'marginLeft']:3,justifyContent:isMe?'flex-end':'flex-start'}}>
                            <span style={{fontSize:10,color:'#9ca3af'}}>{fmtTime(m.timestamp)}</span>
                            {m.edited&&<span style={{fontSize:10,color:'#9ca3af'}}>edited</span>}
                            {isMe&&!isDeleted&&<CheckCheck style={{width:12,height:12,color:'rgba(99,102,241,.6)'}}/>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}

            {isAIThinking&&(
              <div style={{display:'flex',gap:10,alignItems:'flex-end',margin:'8px 0'}}>
                <div style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14}}>✦</div>
                <div style={{background:'rgba(255,255,255,.92)',border:'1px solid rgba(0,0,0,.05)',borderRadius:'4px 16px 16px 16px',padding:'12px 14px',display:'flex',gap:5,alignItems:'center',boxShadow:'0 2px 8px rgba(0,0,0,.08)'}}>
                  <div className="cs-typing-dot"/><div className="cs-typing-dot"/><div className="cs-typing-dot"/>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* ══ INPUT BAR ══ */}
          <div className="cs-input-bar dark:bg-gray-900 dark:border-gray-700" style={{padding:'10px 14px',background:'#151929',borderTop:'1px solid rgba(99,102,241,.15)',flexShrink:0,position:'relative'}}>

            {/* Recording indicator */}
            {isRecording&&(
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',borderRadius:10,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',marginBottom:8}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#ef4444',display:'inline-block',animation:'cs-highlight 1s ease infinite'}}/>
                <span style={{fontSize:13,fontWeight:700,color:'#ef4444'}}>Recording… {recordingTime}s</span>
                <button onClick={stopRecording} style={{marginLeft:'auto',background:'#ef4444',border:'none',color:'white',padding:'3px 10px',borderRadius:7,fontSize:12,fontWeight:700,cursor:'pointer'}}>Stop & Send</button>
              </div>
            )}

            {/* ── MOBILE ACTION TRAY (shown when + is tapped) ── */}
            <div className="cs-mobile-tray-wrap" style={{marginBottom: showMoreActions ? 12 : 0, overflow:'hidden', maxHeight: showMoreActions ? 120 : 0, transition:'max-height .3s ease, margin .3s ease'}}>
              <div className="cs-mobile-tray" style={{display:'flex',gap:12,padding:'4px 2px',overflowX:'auto',WebkitOverflowScrolling:'touch' as any}}>

                {/* File */}
                <label style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:'pointer',flexShrink:0}}>
                  <input ref={mobileFileInputRef} type="file" accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.ppt,.pptx"
                    style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f){sendFile(f);setShowMoreActions(false);}e.target.value='';}}/>
                  <div style={{width:52,height:52,borderRadius:16,background:'rgba(99,102,241,.15)',display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid rgba(99,102,241,.25)'}}>
                    <Paperclip style={{width:22,height:22,color:'#6366f1'}}/>
                  </div>
                  <span style={{fontSize:10,color:'rgba(255,255,255,.55)',fontWeight:600,whiteSpace:'nowrap'}}>File</span>
                </label>

                {/* Camera */}
                <button onClick={()=>{toggleCamera();setShowMoreActions(false);}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',flexShrink:0,padding:0}}>
                  <div style={{width:52,height:52,borderRadius:16,background:cameraActive?'rgba(239,68,68,.15)':'rgba(99,102,241,.15)',display:'flex',alignItems:'center',justifyContent:'center',border:`1.5px solid ${cameraActive?'rgba(239,68,68,.3)':'rgba(99,102,241,.25)'}`}}>
                    {cameraActive?<CameraOff style={{width:22,height:22,color:'#ef4444'}}/>:<Camera style={{width:22,height:22,color:'#6366f1'}}/>}
                  </div>
                  <span style={{fontSize:10,color:'rgba(255,255,255,.55)',fontWeight:600,whiteSpace:'nowrap'}}>{cameraActive?'Stop':'Camera'}</span>
                </button>

                {/* Poll */}
                <button onClick={()=>{setShowPoll(true);setShowMoreActions(false);}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',flexShrink:0,padding:0}}>
                  <div style={{width:52,height:52,borderRadius:16,background:'rgba(245,158,11,.12)',display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid rgba(245,158,11,.25)'}}>
                    <span style={{fontSize:24}}>📊</span>
                  </div>
                  <span style={{fontSize:10,color:'rgba(255,255,255,.55)',fontWeight:600,whiteSpace:'nowrap'}}>Poll</span>
                </button>

                {/* Notepad */}
                <button onClick={()=>{setShowNotepad(true);setShowMoreActions(false);}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',flexShrink:0,padding:0}}>
                  <div style={{width:52,height:52,borderRadius:16,background:'rgba(16,185,129,.12)',display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid rgba(16,185,129,.25)'}}>
                    <span style={{fontSize:24}}>📝</span>
                  </div>
                  <span style={{fontSize:10,color:'rgba(255,255,255,.55)',fontWeight:600,whiteSpace:'nowrap'}}>Notes</span>
                </button>

                {/* AI */}
                <button onClick={()=>{setShowAIPanel(s=>!s);setAINotify(false);setShowMoreActions(false);}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',flexShrink:0,padding:0}}>
                  <div style={{width:52,height:52,borderRadius:16,background:'rgba(167,139,250,.15)',display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid rgba(167,139,250,.3)',position:'relative'}}>
                    <Bot style={{width:22,height:22,color:'#a78bfa'}}/>
                    {aiNotify&&<span style={{position:'absolute',top:-3,right:-3,width:8,height:8,borderRadius:'50%',background:'#ef4444',border:'2px solid #151929'}}/>}
                  </div>
                  <span style={{fontSize:10,color:'rgba(255,255,255,.55)',fontWeight:600,whiteSpace:'nowrap'}}>Ask AI</span>
                </button>

                {/* Emoji */}
                <button onClick={()=>{setEmojiForInput(v=>!v);setShowMoreActions(false);}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',flexShrink:0,padding:0}}>
                  <div style={{width:52,height:52,borderRadius:16,background:'rgba(251,191,36,.12)',display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid rgba(251,191,36,.25)'}}>
                    <Smile style={{width:22,height:22,color:'#fbbf24'}}/>
                  </div>
                  <span style={{fontSize:10,color:'rgba(255,255,255,.55)',fontWeight:600,whiteSpace:'nowrap'}}>Emoji</span>
                </button>
              </div>
            </div>

            {/* Emoji picker for input */}
            {emojiForInput&&(
              <div className="cs-pop" onClick={e=>e.stopPropagation()}
                style={{position:'absolute',bottom:'100%',left:14,right:14,background:'white',borderRadius:14,padding:'10px 12px',boxShadow:'0 8px 32px rgba(0,0,0,.25)',border:'1px solid #e5e7eb',display:'flex',gap:4,zIndex:200,flexWrap:'wrap',marginBottom:4}}>
                {['😀','😂','😍','🥺','😎','🤔','👍','🔥','💡','❤️','🎯','💯','📚','✅','🙌','👏','🤯','💪','🙏','⭐'].map(emoji=>(
                  <button key={emoji} onClick={()=>{setNewMessage(m=>m+emoji);setEmojiForInput(false);inputRef.current?.focus();}}
                    style={{fontSize:22,background:'none',border:'none',cursor:'pointer',borderRadius:6,padding:'3px 4px'}}>
                    {emoji}
                  </button>
                ))}
                <button onClick={()=>setEmojiForInput(false)} style={{fontSize:13,background:'none',border:'none',cursor:'pointer',color:'#9ca3af',marginLeft:'auto'}}>✕</button>
              </div>
            )}

            {/* Main input row */}
            <div style={{display:'flex',gap:8,alignItems:'center'}}>

              {/* + button — mobile only */}
              <button className="cs-mobile-plus" onClick={e=>{e.stopPropagation();setShowMoreActions(v=>!v);}}
                style={{width:36,height:36,borderRadius:10,border:'none',flexShrink:0,alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .2s',
                  background:showMoreActions?sessionTheme:'rgba(99,102,241,.2)',
                  color:showMoreActions?'white':'#6366f1',
                  boxShadow:showMoreActions?`0 4px 12px ${sessionTheme}55`:'none'}}>
                <Plus style={{width:18,height:18,transition:'transform .2s',transform:showMoreActions?'rotate(45deg)':'rotate(0deg)'}}/>
              </button>

              {/* Text input */}
              <div className="cs-input-wrap">
                <Av name={userDetails?.name||'?'} size={26}/>
                <input ref={inputRef} type="text" value={newMessage}
                  onChange={e=>setNewMessage(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                  placeholder={replyTo?`Reply to ${replyTo.sender}…`:'Type a message…'}
                  className="dark:text-white dark:placeholder-gray-500"
                  style={{flex:1,border:'none',background:'transparent',fontSize:14,outline:'none',minWidth:0}}/>
                {/* Emoji button — desktop only inside input */}
                <div className="cs-desktop-actions" style={{position:'relative'}}>
                  <button onClick={e=>{e.stopPropagation();setEmojiForInput(v=>!v);}}
                    style={{background:'none',border:'none',cursor:'pointer',color:emojiForInput?'#6366f1':'#9ca3af',display:'flex',padding:3}}>
                    <Smile style={{width:17,height:17}}/>
                  </button>
                </div>
              </div>

              {/* Desktop-only action buttons */}
              <div className="cs-desktop-actions" style={{gap:6,alignItems:'center'}}>
                <label className="cs-send-btn" title="Upload file or image" style={{background:'rgba(99,102,241,.1)',border:'1.5px solid rgba(99,102,241,.2)',color:'#6366f1',cursor:'pointer'}}>
                  <input ref={fileInputRef} type="file" accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.ppt,.pptx"
                    style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)sendFile(f);e.target.value='';}}/>
                  <Paperclip style={{width:15,height:15}}/>
                </label>
                <button className="cs-send-btn" onClick={toggleCamera}
                  style={{background:cameraActive?'rgba(239,68,68,.12)':'rgba(99,102,241,.1)',border:cameraActive?'1.5px solid rgba(239,68,68,.3)':'1.5px solid rgba(99,102,241,.2)',color:cameraActive?'#ef4444':'#6366f1'}}>
                  {cameraActive?<CameraOff style={{width:15,height:15}}/>:<Camera style={{width:15,height:15}}/>}
                </button>
                <button className="cs-send-btn" onClick={()=>setShowPoll(true)} style={{background:'rgba(245,158,11,.08)',border:'1.5px solid rgba(245,158,11,.3)',color:'#f59e0b'}}>📊</button>
                <button className="cs-send-btn" onClick={isRecording?stopRecording:startRecording}
                  style={{background:isRecording?'rgba(239,68,68,.12)':'rgba(99,102,241,.1)',border:isRecording?'1.5px solid rgba(239,68,68,.3)':'1.5px solid rgba(99,102,241,.2)',color:isRecording?'#ef4444':'#6366f1'}}>
                  {isRecording?<MicOff style={{width:15,height:15}}/>:<Mic style={{width:15,height:15}}/>}
                </button>
              </div>

              {/* Mic — mobile only (always visible) */}
              <button className="cs-mobile-only-btn cs-send-btn" onClick={isRecording?stopRecording:startRecording}
                style={{background:isRecording?'rgba(239,68,68,.12)':'rgba(99,102,241,.1)',border:isRecording?'1.5px solid rgba(239,68,68,.3)':'1.5px solid rgba(99,102,241,.2)',color:isRecording?'#ef4444':'#6366f1'}}>
                {isRecording?<MicOff style={{width:15,height:15}}/>:<Mic style={{width:15,height:15}}/>}
              </button>

              {/* Send */}
              <button className="cs-send-btn" onClick={sendMessage} disabled={!newMessage.trim()||isSending}
                style={{background:newMessage.trim()?sessionTheme:'rgba(99,102,241,.2)',color:newMessage.trim()?'white':'#6366f1',boxShadow:newMessage.trim()?`0 4px 12px ${sessionTheme}55`:'none',border:'none'}}>
                {isSending?<span style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',display:'inline-block',animation:'spin .7s linear infinite'}}/>
                :<Send style={{width:15,height:15}}/>}
              </button>
            </div>

            <p className="cs-desktop-hint" style={{fontSize:11,color:'#9ca3af',textAlign:'center',margin:'6px 0 0'}}>
              Enter to send · Right-click to edit/delete/react · Mic for voice · AI answers seen by all
            </p>
          </div>
        </div>

        {/* SPLITTER */}
        {showAIPanel&&(
          <div ref={splitterRef} className={`cs-splitter${isDraggingSplitter?' active':''}`} onMouseDown={()=>setIsDraggingSplitter(true)}>
            <GripVertical style={{width:14,height:14,color:'rgba(99,102,241,.5)'}}/>
          </div>
        )}

        {/* AI PANEL */}
        {showAIPanel&&(
          <div style={{width:aiPanelWidth,flexShrink:0,display:'flex',flexDirection:'column',background:'var(--cs-surface)',borderLeft:'1px solid rgba(99,102,241,.15)'}}>
            <div style={{padding:'10px 14px',background:'linear-gradient(135deg,#3b0764,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#a78bfa,#c4b5fd)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,boxShadow:'0 4px 12px rgba(167,139,250,.4)'}}>✦</div>
                <div>
                  <p style={{fontSize:14,fontWeight:900,color:'white',margin:0}}>EduBlay AI</p>
                  <p style={{fontSize:11,color:'rgba(255,255,255,.65)',margin:0}}>Shared with all members</p>
                </div>
              </div>
              <button onClick={()=>setShowAIPanel(false)} style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:8,cursor:'pointer',color:'white',display:'flex',padding:5}}>
                <X style={{width:13,height:13}}/>
              </button>
            </div>
            <div style={{padding:'8px 12px',background:'rgba(167,139,250,.08)',borderBottom:'1px solid rgba(167,139,250,.12)'}}>
              <p style={{fontSize:11,color:'#7c3aed',margin:0,display:'flex',alignItems:'center',gap:5}}>
                <AlertCircle style={{width:12,height:12,flexShrink:0}}/>
                All members see this conversation in real-time
              </p>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:10}}>
              {aiHistory.length===0?(
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,textAlign:'center',padding:'24px 16px',gap:10}}>
                  <div style={{width:50,height:50,borderRadius:16,background:'linear-gradient(135deg,#7c3aed,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,boxShadow:'0 6px 20px rgba(124,58,237,.3)'}}>✦</div>
                  <h4 className="dark:text-white" style={{fontWeight:900,fontSize:15,margin:0,color:'#1f2937'}}>Ask EduBlay AI</h4>
                  <p style={{fontSize:12,color:'#9ca3af',margin:0}}>Ask any study question. Everyone in the session sees the answer instantly.</p>
                  <div style={{display:'flex',flexDirection:'column',gap:5,width:'100%',marginTop:4}}>
                    {['Explain this topic simply','Give me quiz questions','Summarize our discussion'].map((s,i)=>(
                      <button key={i} onClick={()=>askAI(s)}
                        style={{background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',borderRadius:10,padding:'8px 12px',cursor:'pointer',fontSize:12,fontWeight:600,color:'#7c3aed',textAlign:'left',transition:'background .15s'}}
                        onMouseEnter={e=>{(e.currentTarget as any).style.background='rgba(124,58,237,.15)'}} onMouseLeave={e=>{(e.currentTarget as any).style.background='rgba(124,58,237,.08)'}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ):aiHistory.map((turn,i)=>(
                <div key={i} style={{display:'flex',flexDirection:turn.role==='user'?'row-reverse':'row',gap:8,alignItems:'flex-start'}}>
                  {turn.role==='ai'&&<div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:12}}>✦</div>}
                  <div style={{maxWidth:'88%'}}>
                    {turn.role==='user'?<div className="cs-ai-user-bubble">{turn.text}</div>:<div className="cs-ai-bubble">{renderAIText(turn.text)}</div>}
                    <p style={{fontSize:10,color:'#9ca3af',margin:'3px 4px 0',textAlign:turn.role==='user'?'right':'left'}}>{fmtTime(turn.ts)}</p>
                  </div>
                </div>
              ))}
              {isAIThinking&&(
                <div style={{display:'flex',gap:8}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:12}}>✦</div>
                  <div style={{background:'rgba(255,255,255,.9)',border:'1px solid rgba(0,0,0,.06)',borderRadius:'4px 14px 14px 14px',padding:'10px 14px',display:'flex',gap:5}}>
                    <div className="cs-typing-dot"/><div className="cs-typing-dot"/><div className="cs-typing-dot"/>
                  </div>
                </div>
              )}
              <div ref={aiEndRef}/>
            </div>
            <div className="dark:bg-gray-900 dark:border-gray-700" style={{padding:'10px 12px',background:'white',borderTop:'1px solid rgba(124,58,237,.12)',flexShrink:0}}>
              <div style={{display:'flex',gap:7,alignItems:'center',padding:'8px 12px',borderRadius:14,background:'rgba(124,58,237,.05)',border:'1.5px solid rgba(124,58,237,.15)',transition:'border-color .2s'}}
                onFocusCapture={e=>{(e.currentTarget as any).style.borderColor='rgba(124,58,237,.4)'}} onBlurCapture={e=>{(e.currentTarget as any).style.borderColor='rgba(124,58,237,.15)'}}>
                <input ref={aiInputRef} type="text" value={aiInput} onChange={e=>setAIInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();askAI();}}}
                  placeholder="Ask a study question…"
                  className="dark:text-white dark:placeholder-gray-500"
                  style={{flex:1,border:'none',background:'transparent',fontSize:13,outline:'none',color:'#111827'}}/>
                <button onClick={()=>askAI()} disabled={!aiInput.trim()||isAIThinking}
                  style={{width:32,height:32,borderRadius:9,border:'none',background:aiInput.trim()&&!isAIThinking?'linear-gradient(135deg,#7c3aed,#a78bfa)':'#e5e7eb',color:aiInput.trim()&&!isAIThinking?'white':'#9ca3af',display:'flex',alignItems:'center',justifyContent:'center',cursor:aiInput.trim()&&!isAIThinking?'pointer':'not-allowed',flexShrink:0,transition:'all .2s'}}>
                  {isAIThinking?<span style={{width:12,height:12,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',display:'inline-block',animation:'spin .7s linear infinite'}}/>:<Send style={{width:13,height:13}}/>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}