import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Film, Grid, Image as ImageIcon, Library, List, Plus, Search, Shield, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Client, Project, SharedFile, downloadUrl, laravelApi } from '../lib/laravelApi';
import { cn, formatDate } from '../lib/utils';

export const VaultView: React.FC = () => {
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [activeClient, setActiveClient] = useState('all');
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadDraft, setUploadDraft] = useState({ clientId: '', projectId: '', category: 'asset' });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const [fileList, clientList, projectList] = await Promise.all([
      laravelApi.files(),
      laravelApi.clients(),
      laravelApi.projects(),
    ]);
    setFiles(fileList);
    setClients(clientList);
    setProjects(projectList);
  };

  useEffect(() => {
    loadData().catch((err) => setVaultError(err.message || 'Failed to load brand vault assets.'));
  }, []);

  const filteredFiles = useMemo(() => files.filter((file) => {
    const client = clients.find((item) => item.id === file.client_id);
    const matchesClient = activeClient === 'all' || String(file.client_id) === activeClient;
    const matchesSearch = file.name.toLowerCase().includes(search.toLowerCase()) || client?.name.toLowerCase().includes(search.toLowerCase());
    return matchesClient && matchesSearch;
  }), [activeClient, clients, files, search]);

  const openUploadDialog = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const defaultClientId = activeClient !== 'all' ? Number(activeClient) : clients[0]?.id;
    const defaultProject = projects.find((project) => project.client_id === defaultClientId);
    setSelectedUploadFile(file);
    setUploadDraft({
      clientId: defaultClientId ? String(defaultClientId) : '',
      projectId: defaultProject ? String(defaultProject.id) : '',
      category: inferCategory(file),
    });
    setUploadError(null);
  };

  const closeUploadDialog = () => {
    setSelectedUploadFile(null);
    setUploadDraft({ clientId: '', projectId: '', category: 'asset' });
    setUploadError(null);
  };

  const uploadFile = async () => {
    if (!selectedUploadFile || !uploadDraft.clientId) {
      setUploadError('Choose a client before uploading this asset.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const created = await laravelApi.uploadFile({
        file: selectedUploadFile,
        client_id: Number(uploadDraft.clientId),
        project_id: uploadDraft.projectId ? Number(uploadDraft.projectId) : undefined,
        category: uploadDraft.category,
      });
      setFiles((items) => [created, ...items]);
      closeUploadDialog();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload asset.');
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (file: SharedFile) => {
    if (!window.confirm(`Delete ${file.name}?`)) return;
    await laravelApi.deleteFile(file.id);
    setFiles((items) => items.filter((item) => item.id !== file.id));
  };

  const categories = [
    { id: 'logos', label: 'Logos', icon: ImageIcon, color: 'text-blue-500 bg-blue-50' },
    { id: 'fonts', label: 'Typography', icon: FileText, color: 'text-purple-500 bg-purple-50' },
    { id: 'footage', label: 'Raw Footage', icon: Film, color: 'text-orange-500 bg-orange-50' },
    { id: 'guidelines', label: 'Guidelines', icon: Library, color: 'text-green-500 bg-green-50' },
    { id: 'asset', label: 'Campaign Assets', icon: Grid, color: 'text-gray-500 bg-gray-50' },
  ];

  const uploadProjects = projects.filter((project) => String(project.client_id) === uploadDraft.clientId);

  return (
    <div className="space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={12} className="text-[#FF6321]" />
            <span className="text-[10px] font-bold text-[#FF6321] uppercase tracking-[0.2em]">Asset Management</span>
          </div>
          <h1 className="text-4xl font-serif font-bold italic text-gray-900 tracking-tight">Brand Vault</h1>
          <p className="text-gray-500 mt-2 text-sm max-w-xl">Centralized Laravel storage for logos, brand guidelines, campaign files, video assets, and client deliverables.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
            <button onClick={() => setViewType('grid')} className={cn('p-2 rounded-xl transition-all', viewType === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600')}><Grid size={18} /></button>
            <button onClick={() => setViewType('list')} className={cn('p-2 rounded-xl transition-all', viewType === 'list' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600')}><List size={18} /></button>
          </div>
          <input ref={fileInput} type="file" className="hidden" onChange={openUploadDialog} />
          <button onClick={() => fileInput.current?.click()} disabled={uploading || clients.length === 0} className="bg-[#FF6321] text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-[#e5591e] transition-all font-bold text-sm shadow-xl shadow-orange-100 active:scale-95 disabled:opacity-50">
            <Plus size={18} /> Select Asset
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all group-hover:scale-110', cat.color)}><cat.icon size={24} /></div>
            <h3 className="text-sm font-bold text-gray-900">{cat.label}</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{files.filter((file) => file.category === cat.id || file.mime_type?.includes(cat.id)).length} Files</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-6 border-y border-gray-100">
        <div className="flex items-center gap-3 overflow-x-auto w-full pb-1 no-scrollbar">
          <button onClick={() => setActiveClient('all')} className={cn('whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all', activeClient === 'all' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900')}>All Clients</button>
          {clients.map((client) => (
            <button key={client.id} onClick={() => setActiveClient(String(client.id))} className={cn('whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all', activeClient === String(client.id) ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900')}>{client.name}</button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets..." className="w-full bg-white border border-gray-100 rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-gray-900 outline-none" />
        </div>
      </div>

      {vaultError && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{vaultError}</div>}

      {viewType === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredFiles.map((file) => (
            <AssetCard
              key={file.id}
              file={file}
              client={clients.find((item) => item.id === file.client_id)?.name || 'Client'}
              onDelete={() => deleteFile(file)}
            />
          ))}
          {filteredFiles.length === 0 && <div className="col-span-full py-20 text-center text-gray-400">No assets found.</div>}
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Asset Name</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Size</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Uploaded</th>
                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 overflow-hidden rounded-xl bg-gray-50 text-gray-400">
                        <AssetPreview file={file} compact />
                      </div>
                      <span className="text-sm font-bold text-gray-900 transition-colors group-hover:text-[#FF6321]">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{clients.find((client) => client.id === file.client_id)?.name || 'Client'}</td>
                  <td className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{formatSize(file.size)}</td>
                  <td className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{formatDate(file.created_at)}</td>
                  <td className="px-8 py-4 text-right">
                    <Actions
                      file={file}
                      onDelete={() => deleteFile(file)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUploadFile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-gray-50 flex items-start justify-between gap-6 bg-gray-900 text-white">
              <div>
                <h3 className="text-2xl font-serif font-bold italic">Upload Asset</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 truncate max-w-sm">{selectedUploadFile.name}</p>
              </div>
              <button onClick={closeUploadDialog} className="p-2 bg-white/10 rounded-xl text-white/60 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-5">
              {uploadError && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100">{uploadError}</div>}

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Client</label>
                <select
                  value={uploadDraft.clientId}
                  onChange={(event) => {
                    const nextClientId = event.target.value;
                    const firstProject = projects.find((project) => String(project.client_id) === nextClientId);
                    setUploadDraft((draft) => ({ ...draft, clientId: nextClientId, projectId: firstProject ? String(firstProject.id) : '' }));
                  }}
                  className="select-arrow w-full rounded-2xl border border-gray-100 bg-gray-50 py-4 pl-4 text-sm font-medium focus:outline-none focus:border-[#FF6321]"
                >
                  <option value="">Select client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Project</label>
                <select
                  value={uploadDraft.projectId}
                  onChange={(event) => setUploadDraft((draft) => ({ ...draft, projectId: event.target.value }))}
                  disabled={!uploadDraft.clientId}
                  className="select-arrow w-full rounded-2xl border border-gray-100 bg-gray-50 py-4 pl-4 text-sm font-medium focus:outline-none focus:border-[#FF6321] disabled:opacity-50"
                >
                  <option value="">No project / general client asset</option>
                  {uploadProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Category</label>
                <select
                  value={uploadDraft.category}
                  onChange={(event) => setUploadDraft((draft) => ({ ...draft, category: event.target.value }))}
                  className="select-arrow w-full rounded-2xl border border-gray-100 bg-gray-50 py-4 pl-4 text-sm font-medium focus:outline-none focus:border-[#FF6321]"
                >
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                </select>
              </div>
            </div>

            <div className="p-8 bg-gray-50 flex gap-3">
              <button onClick={closeUploadDialog} disabled={uploading} className="flex-1 py-4 bg-white border border-gray-100 text-gray-500 rounded-2xl font-bold text-sm hover:bg-gray-100 disabled:opacity-50">Cancel</button>
              <button onClick={uploadFile} disabled={uploading || !uploadDraft.clientId} className="flex-[2] py-4 bg-[#FF6321] text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-200 hover:bg-[#e5591e] transition-all disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function AssetCard({ file, client, onDelete }: { file: SharedFile; client: string; onDelete: () => void }) {
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all group relative">
      <div className="absolute top-4 right-4 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <Actions file={file} onDelete={onDelete} />
      </div>
      <div className="mb-6 h-40 overflow-hidden rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-100">
        <AssetPreview file={file} />
      </div>
      <h4 className="text-sm font-bold text-gray-900 mb-1 truncate">{file.name}</h4>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-bold text-[#FF6321] uppercase tracking-widest">{client}</span>
        <span className="w-1 h-1 bg-gray-200 rounded-full" />
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{file.category}</span>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <span className="text-[10px] font-bold text-gray-300">{formatSize(file.size)}</span>
        <span className="text-[10px] font-bold text-gray-300">{formatDate(file.created_at)}</span>
      </div>
    </motion.div>
  );
}

function Actions({ file, onDelete }: { file: SharedFile; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <a
        href={downloadUrl(file.id)}
        download={file.name}
        target="_blank"
        rel="noreferrer"
        className="cursor-pointer p-2 bg-white rounded-lg shadow-sm border border-gray-50 text-gray-400 hover:text-gray-900"
        title={`Download ${file.name}`}
      >
        <Download size={14} />
      </a>
      <button type="button" onClick={onDelete} className="cursor-pointer p-2 bg-white rounded-lg shadow-sm border border-gray-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
    </div>
  );
}

function AssetPreview({ file, compact = false }: { file: SharedFile; compact?: boolean }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = file.mime_type?.startsWith('image/');

  useEffect(() => {
    if (!isImage) {
      setPreviewUrl(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    laravelApi.fetchFileBlob(file.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPreviewUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, isImage]);

  if (isImage && previewUrl) {
    return <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <FileIcon mime={file.mime_type} large={!compact} />
    </div>
  );
}

function FileIcon({ mime, large }: { mime?: string | null; large?: boolean }) {
  const size = large ? 32 : 16;
  if (mime?.startsWith('image/')) return <ImageIcon size={size} />;
  if (mime?.startsWith('video/')) return <Film size={size} />;
  return <FileText size={size} />;
}

function formatSize(size: number) {
  if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size > 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function inferCategory(file: File) {
  if (file.type.startsWith('video/')) return 'footage';
  if (file.type.includes('font')) return 'fonts';
  if (file.type === 'application/pdf') return 'guidelines';
  if (file.type.startsWith('image/')) return 'asset';
  return 'asset';
}
