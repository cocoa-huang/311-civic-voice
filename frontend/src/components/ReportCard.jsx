import React from 'react';

// Fetch the Google Maps API Key from environment variables
const MAPS_KEY = import.meta.env.VITE_MAPS_KEY;

// Map severity levels to Tailwind utility classes 
// Using subtle backgrounds and borders for a modern, clean look
const SEVERITY_STYLES = {
  High: "bg-red-500/10 text-red-500 border-red-500/20 border",
  Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 border",
  Low: "bg-green-500/10 text-green-500 border-green-500/20 border",
};

export function ReportCard({ report, onReset }) {
  // Gracefully fallback to default values if report data is missing
  const {
    complaint_type = "Unclassified Issue",
    severity = "Medium",
    agency_name = "Relevant Department",
    agency = "NYC",
    location_hint = "Location unavailable",
    narrative = "Processing details...",
    nearby_count = 0,
    lat,
    lng,
    timestamp = Date.now(),
  } = report || {};

  // Construct the Google Static Maps URL
  const mapUrl = lat && lng && MAPS_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x200&markers=color:red|${lat},${lng}&key=${MAPS_KEY}`
    : null;

  const formattedDate = new Date(timestamp).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    // Main wrapper utilizing the global background variable
    <div className="min-h-screen bg-[var(--bg)] flex items-start justify-center py-12 px-4 w-full">
      
      {/* Card Container: using custom border, shadow, and background variables */}
      <div className="w-full max-w-2xl bg-[var(--bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow)] overflow-hidden flex flex-col">
        
        {/* Header Section */}
        <div className="bg-[#f6e900] border-b border-gray-200 px-8 py-6">
          <p className="text-xs uppercase tracking-widest text-black/70 font-bold mb-1">
            Official NYC 311 Report
          </p>
          <h1 className="text-3xl font-bold text-black tracking-tight">
            {complaint_type}
          </h1>
          <p className="text-sm text-black/80 mt-2 font-mono">
            Generated: {formattedDate}
          </p>
        </div>

        {/* Metadata Badges */}
        <div className="px-8 pt-6 flex flex-wrap gap-3">
          <span className={`px-3 py-1.5 rounded-md text-xs font-semibold ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.Medium}`}>
            {severity} Priority
          </span>
          <span className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--code-bg)] text-[var(--text-h)] border border-[var(--border)]">
            Routed to: {agency}
          </span>
          {nearby_count > 0 && (
            <span className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--social-bg)] text-[var(--text)] border border-[var(--border)]">
              {nearby_count} similar reports nearby
            </span>
          )}
        </div>

        {/* Location Section */}
        <div className="px-8 pt-6">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--text)] mb-2">
            Incident Location
          </h2>
          <p className="text-[var(--text-h)] font-medium text-lg">
            {location_hint}
          </p>
        </div>

        {/* Static Map Integration */}
        {mapUrl ? (
          <div className="mt-4 px-8">
            <img
              src={mapUrl}
              alt="Incident location map"
              className="w-full h-48 object-cover rounded-xl border border-[var(--border)] shadow-sm"
            />
          </div>
        ) : (
          <div className="mt-4 mx-8 h-48 bg-[var(--code-bg)] border border-dashed border-[var(--border)] rounded-xl flex items-center justify-center">
            <span className="text-[var(--text)] text-sm font-mono">Map unavailable (Missing API Key or Coordinates)</span>
          </div>
        )}

        {/* AI Narrative Section */}
        <div className="px-8 py-6 flex-1">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--text)] mb-3">
            AI Agent Narrative
          </h2>
          <div className="bg-[var(--code-bg)] border border-[var(--border)] rounded-xl p-5">
            <p className="text-[var(--text-h)] leading-relaxed text-base">
              {narrative}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-8 py-6 bg-[var(--social-bg)] border-t border-[var(--border)] flex gap-4">
          <button
            onClick={() => alert("Mock: Successfully submitted to NYC 311 systems.")}
            className="flex-1 bg-[#f6e900] text-black font-semibold py-3.5 rounded-xl hover:brightness-110 shadow-lg shadow-[#f6e900] transition-all"
          >
            Submit to NYC 311
          </button>
          <button
            onClick={onReset}
            className="px-6 bg-[var(--bg)] text-[var(--text-h)] border border-[var(--border)] font-semibold py-3.5 rounded-xl hover:bg-[var(--code-bg)] transition-colors"
          >
            Start New
          </button>
        </div>
      </div>
    </div>
  );
}