import React, { useEffect, useState } from 'react';
import { AlertCircle, Briefcase, Calendar as CalendarIcon, CheckCircle2, MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Project, SocialPost, laravelApi } from '../lib/laravelApi';
import { formatDate } from '../lib/utils';

export const ClientPortal: React.FC = () => {
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [projectList, postList] = await Promise.all([
      laravelApi.projects(),
      laravelApi.socialPosts(),
    ]);
    setProjects(projectList);
    setApprovalRequests(postList.filter((post) => post.status === 'pending_client_review'));
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, []);

  const handleAction = async (post: SocialPost, status: 'approved' | 'needs_revision') => {
    const updated = await laravelApi.updateSocialPost(post.id, { status });
    setApprovalRequests((items) => items.filter((item) => item.id !== updated.id));
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" /></div>;
  }

  return (
    <div className="space-y-12 pb-12">
      <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2 italic">Client Relations Hub</h1>
          <p className="text-gray-400 text-sm max-w-lg">
            Welcome back, {userProfile?.displayName?.split(' ')[0] || 'Partner'}. Review campaign content, track project health, and approve marketing assets.
          </p>
        </div>
        <div className="flex gap-4">
          <Metric label="Active Projects" value={projects.length} />
          <Metric label="Pending Approval" value={approvalRequests.length} orange />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        <div className="xl:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif font-bold text-gray-900">Your Approval Queue</h2>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">{approvalRequests.length} items awaiting review</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {approvalRequests.map((post) => (
                <motion.div key={post.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-center justify-between mb-6">
                    <div className="px-3 py-1 bg-gray-50 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-500">{post.platform}</div>
                    <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5"><AlertCircle size={12} /> Awaiting Review</div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 truncate">{post.title}</h3>
                  <p className="text-sm text-gray-500 mb-8 leading-relaxed line-clamp-3 italic">"{post.content}"</p>
                  <div className="flex gap-3">
                    <button onClick={() => handleAction(post, 'approved')} className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"><ThumbsUp size={14} /> Approve</button>
                    <button onClick={() => handleAction(post, 'needs_revision')} className="flex-1 py-3 bg-white text-gray-600 border border-gray-100 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"><ThumbsDown size={14} /> Feedback</button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {approvalRequests.length === 0 && (
              <div className="col-span-full py-20 bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300">
                <CheckCircle2 size={64} className="mb-4 opacity-20" />
                <p className="text-lg font-serif font-bold italic">You're all caught up.</p>
                <p className="text-sm uppercase tracking-widest font-bold">No content pending approval</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-serif font-bold text-gray-900">Project Vital Signs</h2>
          {projects.map((project) => (
            <div key={project.id} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-white"><Briefcase size={20} /></div>
                <div className="px-3 py-1 bg-green-50 text-green-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-100">{project.status.replaceAll('_', ' ')}</div>
              </div>
              <h4 className="text-xl font-serif font-bold text-gray-900 mb-2">{project.name}</h4>
              <p className="text-xs text-gray-400 font-medium mb-8 leading-relaxed line-clamp-2">{project.description || 'Campaign strategy in progress.'}</p>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Milestone Progress</span>
                    <span className="text-sm font-mono font-bold text-gray-900">{project.progress || 0}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-900 rounded-full" style={{ width: `${project.progress || 0}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-tight"><CalendarIcon size={14} /> Created: {formatDate(project.created_at)}</div>
                </div>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="p-10 text-center bg-white rounded-[2rem] border border-gray-50">
              <MessageSquare size={32} className="mx-auto text-gray-200 mb-4" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No active projects linked to your account.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function Metric({ label, value, orange }: { label: string; value: number; orange?: boolean }) {
  return (
    <div className={`px-6 py-4 rounded-2xl border flex flex-col items-center min-w-[120px] ${orange ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
      <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${orange ? 'text-orange-400' : 'text-gray-400'}`}>{label}</span>
      <span className={`text-2xl font-serif font-bold ${orange ? 'text-orange-500' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
