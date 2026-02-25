import { useNavigate } from "react-router-dom";
import axios from "../lib/axios";

export default function SalonCard({ salon, user, onClick }) {
  const navigate = useNavigate();

  if(!salon)return null;

  // ✅ Handle populated OR non-populated ownerId
  const ownerId =
    typeof salon?.ownerId === "object" ? salon.ownerId._id : salon.ownerId;

  const isOwnerAdmin =
    user && user.role === "ADMIN" && user._id === ownerId;

  const handleDelete = async (e) => {
    e.stopPropagation();

    if (!window.confirm("Delete this salon?")) return;

    try {
      await axios.delete(`/salons/${salon._id}`);
      
      // ✅ Reload page (you can replace with store update later)
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete salon");
    }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    navigate(`/salon/edit/${salon._id}`);
  };

  return (
    <div
      onClick={onClick}
      className="cursor-pointer border rounded-lg p-4 aspect-square flex flex-col justify-between hover:shadow-md transition relative"
    >
      {/* Top */}
      <div>
        <h2 className="text-lg font-semibold">{salon?.Name}</h2>
        <p className="text-sm text-gray-600">
          ⭐ {salon?.ratingAvg?.toFixed(1) || 0} ({salon?.ratingCnt || 0})
        </p>
      </div>

      {/* Bottom */}
      <div className="text-sm text-gray-500">Tap to view services</div>

      {/* Owner actions */}
      {isOwnerAdmin && (
        <div className="absolute top-2 right-2 flex gap-2">
          <button
            onClick={handleEdit}
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}