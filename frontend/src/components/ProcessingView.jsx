export function ProcessingView() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white gap-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-blue-500/30" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-xl font-semibold">Filing your report...</p>
        <p className="text-gray-400 text-sm mt-1">Routing to the right NYC department</p>
      </div>
    </div>
  );
}
