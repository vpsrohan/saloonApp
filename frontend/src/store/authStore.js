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
    set({ user: res.data.NewUser });
  },

  logout: async () => {
    await axios.post("/auth/logout");
    set({ user: null });
  },
}));
