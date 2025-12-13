import { useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import Layout from "./Layout";
import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function NewTestCase() {
    const [match, params] = useRoute("/projects/:id/testcases/new");
    const projectId = params?.id;
    const [, setLocation] = useLocation();

    // Wizard State
    const [step, setStep] = useState(1);
    const [testCaseId, setTestCaseId] = useState(null);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [userIntent, setUserIntent] = useState("");

    // Examples
    const [desiredExamples, setDesiredExamples] = useState([]);
    const [currentExamples, setCurrentExamples] = useState([]);

    // Step 2 Data
    const [filesProcessing, setFilesProcessing] = useState(false);
    const [metricIteration, setMetricIteration] = useState(null);
    const [feedback, setFeedback] = useState("");

    // Helper to extract text
    const extractText = async (file) => {
        if (file.type === "application/pdf") {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map((item) => item.str).join(" ") + "\\n";
            }
            return text;
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        } else {
            // Plain text
            return await file.text();
        }
    };

    const handleFileUpload = async (e, type) => {
        const files = Array.from(e.target.files);
        setFilesProcessing(true);
        try {
            const newExamples = await Promise.all(
                files.map(async (file) => ({
                    name: file.name,
                    content: await extractText(file),
                    type: type,
                }))
            );
            if (type === "desired") {
                setDesiredExamples((prev) => [...prev, ...newExamples]);
            } else {
                setCurrentExamples((prev) => [...prev, ...newExamples]);
            }
        } catch (err) {
            console.error("File parse error", err);
            alert("Error parsing file. Ensure it is a valid text, PDF, or Docx file.");
        } finally {
            setFilesProcessing(false);
        }
    };

    const handleTextExampleAdd = (content, type) => {
        if (!content.trim()) return;
        const example = { name: "Text Input", content, type };
        if (type === "desired") {
            setDesiredExamples([...desiredExamples, example]);
        } else {
            setCurrentExamples([...currentExamples, example]);
        }
    };

    const handleCreateDraft = async () => {
        if (!name || !description || !userIntent) {
            alert("Please fill in Name, Description, and Evaluation Intent.");
            return;
        }
        if (desiredExamples.length === 0) {
            alert("Please add at least one Desired Output example.");
            return;
        }

        setLoading(true);
        try {
            // 1. Create Test Case
            const res = await fetch(`http://localhost:8000/api/v1/projects/${projectId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description, user_intent: userIntent }),
            });
            if (!res.ok) throw new Error("Failed to create test case");
            const data = await res.json();
            setTestCaseId(data.id);

            // 2. Upload Examples
            const allExamples = [...desiredExamples, ...currentExamples];
            await Promise.all(allExamples.map(ex =>
                fetch(`http://localhost:8000/api/v1/testcases/${data.id}/examples`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: ex.content, type: ex.type })
                })
            ));

            // 3. Generate Metrics (Initial)
            const metricRes = await fetch(`http://localhost:8000/api/v1/testcases/${data.id}/metric-design`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_intent: userIntent })
            });
            if (!metricRes.ok) throw new Error("Failed to generate metrics");
            const metricData = await metricRes.json();
            setMetricIteration(metricData);

            setStep(2);
        } catch (err) {
            console.error(err);
            alert("Error proceeding to next step: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        if (!testCaseId) return;
        setLoading(true);
        try {
            // Recalculate intent with feedback (simple append for now or just resend logic)
            // The API expects user_intent, we can append feedback to it or the backend handles it? 
            // The backend `MetricDesignIterationCreate` only has `user_intent`.
            // Let's combine original intent + feedback for the new "User Intent"
            const newIntent = feedback ? `${userIntent}\n\nFeedback on previous: ${feedback}` : userIntent;

            const metricRes = await fetch(`http://localhost:8000/api/v1/testcases/${testCaseId}/metric-design`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_intent: newIntent })
            });
            if (!metricRes.ok) throw new Error("Failed to regenerate metrics");
            const metricData = await metricRes.json();
            setMetricIteration(metricData);
            setFeedback(""); // Clear feedback after use
        } catch (err) {
            console.error(err);
            alert("Error regenerating metrics");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!testCaseId || !metricIteration) return;
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/v1/testcases/${testCaseId}/metric-design/${metricIteration.id}/confirm`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Failed to confirm metrics");

            // Done!
            setLocation(`/projects/${projectId}/testcases/${testCaseId}`);
        } catch (err) {
            console.error(err);
            alert("Error confirming metrics");
        } finally {
            setLoading(false);
        }
    };

    // --- UI RENDER HELPER ---
    const ExampleInput = ({ type, examples, onRemove }) => {
        const [text, setText] = useState("");
        const fileInputRef = useRef(null);

        return (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-gray-700 mb-2">
                    {type === "desired" ? "Desired Output Examples (Target)" : "Current Output Examples (Baseline)"}
                </h4>
                <p className="text-sm text-gray-500 mb-4">
                    {type === "desired"
                        ? "Upload or paste examples of perfect/ideal outputs."
                        : "Upload or paste examples of what the system currently outputs."}
                </p>

                {/* Existing List */}
                {examples.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {examples.map((ex, i) => (
                            <div key={i} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200 text-sm">
                                <span className="truncate max-w-xs">{ex.name} ({ex.content.length} chars)</span>
                                <button className="text-red-500 hover:text-red-700 font-bold" onClick={() => onRemove(i)}>×</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add New */}
                <div className="flex gap-2 mb-2">
                    <textarea
                        className="flex-1 p-2 border border-gray-300 rounded text-sm h-20"
                        placeholder="Paste text here..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { handleTextExampleAdd(text, type); setText(""); }}
                            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                            disabled={!text.trim()}
                        >
                            Add Text
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 bg-white"
                        >
                            Upload File (PDF/Docx)
                        </button>
                        <input
                            type="file"
                            hidden
                            ref={fileInputRef}
                            accept=".txt,.pdf,.docx"
                            multiple
                            onChange={(e) => handleFileUpload(e, type)}
                        />
                    </div>
                </div>
            </div>
        );
    };

    if (step === 2 && metricIteration) {
        return (
            <Layout title="Design Metrics">
                <div className="max-w-4xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Metric Gap Analysis</h2>
                        <div className="bg-blue-50 p-4 rounded-md text-gray-800 prose prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap font-sans">{metricIteration.gap_analysis}</pre>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Proposed Metrics</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {JSON.parse(metricIteration.llm_proposed_metrics || "[]").map((metric, i) => (
                                <div key={i} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-gray-800">{metric.name}</span>
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{metric.metric_type}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">{metric.description}</p>
                                    <div className="text-xs text-gray-500">
                                        Target: {metric.target_direction}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Feedback (Optional)</label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-md h-24 text-sm"
                            placeholder="Not satisfied? Describe what's missing or wrong with these metrics..."
                        />
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                        <button
                            onClick={handleRegenerate}
                            disabled={loading}
                            className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                        >
                            {loading ? "Regenerating..." : "Regenerate Metrics"}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium shadow-sm transition-colors disabled:opacity-50"
                        >
                            {loading ? "Finalizing..." : "Confirm & Create Test Case"}
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="New Test Case Wizard">
            <div className="max-w-3xl mx-auto mt-10">
                <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                    <div className="mb-6 border-b border-gray-100 pb-4">
                        <h2 className="text-2xl font-bold text-gray-900">Define Evaluation Scenario</h2>
                        <p className="text-gray-500 mt-1">Step 1: Define what you want to test and provide examples.</p>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-6 mb-8">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Test Case Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g. Customer Support Tone Check"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md h-20"
                                placeholder="Brief description..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Evaluation Intent (Critical)</label>
                            <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 mb-2">
                                Describe what "good" and "bad" looks like. The AI will use this to generate metrics.
                            </div>
                            <textarea
                                value={userIntent}
                                onChange={(e) => setUserIntent(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md h-32"
                                placeholder="e.g. I want to measure if the agent is empathetic. Good response acknowledges user frustration. Bad response is robotic."
                            />
                        </div>
                    </div>

                    {/* Examples */}
                    <div className="space-y-6 mb-8">
                        <ExampleInput
                            type="desired"
                            examples={desiredExamples}
                            onRemove={(i) => setDesiredExamples(prev => prev.filter((_, idx) => idx !== i))}
                        />
                        <ExampleInput
                            type="current"
                            examples={currentExamples}
                            onRemove={(i) => setCurrentExamples(prev => prev.filter((_, idx) => idx !== i))}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setLocation(`/projects/${projectId}`)}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateDraft}
                            disabled={loading || filesProcessing}
                            className="bg-[#002B5C] hover:bg-[#001f42] text-white px-6 py-2 rounded-md font-medium shadow-sm transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Analyzing with AI... (this may take 30s+)
                                </span>
                            ) : "Next: Generate Metrics"}
                        </button>
                    </div>
                    {filesProcessing && (
                        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
                            <div className="bg-white p-4 rounded shadow-lg flex items-center gap-3">
                                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="font-medium text-gray-700">Extracting text from files...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
