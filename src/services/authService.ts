import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export const authService = {
  async signInWithEmail(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signUpWithEmail(email: string, password: string) {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  async signInWithGoogle() {
    document.cookie = `oauth_origin=${encodeURIComponent(window.location.origin)}; path=/; max-age=300; SameSite=Lax`;
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
