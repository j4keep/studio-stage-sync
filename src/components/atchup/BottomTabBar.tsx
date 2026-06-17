import { CircleDollarSign, User, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const BottomTabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    
    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUnreadCount();
    });
    
    // Set up realtime subscription for new messages
    const channel = supabase
      .channel('bottom-tab-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => loadUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, []);

  const loadUnreadCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('read', false);
    
    setUnreadCount(count || 0);
  };

  const tabs = [
    { id: 'savings', label: 'Circles', icon: CircleDollarSign, path: '/m/savings-circles' },
    { id: 'messages', label: 'Messages', icon: MessageCircle, path: '/m/messages' },
    { id: 'profile', label: 'Profile', icon: User, path: '/m/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50">
      <div className="max-w-md mx-auto">
        <nav className="flex justify-around items-center h-16 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname.startsWith(tab.path);
            
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className="flex flex-col items-center justify-center flex-1 h-full transition-colors relative"
              >
                {tab.id === 'messages' && unreadCount > 0 && (
                  <span
                    className="absolute top-1 left-1/2 ml-2 min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center font-bold text-white px-1"
                    style={{ backgroundColor: 'hsl(var(--destructive))' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                <Icon 
                  className="w-5 h-5 mb-1"
                  style={{ 
                    color: isActive ? 'hsl(var(--brand-purple))' : 'hsl(var(--muted-foreground))'
                  }}
                />
                <span 
                  className="text-xs font-medium"
                  style={{ 
                    color: isActive ? 'hsl(var(--brand-purple))' : 'hsl(var(--muted-foreground))' 
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default BottomTabBar;
