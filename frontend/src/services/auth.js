import { supabase } from '../config/supabase.js';

class AuthService {
  constructor() {
    this.user = null;
    this.profile = null;
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  _notify() {
    this.listeners.forEach(fn => fn(this.user, this.profile));
  }

  async init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      this.user = session.user;
      await this._loadProfile();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this.user = session.user;
        await this._loadProfile();
      } else if (event === 'SIGNED_OUT') {
        this.user = null;
        this.profile = null;
      }
      this._notify();
    });
  }

  async _loadProfile() {
    if (!this.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*, outlets(nama)')
      .eq('id', this.user.id)
      .single();
    this.profile = data;
  }

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
    await this._loadProfile();
    this._notify();
    return data;
  }

  async logout() {
    await supabase.auth.signOut();
    this.user = null;
    this.profile = null;
    this._notify();
  }

  isAdmin() { return this.profile?.role === 'admin'; }
  isOutlet() { return this.profile?.role === 'outlet'; }
  isManagement() { return this.profile?.role === 'management'; }
  getOutletId() { return this.profile?.outlet_id; }
  getRole() { return this.profile?.role; }
  getUserName() { return this.profile?.nama || this.user?.email || 'User'; }
  getInitials() {
    const name = this.getUserName();
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }
}

export const auth = new AuthService();
