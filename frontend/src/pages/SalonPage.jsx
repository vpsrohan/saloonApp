import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSalonStore } from "../store/salonStore";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import axios from "../lib/axios";

// Date inputs represent a calendar date in the visitor's timezone. Keep that
// date/time local while creating the instant that is saved to the database.
const getLocalDateString = (date = new Date()) => {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

const createLocalSlotDateTime = (dateString, timeString) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute] = timeString.split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute).toISOString();
};

export default function SalonPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { selectedSalon, loading, error, fetchSalonById, clearSelectedSalon } =
    useSalonStore();
  const { user } = useAuthStore();

  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Check if current user is the owner of this salon
  const isOwner = user && selectedSalon && user._id === selectedSalon.ownerId;

  useEffect(() => {
    fetchSalonById(id);

    // Set default date to today
    const today = getLocalDateString();
    setSelectedDate(today);

    return () => {
      clearSelectedSalon();
    };
  }, [id]);

  // Generate time slots when service and date are selected
  useEffect(() => {
    if (selectedService && selectedDate) {
      generateTimeSlots();
    }
  }, [selectedService, selectedDate]);

  const generateTimeSlots = async () => {
    setLoadingSlots(true);

    try {
      // Generate slots from 9 AM to 9 PM in 30-minute intervals
      const slots = [];
      const startHour = 9;
      const endHour = 21; // 9 PM

      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute of [0, 30]) {
          const slotTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          const slotDateTime = new Date(
            `${selectedDate}T${slotTime}:00`,
          ).toISOString();

          slots.push({
            time: slotTime,
            dateTime: slotDateTime,
            available: 0, // Will be updated from backend
            maxPerSlot: selectedService.maxPerSlot,
          });
        }
      }

      // Fetch booking counts for each slot
      const response = await axios.get(`/bookings/availability`, {
        params: {
          salonId: id,
          serviceId: selectedService._id,
          date: selectedDate,
        },
      });

      // Update availability based on existing bookings
      const bookingCounts = response.data.bookingCounts || {};

      slots.forEach((slot) => {
        const count = bookingCounts[slot.dateTime] || 0;
        slot.available = selectedService.maxPerSlot - count;
      });

      setTimeSlots(slots);
    } catch (err) {
      console.error("Error fetching availability:", err);
      // If endpoint doesn't exist yet, just show all slots as available
      const slots = [];
      const startHour = 9;
      const endHour = 21;

      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute of [0, 30]) {
          const slotTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          const slotDateTime = createLocalSlotDateTime(selectedDate, slotTime);

          slots.push({
            time: slotTime,
            dateTime: slotDateTime,
            available: selectedService.maxPerSlot,
            maxPerSlot: selectedService.maxPerSlot,
          });
        }
      }

      setTimeSlots(slots);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSlotClick = async (slot) => {
    if (slot.available <= 0) {
      alert("This slot is full");
      return;
    }

    if (!user) {
      alert("Please login to book");
      navigate("/login");
      return;
    }

    // ✅ Backend requires an Idempotency-Key header on every booking POST
    // (used to safely dedupe retried requests). Without it, addBooking
    // always returns 400 "Idempotency key is required".
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Make booking
    try {
      const response = await axios.post(
        "/bookings",
        {
          salonId: id,
          serviceId: selectedService._id,
          slotStart: slot.dateTime,
        },
        {
          headers: { "Idempotency-Key": idempotencyKey },
        }
      );

      alert(
        `Booking successful! Your queue number is ${response.data.queueNumber}`
      );
      navigate("/profile"); // Redirect to profile page
    } catch (err) {
      alert(err.response?.data?.message || "Booking failed");
      // Refresh slots to update availability
      generateTimeSlots();
    }
  };

  const handleViewBookings = () => {
    navigate(`/salon/${id}/bookings`);
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <p className="p-6">Loading salon...</p>
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

  if (!selectedSalon) {
    return (
      <div>
        <Navbar />
        <p className="p-6">Salon not found</p>
      </div>
    );
  }

  if (!selectedSalon.services || selectedSalon.services.length === 0) {
    return (
      <div>
        <Navbar />
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">{selectedSalon.name}</h1>
          <p className="text-gray-500">No services available</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Salon Info with Admin Button */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{selectedSalon.name}</h1>
            <p className="text-gray-600">
              ⭐ {selectedSalon.ratingAvg?.toFixed(1) || 0} (
              {selectedSalon.ratingCnt || 0} ratings)
            </p>
          </div>

          {/* Show "View Bookings" button only if user is the owner */}
          {isOwner && (
            <button
              onClick={handleViewBookings}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            >
              📋 View All Bookings
            </button>
          )}
        </div>

        {/* Services */}
        <div>
          <h2 className="text-xl font-semibold mb-3">Select a Service</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedSalon.services?.map((service) => (
              <div
                key={service._id}
                className={`border p-4 rounded cursor-pointer transition ${
                  selectedService?._id === service._id
                    ? "border-blue-500 bg-blue-50"
                    : "hover:border-gray-400"
                }`}
                onClick={() => setSelectedService(service)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    <p className="text-sm text-gray-600">
                      Duration: {service.duration} mins
                    </p>
                    <p className="text-xs text-gray-500">
                      Max per slot: {service.maxPerSlot}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">₹{service.price}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Date Selection */}
        {selectedService && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Select Date</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={getLocalDateString()}
              className="border p-2 rounded"
            />
          </div>
        )}

        {/* Time Slots */}
        {selectedService && selectedDate && (
          <div>
            <h2 className="text-xl font-semibold mb-3">
              Available Time Slots - {selectedService.name}
            </h2>

            {loadingSlots ? (
              <p className="text-gray-500">Loading slots...</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {timeSlots.map((slot, index) => {
                  const isAvailable = slot.available > 0;
                  const isPast =
                    new Date(slot.dateTime) < new Date() &&
                    selectedDate === getLocalDateString();

                  return (
                    <button
                      key={index}
                      onClick={() => handleSlotClick(slot)}
                      disabled={!isAvailable || isPast}
                      className={`p-3 rounded border text-sm ${
                        isPast
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : isAvailable
                            ? "bg-white hover:bg-blue-50 hover:border-blue-500 cursor-pointer"
                            : "bg-red-50 text-red-500 border-red-200 cursor-not-allowed"
                      }`}
                    >
                      <div className="font-medium">{slot.time}</div>
                      <div className="text-xs mt-1">
                        {isPast
                          ? "Past"
                          : isAvailable
                            ? `${slot.available} left`
                            : "Full"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
