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
          <p className="micro-label">User Terminal</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_currentColor]" />
            <p className="text-xs font-mono break-all text-zinc-400">USER: {user?.email}</p>
          </div>
        </div>
        
        <button 
          onClick={() => signOut(auth)}
          className="text-sm font-medium text-zinc-300 hover:text-red-400 transition-colors cursor-pointer uppercase tracking-widest"
        >
          DISCONNECT
        </button>
      </nav>

      <div className="w-full max-w-4xl mx-auto z-10 flex flex-col gap-12">
        <motion.section
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5 }}
        >
          <h2 className="text-xl font-light tracking-wide text-zinc-100 border-b border-zinc-800 pb-4 mb-6">Assigned Communication Channels</h2>
          
          {rooms.length === 0 ? (
            <div className="text-center py-12 border border-zinc-800 bg-zinc-950/50 backdrop-blur-sm">
              <h3 className="text-zinc-300 mb-2 font-medium">No active channels</h3>
              <p className="text-zinc-600 font-mono text-xs">You have not been authorized for any active communication rooms.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room, i) => (
                <motion.li 
                  key={room.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => router.push(`/chat/${room.id}`)}
                  className="group flex flex-col justify-between border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur-sm cursor-pointer hover:border-blue-500/50 hover:bg-blue-950/10 transition-all rounded-sm min-h-[160px]"
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <MessageSquare size={18} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
                      <span className="text-[10px] font-mono text-zinc-600">ID:{room.id.slice(0,6)}</span>
                    </div>
                    <h3 className="font-medium text-lg text-zinc-200 group-hover:text-white">{room.name}</h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-zinc-800/50">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      {room.allowedEmails.length} PARTICIPANTS
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>
    </main>
  );
}
