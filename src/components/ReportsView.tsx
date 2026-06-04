import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Calendar as CalendarIcon, Download, Target, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { Project, SocialPost, Task, TeamPerformance, laravelApi } from '../lib/laravelApi';
import { cn } from '../lib/utils';

export const ReportsView: React.FC = () => {
  const { isAgencyAdmin } = useAuth();
  const [timeRange, setTimeRange] = useState('This Month');
  const [team, setTeam] = useState<TeamPerformance[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    const [teamList, projectList, taskList, postList] = await Promise.all([
      isAgencyAdmin ? laravelApi.teamPerformance().catch(() => []) : Promise.resolve([]),
      laravelApi.projects(),
      laravelApi.tasks(),
      laravelApi.socialPosts(),
    ]);
    setTeam(teamList);
    setProjects(projectList);
    setTasks(taskList);
    setSocialPosts(postList);
  };

  useEffect(() => {
    loadData().catch((err) => setError(err.message));
  }, [isAgencyAdmin]);

  const workerPerformance = useMemo(() => team.map((member) => {
    const total = member.open_tasks + member.completed_tasks;
    const efficiency = total > 0 ? Math.round((member.completed_tasks / total) * 100) : 100;
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      email: member.email,
      tasks: total,
      open: member.open_tasks,
      completed: member.completed_tasks,
      efficiency,
      projects: projects.filter((project) => project.manager_id === member.id).length,
      is_active: member.is_active,
    };
  }), [projects, team]);

  const channelPerformance = useMemo(() => {
    const counts = socialPosts.reduce<Record<string, number>>((acc, post) => {
      const platform = post.platform || 'other';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([name, value]) => ({ name: name[0].toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [socialPosts]);
  const COLORS = ['#111827', '#FF6321', '#9ca3af', '#f3f4f6'];

  const openTasks = tasks.filter((task) => task.status !== 'completed').length;
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const publishedPosts = socialPosts.filter((post) => post.status === 'published').length;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row gap-6 md:items-end justify-between">
        <div>
          <h3 className="text-3xl font-serif font-bold text-gray-900 italic mb-2">Campaign Intelligence</h3>
          <p className="text-gray-400 text-sm">Analytics across client marketing funnels and team operations.</p>
        </div>
        <div className="flex gap-3">
          <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)} className="px-5 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-500">
            {['Today', 'This Week', 'This Month', 'This Quarter', 'Year to Date'].map((range) => <option key={range}>{range}</option>)}
          </select>
          <button onClick={() => window.print()} className="px-5 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all flex items-center gap-2">
            <Download size={18} /> Print Report
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Kpi label="Active Projects" value={String(projects.length)} icon={Users} color="text-blue-500" />
        <Kpi label="Open Tasks" value={String(openTasks)} icon={TrendingUp} color="text-orange-500" />
        <Kpi label="Completed" value={String(completedTasks)} icon={Target} color="text-green-500" />
        <Kpi label="Published Posts" value={String(publishedPosts)} icon={BarChart3} color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-sm">
          <h4 className="text-xl font-serif font-bold italic mb-8">Team Throughput</h4>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workerPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="completed" fill="#111827" radius={[6, 6, 0, 0]} barSize={32} />
                <Bar dataKey="open" fill="#FF6321" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-sm flex flex-col">
          <h4 className="text-xl font-serif font-bold italic mb-8">Channel Mix</h4>
          <div className="flex-1 min-h-[300px]">
            {channelPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={channelPerformance} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                    {channelPerformance.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center text-gray-400">
                <BarChart3 size={28} className="text-gray-200 mb-3" />
                <p className="text-sm font-bold">No social posts yet</p>
                <p className="text-xs mt-1">Create posts in Social Media to populate this chart.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function Kpi({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-3 rounded-xl bg-gray-50', color)}><Icon size={20} /></div>
        <CalendarIcon size={14} className="text-gray-300" />
      </div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
    </div>
  );
}
