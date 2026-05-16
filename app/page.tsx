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
    <main className="relative min-h-screen w-full grid-lines flex flex-col justify-between p-12 overflow-hidden bg-[#050505]">
      
      {/* Decorative center layout matching theme structure */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-8 cursor-default z-10"
        >
          {/* Main Logo Text with exact sizing from theme HTML */}
          <div className="flex items-baseline logo-glow scale-[0.35] sm:scale-50 md:scale-75 xl:scale-100 m-0">
            <span className="text-[180px] font-black tracking-tighter leading-none">veb</span>
            
            <span className="relative inline-block">
              <span className="text-[70px] font-light leading-none opacity-80">.com</span>
              <span className="absolute -top-[1.1em] left-0 text-[60px] font-medium leading-none">
                2
              </span>
            </span>
          </div>

          <form onSubmit={handleAuth} className="pointer-events-auto flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
            {isInitializing || isAuthenticating ? (
               <div className="micro-label">
                 {isAuthenticating ? "VERIFYING PASSKEY..." : "INITIALIZING..."}
               </div>
            ) : (
               <>
                 <input
                   type="password"
                   placeholder="Enter Passkey"
                   value={passkey}
                   onChange={e => setPasskey(e.target.value)}
                   className="w-full bg-black border border-zinc-800 p-4 text-center text-xl tracking-widest text-white placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                 />
                 <button 
                  type="submit"
                  disabled={!passkey.trim()}
                  className="w-full px-8 py-4 border border-white/20 text-white font-bold text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Access System
                 </button>
               </>
            )}
            
            {authError && (
              <div className="text-red-400 text-xs font-mono max-w-sm text-center bg-red-500/10 p-3 outline outline-1 outline-red-500/20">
                {authError}
              </div>
            )}
          </form>
        </motion.div>
      </div>

      <nav className="flex justify-between items-start z-10 relative pointer-events-none opacity-0 h-10 w-full" aria-hidden="true" />
    </main>
  );
}
