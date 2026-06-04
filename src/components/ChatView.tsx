import React, { useEffect, useRef, useState } from 'react';
import { CheckCheck, Clock, MessageSquare, Search, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage, Client, LaravelUser, Project, laravelApi } from '../lib/laravelApi';
import { cn, formatDate } from '../lib/utils';

export const ChatView: React.FC = () => {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<LaravelUser[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [activeClientId, setActiveClientId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    const [messageList, clientList, projectList, teamList] = await Promise.all([
      fetch(`${laravelApi.apiUrl}/api/chat-messages`, { credentials: 'include', headers: { Accept: 'application/json' } }).then((response) => response.json()),
      laravelApi.clients(),
      laravelApi.projects(),
      laravelApi.teamMembers().catch(() => []),
    ]);
    setMessages(Array.isArray(messageList) ? messageList.reverse() : []);
    setClients(clientList);
    setProjects(projectList);
    setTeam(teamList);
    setActiveClientId((current) => current ?? clientList[0]?.id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim() || !activeClientId) return;

    const created = await laravelApi.createChatMessage({
      message: newMessage,
      client_id: activeClientId,
    });
    setMessages((items) => [...items, created]);
    setNewMessage('');
  };

  const userName = (id: number) => {
    if (userProfile?.id === id) return userProfile.displayName;
    return team.find((member) => member.id === id)?.name || clients.find((client) => client.portal_user_id === id)?.contact_name || 'User';
  };

  const filteredMessages = messages
    .filter((message) => !activeClientId || message.client_id === activeClientId)
    .filter((message) => message.message.toLowerCase().includes(chatSearch.toLowerCase()) || userName(message.user_id).toLowerCase().includes(chatSearch.toLowerCase()));

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-6">
      <div className="w-80 bg-white rounded-[2.5rem] shadow-sm border border-gray-50 flex-col overflow-hidden hidden lg:flex">
        <div className="p-6 border-b border-gray-50">
          <h3 className="text-xl font-serif font-bold italic mb-4">Client Channels</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Search chat..." className="w-full bg-gray-50 border-none rounded-xl py-2 pl-10 pr-4 text-xs font-medium focus:ring-1 focus:ring-gray-900 outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {clients.map((client) => (
            <button key={client.id} onClick={() => setActiveClientId(client.id)} className={cn('w-full p-4 rounded-2xl cursor-pointer transition-all flex items-start gap-3 text-left', activeClientId === client.id ? 'bg-gray-900 text-white shadow-lg' : 'hover:bg-gray-50')}>
              <div className={cn('w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-bold', activeClientId === client.id ? 'bg-white/10' : 'bg-gray-100 text-gray-400')}>{client.name[0]}</div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{client.name}</p>
                <p className={cn('text-xs truncate', activeClientId === client.id ? 'text-gray-400' : 'text-gray-400')}>{projects.filter((project) => project.client_id === client.id).length} projects</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FF6321] rounded-2xl flex items-center justify-center text-white"><MessageSquare size={24} /></div>
            <div>
              <h4 className="font-serif font-bold text-lg italic">{clients.find((client) => client.id === activeClientId)?.name || 'Communication'}</h4>
              <p className="text-xs text-green-500 font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Laravel chat active</p>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-gray-50/30">
          {loading ? (
            <div className="text-center text-gray-400 py-20">Loading messages...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center text-gray-400 py-20">No messages yet.</div>
          ) : filteredMessages.map((message) => {
            const isMe = message.user_id === userProfile?.id;
            return (
              <motion.div key={message.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                <div className={cn('flex items-end gap-3', isMe ? 'flex-row-reverse' : 'flex-row')}>
                  <div className="w-8 h-8 rounded-lg shadow-sm bg-gray-900 text-white flex items-center justify-center text-[10px] font-bold">{userName(message.user_id)[0]}</div>
                  <div className={cn('max-w-md p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm', isMe ? 'bg-gray-900 text-white rounded-br-none' : 'bg-white text-gray-700 rounded-bl-none border border-gray-100')}>
                    {message.message}
                  </div>
                </div>
                <div className={cn('mt-2 flex items-center gap-2 text-[10px] font-bold text-gray-400 px-11 uppercase tracking-tight', isMe ? 'flex-row-reverse' : 'flex-row')}>
                  <span>{userName(message.user_id)}</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1 uppercase"><Clock size={10} /> {formatDate(message.created_at)}</span>
                  {isMe && <CheckCheck size={12} className="text-blue-500" />}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="p-6 border-t border-gray-50 bg-white">
          <form onSubmit={handleSendMessage} className="flex items-center gap-4 bg-gray-50 rounded-2xl px-4 py-2 border border-transparent focus-within:border-gray-200 transition-all">
            <input value={newMessage} onChange={(event) => setNewMessage(event.target.value)} placeholder={activeClientId ? 'Write your message here...' : 'Select a client channel first'} className="flex-1 bg-transparent border-none py-4 text-sm font-medium outline-none placeholder:text-gray-400" />
            <button type="submit" disabled={!newMessage.trim() || !activeClientId} className="bg-gray-900 text-white p-3 rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 active:scale-90"><Send size={20} /></button>
          </form>
        </div>
      </div>
    </div>
  );
};
