 import { useEffect, useRef } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 
// Generate an iPhone-style tri-tone notification sound dynamically
const generateNotificationSound = (): string => {
  const sampleRate = 22050;
  const duration = 0.5;
  const numSamples = Math.floor(sampleRate * duration);
  
  // Create WAV header + data buffer
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  
  // Helper to write string to buffer
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  
  // Generate tri-tone: E6-C6-E6 pattern (like iPhone)
  const frequencies = [1318.51, 1046.50, 1318.51];
  const noteDuration = duration / 3;
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIndex = Math.min(Math.floor(t / noteDuration), 2);
    const noteT = t - noteIndex * noteDuration;
    const freq = frequencies[noteIndex];
    
    // Envelope for each note
    let envelope = 1;
    if (noteT < 0.02) envelope = noteT / 0.02;
    else if (noteT > noteDuration - 0.03) envelope = Math.max(0, (noteDuration - noteT) / 0.03);
    
    const sample = Math.sin(2 * Math.PI * freq * noteT) * envelope * 0.5;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }
  
  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
};

// Generate sound once and cache it
let cachedSoundUrl: string | null = null;

// Create audio element once
let notificationAudio: HTMLAudioElement | null = null;

const playNotificationSound = () => {
  try {
    if (!cachedSoundUrl) {
      cachedSoundUrl = generateNotificationSound();
    }
    
    if (!notificationAudio) {
      notificationAudio = new Audio(cachedSoundUrl);
      notificationAudio.volume = 0.8;
    }
    
    // Reset and play
    notificationAudio.currentTime = 0;
    notificationAudio.play().then(() => {
      console.log('🔔 Message notification sound played');
    }).catch((err) => {
      console.log('Could not play sound (user interaction required):', err.message);
    });
  } catch (error) {
    console.error('Could not play notification sound:', error);
  }
};
 
 export const useMessageSound = (userId: string | null) => {
   const soundEnabledRef = useRef(true);
  const lastMessageTimeRef = useRef<string | null>(null);
   
   useEffect(() => {
     if (!userId) return;
     
     // Load user's sound preference
     const loadPreference = async () => {
       const { data } = await supabase
         .from('users')
         .select('notification_message_sound')
         .eq('id', userId)
         .single();
       
       soundEnabledRef.current = data?.notification_message_sound ?? true;
      console.log('Message sound enabled:', soundEnabledRef.current);
     };
     
     loadPreference();
     
     // Subscribe to new messages for this user
     const channel = supabase
      .channel(`message-sound-${userId}`)
       .on(
         'postgres_changes',
         {
           event: 'INSERT',
           schema: 'public',
           table: 'messages',
           filter: `receiver_id=eq.${userId}`,
         },
        (payload) => {
          const messageTime = (payload.new as any)?.created_at;
          const senderId = (payload.new as any)?.sender_id;
          
          // Skip if it's from the current user or duplicate
          if (senderId === userId || messageTime === lastMessageTimeRef.current) return;
          lastMessageTimeRef.current = messageTime;
          
          console.log('📩 New message received, sound enabled:', soundEnabledRef.current);
          
           if (soundEnabledRef.current) {
             playNotificationSound();
           }
         }
       )
       .subscribe();
     
     return () => {
       supabase.removeChannel(channel);
     };
   }, [userId]);
   
   return { playNotificationSound };
 };
 
 export { playNotificationSound };