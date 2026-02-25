import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import axios from "../lib/axios";

export default function SalonBookingsPage() {
  const { id } = useParams(); // salonId
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [salonName, setSalonName] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchSalonBookings();
  }, [user, id]);

  const fetchSalonBookings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/bookings/salon/${id}`);
      setBookings(response.data);

      // Get salon name
      const salonResponse = await axios.get(`/salons/${id}`);
      setSalonName(salonResponse.data.name);
    } catch (err) {
      console.error("Error fetching salon bookings:", err);
      if (err.response?.status === 403) {
        alert("You are not authorized to view these bookings");
        navigate("/");
      } else {
        alert("Failed to load bookings");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartService = async (bookingId) => {
    if (!window.confirm("Start this service now?")) {
      return;
    }

    try {
      await axios.patch(`/bookings/update/${bookingId}/start`);
      alert("✅ Service started successfully!");
      fetchSalonBookings();
    } catch (err) {
      alert("❌ " + (err.response?.data?.message || "Failed to start service"));
    }
  };

  const handleEndService = async (bookingId) => {
    if (!window.confirm("Mark this service as completed?")) {
      return;
    }

    try {
      await axios.patch(`/bookings/update/${bookingId}/end`);
      alert("✅ Service completed successfully!");
      fetchSalonBookings();
    } catch (err) {
      alert("❌ " + (err.response?.data?.message || "Failed to complete service"));
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
    if (filter === "today") {
      const today = new Date().toDateString();
      const bookingDate = new Date(booking.slotStart).toDateString();
      return today === bookingDate;
    }
    return booking.status.toLowerCase() === filter.toLowerCase();
  });

  const todayBookings = filteredBookings.filter(
    (b) => new Date(b.slotStart).toDateString() === new Date().toDateString()
  );

  const upcomingBookings = filteredBookings.filter(
    (b) =>
      new Date(b.slotStart) > new Date() &&
      new Date(b.slotStart).toDateString() !== new Date().toDateString()
  );

  const pastBookings = filteredBookings.filter(
    (b) => new Date(b.slotStart) < new Date()
  );

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="p-6 max-w-6xl mx-auto">
          <p className="text-center text-gray-500">Loading bookings...</p>
        </div>
      </div>
    );
  }

  const BookingCard = ({ booking }) => {
    const { date, time } = formatDateTime(booking.slotStart);
    const endTime = formatDateTime(booking.slotEnd).time;
    const serviceName = booking.serviceId?.name || "Unknown Service";
    const isToday = new Date(booking.slotStart).toDateString() === new Date().toDateString();
    const isPast = new Date(booking.slotStart) < new Date();

    return (
      <div className={`border rounded-lg p-4 hover:shadow-md transition ${
        booking.status === "IN_PROGRESS" ? "border-blue-400 bg-blue-50" : ""
      }`}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-lg">
              {booking.userId?.fullName || "Unknown User"}
            </h3>
            <p className="text-sm text-gray-600">{booking.userId?.email}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}
            >
              {booking.status.replace("_", " ")}
            </span>
            {isToday && booking.status === "PENDING" && (
              <span className="text-xs text-orange-600 font-medium">📅 Today</span>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-700">
            <span className="font-medium w-24">Service:</span>
            <span>{serviceName}</span>
          </div>
          <div className="flex items-center text-gray-700">
            <span className="font-medium w-24">Date:</span>
            <span>{date}</span>
          </div>
          <div className="flex items-center text-gray-700">
            <span className="font-medium w-24">Time:</span>
            <span>{time} - {endTime}</span>
          </div>
          <div className="flex items-center text-gray-700">
            <span className="font-medium w-24">Queue #:</span>
            <span className="font-semibold">{booking.queueNumber}</span>
          </div>
          {booking.serviceId?.price && (
            <div className="flex items-center text-gray-700">
              <span className="font-medium w-24">Price:</span>
              <span className="font-semibold text-green-600">₹{booking.serviceId.price}</span>
            </div>
          )}
          {booking.serviceId?.duration && (
            <div className="flex items-center text-gray-700">
              <span className="font-medium w-24">Duration:</span>
              <span>{booking.serviceId.duration} mins</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          {booking.status === "PENDING" && !isPast && (
            <button
              onClick={() => handleStartService(booking._id)}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Service
            </button>
          )}
          {booking.status === "IN_PROGRESS" && (
            <button
              onClick={() => handleEndService(booking._id)}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Complete Service
            </button>
          )}
          {booking.status === "COMPLETED" && booking.completedAt && (
            <p className="text-xs text-green-600">
              ✓ Completed on {formatDateTime(booking.completedAt).date} at {formatDateTime(booking.completedAt).time}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/salon/${id}`)}
            className="text-blue-600 hover:underline mb-2"
          >
            ← Back to Salon
          </button>
          <h1 className="text-3xl font-bold">Bookings - {salonName}</h1>
          <p className="text-gray-600 mt-1">
            Manage all bookings for your salon
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b overflow-x-auto">
          {[
            { key: "all", label: "All" },
            { key: "today", label: "Today" },
            { key: "pending", label: "Pending" },
            { key: "in_progress", label: "In Progress" },
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
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500 text-lg">No bookings found</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Today's Bookings */}
            {filter === "all" && todayBookings.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Today ({todayBookings.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {todayBookings.map((booking) => (
                    <BookingCard key={booking._id} booking={booking} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Bookings */}
            {filter === "all" && upcomingBookings.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Upcoming ({upcomingBookings.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingBookings.map((booking) => (
                    <BookingCard key={booking._id} booking={booking} />
                  ))}
                </div>
              </div>
            )}

            {/* Past Bookings */}
            {filter === "all" && pastBookings.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Past ({pastBookings.length})
                </h2>
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
                  <BookingCard key={booking._id} booking={booking} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}