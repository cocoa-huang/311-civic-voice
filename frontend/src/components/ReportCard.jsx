const MAPS_KEY = import.meta.env.VITE_MAPS_KEY;

const SEVERITY_COLOR = {
  High: "bg-red-100 text-red-800",
  Medium: "bg-yellow-100 text-yellow-800",
  Low: "bg-green-100 text-green-800",
};

export function ReportCard({ report, onReset }) {
  const {
    complaint_type,
    severity,
    agency_name,
    agency,
    location_hint,
    narrative,
    nearby_count,
    lat,
    lng,
    timestamp,
  } = report;

  const mapUrl =
    lat && lng && MAPS_KEY
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x200&markers=color:red|${lat},${lng}&key=${MAPS_KEY}`
      : null;

  const formatted = new Date(timestamp).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-700 px-6 py-5 text-white">
          <p className="text-xs uppercase tracking-widest opacity-75">NYC 311 Complaint Report</p>
          <h1 className="text-2xl font-bold mt-1">{complaint_type}</h1>
          <p className="text-sm opacity-80 mt-0.5">{formatted}</p>
        </div>

        {/* Badges */}
        <div className="px-6 pt-5 flex flex-wrap gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${SEVERITY_COLOR[severity] || "bg-gray-100 text-gray-700"}`}>
            {severity} Severity
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            {agency} — {agency_name}
          </span>
          {nearby_count > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
              {nearby_count} nearby reports
            </span>
          )}
        </div>

        {/* Location */}
        <div className="px-6 pt-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Location</p>
          <p className="text-gray-800 mt-1">{location_hint}</p>
        </div>

        {/* Map */}
        {mapUrl && (
          <div className="mt-4 px-6">
            <img
              src={mapUrl}
              alt="Complaint location map"
              className="w-full rounded-xl object-cover"
            />
          </div>
        )}

        {/* Narrative */}
        <div className="px-6 pt-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Official Narrative</p>
          <p className="text-gray-700 mt-2 leading-relaxed text-sm">{narrative}</p>
        </div>

        {/* Actions */}
        <div className="px-6 py-6 mt-4 flex gap-3">
          <button
            className="flex-1 bg-blue-700 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
            onClick={() => alert("Submitted to NYC 311!")}
          >
            Submit to NYC 311
          </button>
          <button
            className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
            onClick={onReset}
          >
            New Report
          </button>
        </div>
      </div>
    </div>
  );
}
