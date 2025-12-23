'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { supabase, Recording } from '@/lib/supabase';
import { useInstallModal } from '../layout';

interface Folder {
  id: string;
  name: string;
  user_id: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { setShowInstallModal } = useInstallModal();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [draggedRecording, setDraggedRecording] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [openFolder, setOpenFolder] = useState<Folder | null>(null);
  const [folderRecordings, setFolderRecordings] = useState<Recording[]>([]);
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    type: 'recording' | 'folder';
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    await Promise.all([fetchRecordings(), fetchFolders()]);
  };

  const fetchFolders = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user?.id)
        .single();

      if (userError || !userData) return;

      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userData.id)
        .is('parent_id', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching folders:', error);
      } else {
        setFolders(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchRecordings = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user?.id)
        .single();

      if (userError || !userData) {
        console.log('User not found in Supabase yet');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', userData.id)
        .is('deleted_at', null)
        .is('folder_id', null)
        .order('created_at', { ascending: false});

      if (error) {
        console.error('Error fetching recordings:', error);
      } else {
        setRecordings(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEditTitle = (recording: Recording) => {
    setEditingId(recording.id);
    setEditTitle(recording.title);
  };

  const handleSaveTitle = async (sessionId: string) => {
    if (!editTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('recordings')
        .update({ title: editTitle.trim() })
        .eq('session_id', sessionId);

      if (!error) {
        setRecordings(recordings.map(r => 
          r.session_id === sessionId ? { ...r, title: editTitle.trim() } : r
        ));
        setEditingId(null);
      } else {
        console.error('Failed to update title');
      }
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleDeleteRecording = async (sessionId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal({
      show: true,
      type: 'recording',
      id: sessionId,
      name: title
    });
  };

  const confirmDeleteRecording = async () => {
    if (!deleteModal || deleteModal.type !== 'recording') return;
    
    const sessionId = deleteModal.id;
    setDeleteModal(null);
    setDeletingId(sessionId);

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user?.id)
        .single();

      const { error } = await supabase
        .from('recordings')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: userData?.id
        })
        .eq('session_id', sessionId);

      if (!error) {
        setRecordings(recordings.filter(r => r.session_id !== sessionId));
        setFolderRecordings(folderRecordings.filter(r => r.session_id !== sessionId));
      } else {
        console.error('Failed to delete recording');
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user?.id)
        .single();

      if (!userData) return;

      const { data, error } = await supabase
        .from('folders')
        .insert({
          name: newFolderName.trim(),
          user_id: userData.id,
          parent_id: null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating folder:', error);
        alert('Failed to create folder');
      } else {
        setFolders([data, ...folders]);
        setNewFolderName('');
        setShowNewFolderModal(false);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal({
      show: true,
      type: 'folder',
      id: folderId,
      name: folderName
    });
  };

  const confirmDeleteFolder = async () => {
    if (!deleteModal || deleteModal.type !== 'folder') return;
    
    const folderId = deleteModal.id;
    setDeleteModal(null);
    setDeletingFolderId(folderId);

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (!error) {
        setFolders(folders.filter(f => f.id !== folderId));
        fetchRecordings();
      } else {
        console.error('Failed to delete folder');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setDeletingFolderId(null);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (recordingId: string) => {
    setDraggedRecording(recordingId);
  };

  const handleDragEnd = () => {
    setDraggedRecording(null);
    setDragOverFolder(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolder(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolder(null);

    if (!draggedRecording) return;

    try {
      const { error } = await supabase
        .from('recordings')
        .update({ folder_id: folderId })
        .eq('id', draggedRecording);

      if (!error) {
        // Remove recording from current view
        setRecordings(recordings.filter(r => r.id !== draggedRecording));
        setDraggedRecording(null);
      } else {
        console.error('Failed to move recording');
        alert('Failed to move recording to folder');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleOpenFolder = async (folder: Folder) => {
    setOpenFolder(folder);
    setLoading(true);

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user?.id)
        .single();

      if (userError || !userData) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', userData.id)
        .eq('folder_id', folder.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching folder recordings:', error);
      } else {
        setFolderRecordings(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseFolder = () => {
    setOpenFolder(null);
    setFolderRecordings([]);
  };

  const handleRemoveFromFolder = async (recordingId: string) => {
    try {
      const { error } = await supabase
        .from('recordings')
        .update({ folder_id: null })
        .eq('id', recordingId);

      if (!error) {
        setFolderRecordings(folderRecordings.filter(r => r.id !== recordingId));
        // Refresh root recordings
        fetchRecordings();
      } else {
        console.error('Failed to remove from folder');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {openFolder && (
          <button
            onClick={handleCloseFolder}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-xl font-bold text-white">
          {openFolder ? openFolder.name : 'Projects'}
        </h1>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => setShowInstallModal(true)}
          className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center gap-2 transition-all"
        >
          <span className="text-lg">+</span>
          <span>New Video</span>
        </button>
        <button 
          onClick={() => setShowNewFolderModal(true)}
          className="bg-[#13131a] border border-gray-700 hover:border-gray-600 text-white font-medium py-2.5 px-4 rounded-lg flex items-center gap-2 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span>New Folder</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : folders.length === 0 && recordings.length === 0 ? (
        <div className="border border-gray-800 rounded-xl p-16">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Click 'New Video' to create a video
            </h3>
            <p className="text-sm text-gray-400">
              You can also upload or edit videos<br />into Clueso here
            </p>
          </div>
        </div>
      ) : openFolder ? (
        // Show folder contents
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {folderRecordings.map((recording) => (
            <div
              key={recording.id}
              className="rounded-xl bg-[#13131a] border border-gray-800 overflow-hidden hover:border-purple-500 transition-all group"
            >
              {/* Thumbnail */}
              <div 
                onClick={() => router.push(`/recording/${recording.session_id}`)}
                className="aspect-video bg-[var(--color-bg-tertiary)] flex items-center justify-center relative cursor-pointer"
              >
                {recording.thumbnail_url ? (
                  <img
                    src={recording.thumbnail_url}
                    alt={recording.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl opacity-50 group-hover:opacity-100 transition-opacity">
                    {recording.video_path ? '🎬' : '🎙️'}
                  </span>
                )}
                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs text-white">
                  {formatDuration(recording.duration)}
                </div>
                {/* Status badge */}
                {recording.status !== 'completed' && (
                  <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs text-white ${
                    recording.status === 'processing' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    {recording.status}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                {/* Title - Editable */}
                {editingId === recording.id ? (
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle(recording.session_id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 px-2 py-1 text-sm rounded bg-[var(--color-bg-tertiary)] border border-gray-700 text-white focus:outline-none focus:border-purple-500"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveTitle(recording.session_id);
                      }}
                      className="px-2 py-1 text-xs rounded bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      ✓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                      className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 
                      onClick={() => router.push(`/recording/${recording.session_id}`)}
                      className="font-medium text-sm text-white truncate cursor-pointer flex-1"
                    >
                      {recording.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTitle(recording);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-purple-400 p-1"
                      title="Edit title"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {recording.url && (
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {recording.url}
                  </p>
                )}
                
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>{formatDate(recording.created_at)}</span>
                  <span>{recording.events_count} events</span>
                </div>

                {/* Remove from folder button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFromFolder(recording.id);
                  }}
                  className="w-full mt-3 px-3 py-1.5 text-xs rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 transition-colors"
                >
                  Remove from Folder
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Show root folders and recordings
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Folders */}
          {folders.map((folder) => (
            <div
              key={folder.id}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
              className={`rounded-xl bg-[#13131a] border transition-all group flex flex-col ${
                dragOverFolder === folder.id 
                  ? 'border-purple-500 bg-purple-500/10 scale-105' 
                  : 'border-gray-800 hover:border-purple-500'
              }`}
            >
              <div 
                onClick={() => handleOpenFolder(folder)}
                className="p-6 flex-1 flex flex-col items-center justify-center cursor-pointer"
              >
                <svg className="w-16 h-16 text-purple-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <h3 className="text-sm font-medium text-white text-center">{folder.name}</h3>
              </div>
              <div className="px-3 pb-3 mt-auto">
                <button
                  onClick={(e) => handleDeleteFolder(folder.id, folder.name, e)}
                  disabled={deletingFolderId === folder.id}
                  className="w-full px-3 py-1.5 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingFolderId === folder.id ? 'Deleting...' : 'Delete Folder'}
                </button>
              </div>
            </div>
          ))}

          {/* Recordings */}
          {recordings.map((recording) => (
            <div
              key={recording.id}
              draggable
              onDragStart={() => handleDragStart(recording.id)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl bg-[#13131a] border border-gray-800 overflow-hidden hover:border-purple-500 transition-all group ${
                draggedRecording === recording.id ? 'opacity-50' : ''
              }`}
            >
              {/* Thumbnail */}
              <div 
                onClick={() => router.push(`/recording/${recording.session_id}`)}
                className="aspect-video bg-[var(--color-bg-tertiary)] flex items-center justify-center relative cursor-pointer"
              >
                {recording.thumbnail_url ? (
                  <img
                    src={recording.thumbnail_url}
                    alt={recording.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl opacity-50 group-hover:opacity-100 transition-opacity">
                    {recording.video_path ? '🎬' : '🎙️'}
                  </span>
                )}
                <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs text-white">
                  {formatDuration(recording.duration)}
                </div>
                {recording.status !== 'completed' && (
                  <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs text-white ${
                    recording.status === 'processing' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    {recording.status}
                  </div>
                )}
              </div>

              <div className="p-3">
                {editingId === recording.id ? (
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle(recording.session_id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 px-2 py-1 text-sm rounded bg-[var(--color-bg-tertiary)] border border-gray-700 text-white focus:outline-none focus:border-purple-500"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveTitle(recording.session_id);
                      }}
                      className="px-2 py-1 text-xs rounded bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      ✓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                      className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 
                      onClick={() => router.push(`/recording/${recording.session_id}`)}
                      className="font-medium text-sm text-white truncate cursor-pointer flex-1"
                    >
                      {recording.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTitle(recording);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-purple-400 p-1"
                      title="Edit title"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {recording.url && (
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {recording.url}
                  </p>
                )}
                
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>{formatDate(recording.created_at)}</span>
                  <span>{recording.events_count} events</span>
                </div>

                <button
                  onClick={(e) => handleDeleteRecording(recording.session_id, recording.title, e)}
                  disabled={deletingId === recording.session_id}
                  className="w-full mt-3 px-3 py-1.5 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === recording.session_id ? 'Deleting...' : 'Delete Recording'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a24] border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Folder</h2>
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateFolder}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-[#13131a] border border-gray-700 rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Enter folder name"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewFolderModal(false);
                    setNewFolderName('');
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingFolder ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a24] border border-gray-700 rounded-xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white">Delete {deleteModal.name}</h2>
              </div>
              <button
                onClick={() => setDeleteModal(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-300">
                Are you sure you want to delete {deleteModal.name}?
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 border-t border-gray-700">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 bg-[#2a2a3a] hover:bg-[#3a3a4a] text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteModal.type === 'recording') {
                    confirmDeleteRecording();
                  } else {
                    confirmDeleteFolder();
                  }
                }}
                className="flex-1 bg-[#f43f5e] hover:bg-[#e11d48] text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
