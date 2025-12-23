'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { supabase, Recording } from '@/lib/supabase';

export default function TrashPage() {
  const { user } = useUser();
  const [trashedRecordings, setTrashedRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTrashedRecordings();
    }
  }, [user]);

  const fetchTrashedRecordings = async () => {
    try {
      // Get user's Supabase ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user?.id)
        .single();

      if (userError || !userData) {
        console.log('User not found');
        setLoading(false);
        return;
      }

      // Fetch deleted recordings
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', userData.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) {
        console.error('Error fetching trash:', error);
      } else {
        setTrashedRecordings(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('recordings')
        .update({ deleted_at: null, deleted_by: null })
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error restoring recording:', error);
        alert('Failed to restore recording');
      } else {
        // Remove from trash list
        setTrashedRecordings(trashedRecordings.filter(r => r.session_id !== sessionId));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handlePermanentDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to permanently delete this recording? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error deleting recording:', error);
        alert('Failed to delete recording');
      } else {
        setTrashedRecordings(trashedRecordings.filter(r => r.session_id !== sessionId));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntilDeletion = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const deleteDate = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const now = new Date();
    const daysLeft = Math.ceil((deleteDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft;
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Trash</h1>
            <p className="text-xs text-gray-400">Items will be deleted in 30 days</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <div className="bg-[#13131a] border border-gray-800 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-gray-800 text-xs font-medium text-gray-400">
            <div>Project</div>
            <div>Creator</div>
            <div>Updated</div>
            <div>Created</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-800">
            {trashedRecordings.map((recording) => (
              <div
                key={recording.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 hover:bg-gray-800/30 transition-colors items-center"
              >
                {/* Project */}
                <div>
                  <p className="text-sm text-white font-medium truncate">{recording.title}</p>
                  {recording.url && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{recording.url}</p>
                  )}
                </div>

                {/* Creator */}
                <div className="text-sm text-gray-400">
                  {user?.firstName || 'You'}
                </div>

                {/* Updated */}
                <div className="text-sm text-gray-400">
                  {formatDate(recording.updated_at)}
                </div>

                {/* Created */}
                <div className="text-sm text-gray-400">
                  {formatDate(recording.created_at)}
                </div>

                {/* Status */}
                <div>
                  <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400">
                    Deletes in {getDaysUntilDeletion((recording as any).deleted_at)} days
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestore(recording.session_id)}
                    className="text-xs px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                    title="Restore"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(recording.session_id)}
                    className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
                    title="Delete permanently"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
