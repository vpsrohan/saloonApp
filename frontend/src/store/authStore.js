import { create } from "zustand";
import axios from "../lib/axios";

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,

  checkAuth: async () => {
    try {
      const res = await axios.get("/auth/check");

      set({ user: res.data.user, loading: false });
    } catch (e) {
      set({ user: null, loading: false });
    }
  },

  login: async (data) => {
    const res = await axios.post("/auth/login", data);

    set({ user: res.data.user });
  },

  signup: async (data) => {
    const res = await axios.post("/auth/signup", data);
    // ✅ backend now returns { user: {...} } (same shape as login/check),
    // previously it returned { NewUser: {...} } with an "id" vs "_id"
    // mismatch that broke owner checks (e.g. Edit/Delete salon buttons)
    // right after signing up until the next page refresh.
    set({ user: res.data.user });
  },

  logout: async () => {
    await axios.post("/auth/logout");
    set({ user: null });
  },
}));
