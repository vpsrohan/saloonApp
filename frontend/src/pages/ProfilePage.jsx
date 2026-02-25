import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import axios from "../lib/axios";

export default function ProfilePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchBookings();
  }, [user]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/bookings");
      setBookings(response.data);
    } catch (err) {
      console.error("Error fetching bookings:", err);
      alert("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    try {
      await axios.patch(`/bookings/delete/${bookingId}`);
      alert("Booking cancelled successfully");
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel booking");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "COMPLETED":
        return "bg-green-100 text-green-800 border-green-300";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const filteredBookings = bookings.filter((booking) => {
    if (filter === "all") return true;
    return booking.status.toLowerCase() === filter.toLowerCase();
  });

  const upcomingBookings = filteredBookings.filter(
    (b) => b.status === "PENDING" && new Date(b.slotStart) > new Date()
  );

  const activeBooking = filteredBookings.find(
    (b) => b.status === "IN_PROGRESS"
  );

  const pastBookings = filteredBookings.filter(
    (b) =>
      b.status === "COMPLETED" ||
      b.status === "CANCELLED" ||
      (b.status === "PENDING" && new Date(b.slotStart) <= new Date())
  );

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="p-6 max-w-6xl mx-auto">
          <p className="text-center text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  const BookingCard = ({ booking, showActions = false }) => {
    const { date, time } = formatDateTime(booking.slotStart);
    const endTime = formatDateTime(booking.slotEnd).time;

    return (
      <div className="border rounded-lg p-4 hover:shadow-md transition bg-white">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-lg">
              {booking.salonId?.name || "Salon"}
            </h3>
            <p className="text-sm text-gray-600">
              {booking.serviceId?.name || "Service"}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}
          >
            {booking.status}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-700">
            <span className="font-medium w-24">Date:</span>
            <span>{date}</span>
          </div>
          <div className="flex items-center text-gray-700">
            <span className="font-medium w-24">Time:</span>
            <span>
              {time} - {endTime}
            </span>
          </div>
          <div className="flex items-center text-gray-700">
            <span className="font-medium w-24">Queue #:</span>
            <span>{booking.queueNumber}</span>
          </div>
          {booking.serviceId?.price && (
            <div className="flex items-center text-gray-700">
              <span className="font-medium w-24">Price:</span>
              <span>₹{booking.serviceId.price}</span>
            </div>
          )}
        </div>

        {showActions && booking.status === "PENDING" && (
          <div className="mt-4">
            <button
              onClick={() => handleCancelBooking(booking._id)}
              className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition"
            >
              Cancel Booking
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="p-6 max-w-6xl mx-auto">
        {/* User Info */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <h1 className="text-3xl font-bold mb-2">My Profile</h1>
          <div className="space-y-1 text-gray-700">
            <p>
              <span className="font-medium">Name:</span> {user?.fullName}
            </p>
            <p>
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p>
              <span className="font-medium">Role:</span>{" "}
              <span className="capitalize">{user?.role?.toLowerCase()}</span>
            </p>
          </div>
        </div>

        {/* My Bookings Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-4">My Bookings</h2>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 border-b overflow-x-auto">
            {[
              { key: "all", label: "All" },
              { key: "pending", label: "Upcoming" },
              { key: "in_progress", label: "Active" },
              { key: "completed", label: "Completed" },
              { key: "cancelled", label: "Cancelled" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                  filter === tab.key
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bookings List */}
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg mb-4">No bookings found</p>
              <button
                onClick={() => navigate("/")}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
              >
                Browse Salons
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Active Booking */}
              {filter === "all" && activeBooking && (
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">
                      !
                    </span>
                    Active Now
                  </h3>
                  <BookingCard booking={activeBooking} />
                </div>
              )}

              {/* Upcoming Bookings */}
              {filter === "all" && upcomingBookings.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">
                    Upcoming ({upcomingBookings.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upcomingBookings.map((booking) => (
                      <BookingCard
                        key={booking._id}
                        booking={booking}
                        showActions={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past Bookings */}
              {filter === "all" && pastBookings.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">
                    Past ({pastBookings.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pastBookings.map((booking) => (
                      <BookingCard key={booking._id} booking={booking} />
                    ))}
                  </div>
                </div>
              )}

              {/* Filtered View */}
              {filter !== "all" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBookings.map((booking) => (
                    <BookingCard
                      key={booking._id}
                      booking={booking}
                      showActions={filter === "pending"}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}