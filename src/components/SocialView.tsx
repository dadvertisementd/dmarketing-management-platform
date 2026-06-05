import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Twitter,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { Client, PostingCheckStatus, PostingTrackerClient, PostingTrackerDay, PostingTrackerResponse, Project, SocialPost, SocialStatus, laravelApi, uiStatus } from '../lib/laravelApi';
import { generateContentSuggestions } from '../lib/gemini';
import { cn, formatDate } from '../lib/utils';

interface SocialViewProps {
  forceShowModal?: boolean;
  onModalClose?: () => void;
}

const emptyPost = {
  title: '',
  content: '',
  platform: 'instagram',
  scheduledAt: '',
  projectId: '',
  clientId: '',
};

export const SocialView: React.FC<SocialViewProps> = ({ forceShowModal, onModalClose }) => {
  const { isAdmin, isManager, isWorker } = useAuth();
  const canCreate = isAdmin || isManager || isWorker;
  const canApprove = isAdmin || isManager;
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newPost, setNewPost] = useState(emptyPost);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar' | 'tracker'>('grid');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [trackerWeekStart, setTrackerWeekStart] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [tracker, setTracker] = useState<PostingTrackerResponse | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [editingScheduleClient, setEditingScheduleClient] = useState<PostingTrackerClient | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<Record<number, boolean>>({});
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [activePostAnalytics, setActivePostAnalytics] = useState<SocialPost | null>(null);
  const [updatingPostId, setUpdatingPostId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [postList, projectList, clientList] = await Promise.all([
      laravelApi.socialPosts(),
      laravelApi.projects(),
      laravelApi.clients(),
    ]);
    setPosts(postList);
    setProjects(projectList);
    setClients(clientList);
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (forceShowModal) setIsModalOpen(true);
  }, [forceShowModal]);

  const loadTracker = async (weekStart = trackerWeekStart) => {
    setTrackerLoading(true);
    const data = await laravelApi.postingTracker(weekStart);
    setTracker(data);
    setTrackerLoading(false);
  };

  useEffect(() => {
    if (viewMode !== 'tracker') return;
    loadTracker().catch((err) => {
      setError(err.message);
      setTrackerLoading(false);
    });
  }, [viewMode, trackerWeekStart]);

  const closeModal = () => {
    setIsModalOpen(false);
    setNewPost(emptyPost);
    onModalClose?.();
  };

  const selectedProject = projects.find((project) => String(project.id) === newPost.projectId);
  const clientId = selectedProject?.client_id || Number(newPost.clientId) || clients[0]?.id;

  const generateIdeas = async () => {
    if (!topic.trim()) return;
    setAiLoading(true);
    const result = await generateContentSuggestions(topic, 'Instagram, Facebook, LinkedIn, and TikTok');
    setSuggestions(result.length ? result : [
      { title: `Brand story angle for ${topic}`, content: `Show the human side of ${topic}. Pair a behind-the-scenes visual with a clear proof point and a direct call to action.`, platform: 'linkedin' },
      { title: `${topic} carousel hook`, content: `Use a 5-slide carousel: problem, insight, solution, example, call to action. Keep copy punchy and visual-led.`, platform: 'instagram' },
      { title: `Short video script: ${topic}`, content: `Open with a before/after statement, show the process, then close with a result-focused caption.`, platform: 'tiktok' },
    ]);
    setAiLoading(false);
  };

  const useSuggestion = (suggestion: any) => {
    setNewPost({
      ...newPost,
      title: suggestion.title || '',
      content: suggestion.content || '',
      platform: suggestion.platform || 'instagram',
    });
    setIsModalOpen(true);
  };

  const savePost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate || !newPost.title.trim() || !clientId) return;
    setIsSaving(true);
    setError(null);

    try {
      const status = newPost.scheduledAt ? 'scheduled' : 'draft';
      const created = await laravelApi.createSocialPost({
        title: newPost.title,
        content: newPost.content,
        platform: newPost.platform,
        status,
        scheduled_at: newPost.scheduledAt || null,
        project_id: selectedProject?.id || null,
        client_id: clientId,
      } as any);
      setPosts((items) => [created, ...items]);
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to save post.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (post: SocialPost, status: SocialStatus) => {
    setUpdatingPostId(post.id);
    setError(null);

    try {
      const updated = await laravelApi.updateSocialPost(post.id, { status });
      setPosts((items) => items.map((item) => item.id === post.id ? updated : item));
    } catch (err: any) {
      setError(err.message || 'Failed to update social post status.');
    } finally {
      setUpdatingPostId(null);
    }
  };

  const isUpdatingPost = (post: SocialPost) => updatingPostId === post.id;

  const deletePost = async (post: SocialPost) => {
    if (!canCreate) return;
    if (!window.confirm('Delete this social post?')) return;
    await laravelApi.deleteSocialPost(post.id);
    setPosts((items) => items.filter((item) => item.id !== post.id));
  };

  const openScheduleEditor = (client: PostingTrackerClient) => {
    setEditingScheduleClient(client);
    setScheduleDraft(
      Object.fromEntries(Array.from({ length: 7 }, (_, index) => [index + 1, client.schedule_days.includes(index + 1)])),
    );
  };

  const saveSchedule = async () => {
    if (!editingScheduleClient) return;
    setScheduleSaving(true);
    setError(null);

    try {
      const days = Object.entries(scheduleDraft)
        .filter(([, selected]) => selected)
        .map(([day]) => ({ day_of_week: Number(day), required_posts: 1 }));

      await laravelApi.updatePostingSchedule(editingScheduleClient.id, days);
      setEditingScheduleClient(null);
      await loadTracker();
    } catch (err: any) {
      setError(err.message || 'Failed to save posting schedule.');
    } finally {
      setScheduleSaving(false);
    }
  };

  const markPostingCheck = async (clientId: number, date: string, status: PostingCheckStatus) => {
    setError(null);

    try {
      await laravelApi.markPostingCheck(clientId, { post_date: date, status });
      await loadTracker();
    } catch (err: any) {
      setError(err.message || 'Failed to update posting tracker.');
    }
  };

  const getProjectName = (post: SocialPost) => projects.find((project) => project.id === post.project_id)?.name || 'Campaign Content';
  const scheduledPosts = useMemo(() => posts.filter((post) => post.scheduled_at), [posts]);

  return (
    <div className="space-y-10 pb-20">
      <section className="bg-gray-900 rounded-[3rem] p-10 overflow-hidden text-white relative shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[#FF6321] rounded-xl"><Sparkles size={24} /></div>
            <h3 className="text-2xl font-serif font-bold italic">AI Content Forge</h3>
          </div>
          <p className="text-gray-300 mb-8 max-w-md">Generate campaign ideas, captions, and hooks for social media execution.</p>
          <div className="flex flex-col md:flex-row gap-4 max-w-3xl">
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Post topic, offer, or campaign idea" className="flex-1 bg-white/10 border-white/20 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-[#FF6321] transition-all text-lg placeholder:text-gray-500" />
            <button onClick={generateIdeas} disabled={aiLoading || !topic} className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-all disabled:opacity-50">
              {aiLoading ? 'Generating...' : <><Zap size={20} className="text-[#FF6321]" /> Generate Ideas</>}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-[2rem] flex flex-col group hover:bg-white/10 transition-all">
                  <h4 className="font-bold text-lg mb-2 text-[#FF6321]">{suggestion.title}</h4>
                  <p className="text-sm text-gray-300 flex-1 leading-relaxed line-clamp-3 mb-4">{suggestion.content}</p>
                  <button onClick={() => useSuggestion(suggestion)} className="w-full py-3 bg-white text-gray-900 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#FF6321] hover:text-white transition-all">
                    Use Draft
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6321]/20 blur-[100px] rounded-full pointer-events-none" />
      </section>

      <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-50">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-3xl font-serif font-bold text-gray-900 italic mb-2">Social Roadmap</h3>
            <p className="text-gray-400 text-sm">Drafts, approvals, schedules, and published content from Laravel.</p>
          </div>
          <div className="flex gap-4">
            {[
              { value: 'grid', label: 'Grid', icon: BarChart3 },
              { value: 'calendar', label: 'Calendar', icon: CalendarIcon },
              { value: 'tracker', label: 'Weekly Tracker', icon: Check },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  onClick={() => setViewMode(item.value as typeof viewMode)}
                  className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border', viewMode === item.value ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-200' : 'bg-gray-50 text-gray-500 hover:text-gray-900 border-gray-100')}
                >
                  <Icon size={18} /> {item.label}
                </button>
              );
            })}
            {canCreate && <button onClick={() => setIsModalOpen(true)} className="bg-gray-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold"><Plus size={18} /> New Post</button>}
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{error}</div>}
        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading social posts...</div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {posts.map((post) => (
              <motion.div key={post.id} whileHover={{ y: -8 }} className="bg-gray-50 rounded-[2.25rem] p-8 border border-transparent hover:border-gray-100 hover:bg-white hover:shadow-xl transition-all flex flex-col group shadow-sm">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-50">{platformIcon(post.platform)}</div>
                  <StatusPill status={post.status} />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#FF6321] transition-all line-clamp-1">{post.title}</h4>
                <p className="text-[10px] font-bold text-[#FF6321] uppercase tracking-wider mb-2">{getProjectName(post)}</p>
                <p className="text-sm text-gray-500 mb-8 flex-1 leading-relaxed line-clamp-4">{post.content}</p>
                {canApprove && (post.status === 'draft' || post.status === 'review' || post.status === 'pending_agency_approval') && (
                  <div className="flex gap-2 mb-6 p-2 bg-amber-50 rounded-2xl border border-amber-100">
                    <button disabled={isUpdatingPost(post)} onClick={() => updateStatus(post, 'pending_client_review')} className="flex-1 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"><Send size={12} /> {isUpdatingPost(post) ? 'Sending...' : 'Client Review'}</button>
                    <button disabled={isUpdatingPost(post)} onClick={() => updateStatus(post, 'needs_revision')} className="flex-1 py-2 bg-white text-gray-600 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-amber-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"><X size={12} /> {isUpdatingPost(post) ? 'Requesting...' : 'Revision'}</button>
                  </div>
                )}
                <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{post.scheduled_at ? `Schedules: ${formatDate(post.scheduled_at)}` : 'Draft Stage'}</div>
                  <div className="flex gap-2">
                    <button onClick={() => setActivePostAnalytics(post)} className="p-2 text-gray-300 hover:text-blue-500 transition-all"><BarChart3 size={18} /></button>
                    {canCreate && <button onClick={() => deletePost(post)} className="p-2 text-gray-300 hover:text-red-500 transition-all"><Trash2 size={18} /></button>}
                  </div>
                </div>
              </motion.div>
            ))}
            {canCreate && (
              <button onClick={() => setIsModalOpen(true)} className="bg-white border-2 border-dashed border-gray-200 rounded-[2.25rem] p-10 flex flex-col items-center justify-center gap-4 text-gray-400 hover:border-[#FF6321] hover:text-[#FF6321] hover:bg-orange-50/30 transition-all min-h-[300px]">
                <Plus size={32} />
                <span className="font-bold text-lg">Add New Post</span>
              </button>
            )}
          </div>
        ) : viewMode === 'calendar' ? (
          <CalendarGrid date={currentDate} setDate={setCurrentDate} posts={scheduledPosts} onPost={setActivePostAnalytics} />
        ) : (
          <WeeklyPostingTracker
            tracker={tracker}
            loading={trackerLoading}
            weekStart={trackerWeekStart}
            canManageSchedules={canApprove}
            onWeekChange={setTrackerWeekStart}
            onReload={() => loadTracker().catch((err) => setError(err.message))}
            onEditSchedule={openScheduleEditor}
            onMark={markPostingCheck}
          />
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-gray-50"><h3 className="text-2xl font-serif font-bold italic">Draft New Post</h3></div>
              <form onSubmit={savePost} className="p-8 space-y-6">
                <Input label="Internal Title" value={newPost.title} onChange={(value) => setNewPost({ ...newPost, title: value })} />
                <Select label="Campaign Project" value={newPost.projectId} onChange={(value) => setNewPost({ ...newPost, projectId: value, clientId: '' })} options={[{ value: '', label: 'No project' }, ...projects.map((project) => ({ value: String(project.id), label: project.name }))]} />
                {!selectedProject && <Select label="Client" value={newPost.clientId} onChange={(value) => setNewPost({ ...newPost, clientId: value })} options={[{ value: '', label: 'Select client' }, ...clients.map((client) => ({ value: String(client.id), label: client.name }))]} />}
                <Select label="Platform" value={newPost.platform} onChange={(value) => setNewPost({ ...newPost, platform: value })} options={['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok'].map((value) => ({ value, label: value }))} />
                <Input label="Schedule For" type="date" value={newPost.scheduledAt} onChange={(value) => setNewPost({ ...newPost, scheduledAt: value })} />
                <Textarea label="Post Content" value={newPost.content} onChange={(value) => setNewPost({ ...newPost, content: value })} />
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 py-4 text-sm font-bold text-gray-400 hover:text-gray-900 transition-all">Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-gray-900 text-white rounded-[1.25rem] font-bold text-sm hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Draft'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingScheduleClient && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-gray-50 flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-serif font-bold italic">Posting Schedule</h3>
                  <p className="text-sm text-gray-400 mt-1">Choose the weekly posting days for {editingScheduleClient.name}.</p>
                </div>
                <button onClick={() => setEditingScheduleClient(null)} className="p-2 text-gray-300 hover:text-gray-900 transition-all"><X size={22} /></button>
              </div>
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {WEEKDAY_LABELS.map((day) => (
                    <button
                      key={day.day_of_week}
                      type="button"
                      onClick={() => setScheduleDraft((draft) => ({ ...draft, [day.day_of_week]: !draft[day.day_of_week] }))}
                      className={cn('flex items-center justify-between p-4 rounded-2xl border text-left transition-all', scheduleDraft[day.day_of_week] ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:text-gray-900')}
                    >
                      <span className="text-xs font-bold uppercase tracking-widest">{day.short}</span>
                      <span className={cn('w-6 h-6 rounded-lg border flex items-center justify-center', scheduleDraft[day.day_of_week] ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200')}>
                        {scheduleDraft[day.day_of_week] && <Check size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setEditingScheduleClient(null)} className="flex-1 py-4 text-sm font-bold text-gray-400 hover:text-gray-900 transition-all">Cancel</button>
                  <button type="button" onClick={saveSchedule} disabled={scheduleSaving} className="flex-1 py-4 bg-gray-900 text-white rounded-[1.25rem] font-bold text-sm hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 disabled:opacity-50">{scheduleSaving ? 'Saving...' : 'Save Schedule'}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activePostAnalytics && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-serif font-bold italic">Post Summary</h3>
                <button onClick={() => setActivePostAnalytics(null)} className="text-gray-400 hover:text-gray-900 transition-all"><Check size={24} /></button>
              </div>
              <div className="space-y-6">
                <div className="p-6 bg-gray-50 rounded-3xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Internal Title</p>
                  <p className="text-lg font-bold text-gray-900 italic font-serif">"{activePostAnalytics.title}"</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Detail label="Platform" value={activePostAnalytics.platform} />
                  <Detail label="Status" value={uiStatus(activePostAnalytics.status)} />
                  <Detail label="Scheduled" value={activePostAnalytics.scheduled_at ? formatDate(activePostAnalytics.scheduled_at) : 'Not scheduled'} />
                  <Detail label="Project" value={getProjectName(activePostAnalytics)} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WEEKDAY_LABELS = [
  { day_of_week: 1, short: 'E Hane', label: 'Monday' },
  { day_of_week: 2, short: 'E Marte', label: 'Tuesday' },
  { day_of_week: 3, short: 'E Merkuri', label: 'Wednesday' },
  { day_of_week: 4, short: 'E Enjte', label: 'Thursday' },
  { day_of_week: 5, short: 'E Premte', label: 'Friday' },
  { day_of_week: 6, short: 'E Shtune', label: 'Saturday' },
  { day_of_week: 7, short: 'E Dielle', label: 'Sunday' },
];

function WeeklyPostingTracker({
  tracker,
  loading,
  weekStart,
  canManageSchedules,
  onWeekChange,
  onReload,
  onEditSchedule,
  onMark,
}: {
  tracker: PostingTrackerResponse | null;
  loading: boolean;
  weekStart: string;
  canManageSchedules: boolean;
  onWeekChange: (weekStart: string) => void;
  onReload: () => void;
  onEditSchedule: (client: PostingTrackerClient) => void;
  onMark: (clientId: number, date: string, status: PostingCheckStatus) => void;
}) {
  const currentWeek = new Date(`${weekStart}T00:00:00`);
  const plannedCount = tracker?.clients.reduce((total, client) => total + client.days.filter((day) => day.planned).length, 0) ?? 0;
  const postedCount = tracker?.clients.reduce((total, client) => total + client.days.filter((day) => day.status === 'posted').length, 0) ?? 0;
  const missedCount = tracker?.clients.reduce((total, client) => total + client.days.filter((day) => day.status === 'missed').length, 0) ?? 0;

  return (
    <div className="bg-gray-50 rounded-[2rem] p-6 md:p-8 border border-gray-100">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 mb-8">
        <div>
          <h4 className="text-2xl font-serif font-bold italic text-gray-900">Weekly Posting Control</h4>
          <p className="text-sm text-gray-400 mt-1">Set required posting days per client, then check every planned post off during the week.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => onWeekChange(format(subWeeks(currentWeek, 1), 'yyyy-MM-dd'))} className="p-3 bg-white rounded-xl border border-gray-100 text-gray-500 hover:text-gray-900">
            <ChevronLeft size={18} />
          </button>
          <div className="px-5 py-3 bg-white rounded-xl border border-gray-100 text-sm font-bold text-gray-700 min-w-[220px] text-center">
            {tracker ? `${format(new Date(`${tracker.week_start}T00:00:00`), 'MMM d')} - ${format(new Date(`${tracker.week_end}T00:00:00`), 'MMM d, yyyy')}` : 'Loading week'}
          </div>
          <button onClick={() => onWeekChange(format(addWeeks(currentWeek, 1), 'yyyy-MM-dd'))} className="p-3 bg-white rounded-xl border border-gray-100 text-gray-500 hover:text-gray-900">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => onWeekChange(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))} className="px-4 py-3 bg-white rounded-xl border border-gray-100 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900">This Week</button>
          <button onClick={onReload} className="p-3 bg-white rounded-xl border border-gray-100 text-gray-500 hover:text-gray-900">
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <TrackerMetric label="Planned posts" value={plannedCount} tone="blue" />
        <TrackerMetric label="Posted / confirmed" value={postedCount} tone="green" />
        <TrackerMetric label="Missed" value={missedCount} tone="red" />
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading weekly tracker...</div>
      ) : !tracker || tracker.clients.length === 0 ? (
        <div className="py-20 text-center text-gray-400">No clients available for posting tracking.</div>
      ) : (
        <div className="overflow-x-auto rounded-[1.75rem] border border-gray-200 bg-white shadow-sm">
          <table className="min-w-[1050px] w-full border-collapse">
            <thead>
              <tr className="bg-[#2f6a50] text-white">
                <th className="w-56 px-5 py-4 text-left text-xs font-bold uppercase tracking-widest">Klient</th>
                {WEEKDAY_LABELS.map((day) => (
                  <th key={day.day_of_week} className="px-3 py-4 text-center text-xs font-bold uppercase tracking-widest border-l border-white/20">
                    <div>{day.short}</div>
                    <div className="text-[10px] font-medium text-white/70 mt-1 normal-case">
                      {tracker.days.find((item) => item.day_of_week === day.day_of_week)?.date}
                    </div>
                  </th>
                ))}
                <th className="w-40 px-5 py-4 text-left text-xs font-bold uppercase tracking-widest border-l border-white/20">Controls</th>
              </tr>
            </thead>
            <tbody>
              {tracker.clients.map((client) => (
                <tr key={client.id} className="odd:bg-white even:bg-gray-50/60">
                  <td className="px-5 py-4 bg-[#2f6a50] text-white font-bold text-sm border-t border-white/10">{client.name}</td>
                  {client.days.map((day) => (
                    <td key={`${client.id}-${day.date}`} className="p-2 border-t border-l border-gray-200 text-center">
                      <PostingDayButton day={day} onClick={() => onMark(client.id, day.date, nextTrackerStatus(day))} />
                    </td>
                  ))}
                  <td className="px-4 py-3 border-t border-l border-gray-200">
                    {canManageSchedules ? (
                      <button onClick={() => onEditSchedule(client)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all">
                        <Settings2 size={14} /> Schedule
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-6 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        <LegendItem className="bg-emerald-500" label="Posted" />
        <LegendItem className="bg-amber-400" label="Pending" />
        <LegendItem className="bg-red-500" label="Missed" />
        <LegendItem className="bg-gray-300" label="Not planned" />
      </div>
    </div>
  );
}

function nextTrackerStatus(day: PostingTrackerDay): PostingCheckStatus {
  if (day.status === 'posted') return 'pending';
  return 'posted';
}

function PostingDayButton({ day, onClick }: { day: PostingTrackerDay; onClick: () => void }) {
  const styles = {
    posted: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
    pending: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    missed: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
    skipped: 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200',
    not_planned: 'bg-white border-gray-100 text-gray-300 hover:bg-gray-50 hover:text-gray-500',
  }[day.status];

  return (
    <button onClick={onClick} title={day.planned ? `${day.required_posts} required post(s)` : 'Not planned; click to mark posted anyway'} className={cn('mx-auto min-h-12 w-full rounded-xl border flex flex-col items-center justify-center transition-all', styles)}>
      {day.status === 'posted' ? <Check size={18} /> : <span className="text-xs font-black">{day.planned ? statusLabel(day.status) : '-'}</span>}
      {day.published_count > 0 && <span className="text-[9px] font-bold mt-0.5">{day.published_count} live</span>}
    </button>
  );
}

function statusLabel(status: string): string {
  if (status === 'missed') return '!';
  if (status === 'skipped') return 'S';
  return '';
}

function TrackerMetric({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'green' | 'red' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }[tone];

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      <p className={cn('inline-flex min-w-12 justify-center rounded-2xl px-4 py-2 text-2xl font-serif font-bold', toneClass)}>{value}</p>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('w-3 h-3 rounded-full', className)} />
      {label}
    </span>
  );
}

function platformIcon(platform: string) {
  switch (platform) {
    case 'instagram': return <Instagram size={18} className="text-pink-500" />;
    case 'facebook': return <Facebook size={18} className="text-blue-600" />;
    case 'twitter': return <Twitter size={18} className="text-sky-500" />;
    case 'linkedin': return <Linkedin size={18} className="text-blue-700" />;
    default: return <MessageCircle size={18} className="text-gray-400" />;
  }
}

function StatusPill({ status }: { status: string }) {
  const ui = uiStatus(status);
  return <div className="px-3 py-1 border rounded-full text-[10px] font-bold uppercase tracking-widest bg-white shadow-sm text-gray-500 border-gray-100">{ui.replace('-', ' ')}</div>;
}

function CalendarGrid({ date, setDate, posts, onPost }: { date: Date; setDate: (date: Date) => void; posts: SocialPost[]; onPost: (post: SocialPost) => void }) {
  const monthStart = startOfMonth(date);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) });
  return (
    <div className="bg-gray-50 rounded-[2rem] p-8 border border-gray-100">
      <div className="flex items-center justify-between mb-8">
        <h4 className="text-2xl font-serif font-bold italic">{format(date, 'MMMM yyyy')}</h4>
        <div className="flex gap-2">
          <button onClick={() => setDate(subMonths(date, 1))} className="px-4 py-2 bg-white rounded-xl border border-gray-100 text-xs font-bold">Previous</button>
          <button onClick={() => setDate(new Date())} className="px-4 py-2 bg-white rounded-xl border border-gray-100 text-xs font-bold">Today</button>
          <button onClick={() => setDate(addMonths(date, 1))} className="px-4 py-2 bg-white rounded-xl border border-gray-100 text-xs font-bold">Next</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="bg-gray-100 p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">{day}</div>)}
        {calendarDays.map((day) => {
          const dayPosts = posts.filter((post) => post.scheduled_at && isSameDay(new Date(post.scheduled_at), day));
          return (
            <div key={day.toISOString()} className={cn('bg-white min-h-[140px] p-3 transition-all hover:bg-gray-50/50', !isSameMonth(day, monthStart) && 'bg-gray-50/30')}>
              <span className={cn('text-xs font-bold', isSameDay(day, new Date()) ? 'w-6 h-6 bg-[#FF6321] text-white rounded-full flex items-center justify-center' : 'text-gray-400')}>{format(day, 'd')}</span>
              <div className="space-y-1.5 mt-3">
                {dayPosts.map((post) => (
                  <button key={post.id} onClick={() => onPost(post)} className="w-full p-2 bg-white border border-gray-100 rounded-lg shadow-sm cursor-pointer hover:border-[#FF6321] flex items-center gap-2 text-left">
                    {platformIcon(post.platform)}
                    <span className="text-[10px] font-bold text-gray-700 truncate">{post.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium placeholder:text-gray-300 focus:ring-2 focus:ring-gray-900 transition-all outline-none" />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-gray-900 font-medium placeholder:text-gray-300 focus:ring-2 focus:ring-gray-900 transition-all outline-none h-32 resize-none" />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="select-arrow w-full rounded-2xl border-none bg-gray-50 py-4 pl-4 font-medium capitalize text-gray-900 outline-none">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-6 bg-gray-50 rounded-3xl text-center">
      <p className="text-xl font-bold text-gray-900 capitalize">{value}</p>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
    </div>
  );
}
