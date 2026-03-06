import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, List, LayoutGrid } from 'lucide-react';
import { calendarAPI, postsAPI } from '../api/client';
import EmptyState from '../components/shared/EmptyState';
import type { Post } from '../types';
import { STATUS_COLORS, PILLAR_COLORS } from '../utils/constants';

type ViewType = 'month' | 'week' | 'list';

export default function CalendarPage() {
  const [view, setView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [alignment, setAlignment] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [currentDate, view]);

  const loadData = async () => {
    try {
      setLoading(true);
      const dateStr = view === 'month'
        ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
        : currentDate.toISOString().split('T')[0];

      const [calData, alignData] = await Promise.all([
        calendarAPI.get({ view, date: dateStr }),
        calendarAPI.getAlignment().catch(() => ({ data: null })),
      ]);

      setPosts(calData.data.posts || calData.data || []);
      setAlignment(alignData.data);
    } catch (err) {
      console.error('Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + 7 * dir);
    setCurrentDate(d);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const getPostsForDay = (day: number) => {
    return posts.filter((p) => {
      const d = new Date(p.scheduledAt || p.createdAt);
      return d.getDate() === day && d.getMonth() === currentDate.getMonth();
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Calendar</h1>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {(['month', 'week', 'list'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded text-sm capitalize ${
                  view === v ? 'bg-brand-coral text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 text-white/50 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {currentDate.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <button onClick={() => navigate(1)} className="p-1 text-white/50 hover:text-white">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Strategy Alignment Bar */}
      {alignment && (
        <div className="mb-4 bg-white/5 border border-white/10 rounded-lg p-3">
          <p className="text-xs text-white/50 mb-2">Content Pillar Distribution (actual vs target)</p>
          <div className="flex gap-2">
            {alignment.pillars?.map((p: any) => (
              <div key={p.pillar} className="flex-1">
                <div className="text-xs text-white/60 mb-1 truncate">{p.pillar}</div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-coral rounded-full"
                    style={{ width: `${Math.min(100, (p.actual / p.target) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-white/30 mt-0.5">{p.actual}% / {p.target}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-white/40">Loading...</div>
      ) : posts.length === 0 && view === 'list' ? (
        <EmptyState
          icon={<CalendarIcon size={48} />}
          title="No posts scheduled"
          description="Your strategy has enough to fill the next 2 weeks."
          action={{ label: 'Let the Brain fill the calendar', onClick: () => {} }}
        />
      ) : view === 'month' ? (
        <MonthGrid
          currentDate={currentDate}
          getDaysInMonth={getDaysInMonth}
          getPostsForDay={getPostsForDay}
        />
      ) : view === 'list' ? (
        <ListView posts={posts} />
      ) : (
        <WeekView posts={posts} currentDate={currentDate} />
      )}
    </div>
  );
}

function MonthGrid({
  currentDate,
  getDaysInMonth,
  getPostsForDay,
}: {
  currentDate: Date;
  getDaysInMonth: () => { firstDay: number; daysInMonth: number };
  getPostsForDay: (day: number) => Post[];
}) {
  const { firstDay, daysInMonth } = getDaysInMonth();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <div key={d} className="px-2 py-2 text-xs text-white/40 text-center border-b border-white/10">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-white/5" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayPosts = getPostsForDay(day);
          const isToday =
            day === new Date().getDate() &&
            currentDate.getMonth() === new Date().getMonth() &&
            currentDate.getFullYear() === new Date().getFullYear();

          return (
            <div
              key={day}
              className={`min-h-[100px] border-b border-r border-white/5 p-1.5 ${
                isToday ? 'bg-brand-coral/5' : ''
              }`}
            >
              <span
                className={`text-xs ${
                  isToday
                    ? 'bg-brand-coral text-white w-5 h-5 rounded-full flex items-center justify-center'
                    : 'text-white/40'
                }`}
              >
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayPosts.slice(0, 3).map((p) => (
                  <div
                    key={p._id}
                    className="text-xs px-1 py-0.5 rounded truncate"
                    style={{
                      backgroundColor: p.platform === 'linkedin' ? '#152B6830' : '#FF6F6130',
                      color: p.platform === 'linkedin' ? '#6B8DD6' : '#FF6F61',
                    }}
                  >
                    {p.linkedinHook || p.instagramHook || p.contentPillar || 'Draft'}
                  </div>
                ))}
                {dayPosts.length > 3 && (
                  <span className="text-xs text-white/30">+{dayPosts.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ posts, currentDate }: { posts: Post[]; currentDate: Date }) {
  return (
    <div className="grid grid-cols-7 gap-3">
      {Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - d.getDay() + i);
        const dayPosts = posts.filter((p) => {
          const pd = new Date(p.scheduledAt || p.createdAt);
          return pd.toDateString() === d.toDateString();
        });

        return (
          <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 min-h-[200px]">
            <div className="text-xs text-white/40 mb-2">
              {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="space-y-2">
              {dayPosts.map((p) => (
                <div key={p._id} className="bg-white/5 rounded p-2">
                  <div className="text-xs text-white/70 truncate">
                    {p.linkedinHook || p.instagramHook || 'Draft'}
                  </div>
                  <div className="text-xs text-white/30 mt-1">{p.platform} | {p.author}</div>
                </div>
              ))}
              {dayPosts.length === 0 && (
                <div className="text-xs text-white/20 text-center py-4">Empty slot</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ posts }: { posts: Post[] }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-white/40 text-xs">
            <th className="text-left p-3">Date</th>
            <th className="text-left p-3">Author</th>
            <th className="text-left p-3">Platform</th>
            <th className="text-left p-3">Pillar</th>
            <th className="text-left p-3">Hook</th>
            <th className="text-left p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p._id} className="border-b border-white/5 hover:bg-white/5">
              <td className="p-3 text-white/60">
                {new Date(p.scheduledAt || p.createdAt).toLocaleDateString()}
              </td>
              <td className="p-3 capitalize">{p.author}</td>
              <td className="p-3 capitalize">{p.platform}</td>
              <td className="p-3 text-white/60">{p.contentPillar}</td>
              <td className="p-3 text-white/80 max-w-[300px] truncate">
                {p.linkedinHook || p.instagramHook || '—'}
              </td>
              <td className="p-3">
                <span
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: `${STATUS_COLORS[p.status]}20`,
                    color: STATUS_COLORS[p.status],
                  }}
                >
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
