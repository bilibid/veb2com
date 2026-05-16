"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, deleteDoc, where } from "firebase/firestore";
import { motion } from "motion/react";
import { Trash2 } from "lucide-react";

interface Room {
  id: string;
  name: string;
  allowedEmails: string[];
  createdAt: number;
  createdBy: string;
}

export default function AdminPanel() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomEmails, setNewRoomEmails] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }
      
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists() && userDoc.data().role === "admin") {
        setUser(currentUser);
      } else {
        router.push("/dashboard");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    
    // Auto-create default room if it doesn't exist
    const ensureDefaultRoom = async () => {
      const q = query(collection(db, "rooms"), where("name", "==", "Maybe???"));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        try {
          const roomId = crypto.randomUUID();
          await setDoc(doc(db, "rooms", roomId), {
            name: "Maybe???",
            allowedEmails: ["ymerejnotae@gmail.com", "doug@veb2.com"],
            createdAt: Date.now(),
            createdBy: user.uid
          });
        } catch (err) {
          console.error("Failed to auto-create room", err);
        }
      }
    };
    ensureDefaultRoom();

    const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(roomData.sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => unsubscribe();
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !user) return;

    setIsCreating(true);
    try {
      const roomId = crypto.randomUUID();
      const emails = newRoomEmails.split(",").map(e => e.trim()).filter(e => e.length > 0);
      
      // Admin should always have access
      if (!emails.includes(user.email!)) {
        emails.push(user.email!);
      }

      await setDoc(doc(db, "rooms", roomId), {
        name: newRoomName.trim(),
        allowedEmails: emails,
        createdAt: Date.now(),
        createdBy: user.uid
      });

      setNewRoomName("");
      setNewRoomEmails("");
    } catch (err) {
      console.error(err);
      alert("Failed to create room.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Are you sure you want to delete this room?")) return;
    try {
      await deleteDoc(doc(db, "rooms", roomId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete room.");
    }
  };

  if (loading) return <div className="min-h-screen bg-[#050505] grid-lines text-white flex items-center justify-center"><p className="micro-label">AUTHENTICATING...</p></div>;

  return (
    <main className="relative min-h-screen w-full grid-lines flex flex-col p-6 sm:p-12 bg-[#050505] text-white overflow-y-auto">
      <nav className="flex flex-col sm:flex-row justify-between items-start z-10 relative mb-12 gap-4">
        <div className="flex flex-col gap-1">
          <p className="micro-label">Admin Control Panel</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_currentColor]" />
            <p className="text-xs font-mono break-all text-zinc-400">SYS_ADMIN: {user?.email}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/dashboard")}
            className="text-xs font-mono hover:text-white text-zinc-500 transition-colors uppercase"
          >
            Go to Dashboard
          </button>
          <button 
            onClick={() => signOut(auth)}
            className="text-sm font-medium hover:text-red-400 transition-colors cursor-pointer uppercase tracking-widest text-zinc-300"
          >
            DISCONNECT
          </button>
        </div>
      </nav>

      <div className="w-full max-w-4xl mx-auto z-10 flex flex-col gap-12">
        <motion.section
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5 }}
           className="border border-zinc-800 bg-zinc-950/50 p-6 backdrop-blur-sm"
        >
          <h2 className="text-xl font-light mb-6 tracking-wide text-zinc-100">Instantiate Chat Room</h2>
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-mono text-zinc-500 block mb-2">ROOM DESIGNATION</label>
              <input 
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="e.g. Project Alpha Nexus"
                required
                className="w-full bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-500 block mb-2">AUTHORIZED IDENTITIES (Comma separated emails)</label>
              <textarea 
                value={newRoomEmails}
                onChange={e => setNewRoomEmails(e.target.value)}
                placeholder="user1@gmail.com, user2@gmail.com"
                className="w-full bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors font-mono h-24 resize-y"
              />
            </div>
            <button 
              type="submit"
              disabled={isCreating}
              className="mt-2 self-start px-6 py-3 border border-white/20 hover:bg-white hover:text-black transition-all text-xs tracking-widest uppercase font-bold disabled:opacity-50"
            >
              {isCreating ? 'INITIALIZING...' : 'CREATE SECURE ROOM'}
            </button>
          </form>
        </motion.section>

        <motion.section
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5, delay: 0.1 }}
           className="flex flex-col gap-4"
        >
          <h2 className="text-xl font-light tracking-wide text-zinc-100 border-b border-zinc-800 pb-4">Active Deployments</h2>
          
          {rooms.length === 0 ? (
            <p className="text-zinc-600 font-mono text-sm py-8 text-center italic">No active rooms found.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map(room => (
                <li key={room.id} className="border border-zinc-800 bg-zinc-950/50 p-5 backdrop-blur-sm group hover:border-zinc-700 transition-colors">
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <h3 className="font-medium text-lg cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => router.push(`/chat/${room.id}`)}>
                         {room.name}
                       </h3>
                       <p className="text-xs text-zinc-600 font-mono mt-1">ID: {room.id}</p>
                     </div>
                     <button 
                       onClick={() => handleDeleteRoom(room.id)}
                       title="Delete Room"
                       className="text-zinc-600 hover:text-red-500 transition-colors p-2"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>
                   <div className="mt-4">
                     <p className="micro-label mb-2">AUTH WHITELIST</p>
                     <div className="flex flex-wrap gap-2">
                       {room.allowedEmails.map(email => (
                         <span key={email} className="px-2 py-1 bg-black border border-zinc-800 text-[10px] font-mono text-zinc-400 rounded-sm">
                           {email}
                         </span>
                       ))}
                     </div>
                   </div>
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>
    </main>
  );
}
