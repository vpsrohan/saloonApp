import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import Navbar from "../components/Navbar";
import axios from "../lib/axios";

export default function EditSalonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Salon data
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [services, setServices] = useState([]);

  useEffect(() => {
    fetchSalon();
  }, [id]);

  const fetchSalon = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/salons/${id}`);

      setName(res.data.name);
      setIsActive(res.data.isActive !== false); // Default to true if not present
      setServices(res.data.services || []);

      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load salon");
      setLoading(false);
    }
  };

  const handleAddService = () => {
    setServices([
      ...services,
      {
        _id: `temp-${Date.now()}`, // Temporary ID for new services
        name: "",
        duration: 30,
        maxPerSlot: 1,
        price: 0,
        isActive: true,
      },
    ]);
  };

  const handleRemoveService = (index) => {
    const newServices = [...services];
    newServices.splice(index, 1);
    setServices(newServices);
  };

  const handleServiceChange = (index, field, value) => {
    const newServices = [...services];
    newServices[index][field] = value;
    setServices(newServices);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate services
      for (let service of services) {
        if (!service.name || service.price <= 0 || service.duration <= 0) {
          alert("Please fill all service fields with valid values");
          setSaving(false);
          return;
        }
      }

      // ✅ Clean up services: remove temp IDs from new services
      const cleanedServices = services.map((service) => {
        if (service._id && service._id.startsWith('temp-')) {
          // Remove _id for new services
          const { _id, ...rest } = service;
          return rest;
        }
        return service;
      });

      // ✅ Backend's updateSalon reads req.body.Name (capital N) since the
      // salon model field is `Name`. Sending lowercase `name` here meant
      // this form was silently failing to save the salon's name.
      await axios.patch(`/salons/${id}`, {
        Name: name,
        isActive,
        services: cleanedServices,
      });

      alert("Salon updated successfully!");
      navigate(`/salon/${id}`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update salon");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <p className="p-6">Loading...</p>
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

      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Edit Salon</h1>
          <button
            onClick={() => navigate(`/salon/${id}`)}
            className="text-sm text-gray-600 hover:underline"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Salon Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Salon Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border p-2 rounded w-full"
              required
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Salon is active
            </label>
          </div>

          {/* Services */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">Services</h2>
              <button
                type="button"
                onClick={handleAddService}
                className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
              >
                + Add Service
              </button>
            </div>

            <div className="space-y-4">
              {services.map((service, index) => (
                <div key={service._id || index} className="border p-4 rounded">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Service Name */}
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Service Name
                      </label>
                      <input
                        type="text"
                        value={service.name}
                        onChange={(e) =>
                          handleServiceChange(index, "name", e.target.value)
                        }
                        className="border p-2 rounded w-full text-sm"
                        placeholder="e.g., Haircut"
                        required
                      />
                    </div>

                    {/* Price */}
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Price (₹)
                      </label>
                      <input
                        type="text"
                        value={service.price}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          handleServiceChange(
                            index,
                            "price",
                            value ? parseInt(value) : 0
                          );
                        }}
                        className="border p-2 rounded w-full text-sm"
                        placeholder="Enter price"
                        required
                      />
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Duration (minutes)
                      </label>
                      <input
                        type="number"
                        value={service.duration}
                        onChange={(e) =>
                          handleServiceChange(
                            index,
                            "duration",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="border p-2 rounded w-full text-sm"
                        min="1"
                        required
                      />
                    </div>

                    {/* Max Per Slot */}
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Max per Slot
                      </label>
                      <input
                        type="number"
                        value={service.maxPerSlot}
                        onChange={(e) =>
                          handleServiceChange(
                            index,
                            "maxPerSlot",
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="border p-2 rounded w-full text-sm"
                        min="1"
                        required
                      />
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`service-active-${index}`}
                        checked={service.isActive}
                        onChange={(e) =>
                          handleServiceChange(
                            index,
                            "isActive",
                            e.target.checked
                          )
                        }
                        className="w-4 h-4"
                      />
                      <label
                        htmlFor={`service-active-${index}`}
                        className="text-xs"
                      >
                        Active
                      </label>
                    </div>

                    {/* Remove Button */}
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveService(index)}
                        className="text-xs px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {services.length === 0 && (
                <p className="text-gray-500 text-sm">
                  No services yet. Click "Add Service" to create one.
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/salon/${id}`)}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
