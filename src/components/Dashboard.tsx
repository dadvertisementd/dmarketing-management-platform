import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  Instagram,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { laravelApi } from '../lib/laravelApi';
import { avatarStyleForUser, userInitial } from '../lib/avatar';
import { cn } from '../lib/utils';
import { ChatView } from './ChatView';
import { ClientPortal } from './ClientPortal';
import { ClientsView } from './ClientsView';
import { DashboardHome } from './DashboardHome';
import { ProjectsView } from './ProjectsView';
import { ReportsView } from './ReportsView';
import { RoadmapView } from './RoadmapView';
import { SocialView } from './SocialView';
import { TeamView } from './TeamView';
import { TasksView } from './TasksView';
import { VaultView } from './VaultView';

export const Dashboard: React.FC = () => {
  const { userProfile, isAdmin, isAgencyAdmin, isManager, isClient, isWorker, isAgency, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [navProjectId, setNavProjectId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ clients: any[]; tasks: any[]; projects: any[]; posts: any[] }>({ clients: [], tasks: [], projects: [], posts: [] });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const agencyNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(isManager ? [{ id: 'team', label: 'Team', icon: Users }] : []),
    { id: 'clients', label: 'Clients', icon: Building2 },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'social', label: 'Social Media', icon: Instagram },
    { id: 'vault', label: 'Brand Vault', icon: Shield },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'chat', label: 'Communication', icon: MessageSquare },
    { id: 'roadmap', label: 'Roadmap', icon: Calendar },
  ];
  const navItems = isAgency ? agencyNavItems : [
    { id: 'client-hub', label: 'Client Hub', icon: LayoutDashboard },
    { id: 'chat', label: 'Communication', icon: MessageSquare },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];
  const canUseGlobalNew = activeTab === 'team' ? isAdmin : (isAdmin || isManager || isWorker);
  const globalNewLabel = activeTab === 'clients' ? 'Client' : activeTab === 'projects' ? 'Project' : activeTab === 'social' ? 'Post' : activeTab === 'team' ? 'Member' : 'Task';

  useEffect(() => {
    if (loading) return;
    if (isAgency && activeTab === 'client-hub') setActiveTab('dashboard');
    if (isClient && activeTab === 'dashboard') setActiveTab('client-hub');
  }, [activeTab, isAgency, isClient, loading]);

  useEffect(() => {
    let mounted = true;

    laravelApi.notifications()
      .then((data) => {
        if (mounted) setNotifications(data);
      })
      .catch(() => {
        if (mounted) setNotifications([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setSearchResults({ clients: [], tasks: [], projects: [], posts: [] });
      return;
    }

    let mounted = true;
    const timer = window.setTimeout(async () => {
      const [clients, projects, tasks, posts] = await Promise.all([
        laravelApi.clients(),
        laravelApi.projects(),
        laravelApi.tasks(),
        laravelApi.socialPosts(),
      ]);

      if (!mounted) return;

      setSearchResults({
        clients: clients.filter((client) => client.name.toLowerCase().includes(query) || client.industry?.toLowerCase().includes(query)),
        projects: projects.filter((project) => project.name.toLowerCase().includes(query)),
        tasks: tasks.filter((task) => task.title.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query)),
        posts: posts.filter((post) => post.title.toLowerCase().includes(query) || post.content?.toLowerCase().includes(query)),
      });
    }, 250);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const markNotificationRead = async (notification: any) => {
    if (!notification.id || notification.read_at) return;
    await fetch(`${laravelApi.apiUrl}/api/notifications/${notification.id}/read`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).catch(() => undefined);
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
  };

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div className="flex h-screen bg-[#f5f2ed] overflow-hidden">
      <aside className={cn(
        'bg-white border-r border-gray-100 flex flex-col shadow-sm transition-all duration-300 relative',
        isSidebarCollapsed ? 'w-20' : 'w-64',
      )}>
        <div className={cn('p-6 flex items-center gap-3 transition-all', isSidebarCollapsed && 'justify-center px-0')}>
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">D</div>
          {!isSidebarCollapsed && (
            <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="font-serif text-xl font-bold tracking-tight text-gray-900 truncate">
              DMARKETING
            </motion.span>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setNavProjectId(null);
              }}
              title={isSidebarCollapsed ? item.label : ''}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm group',
                activeTab === item.id ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                isSidebarCollapsed && 'justify-center px-0',
              )}
            >
              <item.icon size={20} className={cn(activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-900')} />
              {!isSidebarCollapsed && item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-50 space-y-2">
          <button
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm group text-gray-400 hover:text-gray-900 hover:bg-gray-50', isSidebarCollapsed && 'justify-center px-0')}
          >
            <ArrowRight className={cn('transition-transform duration-300', isSidebarCollapsed ? '' : 'rotate-180')} size={20} />
            {!isSidebarCollapsed && 'Collapse'}
          </button>

          {userProfile && !isSidebarCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-50 rounded-2xl p-4 mb-2">
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold"
                  style={avatarStyleForUser({ id: userProfile.id, name: userProfile.displayName, email: userProfile.email, avatar_color: userProfile.avatarColor })}
                >
                  {userInitial(userProfile.displayName, 'D')}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-gray-900 truncate">{userProfile.displayName || userProfile.email}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {isAdmin ? 'Agency Owner' : isAgencyAdmin ? 'Agency Manager' : isWorker ? 'Agency Expert' : userProfile.role}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <button
            onClick={() => logout()}
            className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium text-sm', isSidebarCollapsed && 'justify-center px-0')}
            title="Sign Out"
          >
            <LogOut size={20} />
            {!isSidebarCollapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 h-20 flex items-center justify-between px-8 z-10">
          <h2 className="text-2xl font-serif text-gray-900 capitalize italic">{activeTab.replace('-', ' ')}</h2>

          <div className="flex items-center gap-6">
            <div className="relative max-w-xs hidden md:block group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-900 transition-all" size={18} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="bg-gray-50 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-gray-900 transition-all w-64"
              />
              {searchQuery && (
                <div className="absolute top-full right-0 mt-2 w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-h-[500px] overflow-y-auto z-50">
                  <SearchSection title="Clients" items={searchResults.clients} icon={Building2} onClick={() => { setActiveTab('clients'); setSearchQuery(''); }} />
                  <SearchSection title="Projects" items={searchResults.projects} icon={Briefcase} onClick={(item) => { setNavProjectId(String(item.id)); setActiveTab('projects'); setSearchQuery(''); }} />
                  <SearchSection title="Tasks" items={searchResults.tasks} icon={CheckSquare} onClick={() => { setActiveTab('tasks'); setSearchQuery(''); }} />
                  <SearchSection title="Social Content" items={searchResults.posts} icon={Instagram} onClick={() => { setActiveTab('social'); setSearchQuery(''); }} />
                  {searchResults.clients.length + searchResults.projects.length + searchResults.tasks.length + searchResults.posts.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-400 italic">No results found for "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <button onClick={() => setShowNotifications((value) => !value)} className="relative p-2 text-gray-400 hover:text-gray-900 transition-all">
                <Bell size={22} />
                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#FF6321] rounded-full border-2 border-white shadow-sm" />}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full right-0 mt-4 w-80 bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden z-50">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Alerts</h4>
                      {unreadCount > 0 && <span className="text-[10px] font-bold text-[#FF6321]">{unreadCount} New</span>}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto p-2">
                      {notifications.map((notification) => (
                        <button key={notification.id} onClick={() => markNotificationRead(notification)} className={cn('block w-full text-left p-4 rounded-2xl hover:bg-gray-50 transition-all mb-1', !notification.read_at && 'bg-orange-50/30')}>
                          <p className="text-xs font-semibold text-gray-900 mb-1">{notification.data?.title || 'Notification'}</p>
                          <p className="text-[10px] text-gray-400 leading-tight">{notification.data?.message || 'Workspace update'}</p>
                        </button>
                      ))}
                      {notifications.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center">
                          <Bell size={24} className="text-gray-200 mb-3" />
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">All Quiet</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {canUseGlobalNew && (
              <button
                onClick={() => {
                  if (activeTab === 'dashboard') setActiveTab('tasks');
                  setIsNewModalOpen(true);
                }}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium hover:bg-gray-800 shadow-md transition-all active:scale-95"
              >
                <Plus size={18} />
                New {globalNewLabel}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="max-w-7xl mx-auto h-full">
              {activeTab === 'dashboard' && (
                <DashboardHome
                  onAddTask={() => { setActiveTab('tasks'); setIsNewModalOpen(true); }}
                  onAIContent={() => setActiveTab('social')}
                  onProjectClick={(projectId) => { setNavProjectId(projectId); setActiveTab('projects'); }}
                  onViewRoadmap={() => setActiveTab('roadmap')}
                  onViewProjects={() => setActiveTab('projects')}
                  onViewTasks={() => setActiveTab('tasks')}
                  onViewSocial={() => setActiveTab('social')}
                  onViewReports={() => setActiveTab('reports')}
                />
              )}
              {activeTab === 'roadmap' && <RoadmapView />}
              {activeTab === 'client-hub' && <ClientPortal />}
              {activeTab === 'clients' && <ClientsView forceShowModal={isNewModalOpen} onModalClose={() => setIsNewModalOpen(false)} />}
              {activeTab === 'projects' && <ProjectsView forceShowModal={isNewModalOpen} onModalClose={() => setIsNewModalOpen(false)} selectedProjectId={navProjectId} />}
              {activeTab === 'tasks' && <TasksView forceShowModal={isNewModalOpen} onModalClose={() => setIsNewModalOpen(false)} />}
              {activeTab === 'team' && <TeamView forceShowModal={isNewModalOpen} onModalClose={() => setIsNewModalOpen(false)} />}
              {activeTab === 'chat' && <ChatView />}
              {activeTab === 'social' && <SocialView forceShowModal={isNewModalOpen} onModalClose={() => setIsNewModalOpen(false)} />}
              {activeTab === 'vault' && <VaultView />}
              {activeTab === 'reports' && <ReportsView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

function SearchSection({ title, items, icon: Icon, onClick }: { title: string; items: any[]; icon: React.ElementType; onClick: (item: any) => void }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-5 last:mb-0">
      <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{title}</h5>
      {items.slice(0, 5).map((item) => (
        <button key={item.id} onClick={() => onClick(item)} className="w-full p-3 hover:bg-gray-50 rounded-xl cursor-pointer flex items-center justify-between group text-left">
          <span className="text-sm font-medium text-gray-900 truncate">{item.name || item.title}</span>
          <Icon size={14} className="text-gray-300 group-hover:text-gray-900" />
        </button>
      ))}
    </div>
  );
}
