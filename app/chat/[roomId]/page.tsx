"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Send, Bot, User as UserIcon } from "lucide-react";

interface Room {
  id: string;
  name: string;
  allowedEmails: string[];
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderEmail: string;
  roomId: string;
  allowedEmails: string[];
  isAi: boolean;
  timestamp: number;
}

export default function ChatRoom() {
  const router = useRouter();
  const { roomId } = useParams() as { roomId: string };
  
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isGeminiToggled, setIsGeminiToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auth & Room Validation
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }
      setUser(currentUser);

      // Verify room access
      try {
        const roomDoc = await getDoc(doc(db, "rooms", roomId));
        if (!roomDoc.exists()) {
          alert("Room not found");
          router.push("/dashboard");
          return;
        }

        const roomData = { id: roomDoc.id, ...roomDoc.data() } as Room;
        const isAdmin = currentUser.email === "ymerejnotae@gmail.com";
        if (!isAdmin && !roomData.allowedEmails.includes(currentUser.email!)) {
           alert("Unauthorized access");
           router.push("/dashboard");
           return;
        }
        setRoom(roomData);
        setLoading(false);
      } catch (e) {
         console.error(e);
         router.push("/dashboard");
      }
    });
    return () => unsubscribe();
  }, [roomId, router]);

  // Real-time messages
  useEffect(() => {
    if (!user || loading || !room) return;
    
    const messagesRef = collection(db, `rooms/${roomId}/messages`);
    const q = query(messagesRef, where("allowedEmails", "array-contains", user.email));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      // Sort client-side to avoid composite index requirement
      setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp));
    }, (err) => {
       console.error("Error fetching messages:", err);
    });

    return () => unsubscribe();
  }, [roomId, user, loading, room]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !room || isSending) return;

    let textToSend = inputText.trim();
    if (isGeminiToggled && !textToSend.startsWith("@Gemini")) {
       textToSend = `@Gemini ${textToSend}`;
    }

    setIsSending(true);
    setInputText("");

    try {
      // 1. Send user message
      const msgId = crypto.randomUUID();
      // eslint-disable-next-line react-hooks/purity
      const currentTimestamp = Date.now();
      await setDoc(doc(db, `rooms/${roomId}/messages`, msgId), {
        text: textToSend,
        senderId: user.uid,
        senderEmail: user.email!,
        roomId: roomId,
        allowedEmails: room.allowedEmails,
        isAi: false,
        timestamp: currentTimestamp
      });

      // 2. Determine if AI should reply
      if (textToSend.toLowerCase().startsWith("@gemini")) {
         setIsAiTyping(true);
         await handleAiResponse(textToSend);
         setIsAiTyping(false);
      }

    } catch (err) {
      console.error(err);
      alert("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleAiResponse = async (latestText: string) => {
     if (!room) return;
     try {
       // Build full context
       const contents: any[] = messages.map(msg => ({
          role: msg.isAi ? 'model' : 'user',
          parts: [{ text: `${msg.isAi ? '' : `${msg.senderEmail} said: `}${msg.text}` }]
       }));

       // Add the new message
       contents.push({
          role: 'user',
          parts: [{ text: `${user!.email} said: ${latestText}` }]
       });

       const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
       });

       if (!res.ok) {
          const errRes = await res.json().catch(() => ({}));
          throw new Error(errRes.error || "Failed to fetch response from secure proxy");
       }

       const response = await res.json();
       const responseText = response.text;
       
       if (responseText) {
          const aiMsgId = crypto.randomUUID();
          const aiTimestamp = Date.now();
          await setDoc(doc(db, `rooms/${roomId}/messages`, aiMsgId), {
            text: responseText,
            senderId: "system_gemini",
            senderEmail: "gemini@ai.studio",
            roomId: roomId,
            allowedEmails: room.allowedEmails,
            isAi: true,
            timestamp: aiTimestamp
          });
       }
     } catch (err: any) {
        console.error("AI Generation Error", err);
        // Error fallback message
        const errId = crypto.randomUUID();
        const errTimestamp = Date.now();
        await setDoc(doc(db, `rooms/${roomId}/messages`, errId), {
            text: `*[System Error: ${err?.message || 'Gemini connection interrupted'}]*`,
            senderId: "system_error",
            senderEmail: "system",
            roomId: roomId,
            allowedEmails: room.allowedEmails,
            isAi: true,
            timestamp: errTimestamp
        });
     }
  };

  if (loading) return <div className="min-h-screen bg-[#050505] grid-lines text-white flex items-center justify-center"><p className="micro-label">SYNCHRONIZING SECURE TUNNEL...</p></div>;

  return (
    <main className="relative h-screen w-full bg-[#050505] text-white flex flex-col font-sans overflow-hidden">
      
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-zinc-800/80 bg-black/50 backdrop-blur-md px-6 flex justify-between items-center z-10">
         <div className="flex items-center gap-4">
           <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
              ← Back
           </button>
           <h1 className="text-lg font-medium">{room?.name}</h1>
           <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
             {room?.allowedEmails.length} Participants
           </span>
         </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 z-10 scroll-smooth">
         <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="text-center py-8">
               <p className="micro-label mb-2">END-TO-END VERIFIED</p>
               <p className="text-xs text-zinc-500 font-mono">Welcome to &apos;{room?.name}&apos;.</p>
               <p className="text-xs text-zinc-600 font-mono mt-1">Start messages with @Gemini to ping the AI.</p>
            </div>

            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                 const isMe = msg.senderId === user?.uid;
                 return (
                   <motion.div 
                     key={msg.id}
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className={`flex gap-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                   >
                     {/* Avatar */}
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
                       ${msg.isAi ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 
                         isMe ? 'bg-zinc-800 text-zinc-300' : 'bg-blue-900/40 text-blue-400 border border-blue-800/50'}`}
                     >
                        {msg.isAi ? <Bot size={16} /> : <UserIcon size={16} />}
                     </div>

                     {/* Message Body */}
                     <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                       <span className="text-[10px] text-zinc-500 font-mono mb-1 px-1 flex items-center gap-2">
                          <span>{msg.isAi ? 'Gemini' : msg.senderEmail}</span>
                          <span className="opacity-50">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       </span>
                       <div className={`px-4 py-3 rounded-2xl ${
                         msg.isAi 
                           ? 'bg-zinc-900/80 border border-zinc-800/50 text-zinc-200 rounded-tl-sm' 
                           : isMe
                             ? 'bg-emerald-900/20 border border-emerald-900/50 text-emerald-50 rounded-tr-sm'
                             : 'bg-zinc-900 text-zinc-200 rounded-tl-sm'
                       }`}>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                       </div>
                     </div>
                   </motion.div>
                 );
              })}
            </AnimatePresence>
            
            {isAiTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 flex-row"
              >
                 <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-1 animate-pulse">
                    <Bot size={16} />
                 </div>
                 <div className="flex flex-col max-w-[80%] items-start">
                    <span className="text-[10px] text-zinc-500 font-mono mb-1 px-1 flex items-center gap-2">
                       <span>Gemini</span>
                    </span>
                    <div className="px-4 py-3 bg-zinc-900/80 border border-zinc-800/50 text-zinc-400 rounded-2xl rounded-tl-sm max-w-fit flex items-center gap-1 h-10 animate-pulse">
                       <span className="text-sm italic">typing...</span>
                    </div>
                 </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
         </div>
      </div>

      {/* Input Area */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none grid-lines opacity-50 bg-gradient-to-t from-[#050505] via-transparent to-transparent pointer-events-none z-0"></div>
      
      <div className="absolute bottom-0 w-full bg-gradient-to-t from-[#050505] via-[#050505] to-transparent pt-12 pb-6 px-4 sm:px-6 z-20">
         <div className="max-w-3xl mx-auto w-full flex flex-col gap-2">
            
            <div className="flex items-center">
              <button 
                onClick={() => setIsGeminiToggled(!isGeminiToggled)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-all ${
                  isGeminiToggled 
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                    : 'bg-black text-zinc-500 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                @Gemini
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="relative flex items-end w-full group">
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={isGeminiToggled ? "Message @Gemini..." : "Message chat..."}
                className={`w-full bg-zinc-900/80 border text-zinc-100 placeholder:text-zinc-600 rounded-xl py-4 pl-4 pr-14 focus:outline-none resize-none transition-colors backdrop-blur-md min-h-[56px] max-h-32 shadow-xl ${
                  isGeminiToggled ? 'border-indigo-500/30 focus:border-indigo-500/60' : 'border-zinc-800 focus:border-zinc-600'
                }`}
                rows={1}
              />
              <button 
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-colors"
               >
                 <Send size={18} />
              </button>
            </form>
            <p className="text-[10px] text-zinc-600 font-mono text-center mt-2">
              Conversations are securely synced and persistent.
            </p>
         </div>
      </div>

    </main>
  );
}
