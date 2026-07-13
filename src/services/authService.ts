import { createClient } from '@/lib/supabase/client';

function getClient() {
  return createClient();
}

export const authService = {
  async signInWithEmail(email: string, password: string) {
    return await getClient().auth.signInWithPassword({ email, password });
  },

  async signUpWithEmail(email: string, password: string) {
    return await getClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  async signInWithGoogle() {
    document.cookie = `oauth_origin=${encodeURIComponent(window.location.origin)}; path=/; max-age=300; SameSite=Lax`;
    return await getClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  async signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
  },
};
