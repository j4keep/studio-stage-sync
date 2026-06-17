import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const MessagesIcon = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    
    // Set up realtime subscription for new messages
    const channel = supabase
      .channel('messages-icon')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => loadUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadUnreadCount = async () => {
    const { data: currentUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'emma@demo.com')
      .single();
    
    if (currentUser) {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', currentUser.id)
        .eq('read', false);
      
      setUnreadCount(count || 0);
    }
  };

  return (
    <button 
      onClick={() => navigate('/m/messages')}
      className="relative p-2 rounded-full hover:bg-white/20 transition-colors"
    >
      <MessageSquare size={24} className="text-white" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full text-xs flex items-center justify-center font-bold text-white px-1"
          style={{ backgroundColor: 'hsl(var(--destructive))' }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default MessagesIcon;
