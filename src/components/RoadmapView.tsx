import React, { useEffect, useState } from 'react';
import { Briefcase, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Project, Task, laravelApi } from '../lib/laravelApi';
import { cn, formatDate } from '../lib/utils';

export const RoadmapView: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());

  const timelineDays = Array.from({ length: 21 }, (_, index) => {
    const day = new Date(viewDate);
    day.setDate(day.getDate() - 5 + index);
    return day;
  });

  useEffect(() => {
    Promise.all([laravelApi.projects(), laravelApi.tasks()])
      .then(([projectList, taskList]) => {
        setProjects(projectList);
        setTasks(taskList);
      })
      .finally(() => setLoading(false));
  }, []);

  const moveTimeline = (days: number) => {
    const next = new Date(viewDate);
    next.setDate(next.getDate() + days);
    setViewDate(next);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" /></div>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2 italic">Campaign Roadmap</h1>
          <p className="text-gray-400 text-sm max-w-lg">Cross-project tactical timeline from Laravel tasks and deadlines.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-50">
          <button onClick={() => moveTimeline(-7)} className="p-2 hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-900"><ChevronLeft size={20} /></button>
          <div className="px-4 text-sm font-bold text-gray-900 flex items-center gap-2"><CalendarIcon size={16} className="text-[#FF6321]" /> {formatDate(timelineDays[0])} - {formatDate(timelineDays[20])}</div>
          <button onClick={() => moveTimeline(7)} className="p-2 hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-900"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[1200px]">
            <div className="grid grid-cols-[240px_1fr] border-b border-gray-100">
              <div className="p-6 border-r border-gray-100 bg-gray-50/30"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Campaigns</span></div>
              <div className="grid grid-cols-21 divide-x divide-gray-50">
                {timelineDays.map((day, index) => {
                  const isToday = day.toDateString() === new Date().toDateString();
                  return (
                    <div key={index} className={cn('p-4 text-center flex flex-col items-center justify-center gap-1', isToday && 'bg-orange-50/50')}>
                      <span className="text-[10px] font-bold text-gray-300">{['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getDay()]}</span>
                      <span className={cn('text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full', isToday ? 'bg-[#FF6321] text-white' : 'text-gray-500')}>{day.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {projects.map((project) => {
                const projectTasks = tasks.filter((task) => task.project_id === project.id);
                return (
                  <div key={project.id} className="grid grid-cols-[240px_1fr] group">
                    <div className="p-6 border-r border-gray-100 bg-gray-50/10 group-hover:bg-gray-50 transition-all flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-1">
                        <Briefcase size={14} className="text-gray-300 group-hover:text-[#FF6321] transition-all" />
                        <span className="text-sm font-bold text-gray-900 truncate">{project.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{project.status.replaceAll('_', ' ')}</span>
                    </div>
                    <div className="grid grid-cols-21 relative h-24 divide-x divide-gray-50/30">
                      {timelineDays.map((_, index) => <div key={index} className="h-full" />)}
                      <div className="absolute inset-x-0 inset-y-0 p-4 space-y-2">
                        {projectTasks.map((task, taskIndex) => {
                          if (!task.due_at) return null;
                          const taskDate = new Date(task.due_at);
                          const dayIndex = timelineDays.findIndex((day) => day.toDateString() === taskDate.toDateString());
                          if (dayIndex === -1) return null;
                          return (
                            <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={cn('absolute h-7 rounded-lg shadow-sm border px-3 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] hover:z-10', task.priority === 'urgent' ? 'bg-red-50 border-red-100 text-red-600' : task.priority === 'high' ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-gray-900 border-gray-800 text-white')} style={{ left: `${(dayIndex / 21) * 100}%`, minWidth: '140px', top: `${(taskIndex % 3) * 32 + 12}px` }}>
                              <Zap size={10} className={task.priority === 'urgent' || task.priority === 'high' ? 'text-current' : 'text-[#FF6321]'} />
                              <span className="text-[10px] font-bold truncate tracking-tight">{task.title}</span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {projects.length === 0 && <div className="p-20 text-center text-gray-400">No projects yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
