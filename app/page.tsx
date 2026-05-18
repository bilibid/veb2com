// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function Home() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [passkey, setPasskey] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Create or determine role
        const userRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        
        let role = "user";
        if (currentUser.email === "ymerejnotae@gmail.com" || currentUser.email === "jeremy@veb2.com") {
          role = "admin";
        }

        if (!docSnap.exists()) {
          try {
            await setDoc(userRef, {
              email: currentUser.email || "unknown@domain.com",
              role: role,
              createdAt: Date.now()
            });
          } catch(e) {
            console.error("Failed to create user document:", e);
          }
        } else {
          role = docSnap.data().role;
        }

        if (role === "admin") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
      } else {
        setIsInitializing(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAuthenticating || !passkey.trim()) return;
    
    setIsAuthenticating(true);
    setAuthError(null);

    let email = "";
    let password = passkey.trim();

    if (password === "Vv121212") {
      email = "jeremy@veb2.com";
    } else if (password === "Longacre") {
      email = "doug@veb2.com";
    } else {
      setAuthError("Unauthorized Passkey.");
      setIsAuthenticating(false);
      return;
    }
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        try {
           await createUserWithEmailAndPassword(auth, email, password);
        } catch (createError: any) {
           console.error("Create error:", createError);
           if (createError.code === 'auth/operation-not-allowed') {
             setAuthError("Auth disabled. Enable Email/Password in Firebase Console -> Authentication -> Sign-in method.");
           } else if (createError.code === 'auth/email-already-in-use') {
             setAuthError("Invalid Passkey. An account with this clearance level exists, but the identity validation failed.");
           } else {
             setAuthError(createError.message || "Failed to create account.");
           }
        }
      } else if (error.code === 'auth/operation-not-allowed') {
         setAuthError("Auth disabled. Enable Email/Password in Firebase Console -> Authentication -> Sign-in method.");
      } else {
         console.error("Auth error:", error);
         setAuthError(error.message || "An error occurred during authentication.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full grid-lines flex flex-col items-center justify-center p-6 bg-[#050505] overflow-hidden">
      
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-12 cursor-default"
        >
          {/* Main Logo Text */}
          <div className="flex items-baseline logo-glow scale-75 md:scale-100 m-0">
            <span className="text-[120px] md:text-[180px] font-black tracking-tighter leading-none">veb</span>
            <span className="relative inline-block">
              <span className="text-[50px] md:text-[70px] font-light leading-none opacity-80">.com</span>
              <span className="absolute -top-[1.1em] left-0 text-[40px] md:text-[60px] font-medium leading-none">
                2
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full">
            {/* Left side: branding/copy */}
            <div className="flex flex-col justify-center text-center md:text-left gap-6">
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-white leading-tight">
                Secure communications for <span className="text-emerald-400">authorized personnel</span>.
              </h2>
              <p className="text-zinc-400 font-mono text-sm leading-relaxed max-w-md">
                Encrypted channels, persistent logs, and integrated intelligence. 
                Access is restricted to validated identities only.
              </p>
              
              <div className="flex flex-wrap gap-4 mt-4 justify-center md:justify-start">
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/50 border border-zinc-800 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest text-white/80">Quantum Safe</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/50 border border-zinc-800 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest text-white/80">AI Augmented</span>
                </div>
              </div>
            </div>

            {/* Right side: Login */}
            <div className="bg-zinc-950/50 border border-zinc-800 p-8 py-10 backdrop-blur-xl relative">
              <div className="absolute top-0 right-0 p-3">
                <p className="text-[8px] font-mono text-zinc-700 tracking-[0.3em] uppercase">Auth_Module_v2.04</p>
              </div>
              
              <form onSubmit={handleAuth} className="flex flex-col items-center gap-6 w-full">
                <div className="w-full">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-3 text-center md:text-left">Enter System Passkey</label>
                  {isInitializing || isAuthenticating ? (
                     <div className="w-full h-14 bg-black border border-zinc-900 flex items-center justify-center">
                       <p className="micro-label animate-pulse">
                         {isAuthenticating ? "VERIFYING..." : "INITIALIZING..."}
                       </p>
                     </div>
                  ) : (
                     <div className="flex flex-col gap-4">
                       <input
                         type="password"
                         placeholder="••••••••"
                         value={passkey}
                         onChange={e => setPasskey(e.target.value)}
                         className="w-full bg-black border border-zinc-800 p-4 text-center text-xl tracking-widest text-white placeholder:text-zinc-800 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                       />
                       <button 
                         type="submit"
                         disabled={!passkey.trim()}
                         className="w-full px-8 py-4 border border-white/20 text-white font-bold text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
                       >
                         Access System
                         <span className="group-hover:translate-x-1 transition-transform">→</span>
                       </button>
                     </div>
                  )}
                </div>
                
                {authError && (
                  <div className="text-red-400 text-xs font-mono w-full text-center bg-red-500/10 p-4 border border-red-500/20">
                    ERROR_UA: {authError}
                  </div>
                )}
              </form>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="flex flex-col items-center gap-2"
        >
          <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-[0.5em]">Secure Terminal Interface</p>
          <p className="text-[9px] font-mono text-zinc-800 uppercase tracking-[0.2em]">&copy; 2026 VEB2.COM // ALL RIGHTS RESERVED</p>
        </motion.div>
      </div>
    </main>
  );
}
