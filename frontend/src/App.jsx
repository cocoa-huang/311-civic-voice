import { useState } from "react";
import { IntakeView } from "./components/IntakeView";
import { ProcessingView } from "./components/ProcessingView";
import { ReportCard } from "./components/ReportCard";

// State machine: "intake" | "processing" | "report"
export default function App() {
  const [phase, setPhase] = useState("intake");
  const [report, setReport] = useState(null);

  function handleReportReady(data) {
    setPhase("processing");
    setTimeout(() => {
      setReport(data);
      setPhase("report");
    }, 1500);
  }

  function handleReset() {
    setReport(null);
    setPhase("intake");
  }

  if (phase === "processing") return <ProcessingView />;
  if (phase === "report") return <ReportCard report={report} onReset={handleReset} />;
  return <IntakeView onReportReady={handleReportReady} />;
}
