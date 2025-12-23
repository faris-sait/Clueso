'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';

interface RecordingInsight {
  id: string;
  recording_id: string;
  session_id: string;
  title: string;
  summary: string;
  key_points: string[];
  action_items: string[];
  sentiment: string | null;
  topics: string[];
  created_at: string;
  recording_title: string;
  recording_url: string | null;
}

export default function InsightsPage() {
  const router = useRouter();
  const { user } = useUser();
  const [insights, setInsights] = useState<RecordingInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchInsights();
    }
  }, [user]);

  const fetchInsights = async () => {
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

      // Fetch recordings with their insights
      const { data: recordings, error: recordingsError } = await supabase
        .from('recordings')
        .select(`
          id,
          session_id,
          title,
          url,
          created_at,
          recording_insights (
            id,
            summary,
            key_points,
            action_items,
            sentiment,
            topics,
            created_at
          )
        `)
        .eq('user_id', userData.id)
        .is('deleted_at', null)
        .not('recording_insights', 'is', null)
        .order('created_at', { ascending: false });

      if (recordingsError) {
        console.error('Error fetching insights:', recordingsError);
        setLoading(false);
        return;
      }

      // Transform data to flat structure
      const insightsData: RecordingInsight[] = [];
      recordings?.forEach((recording: any) => {
        if (recording.recording_insights && recording.recording_insights.length > 0) {
          recording.recording_insights.forEach((insight: any) => {
            insightsData.push({
              id: insight.id,
              recording_id: recording.id,
              session_id: recording.session_id,
              title: recording.title,
              summary: insight.summary,
              key_points: insight.key_points,
              action_items: insight.action_items,
              sentiment: insight.sentiment,
              topics: insight.topics,
              created_at: insight.created_at,
              recording_title: recording.title,
              recording_url: recording.url,
            });
          });
        }
      });

      setInsights(insightsData);
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
    });
  };

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'text-green-400 bg-green-500/10';
      case 'negative':
        return 'text-red-400 bg-red-500/10';
      case 'neutral':
      default:
        return 'text-gray-400 bg-gray-500/10';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6">Insights</h1>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : insights.length === 0 ? (
        <div className="border border-gray-800 rounded-xl p-16">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <span className="text-3xl">💡</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              No insights yet
            </h3>
            <p className="text-sm text-gray-400">
              Insights will appear here once you create recordings<br />and generate AI summaries.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="bg-[#13131a] border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all"
            >
              {/* Header */}
              <div
                onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
                className="p-4 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <span className="text-xl">💡</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{insight.recording_title}</h3>
                    <p className="text-xs text-gray-500">{formatDate(insight.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {insight.sentiment && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSentimentColor(insight.sentiment)}`}>
                      {insight.sentiment}
                    </span>
                  )}
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedId === insight.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === insight.id && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-4">
                  {/* Summary */}
                  {insight.summary && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-purple-400 mb-2">Summary</h4>
                      <p className="text-sm text-gray-300">{insight.summary}</p>
                    </div>
                  )}

                  {/* Key Points */}
                  {insight.key_points && insight.key_points.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-purple-400 mb-2">Key Points</h4>
                      <ul className="space-y-1">
                        {insight.key_points.map((point, index) => (
                          <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-purple-400 mt-1">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Items */}
                  {insight.action_items && insight.action_items.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-purple-400 mb-2">Action Items</h4>
                      <ul className="space-y-1">
                        {insight.action_items.map((item, index) => (
                          <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-green-400 mt-1">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Topics */}
                  {insight.topics && insight.topics.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-purple-400 mb-2">Topics</h4>
                      <div className="flex flex-wrap gap-2">
                        {insight.topics.map((topic, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View Recording Button */}
                  <button
                    onClick={() => router.push(`/recording/${insight.session_id}`)}
                    className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
                  >
                    View Recording
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
