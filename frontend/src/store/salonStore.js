import { create } from "zustand";
import axiosInstance from "../lib/axios";

export const useSalonStore = create((set) => ({
  salons: [],
  selectedSalon: null,
  loading: false,
  error: null,

  fetchAllSalons: async () => {
    try {
      set({ loading: true, error: null });

      const res = await axiosInstance.get("/salons");
      set({ salons: res.data, loading: false });
    } catch (e) {
      set({
        error: e.response?.data?.message || "Failed to fetch salons",
        loading: false,
      });
      console.error("error while fetching salons:", e);
    }
  },

  fetchSalonById: async (id) => {
    try {
      set({ loading: true, error: null, selectedSalon: null });

      const res = await axiosInstance.get(`/salons/${id}`);
      set({ selectedSalon: res.data, loading: false });
    } catch (e) {
      set({
        error: e.response?.data?.message || "Failed to fetch salon",
        loading: false,
      });
      console.error("error fetching salon by id:", e);
    }
  },

  clearSelectedSalon: () => set({ selectedSalon: null }),
}));
