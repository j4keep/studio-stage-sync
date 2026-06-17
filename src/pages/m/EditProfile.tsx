 import { useState, useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import BottomTabBar from '@/components/BottomTabBar';
 import { Upload } from 'lucide-react';
 
 type UsernameStatus = 'idle' | 'checking' | 'ok' | 'taken' | 'same';
 
 export default function EditProfile() {
   const navigate = useNavigate();
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [userData, setUserData] = useState<any>(null);
   const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
   const [checkingUsername, setCheckingUsername] = useState(false);
 
   const [formData, setFormData] = useState({
     name: '',
     username: '',
    tagline: '',
     bio: '',
     location: '',
     photo_url: '',
     notification_payment_received: true,
     notification_member_joined: true,
     notification_payment_due: true,
     language: 'English',
     privacy_show_email: false,
   });
 
   useEffect(() => {
     loadUserData();
   }, []);
 
   const loadUserData = async () => {
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) {
         navigate('/welcome');
         return;
       }
 
       const { data, error } = await supabase
         .from('users')
         .select('*')
         .eq('email', user.email)
         .single();
 
       if (error) throw error;
 
       setUserData(data);
       setFormData({
         name: data.name || '',
         username: data.username || '',
          tagline: data.tagline || '',
         bio: data.bio || '',
         location: data.location || '',
         photo_url: data.photo_url || '',
         notification_payment_received: data.notification_payment_received ?? true,
         notification_member_joined: data.notification_member_joined ?? true,
         notification_payment_due: data.notification_payment_due ?? true,
         language: data.language || 'English',
         privacy_show_email: data.privacy_show_email ?? false,
       });
     } catch (error) {
       console.error('Error loading user data:', error);
       toast.error('Failed to load profile');
     } finally {
       setLoading(false);
     }
   };
 
   const normalizeUsername = (u: string) => {
     const v = (u || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
     return v.slice(0, 20);
   };
 
   const checkUsernameAvailability = async (username: string) => {
     const normalized = normalizeUsername(username);
     
     if (!normalized) {
       setUsernameStatus('idle');
       setCheckingUsername(false);
       return;
     }
 
     if (userData?.username && userData.username.toLowerCase() === normalized) {
       setUsernameStatus('same');
       setCheckingUsername(false);
       return;
     }
 
     setCheckingUsername(true);
     try {
       const { data, error } = await supabase
         .from('users')
         .select('id')
         .eq('username_lower', normalized)
         .maybeSingle();
 
       if (error) throw error;
       setUsernameStatus(data ? 'taken' : 'ok');
     } catch (error) {
       console.error('Error checking username:', error);
     } finally {
       setCheckingUsername(false);
     }
   };
 
   const handleUsernameChange = (value: string) => {
     const normalized = normalizeUsername(value);
     setFormData(prev => ({ ...prev, username: normalized }));
     
     if (!normalized) {
       setUsernameStatus('idle');
       return;
     }
     
     checkUsernameAvailability(normalized);
   };
 
   const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
 
     const reader = new FileReader();
     reader.onloadend = () => {
       setFormData(prev => ({ ...prev, photo_url: reader.result as string }));
       toast.success('Photo updated (temporary - save to persist)');
     };
     reader.readAsDataURL(file);
   };
 
   const handleSave = async () => {
     if (!formData.name.trim()) {
       toast.error('Full name is required');
       return;
     }
 
     const normalized = normalizeUsername(formData.username);
     if (!normalized) {
       toast.error('Username is required');
       return;
     }
 
     if (usernameStatus === 'taken') {
       toast.error('Pick a different username');
       return;
     }
 
     setSaving(true);
     try {
       const updateData: any = {
         name: formData.name.trim(),
         username: normalized,
         username_lower: normalized,
          tagline: formData.tagline || null,
         bio: formData.bio || null,
         location: formData.location || null,
         photo_url: formData.photo_url || null,
         notification_payment_received: formData.notification_payment_received,
         notification_member_joined: formData.notification_member_joined,
         notification_payment_due: formData.notification_payment_due,
         language: formData.language,
         privacy_show_email: formData.privacy_show_email,
       };
 
       const { error } = await supabase
         .from('users')
         .update(updateData)
         .eq('id', userData.id);
 
       if (error) throw error;
 
       toast.success('Profile updated');
       navigate('/m/profile');
     } catch (error: any) {
       console.error('Error updating profile:', error);
       if (error.code === '23505') {
         toast.error('Username already taken');
       } else {
         toast.error('Failed to update profile');
       }
     } finally {
       setSaving(false);
     }
   };
 
   if (loading) {
     return (
       <div className="min-h-screen gradient-hero flex items-center justify-center">
         <div className="text-white">Loading...</div>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen gradient-hero pb-20">
       <div className="max-w-md mx-auto px-4 py-6">
         <div className="mb-6">
           <h1 className="text-2xl font-bold text-white mb-2">
             Edit Profile
           </h1>
           <p className="text-white/70">
             Update your profile information
           </p>
         </div>
 
         {/* Identity */}
         <section className="card-elevated bg-white/95 backdrop-blur-sm p-5 mb-4">
           <h2 className="text-lg font-semibold mb-4" style={{ color: 'hsl(var(--brand-navy))' }}>Identity</h2>
           
           <div className="flex items-center gap-3 mb-4">
             {formData.photo_url ? (
               <img src={formData.photo_url} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
             ) : (
               <div className="w-16 h-16 rounded-full gradient-hero flex items-center justify-center">
                 <span className="text-white text-xl font-bold">
                   {formData.name.charAt(0).toUpperCase()}
                 </span>
               </div>
             )}
             <label className="cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted">
               <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
               <Upload className="inline-block w-4 h-4 mr-1" />
               Change photo
             </label>
           </div>
 
           <div className="space-y-3">
             <div>
               <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--brand-navy))' }}>
                 Full name *
               </label>
               <input
                 type="text"
                 value={formData.name}
                 onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                 className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                 placeholder="Your full name"
                 maxLength={60}
                 required
               />
             </div>
 
             <div>
               <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--brand-navy))' }}>
                 Username (unique) *
               </label>
               <input
                 type="text"
                 value={formData.username}
                 onChange={(e) => handleUsernameChange(e.target.value)}
                 className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                 placeholder="username"
                 maxLength={20}
                 required
               />
               <p className="text-xs text-muted-foreground mt-1">Only letters, numbers, underscore. Publicly visible.</p>
               {checkingUsername && <p className="text-xs text-muted-foreground mt-1">Checking username…</p>}
               {usernameStatus === 'ok' && <p className="text-xs" style={{ color: 'hsl(var(--brand-purple))' }}>Username available ✓</p>}
               {usernameStatus === 'taken' && <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>That username is taken.</p>}
               {usernameStatus === 'same' && <p className="text-xs text-muted-foreground">This is your current username.</p>}
             </div>
 
             <div>
               <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--brand-navy))' }}>
                  Tagline
               </label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
                 className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="e.g., Entrepreneur, Public Figure, Manager"
                  maxLength={50}
               />
                <p className="text-xs text-muted-foreground mt-1">Displayed under your name (max 50 chars)</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--brand-navy))' }}>
                  Bio
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="Short intro (max 150 chars)"
                  maxLength={150}
                  rows={3}
                />
             </div>
 
             <div>
               <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--brand-navy))' }}>
                 Location (optional)
               </label>
               <input
                 type="text"
                 value={formData.location}
                 onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                 className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                 placeholder="City, Country"
               />
             </div>
           </div>
         </section>
 
         {/* Circle Notifications */}
         <section className="card-elevated bg-white/95 backdrop-blur-sm p-5 mb-4">
           <h2 className="text-lg font-semibold mb-4" style={{ color: 'hsl(var(--brand-navy))' }}>Circle Notifications</h2>
           
           <div className="space-y-3">
             <label className="flex items-center justify-between">
               <div>
                 <span className="text-sm">Payment received</span>
                 <p className="text-xs text-muted-foreground">When someone pays into your circle</p>
               </div>
               <input
                 type="checkbox"
                 checked={formData.notification_payment_received}
                 onChange={(e) => setFormData(prev => ({ ...prev, notification_payment_received: e.target.checked }))}
                 className="w-4 h-4 rounded accent-primary"
               />
             </label>
 
             <label className="flex items-center justify-between">
               <div>
                 <span className="text-sm">New member joined</span>
                 <p className="text-xs text-muted-foreground">When someone joins your circle</p>
               </div>
               <input
                 type="checkbox"
                 checked={formData.notification_member_joined}
                 onChange={(e) => setFormData(prev => ({ ...prev, notification_member_joined: e.target.checked }))}
                 className="w-4 h-4 rounded accent-primary"
               />
             </label>
 
             <label className="flex items-center justify-between">
               <div>
                 <span className="text-sm">Payment reminders</span>
                 <p className="text-xs text-muted-foreground">Reminders before your payment is due</p>
               </div>
               <input
                 type="checkbox"
                 checked={formData.notification_payment_due}
                 onChange={(e) => setFormData(prev => ({ ...prev, notification_payment_due: e.target.checked }))}
                 className="w-4 h-4 rounded accent-primary"
               />
             </label>
 
             <div>
               <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--brand-navy))' }}>
                 Language
               </label>
               <select
                 value={formData.language}
                 onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                 className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
               >
                 <option>English</option>
                 <option>Spanish</option>
                 <option>French</option>
               </select>
             </div>
           </div>
         </section>
 
         {/* Privacy & Security */}
         <section className="card-elevated bg-white/95 backdrop-blur-sm p-5 mb-4">
           <h2 className="text-lg font-semibold mb-4" style={{ color: 'hsl(var(--brand-navy))' }}>Privacy & Security</h2>
           
           <div className="space-y-3">
             <label className="flex items-center justify-between">
               <span className="text-sm">Show my email publicly</span>
               <input
                 type="checkbox"
                 checked={formData.privacy_show_email}
                 onChange={(e) => setFormData(prev => ({ ...prev, privacy_show_email: e.target.checked }))}
                 className="w-4 h-4 rounded accent-primary"
               />
             </label>
 
             <div className="pt-2 space-y-2">
               <button
                 onClick={() => toast.info('Password reset feature coming soon')}
                 className="text-sm text-sky-600 hover:underline"
               >
                 Change password
               </button>
               <br />
               <button
                 onClick={() => navigate('/settings/account')}
                 className="text-sm text-sky-600 hover:underline"
               >
                 Account settings (deactivate)
               </button>
             </div>
           </div>
         </section>
 
         {/* Action Buttons */}
         <div className="flex gap-2">
           <button
             onClick={() => navigate('/m/profile')}
             className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted"
             disabled={saving}
           >
             Cancel
           </button>
           <button
             onClick={handleSave}
             disabled={saving || checkingUsername}
             className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
             style={{ backgroundColor: 'hsl(var(--brand-purple))' }}
           >
             {saving ? 'Saving…' : 'Save changes'}
           </button>
         </div>
       </div>
 
       <BottomTabBar />
     </div>
   );
 }