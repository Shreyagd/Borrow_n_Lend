import React, { useState } from 'react';

interface CommunityViewProps {
  onNavigate: (tab: string) => void;
  onOpenListBook: () => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  onNavigate,
  onOpenListBook,
}) => {
  const [discussionPosts, setDiscussionPosts] = useState([
    {
      id: 1,
      author: 'Maya Thorne',
      avatar: 'MT',
      time: '2 hours ago',
      title: 'Which translation of Siddhartha did you prefer?',
      content:
        'Just returned the 1951 edition to Locker #4. The chapter on the River has some of the most serene marginal reflections left by past readers!',
      likes: 14,
      comments: 6,
      bookTag: 'Siddhartha (Classics)',
    },
    {
      id: 2,
      author: 'Marcus Reed',
      avatar: 'MR',
      time: 'Yesterday',
      title: 'North Central Ward Readers Circle: November Meetup',
      content:
        'We are gathering at the Central Library Courtyard next Saturday at 10:30 AM to discuss habits and intentional slow reading. Bring your current borrowed book!',
      likes: 29,
      comments: 11,
      bookTag: 'Community Meetup',
    },
    {
      id: 3,
      author: 'Arthur Vance',
      avatar: 'AV',
      time: '2 days ago',
      title: 'Tip for returning books during rainy mornings',
      content:
        'Remember that library swap lockers are fully covered indoors inside the glass foyer. If you use the bike courier, they carry waterproof recycled canvas covers.',
      likes: 19,
      comments: 3,
      bookTag: 'Locker Logistics',
    },
  ]);

  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('');

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    setDiscussionPosts([
      {
        id: Date.now(),
        author: 'Clara Vance',
        avatar: 'CV',
        time: 'Just now',
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        likes: 1,
        comments: 0,
        bookTag: 'Reader Discussion',
      },
      ...discussionPosts,
    ]);

    setNewPostTitle('');
    setNewPostContent('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-10 space-y-12">
      {/* Header */}
      <div className="max-w-3xl space-y-3">
        <div className="flex items-center gap-2 text-[#a04028] text-[11px] uppercase tracking-widest font-bold">
          <span className="material-symbols-outlined text-[16px]">diversity_3</span>
          <span>North Central Ward Readers Guild</span>
        </div>
        <h1 className="font-serif text-[34px] sm:text-[44px] leading-tight text-[#04281a] font-semibold">
          Paper Community &amp; Book Clubs
        </h1>
        <p className="text-[16px] leading-relaxed text-[#414844]">
          Connect with neighbors who cherish physical books. Share marginal notes, participate in
          neighborhood reading clubs, and discover local book drop-off spots.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Main Feed (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Post creator */}
          <div className="bg-white rounded-2xl p-6 border border-[#e1ddd0] shadow-xs space-y-4">
            <h3 className="font-serif text-[18px] text-[#04281a] font-semibold">
              Share a Reading Note or Question
            </h3>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <input
                type="text"
                placeholder="Topic or book title (e.g., Thoughts on chapter 4 of Deep Work)..."
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] text-[14px] text-[#1c1c17] focus:ring-2 focus:ring-[#04281a] focus:bg-white focus:outline-none"
              />
              <textarea
                rows={3}
                placeholder="Write your note to the neighborhood..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#f6f3ea] border border-[#e1ddd0] text-[14px] text-[#1c1c17] focus:ring-2 focus:ring-[#04281a] focus:bg-white focus:outline-none resize-none"
              />
              <div className="flex justify-between items-center pt-1">
                <span className="text-[12px] text-[#414844]">
                  Posting as <strong>Clara Vance</strong> (Host)
                </span>
                <button
                  type="submit"
                  disabled={!newPostTitle.trim() || !newPostContent.trim()}
                  className="px-5 py-2 rounded-full bg-[#04281a] text-white text-[13px] font-semibold hover:bg-[#1c3e2f] transition-all disabled:opacity-50 cursor-pointer"
                >
                  Post to Community
                </button>
              </div>
            </form>
          </div>

          {/* Posts list */}
          <div className="space-y-5">
            {discussionPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-2xl p-6 border border-[#e1ddd0] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#c5ebd6] text-[#04281a] flex items-center justify-center font-bold text-[14px]">
                      {post.avatar}
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#1c1c17]">{post.author}</h4>
                      <span className="text-[11px] text-[#414844]">{post.time}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#f6f3ea] text-[#414844] text-[11px] font-semibold border border-[#e1ddd0]">
                    {post.bookTag}
                  </span>
                </div>

                <h3 className="font-serif text-[18px] text-[#1c1c17] font-semibold">
                  {post.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-[#414844]">{post.content}</p>

                <div className="pt-3 border-t border-[#e1ddd0]/60 flex items-center gap-6 text-[13px] text-[#414844]">
                  <button className="flex items-center gap-1.5 hover:text-[#a04028] transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[16px]">favorite</span>
                    <span>{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-[#04281a] transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                    <span>{post.comments} comments</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upcoming book club */}
          <div className="bg-[#f6f3ea] rounded-2xl p-6 border border-[#e1ddd0] space-y-4">
            <div className="flex items-center gap-2 text-[#a04028] text-[11px] font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px]">event</span>
              <span>Next Neighborhood Gathering</span>
            </div>
            <h3 className="font-serif text-[20px] text-[#04281a] font-semibold">
              Slow Reading &amp; Coffee Exchange
            </h3>
            <p className="text-[13px] text-[#414844] leading-relaxed">
              Saturday, Nov 2 • 10:30 AM @ Central Library Courtyard. Discussing Atomic Habits and
              autumn non-fiction editions.
            </p>
            <button
              onClick={() => alert('RSVP confirmed! See you at Central Library Courtyard next Saturday.')}
              className="w-full py-2.5 rounded-full bg-[#04281a] text-white font-semibold text-[13px] hover:bg-[#1c3e2f] transition-all cursor-pointer"
            >
              RSVP to Join (Free)
            </button>
          </div>

          {/* Become a Host CTA */}
          <div className="bg-white rounded-2xl p-6 border border-[#e1ddd0] space-y-3">
            <h3 className="font-serif text-[18px] text-[#1c1c17] font-semibold">
              Host a Community Drop Box
            </h3>
            <p className="text-[13px] text-[#414844] leading-relaxed">
              Have a protected porch or bookstore entryway? Apply to host a verified 4-compartment
              Safe Swap locker in your micro-neighborhood.
            </p>
            <button
              onClick={onOpenListBook}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#a04028] hover:underline cursor-pointer"
            >
              <span>Learn about Shelf Hosting</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
