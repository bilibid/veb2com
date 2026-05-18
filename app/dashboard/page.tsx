"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { motion } from "motion/react";
import { MessageSquare } from "lucide-react";

interface Room {
  id: string;
  name: string;
  allowedEmails: string[];
  createdAt: number;
  createdBy: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }
      
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists() && userDoc.data().role === "admin") {
         router.push("/admin"); // Redirect admins to admin panel
         return;
      }
      
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user || loading) return;
    
    // Firestore rules only allow fetching if condition matches, but since array-contains 
    // requires indexing and we want to list securely, we can just use the rule limits 
    // relying on 'allowedEmails' array contains query
    const q = query(
      collection(db, "rooms"),
      where("allowedEmails", "array-contains", user.email)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(roomData.sort((a, b) => b.createdAt - a.createdAt));
    }, (err) => {
      console.error("Failed to fetch rooms:", err);
    });
    return () => unsubscribe();
  }, [user, loading]);

  if (loading) return <div className="min-h-screen bg-[#050505] grid-lines text-white flex items-center justify-center"><p className="micro-label">AUTHENTICATING...</p></div>;

  return (
    <main className="relative min-h-screen w-full grid-lines flex flex-col p-6 sm:p-12 bg-[#050505] text-white overflow-y-auto">
      <nav className="flex flex-col sm:flex-row justify-between items-start z-10 relative mb-12 gap-4">
        <div className="flex flex-col gap-1">
          <p className="micro-label">User Terminal Interface</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_currentColor] animate-pulse" />
            <p className="text-xs font-mono break-all text-zinc-400 uppercase tracking-tighter">SECURE_LINK_ESTABLISHED // {user?.email}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">System Time</p>
            <p className="text-xs font-mono text-zinc-300">
              {currentTime.toLocaleTimeString([], { hour12: false })}
            </p>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="text-xs font-bold text-zinc-400 hover:text-red-400 transition-colors cursor-pointer uppercase tracking-[0.2em] px-4 py-2 border border-zinc-800 hover:border-red-500/30"
          >
            DISCONNECT
          </button>
        </div>
      </nav>

      <div className="w-full max-w-6xl mx-auto z-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <motion.section
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-8">
              <h2 className="text-xl font-light tracking-wide text-zinc-100 flex items-center gap-3">
                <MessageSquare size={20} className="text-zinc-500" />
                Authorized Communication Channels
              </h2>
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest bg-zinc-900 px-2 py-1 border border-zinc-800">
                {rooms.length} NODES FOUND
              </span>
            </div>
            
            {rooms.length === 0 ? (
              <div className="text-center py-20 border border-zinc-800 bg-zinc-950/50 backdrop-blur-sm flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-700">?</div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-zinc-300 font-medium">No active channels</h3>
                  <p className="text-zinc-600 font-mono text-xs">Awaiting authorization from system administrators.</p>
                </div>
              </div>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((room, i) => (
                  <motion.li 
                    key={room.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => router.push(`/chat/${room.id}`)}
                    className="group flex flex-col justify-between border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur-sm cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all rounded-sm"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Encrypted_Link</span>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-700">ID: {room.id.slice(0,8)}</span>
                      </div>
                      <h3 className="font-medium text-lg text-zinc-200 group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{room.name}</h3>
                    </div>
                    <div className="mt-8 flex justify-between items-end border-t border-zinc-900/50 pt-4">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        {room.allowedEmails.length} Registered Identities
                      </p>
                      <span className="text-xs text-zinc-600 font-mono group-hover:text-emerald-400 transition-colors">Access →</span>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.section>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="border border-zinc-800 bg-zinc-950/50 p-5 rounded-sm backdrop-blur-sm"
          >
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-4">System Status</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-zinc-500 font-mono">Platform</span>
                <span className="text-[11px] text-emerald-500 font-mono uppercase tracking-tighter">Operational</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-zinc-500 font-mono">Database</span>
                <span className="text-[11px] text-emerald-500 font-mono uppercase tracking-tighter">Synced</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-zinc-500 font-mono">Gemini Link</span>
                <span className="text-[11px] text-emerald-500 font-mono uppercase tracking-tighter">Ready</span>
              </div>
              <div className="pt-2 border-t border-zinc-900 mt-2">
                <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "94%" }}
                    className="h-full bg-emerald-500"
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-zinc-700 font-mono uppercase">Encryption Load</span>
                  <span className="text-[9px] text-zinc-700 font-mono">94%</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="border border-zinc-800 bg-zinc-950/50 p-5 rounded-sm backdrop-blur-sm"
          >
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-4">Platform Notes</h3>
            <p className="text-[10px] leading-relaxed text-zinc-600 font-mono italic">
              All interactions within the VEB2 terminal are monitored and logged for security purposes. 
              Unauthorized access to channels will trigger an immediate lockout protocol.
            </p>
          </motion.div>
        </aside>
      </div>
    </main>
  );
}
