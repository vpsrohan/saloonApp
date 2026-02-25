import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSalonStore } from "../store/salonStore";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import SalonCard from "../components/SalonCard";

export default function HomePage() {
  const navigate = useNavigate();
  const { salons, loading, error, fetchAllSalons } = useSalonStore();
  const { user, checkAuth } = useAuthStore();

  useEffect(() => {
    fetchAllSalons();
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div>
        <Navbar />
        <p className="p-6">Loading salons...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Navbar />
        <p className="p-6 text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <Navbar />

      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Salons</h1>

        {salons.length === 0 ? (
          <p className="text-gray-500">No salons available</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {salons.map((salon) => (
              <SalonCard
                key={salon._id}
                salon={salon}
                user={user}
                onClick={() => navigate(`/salon/${salon._id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}