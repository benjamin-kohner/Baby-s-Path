import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from './App';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays, parseISO, startOfMonth } from 'date-fns';
import { Activity, Users, Baby, CheckCircle, ChevronLeft } from 'lucide-react';

export default function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const q = query(collection(db, 'telemetry'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => doc.data());
        setTelemetry(data);
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error fetching telemetry (Ensure you are logged in as admin)');
        setLoading(false);
      }
    };
    fetchTelemetry();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Telemetry...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <button onClick={onBack} className="mb-4 flex items-center text-indigo-600"><ChevronLeft size={16} /> Back</button>
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</div>
      </div>
    );
  }

  // Calculate Metrics
  const thirtyDaysAgo = subDays(new Date(), 30);
  const recentEvents = telemetry.filter(t => {
    try { return parseISO(t.timestamp) >= thirtyDaysAgo; } catch(e) { return false; }
  });
  const mau = new Set(recentEvents.map(t => t.userId)).size;

  const uniqueSessions = new Set(telemetry.map(t => t.sessionName).filter(s => s && s !== 'unknown'));
  const taskCompletions = telemetry.filter(t => t.eventName === 'task_completed');
  
  // Tab Views
  const viewEvents = telemetry.filter(t => t.eventName === 'view_switched');
  let viewsDaily = 0;
  let viewsMilestones = 0;
  viewEvents.forEach(v => {
    try {
      const meta = JSON.parse(v.metadata);
      if (meta.view === 'daily') viewsDaily++;
      if (meta.view === 'milestones') viewsMilestones++;
    } catch(e) {}
  });

  // Task Velocity & Most/Least
  const taskCounts: Record<string, number> = {};
  taskCompletions.forEach(t => {
    try {
      const meta = JSON.parse(t.metadata);
      if (meta.taskId) {
        taskCounts[meta.taskId] = (taskCounts[meta.taskId] || 0) + 1;
      }
    } catch(e) {}
  });
  const taskCountEntries = Object.entries(taskCounts).sort((a, b) => b[1] - a[1]);
  const mostCompletedTask = taskCountEntries.length > 0 ? taskCountEntries[0][0] : 'None';
  const leastCompletedTask = taskCountEntries.length > 0 ? taskCountEntries[taskCountEntries.length - 1][0] : 'None';

  // Retention: First seen to latest seen
  const firstSeenMap: Record<string, Date> = {};
  const lastSeenMap: Record<string, Date> = {};
  telemetry.forEach(t => {
    try {
      const d = parseISO(t.timestamp);
      if (!firstSeenMap[t.userId] || d < firstSeenMap[t.userId]) firstSeenMap[t.userId] = d;
      if (!lastSeenMap[t.userId] || d > lastSeenMap[t.userId]) lastSeenMap[t.userId] = d;
    } catch(e) {}
  });
  let retainedD1 = 0;
  let retainedD7 = 0;
  let retainedD30 = 0;
  let totalUsers = Object.keys(firstSeenMap).length;
  Object.keys(firstSeenMap).forEach(uid => {
    const activeDays = (lastSeenMap[uid].getTime() - firstSeenMap[uid].getTime()) / (1000 * 60 * 60 * 24);
    if (activeDays >= 1) retainedD1++;
    if (activeDays >= 7) retainedD7++;
    if (activeDays >= 30) retainedD30++;
  });
  const renderRetention = (count: number) => totalUsers ? `${Math.round((count / totalUsers) * 100)}%` : '0%';
  
  // Tasks by Month
  const tasksByMonthMap: Record<string, number> = {};
  taskCompletions.forEach(t => {
    try {
      const monthStr = format(startOfMonth(parseISO(t.timestamp)), 'MMM yyyy');
      tasksByMonthMap[monthStr] = (tasksByMonthMap[monthStr] || 0) + 1;
    } catch(e) {}
  });
  const tasksByMonthData = Object.keys(tasksByMonthMap).map(k => ({ month: k, count: tasksByMonthMap[k] })).reverse();

  // Activity over last 14 days
  const activityMap: Record<string, number> = {};
  for (let i = 14; i >= 0; i--) {
    activityMap[format(subDays(new Date(), i), 'MMM dd')] = 0;
  }
  telemetry.forEach(t => {
    try {
      const dayStr = format(parseISO(t.timestamp), 'MMM dd');
      if (activityMap[dayStr] !== undefined) {
        activityMap[dayStr]++;
      }
    } catch(e){}
  });
  const activityData = Object.keys(activityMap).map(k => ({ date: k, events: activityMap[k] }));

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 pb-12">
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="mb-6 flex items-center font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
          <ChevronLeft size={20} className="mr-1" /> Back to App
        </button>

        <h1 className="text-3xl font-black text-gray-900 mb-8 tracking-tight flex items-center">
          <Activity className="mr-3 text-indigo-600" /> Platform Telemetry
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="text-gray-500 font-bold text-xs uppercase tracking-widest mb-1 flex items-center"><Users size={14} className="mr-1" /> Monthly Active Users</div>
            <div className="text-3xl font-black text-gray-900">{mau}</div>
            <div className="text-xs text-gray-400 font-medium mt-1">out of {totalUsers} all-time</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="text-gray-500 font-bold text-xs uppercase tracking-widest mb-1 flex items-center"><Baby size={14} className="mr-1" /> Babies Helped</div>
            <div className="text-3xl font-black text-blue-600">{uniqueSessions.size}</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="text-gray-500 font-bold text-xs uppercase tracking-widest mb-1 flex items-center"><CheckCircle size={14} className="mr-1" /> Tasks Completed</div>
            <div className="text-3xl font-black text-green-600">{taskCompletions.length}</div>
            <div className="text-xs text-green-600/70 font-medium mt-1">Avg {totalUsers ? (taskCompletions.length / totalUsers).toFixed(1) : 0} / user</div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="text-gray-500 font-bold text-xs uppercase tracking-widest mb-1 flex items-center"><Activity size={14} className="mr-1" /> Total Events</div>
            <div className="text-3xl font-black text-purple-600">{telemetry.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Retention Overview</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Day 1</span> <span className="font-bold">{renderRetention(retainedD1)}</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: renderRetention(retainedD1) }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Day 7</span> <span className="font-bold">{renderRetention(retainedD7)}</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: renderRetention(retainedD7) }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Day 30</span> <span className="font-bold">{renderRetention(retainedD30)}</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: renderRetention(retainedD30) }}></div></div>
                </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Task Activity</h3>
              <div className="text-sm space-y-4">
                 <div>
                   <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Most Completed</div>
                   <div className="font-bold text-indigo-700 truncate">{mostCompletedTask.replace(/-/g, ' ')}</div>
                 </div>
                 <div>
                   <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Least Completed</div>
                   <div className="font-bold text-gray-600 truncate">{leastCompletedTask.replace(/-/g, ' ')}</div>
                 </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Tab Views</h3>
              <div className="flex justify-center space-x-8 mt-6">
                 <div className="text-center">
                    <div className="text-3xl font-black text-indigo-600">{viewsDaily}</div>
                    <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mt-1">Today</div>
                 </div>
                 <div className="text-center">
                    <div className="text-3xl font-black text-indigo-400">{viewsMilestones}</div>
                    <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mt-1">Goals</div>
                 </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-6">Activity (Last 14 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="events" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorEvents)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-6">Tasks Completed by Month</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByMonthData.length ? tasksByMonthData : [{ month: 'Current', count: taskCompletions.length }]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
