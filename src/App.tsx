import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Circle, 
  Calendar, 
  Award, 
  Activity, 
  BookOpen, 
  Users, 
  Baby,
  Trophy,
  Cloud,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc
} from 'firebase/firestore';

import { trackEvent } from './lib/telemetry';

// Firebase Configuration
import firebaseConfig from '../firebase-applet-config.json';

const isFirebaseConfigured = !!firebaseConfig.apiKey;

export let app: any, auth: any, db: any;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export { isFirebaseConfigured };

const appId = 'baby-tracker-shared';

// Helper to get current date in Pacific Time Zone (YYYY-MM-DD format)
const getPacificDateString = () => {
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: 'America/Los_Angeles', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  };
  const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD
  return formatter.format(new Date());
};

import { TASK_POOLS } from './lib/tasks';

const MILESTONE_HIGHLIGHTS: Record<number, string[]> = {
  6: ["Rolls over both ways", "Sits without support", "Babbles"],
  7: ["Reaches with one hand", "Responds to own name", "Transfers objects"],
  8: ["Begins to crawl", "Pulls to stand", "Pincer grasp developing"],
  9: ["Stands holding on", "Plays peek-a-boo", "Understands 'no'"],
  10: ["Cruises along furniture", "Waves bye-bye", "Says mama/dada"],
  11: ["Stands alone briefly", "Puts objects in container", "Points to objects"],
  12: ["Walks few steps", "Uses basic gestures", "Says 1-2 words"],
  13: ["Walks alone", "Drinks from cup", "Looks at named picture"],
  14: ["Follows 1-step commands", "Uses spoon (spills)", "Shows affection"],
  15: ["Points to ask", "Walks well", "Stacks 2 blocks"],
  16: ["Uses 3-5 words", "Points to body part", "Kicks ball"],
  17: ["Feeds self with fingers", "Walks up steps (with help)", "Imitates chores"],
  18: ["Runs (stiffly)", "Says 10+ words", "Eats with spoon well"],
  19: ["Climbs furniture", "Uses words to express needs", "Scribbles"],
  20: ["Throws ball overhand", "Follows 2-step commands", "Knows object uses"],
  21: ["Combines 2 words", "Jumps up", "Points to pictures in book"],
  22: ["Parallel play", "Names body parts", "Begins sorting"],
  23: ["Tiptoe walks", "Names 50+ words", "Stacks 4-6 blocks"],
  24: ["Runs well", "Uses 2-3 word sentences", "Imitates lines/circles"]
};

const calculateAgeInMonths = (birthDateStr: string, currentDateStr: string) => {
  if (!birthDateStr) return null;
  const bDate = new Date(birthDateStr);
  const cDate = new Date(currentDateStr);
  if (isNaN(bDate.getTime()) || isNaN(cDate.getTime())) return null;
  let months = (cDate.getFullYear() - bDate.getFullYear()) * 12;
  months -= bDate.getMonth();
  months += cDate.getMonth();
  if (cDate.getDate() < bDate.getDate()) {
    months--;
  }
  return months;
};

const getPoolKeyForAge = (months: number | null) => {
  if (months === null || months <= 8) return '6-8';
  if (months <= 11) return '9-11';
  if (months <= 14) return '12-14';
  if (months <= 17) return '15-17';
  if (months <= 20) return '18-20';
  return '21-24';
};

import AdminDashboard from './AdminDashboard';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('app');
  const [selectedDate, setSelectedDate] = useState(getPacificDateString());
  const [completedTasks, setCompletedTasks] = useState({});
  const [view, setView] = useState('daily');
  
  const setViewTracked = (newView: string) => {
    setView(newView);
    const sessionName = localStorage.getItem('generatedSessionName') || 'unknown';
    trackEvent('view_switched', sessionName, JSON.stringify({ view: newView }));
  };

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [babyName, setBabyName] = useState(() => localStorage.getItem('babyName') || '');
  const [birthDate, setBirthDate] = useState(() => localStorage.getItem('birthDate') || '');

  const generatedSessionName = babyName && birthDate 
    ? `baby-${babyName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}-${birthDate.replace(/-/g, '')}`
    : null;

  const currentAgeInMonths = calculateAgeInMonths(birthDate, selectedDate);
  const displayAge = currentAgeInMonths !== null ? Math.max(0, currentAgeInMonths) : '--';
  const properBabyName = babyName.trim() || 'Baby';

  useEffect(() => {
    localStorage.setItem('babyName', babyName);
    localStorage.setItem('generatedSessionName', generatedSessionName || '');
    document.title = babyName.trim() ? `${babyName.trim()}'s Path` : "Baby's Path";
  }, [babyName, generatedSessionName]);

  useEffect(() => {
    localStorage.setItem('birthDate', birthDate);
  }, [birthDate]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        trackEvent('app_open', localStorage.getItem('generatedSessionName') || 'unknown', JSON.stringify({ device: navigator.userAgent }));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    if (auth.currentUser) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setSyncStatus('connecting');
    } catch (error) {
      setSyncStatus('error');
      console.error("Auth failed:", error);
    }
  };

  const handleFirestoreError = (error: unknown, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setSyncStatus('error');
    throw new Error(JSON.stringify(errInfo));
  };

  useEffect(() => {
    if (!user || !isFirebaseConfigured || !generatedSessionName) return;

    const basePath = `artifacts/${generatedSessionName}/public/data/completions`;
    const completionsRef = collection(db, basePath);
    
    const unsubscribe = onSnapshot(completionsRef, (snapshot) => {
      const remoteData: any = {};
      snapshot.forEach((doc) => {
        remoteData[doc.id] = doc.data().completed;
      });
      setCompletedTasks(remoteData);
      setSyncStatus('synced');
    }, (error) => {
      handleFirestoreError(error, 'list', basePath);
    });

    return () => unsubscribe();
  }, [user, generatedSessionName]);

  const toggleTask = async (taskId: string) => {
    if (!user || !isFirebaseConfigured || !generatedSessionName) return;
    const taskKey = `${selectedDate}-${taskId}`;
    const newStatus = !completedTasks[taskKey as keyof typeof completedTasks];
    
    setCompletedTasks((prev: any) => ({ ...prev, [taskKey]: newStatus }));
    
    const docPath = `artifacts/${generatedSessionName}/public/data/completions/${taskKey}`;
    try {
      const docRef = doc(db, docPath);
      await setDoc(docRef, { 
        completed: newStatus, 
        updatedBy: user.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      if (newStatus) {
        trackEvent('task_completed', generatedSessionName, JSON.stringify({ taskId, month: currentAgeInMonths }));
      }
    } catch (error) {
      handleFirestoreError(error, 'write', docPath);
    }
  };

  const getDailyTasks = () => {
    const poolKey = getPoolKeyForAge(currentAgeInMonths) as keyof typeof TASK_POOLS;
    const pool = TASK_POOLS[poolKey] || TASK_POOLS['6-8'];
    const dateParts = selectedDate.split('-');
    const daySeed = parseInt(dateParts[2]) + parseInt(dateParts[1]);

    return [
      { ...pool.Athletic[daySeed % pool.Athletic.length], category: 'Athletic' },
      { ...pool.Cognitive[(daySeed + 1) % pool.Cognitive.length], category: 'Cognitive' },
      { ...pool.Social[(daySeed + 2) % pool.Social.length], category: 'Social' },
      { ...pool.FineMotor[(daySeed + 3) % pool.FineMotor.length], category: 'Fine Motor' }
    ];
  };

  const categories = {
    Athletic: { color: 'bg-orange-100 text-orange-700', icon: <Activity size={16} /> },
    Cognitive: { color: 'bg-blue-100 text-blue-700', icon: <BookOpen size={16} /> },
    Social: { color: 'bg-purple-100 text-purple-700', icon: <Users size={16} /> },
    'Fine Motor': { color: 'bg-green-100 text-green-700', icon: <Baby size={16} /> }
  };

  if (currentRoute === 'admin') {
    return <AdminDashboard onBack={() => setCurrentRoute('app')} />;
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-orange-100 p-4 rounded-full">
              <AlertCircle size={32} className="text-orange-600" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center text-gray-900 mb-2 tracking-tight">Firebase Setup Required</h1>
          <p className="text-gray-600 text-center mb-6 text-sm">
            To save and share {properBabyName}'s progress with your family, you need to connect a Firebase project.
          </p>
          
          <div className="space-y-4 text-sm text-gray-700">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h3 className="font-bold mb-2">1. Create a Firebase Project</h3>
              <p className="mb-2">Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-medium">Firebase Console</a> and create a new project.</p>
              <p className="mb-2">Enable <strong>Google Sign-In</strong> in Authentication &gt; Sign-in method.</p>
              <p>Create a <strong>Firestore Database</strong> in test mode (or set up security rules).</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h3 className="font-bold mb-2">2. Add Environment Variables</h3>
              <p className="mb-2">Add these variables to your .env file:</p>
              <ul className="list-disc pl-5 space-y-1 font-mono text-xs bg-gray-100 p-3 rounded-lg">
                <li>VITE_FIREBASE_API_KEY</li>
                <li>VITE_FIREBASE_AUTH_DOMAIN</li>
                <li>VITE_FIREBASE_PROJECT_ID</li>
                <li>VITE_FIREBASE_STORAGE_BUCKET</li>
                <li>VITE_FIREBASE_MESSAGING_SENDER_ID</li>
                <li>VITE_FIREBASE_APP_ID</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Baby size={48} className="text-indigo-600 mx-auto mb-4 animate-bounce" />
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Connecting to {properBabyName}'s Cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-28">
      <header className="bg-white border-b sticky top-0 z-20 px-4 py-4 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-indigo-200 shadow-lg">
              <Baby size={22} />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight text-gray-900 leading-none">{properBabyName}'s Path</h1>
              <div className="flex items-center mt-1">
                {syncStatus === 'synced' ? (
                  <span className="flex items-center text-[9px] font-bold text-green-500 uppercase tracking-tighter">
                    <Wifi size={10} className="mr-1" /> Live with Family
                  </span>
                ) : syncStatus === 'error' ? (
                  <span className="flex items-center text-[9px] font-bold text-red-500 uppercase tracking-tighter">
                    <WifiOff size={10} className="mr-1" /> Connection Error
                  </span>
                ) : user ? (
                  <span className="flex items-center text-[9px] font-bold text-orange-400 uppercase tracking-tighter animate-pulse">
                    <Cloud size={10} className="mr-1" /> Syncing...
                  </span>
                ) : (
                  <span className="flex items-center text-[9px] font-bold text-gray-500 uppercase tracking-tighter">
                    <WifiOff size={10} className="mr-1" /> Sign in to Sync
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
            <div className="flex flex-col items-center px-4 min-w-[60px]">
               <span className="font-black text-sm text-indigo-600">{displayAge}</span>
               <span className="text-[7px] font-bold text-gray-400 uppercase tracking-tighter">Months</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pt-6">
        {syncStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mb-4 text-xs">
            <p className="font-bold mb-1 flex items-center"><AlertCircle size={14} className="mr-1" /> Connection Error</p>
            <p>Please check your Firebase configuration:</p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 opacity-90">
              <li>Are popups allowed for <strong>Google Login</strong>?</li>
              <li>Is your Firestore database created?</li>
              <li>Are your Firestore <strong>Security Rules</strong> set to allow reads and writes?</li>
              <li>Try refreshing or clicking the connection icon to reconnect.</li>
            </ul>
          </div>
        )}

        <div className="mb-6 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <p className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Family Sync Setup</p>
            {!user && (
              <button 
                onClick={handleSignIn}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-widest py-1.5 px-3 rounded-lg shadow-sm transition-colors"
                title="Google Login Required"
              >
                Sign In
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="baby-name" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Baby's Name</label>
              <input
                id="baby-name"
                type="text"
                value={babyName}
                onChange={(e) => setBabyName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 font-medium transition-colors"
                placeholder="e.g. Liam"
              />
            </div>
            <div>
              <label htmlFor="birth-date" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Birth Date</label>
              <input
                id="birth-date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 font-medium transition-colors"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-medium">Connect with exactly the same name and birth date on all devices to sync tasks together.</p>
        </div>

        <div className="flex bg-gray-200 p-1.5 rounded-2xl mb-8 border border-gray-200 shadow-inner">
          <button 
            onClick={() => setViewTracked('daily')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center space-x-2 transition-all ${
              view === 'daily' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500'
            }`}
          >
            <Calendar size={14} />
            <span>Today</span>
          </button>
          <button 
            onClick={() => setViewTracked('milestones')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center space-x-2 transition-all ${
              view === 'milestones' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500'
            }`}
          >
            <Award size={14} />
            <span>Goals</span>
          </button>
        </div>

        {view === 'daily' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Checklist</h2>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">
                PST Mode
              </div>
            </div>
            
            <div className="space-y-3">
              {getDailyTasks().map((task) => {
                const taskKey = `${selectedDate}-${task.id}`;
                const isDone = completedTasks[taskKey];
                const cat = categories[task.category] || categories.Cognitive;
                
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      isDone 
                      ? 'border-green-500 bg-green-50 shadow-inner' 
                      : 'border-white bg-white shadow-sm hover:border-indigo-100'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-2.5 rounded-xl ${cat.color}`}>
                        {cat.icon}
                      </div>
                      <div>
                        <p className={`font-bold leading-tight ${isDone ? 'text-green-700 line-through opacity-70' : 'text-gray-800'}`}>
                          {task.text}
                        </p>
                        <span className="text-[10px] uppercase tracking-widest font-black opacity-30">
                          {task.category}
                        </span>
                      </div>
                    </div>
                    {isDone ? <CheckCircle className="text-green-500" /> : <Circle className="text-gray-100" />}
                  </button>
                );
              })}
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-3xl text-white shadow-xl">
              <div className="flex items-center space-x-2 mb-2">
                <Trophy size={18} className="text-yellow-300" />
                <h3 className="font-black text-xs uppercase tracking-widest">Shared Tip</h3>
              </div>
              <p className="text-sm font-medium leading-relaxed opacity-90">
                Consistency builds {properBabyName}'s confidence. If you and your partner use the same "clean up" song or "high five" routines, they'll learn 2x faster!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-gray-800">Month {displayAge} Milestones</h2>
            <div className="grid grid-cols-1 gap-3">
              {(displayAge !== '--' && MILESTONE_HIGHLIGHTS[displayAge as number] ? MILESTONE_HIGHLIGHTS[displayAge as number] : ["Set birth date to see milestones!"]).map((m, idx) => (
                <div key={idx} className="flex items-center space-x-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="bg-yellow-100 p-1.5 rounded-full text-yellow-600">
                    <Award size={18} />
                  </div>
                  <p className="text-gray-700 font-bold text-sm">{m}</p>
                </div>
              ))}
            </div>
            <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
               <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 text-center">Developmental Note</h4>
               <p className="text-sm text-indigo-700 font-medium text-center">
                 "Walking on uneven ground (grass/hills) is better for {properBabyName}'s athletic foundation than any flat playground."
               </p>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-md mx-auto px-4 pb-28 pt-4 text-center pb-32">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-loose">
          Prototype built by Ben Kohner <br/>
          {user?.email === 'benjaminkohner@gmail.com' && (
            <button onClick={() => setCurrentRoute('admin')} title="Admin Dashboard">📊</button>
          )}
        </p>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
          Feedback welcome: <br/> <a href="mailto:benjaminkohner@gmail.com" className="text-indigo-400 hover:text-indigo-600 transition-colors lowercase font-medium tracking-normal text-xs">benjaminkohner@gmail.com</a>
        </p>
      </footer>

      <nav className="fixed bottom-6 left-4 right-4 bg-white/90 backdrop-blur-lg border border-white/20 rounded-[32px] p-4 shadow-2xl z-30 max-w-md mx-auto">
        <div className="flex items-center justify-around">
          <div className="flex flex-col items-center">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-black border-none focus:ring-0 bg-transparent text-indigo-600 cursor-pointer text-center"
            />
            <span className="text-[8px] text-gray-400 uppercase font-black tracking-widest">
              {new Date(selectedDate.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          
          <div className="h-10 w-px bg-gray-100"></div>

          <div className="flex flex-col items-center opacity-40">
            <Users size={18} className="text-gray-600" />
            <span className="text-[7px] font-black uppercase tracking-tighter">Family Active</span>
          </div>

          <div className="h-10 w-px bg-gray-100"></div>

          <button 
            onClick={() => setSelectedDate(getPacificDateString())}
            className="flex flex-col items-center group"
          >
            <div className="p-1 bg-gray-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
              <Calendar size={18} className="text-gray-400 group-hover:text-indigo-600" />
            </div>
            <span className="text-[8px] uppercase font-bold tracking-widest text-gray-400 group-hover:text-indigo-600">Today</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
