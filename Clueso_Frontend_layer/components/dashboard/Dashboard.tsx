'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import UserButton from '@/components/UserButton';
import { supabase, Recording } from '@/lib/supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export default function Dashboard() {
  const router = useRouter();
  const { user } = useUser();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState('');
  const [synced, setSynced] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync user to Supabase on first load
  useEffect(() => {
    if (user && !synced) {
      syncUser();
    }
  }, [user, synced]);

  // Fetch recordings after user is synced
  useEffect(() => {
    if (user && synced) {
      fetchRecordings();
    }
  }, [user, synced]);

  const syncUser = async () => {
    try {
      const response = await fetch('/api/user/sync', { method: 'POST' });
      if (response.ok) {
        console.log('User synced to Supabase');
      }
    } catch (error) {
      console.error('Failed to sync user:', error);
    } finally {
      setSynced(true);
    }
  };

  const fetchRecordings = async () => {
    try {
      // First get the user's Supabase ID from their Clerk ID
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

      // Fetch recordings for this user (exclude deleted)
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', userData.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

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

  const handleViewRecording = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionId.trim()) {
      router.push(`/recording/${sessionId.trim()}`);
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
      const response = await fetch(`${API_BASE_URL}/api/v1/recording/${sessionId}/title`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: editTitle.trim() }),
      });

      if (response.ok) {
        // Update local state
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

  const handleDeleteRecording = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Move this recording to trash? It will be permanently deleted after 30 days.')) {
      return;
    }

    setDeletingId(sessionId);

    try {
      // Soft delete - update deleted_at timestamp
      const { error } = await supabase
        .from('recordings')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: (await supabase.from('users').select('id').eq('clerk_id', user?.id).single()).data?.id
        })
        .eq('session_id', sessionId);

      if (!error) {
        // Remove from local state
        setRecordings(recordings.filter(r => r.session_id !== sessionId));
      } else {
        console.error('Failed to delete recording');
        alert('Failed to delete recording. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
      alert('Error deleting recording. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✦</span>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Clueso</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-text-secondary)] hidden sm:block">
              {user?.firstName ? `Welcome, ${user.firstName}` : 'Welcome'}
            </span>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Access */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            View Recording
          </h2>
          <form onSubmit={handleViewRecording} className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Enter session ID"
              className="flex-1 px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white font-medium transition-colors"
            >
              View
            </button>
          </form>
        </section>

        {/* Recordings */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              My Recordings
            </h2>
            <span className="text-sm text-[var(--color-text-tertiary)]">
              {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div>
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)]">
              <div className="text-5xl mb-4">🎬</div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                No recordings yet
              </h3>
              <p className="text-[var(--color-text-tertiary)] max-w-sm mx-auto">
                Start recording with the browser extension to see your recordings here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] overflow-hidden hover:border-[var(--color-accent-primary)] transition-all group"
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
                          className="flex-1 px-2 py-1 text-sm rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveTitle(recording.session_id);
                          }}
                          className="px-2 py-1 text-xs rounded bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-white"
                        >
                          ✓
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="px-2 py-1 text-xs rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 
                          onClick={() => router.push(`/recording/${recording.session_id}`)}
                          className="font-medium text-sm text-[var(--color-text-primary)] truncate cursor-pointer flex-1"
                        >
                          {recording.title}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTitle(recording);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-primary)] p-1"
                          title="Edit title"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}
                    
                    {recording.url && (
                      <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-1">
                        {recording.url}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2 text-xs text-[var(--color-text-muted)]">
                      <span>{formatDate(recording.created_at)}</span>
                      <span>{recording.events_count} events</span>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteRecording(recording.session_id, e)}
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
        </section>
      </main>
    </div>
  );
}
