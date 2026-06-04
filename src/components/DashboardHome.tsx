import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  Target,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { DashboardSummary, Project, Task, TeamPerformance, laravelApi, uiTaskStatus } from '../lib/laravelApi';
import { cn, formatDate } from '../lib/utils';

interface DashboardHomeProps {
  onAddTask?: () => void;
  onAIContent?: () => void;
  onProjectClick?: (projectId: string) => void;
  onViewRoadmap?: () => void;
  onViewProjects?: () => void;
  onViewTasks?: () => void;
  onViewSocial?: () => void;
  onViewReports?: () => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  onAddTask,
  onAIContent,
  onProjectClick,
  onViewRoadmap,
  onViewProjects,
  onViewTasks,
  onViewSocial,
  onViewReports,
}) => {
  const { userProfile, isAgencyAdmin } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      laravelApi.dashboard(),
      laravelApi.projects(),
      laravelApi.tasks(),
      isAgencyAdmin ? laravelApi.teamPerformance().catch(() => []) : Promise.resolve([]),
    ])
      .then(([dashboard, projectList, taskList, teamList]) => {
        if (!mounted) return;
        setSummary(dashboard);
        setProjects(projectList);
        setTasks(taskList);
        setTeam(teamList);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isAgencyAdmin]);

  const cards = [
    { label: 'Total Projects', value: projects.length, icon: Briefcase, color: 'bg-indigo-600', onClick: onViewProjects },
    { label: 'Sales Leads', value: projects.filter((project) => project.type === 'lead').length, icon: Target, color: 'bg-[#FF6321]' },
    { label: 'Global Backlog', value: summary?.stats.openTasks ?? tasks.filter((task) => task.status !== 'completed').length, icon: AlertCircle, color: 'bg-rose-500', onClick: onViewTasks },
    { label: 'Content Pipeline', value: summary?.stats.scheduledPosts ? `${summary.stats.scheduledPosts} Scheduled` : 'Active', icon: MessageSquare, color: 'bg-amber-500', onClick: onViewSocial },
  ];

  const urgentTasks = useMemo(() => tasks
    .filter((task) => task.status !== 'completed')
    .sort((a, b) => {
      const priority = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priority[a.priority] - priority[b.priority];
    })
    .slice(0, 5), [tasks]);

  const projectProgress = (project: Project) => {
    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    if (projectTasks.length === 0) return project.progress || 0;
    return Math.round((projectTasks.filter((task) => task.status === 'completed').length / projectTasks.length) * 100);
  };

  return (
    <div className="space-y-8">
      <div className="relative bg-gray-900 rounded-[2.5rem] p-10 overflow-hidden text-white shadow-2xl min-h-[300px]">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-5xl font-serif mb-4 leading-tight">
            {isAgencyAdmin ? 'Command Center' : `Hello, ${userProfile?.displayName?.split(' ')[0] || 'there'}`} <br />
            <span className="italic text-gray-400">
              {isAgencyAdmin ? 'Strategic oversight & team growth.' : 'Projects, content, and approvals in one place.'}
            </span>
          </h1>
          <p className="text-gray-300 text-lg mb-8 max-w-md">
            Monitor resource allocation, project health, client approvals, and marketing execution from the Laravel workspace.
          </p>
          <div className="flex gap-4">
            <button onClick={onAddTask} className="bg-white text-gray-900 px-6 py-3 rounded-2xl font-bold hover:bg-gray-100 transition-all flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              Plan Global Task
            </button>
            <button onClick={onViewRoadmap} className="bg-gray-800 text-white px-6 py-3 rounded-2xl font-bold hover:bg-gray-700 transition-all">
              View Agency Roadmap
            </button>
          </div>
        </div>

        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-br from-gray-800 to-transparent rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-[-10%] left-[20%] w-[300px] h-[300px] bg-[#FF6321] rounded-full blur-[100px] opacity-10" />

        <div className="absolute right-20 bottom-10 hidden lg:block">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl max-w-xs">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">System Pulse</p>
            <div className="flex -space-x-2 mb-4">
              {team.slice(0, 4).map((member) => (
                <div key={member.id} className="w-10 h-10 rounded-full border-2 border-gray-900 bg-gray-700 flex items-center justify-center text-[10px] font-bold">
                  {member.name[0]}
                </div>
              ))}
              {team.length === 0 && <div className="w-10 h-10 rounded-full border-2 border-gray-900 bg-gray-700 flex items-center justify-center text-[10px] font-bold">D</div>}
            </div>
            <p className="text-sm font-medium">{Math.max(team.length, 1)} team members active</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((stat, index) => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -5 }}
            onClick={stat.onClick}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 flex items-center gap-5 cursor-pointer hover:border-[#FF6321] transition-all"
          >
            <div className={cn('p-4 rounded-2xl text-white shadow-md', stat.color)}>
              <stat.icon size={26} />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest text-[10px]">{stat.label}</p>
              <h3 className="text-2xl font-serif font-bold text-gray-900">{loading && index === 0 ? '...' : stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <QuickAction icon={Plus} title="Assign Global Task" text="Allocate execution work across active client projects." onClick={onAddTask} />
        <QuickAction icon={Zap} title="Run AI Content Brain" text="Generate social drafts, post angles, and campaign ideas." onClick={onAIContent} />
        <QuickAction icon={Calendar} title="Sync Agency Roadmap" text="Review visual timelines and cross-project milestones." onClick={onViewRoadmap} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-serif font-bold text-gray-900">Active Projects</h3>
              <p className="text-gray-400 text-xs mt-1">Live work pulled from the Laravel SQL database.</p>
            </div>
            <button onClick={onViewProjects} className="px-4 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-500 uppercase tracking-widest hover:bg-gray-100 transition-all">
              Open Projects
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {projects.slice(0, 6).map((project) => {
              const progress = projectProgress(project);
              return (
                <button key={project.id} onClick={() => onProjectClick?.(String(project.id))} className="text-left p-6 bg-gray-50 rounded-[2rem] border border-transparent hover:border-gray-200 hover:bg-white transition-all group">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="font-bold text-gray-900 group-hover:text-[#FF6321] transition-all truncate">{project.name}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{project.status.replaceAll('_', ' ')}</span>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2 mb-5">{project.description || 'No project brief yet.'}</p>
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">Progress</span>
                    <span className="text-sm font-mono font-bold text-gray-900">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-50">
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-6 italic">Priority Queue</h3>
          <div className="space-y-4">
            {urgentTasks.map((task) => (
              <div key={task.id} className="p-4 rounded-2xl hover:bg-gray-50 transition-all border border-gray-50 flex items-start gap-4">
                <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', task.priority === 'urgent' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : 'bg-gray-300')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{task.title}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight flex items-center gap-2">
                    <Clock size={10} />
                    {task.due_at ? formatDate(task.due_at) : 'No deadline'} / {uiTaskStatus(task.status)}
                  </p>
                </div>
              </div>
            ))}
            {urgentTasks.length === 0 && (
              <div className="py-12 text-center text-gray-300">
                <CheckCircle2 size={40} className="mx-auto mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest">No open tasks</p>
              </div>
            )}
          </div>
          <button onClick={onViewTasks} className="mt-6 w-full py-4 bg-gray-50 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-all">
            Go to Tasks
          </button>
        </div>
      </div>
    </div>
  );
};

function QuickAction({ icon: Icon, title, text, onClick }: { icon: React.ElementType; title: string; text: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="text-left bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
      <div className="w-12 h-12 bg-orange-50 text-[#FF6321] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#FF6321] group-hover:text-white transition-all">
        <Icon size={24} />
      </div>
      <h4 className="text-xl font-serif font-bold text-gray-900 mb-2">{title}</h4>
      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-loose">{text}</p>
    </button>
  );
}
