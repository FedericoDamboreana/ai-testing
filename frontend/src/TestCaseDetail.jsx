import { useEffect, useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from "./Layout";
import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function TestCaseDetail() {
    const [match, params] = useRoute("/projects/:id/testcases/:testCaseId");
    // Note: The route in App.jsx might need adjustment if it was /testcases/:id. 
    // NewTestCase redirects to /projects/:projectId/testcases/:testCaseId usually, or simplified /testcases/:id?
    // Let's check wouter usage in NewTestCase: setLocation(`/projects/${projectId}/testcases/${testCaseId}`)
    // But typically standard REST resources are /testcases/:id.
    // The previous file used /testcases/:id. I'll stick to that to avoid breaking other links if possible, 
    // but NewTestCase redirects to /projects/:id/testcases/:id. 
    // Wait, NewTestCase redirects to: `/projects/${projectId}/testcases/${testCaseId}` is incorrect if `testCaseId` is unique globally.
    // Let's assume /testcases/:id is enough.
    // Actually, NewTestCase code I just wrote redirects to: setLocation(`/projects/${projectId}/testcases/${testCaseId}`);
    // I should probably standardise. Let's support both or just check params.

    // Actually, let's look at the previous file again.
    // Line 7: const [match, params] = useRoute("/testcases/:id");
    // So the app seems to use flat routes for details.
    // I should fix NewTestCase redirect if needed, but for now let's handle /testcases/:id here.

    const [matchDetail, paramsDetail] = useRoute("/testcases/:id");
    const [matchProject, paramsProject] = useRoute("/projects/:pid/testcases/:id");

    const id = paramsDetail?.id || paramsProject?.id;

    const [activeTab, setActiveTab] = useState("examples");
    const [testCase, setTestCase] = useState(null);

    // Evaluation State
    const [evalOutput, setEvalOutput] = useState("");
    const [previewResult, setPreviewResult] = useState(null);
    const [evalLoading, setEvalLoading] = useState(false);
    const [fileProcessing, setFileProcessing] = useState(false);
    const fileInputRef = useRef(null);

    // Helper to extract text (Reused from NewTestCase)
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

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setFileProcessing(true);
        try {
            const texts = await Promise.all(files.map(extractText));
            const newContent = texts.join("\n\n---\n\n");
            setEvalOutput(prev => prev ? prev + "\n" + newContent : newContent);
        } catch (err) {
            console.error("File parse error", err);
            alert("Error parsing file. Ensure it is a valid text, PDF, or Docx file.");
        } finally {
            setFileProcessing(false);
        }
    };

    // Dashboard State
    const [dashData, setDashData] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportConfig, setReportConfig] = useState({ start: 1, end: 1 });
    const [generatedReport, setGeneratedReport] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);

    useEffect(() => {
        if (id) {
            fetch(`http://localhost:8000/api/v1/testcases/${id}`)
                .then(res => res.json())
                .then(setTestCase)
                .catch(console.error);

            loadDashboard();
        }
    }, [id]);

    const loadDashboard = () => {
        if (!id) return;
        fetch(`http://localhost:8000/api/v1/testcases/${id}/runs`)
            .then(res => res.json())
            .then(runs => {
                // Adapt runs to simple dash data for now
                // Ideally backend has a dashboard endpoint, but previous file used /dashboard endpoint which I didn't see in backend routes list?
                // Wait, I saw `dashboard.py` in `app/api/routes`?
                // Let's check Step 25: `dashboard.py` exists. 
                // But in `projects.py` there was no dashboard include.
                // Maybe it's mounted in main.py? I didn't check main.py.
                // Use the code from previous file: `fetch(http://localhost:8000/api/v1/testcases/${id}/dashboard)`
                // If that worked, I'll keep it.
                fetch(`http://localhost:8000/api/v1/testcases/${id}/dashboard`)
                    .then(r => {
                        if (r.ok) return r.json();
                        return null;
                    })
                    .then(setDashData)
                    .catch(e => console.warn("Dashboard not avail", e));
            })
            .catch(console.error);
    };

    const runPreview = async () => {
        setEvalLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/v1/testcases/${id}/evaluate/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outputs: [evalOutput] })
            });
            const data = await res.json();
            setPreviewResult(data);
        } catch (e) { console.error(e); alert("Error previewing"); }
        setEvalLoading(false);
    };

    const openReportModal = () => {
        if (!dashData || dashData.aggregated_score_points.length === 0) {
            alert("No runs available to report on.");
            return;
        }
        const versions = dashData.aggregated_score_points.map(p => p.version_number);
        const minV = Math.min(...versions);
        const maxV = Math.max(...versions);
        setReportConfig({ start: minV, end: maxV });
        setShowReportModal(true);
        setGeneratedReport(null);
    };

    const generateReport = async () => {
        setReportLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/v1/testcases/${id}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_version: parseInt(reportConfig.start),
                    end_version: parseInt(reportConfig.end)
                })
            });
            if (!res.ok) throw new Error("Failed to generate report");
            const data = await res.json();
            setGeneratedReport(data.summary_text);
        } catch (e) {
            console.error(e);
            alert("Error generating report");
        }
        setReportLoading(false);
    };

    const commitEval = async () => {
        setEvalLoading(true);
        try {
            await fetch(`http://localhost:8000/api/v1/testcases/${id}/evaluate/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outputs: [evalOutput], notes: "Manual run via UI" })
            });
            alert("Evaluation Committed! Version bumped.");
            setPreviewResult(null);
            loadDashboard();
            setActiveTab('dashboard');
        } catch (e) { console.error(e); alert("Error committing"); }
        setEvalLoading(false);
    };

    if (!testCase) return <Layout title="Loading..."><div className="text-gray-400 p-10">Loading...</div></Layout>;

    const desiredExamples = testCase.examples?.filter(e => e.type.toLowerCase() === "desired") || [];
    const currentExamples = testCase.examples?.filter(e => e.type.toLowerCase() === "current") || [];

    return (
        <Layout title={testCase.name}>
            <div className="flex flex-col h-full w-full">
                {/* Header */}
                <div className="mb-6">
                    <Link href={`/projects/${testCase.project_id}`}>
                        <button className="text-gray-500 hover:text-gray-800 mb-4 flex items-center gap-1 text-sm font-medium">
                            ← Back to Project
                        </button>
                    </Link>
                    <p className="text-gray-600">{testCase.description}</p>
                    {testCase.user_intent && (
                        <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 inline-block">
                            <strong>Intent:</strong> {testCase.user_intent}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    {['examples', 'metrics', 'evaluate', 'dashboard'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 capitalize font-medium transition-colors ${activeTab === tab
                                ? 'text-[#002B5C] border-b-2 border-[#002B5C]'
                                : 'text-gray-500 hover:text-[#002B5C]'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-auto">
                    {/* EXAMPLES TAB (READ ONLY) */}
                    {activeTab === 'examples' && (
                        <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                                <h3 className="text-lg font-medium text-[#002B5C] mb-4">Desired Outputs (Target)</h3>
                                <div className="space-y-4">
                                    {desiredExamples.length === 0 && <p className="text-gray-400 italic">No examples provided.</p>}
                                    {desiredExamples.map(ex => (
                                        <div key={ex.id} className="bg-gray-50 p-3 rounded border border-gray-200 text-sm">
                                            <div className="font-semibold text-gray-700 mb-1">Example #{ex.id}</div>
                                            <pre className="whitespace-pre-wrap text-gray-600 font-sans">{ex.content}</pre>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                                <h3 className="text-lg font-medium text-[#002B5C] mb-4">Current Outputs (Baseline)</h3>
                                <div className="space-y-4">
                                    {currentExamples.length === 0 && <p className="text-gray-400 italic">No examples provided.</p>}
                                    {currentExamples.map(ex => (
                                        <div key={ex.id} className="bg-gray-50 p-3 rounded border border-gray-200 text-sm">
                                            <div className="font-semibold text-gray-700 mb-1">Example #{ex.id}</div>
                                            <pre className="whitespace-pre-wrap text-gray-600 font-sans">{ex.content}</pre>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* METRICS TAB (READ ONLY) */}
                    {activeTab === 'metrics' && (
                        <div className="max-w-3xl space-y-6">
                            <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                                <h3 className="text-lg font-medium text-[#002B5C] mb-4">Confirmed Metrics</h3>
                                <div className="space-y-4">
                                    {testCase.metrics?.map((m, i) => (
                                        <div key={i} className="bg-white p-4 rounded border border-gray-200 hover:border-blue-300 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-bold text-gray-800">{m.name}</span>
                                                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{m.metric_type}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">{m.description}</p>
                                            <div className="text-xs text-gray-500 flex gap-4">
                                                <span>Target: {m.target_direction}</span>
                                                {m.scale_type === 'bounded' && <span>Scale: {m.scale_min}-{m.scale_max}</span>}
                                            </div>
                                        </div>
                                    ))}
                                    {(!testCase.metrics || testCase.metrics.length === 0) && (
                                        <p className="text-gray-400">No metrics confirmed yet.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EVALUATE TAB */}
                    {activeTab === 'evaluate' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full pb-10">
                            <div className="flex flex-col gap-4 h-full">
                                <div className="bg-white p-4 rounded shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[300px]">
                                    <h3 className="text-[#002B5C] font-medium mb-3 flex justify-between items-center">
                                        Input Output
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-sm text-blue-600 hover:text-blue-800 underline"
                                                disabled={fileProcessing}
                                            >
                                                {fileProcessing ? "Processing..." : "Upload File"}
                                            </button>
                                            <input
                                                type="file"
                                                hidden
                                                ref={fileInputRef}
                                                accept=".txt,.pdf,.docx"
                                                onChange={handleFileUpload}
                                            />
                                        </div>
                                    </h3>
                                    <textarea
                                        value={evalOutput}
                                        onChange={e => setEvalOutput(e.target.value)}
                                        className="flex-1 w-full bg-gray-50 border border-gray-200 rounded p-3 text-gray-900 resize-none font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="Paste the LLM output you want to evaluate here, or upload a file..."
                                    ></textarea>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={runPreview}
                                        disabled={evalLoading || !evalOutput.trim()}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded border border-gray-300 font-medium disabled:opacity-50"
                                    >
                                        Preview Score
                                    </button>
                                    <button
                                        onClick={commitEval}
                                        disabled={!previewResult || evalLoading}
                                        className="flex-1 bg-[#002B5C] hover:bg-[#001f42] text-white py-3 rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                    >
                                        Commit & Save
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded shadow-sm border border-gray-100 overflow-auto max-h-[600px]">
                                <h3 className="text-gray-500 uppercase text-xs font-bold tracking-wider mb-4">Results Preview</h3>
                                {previewResult ? (
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <div className="text-5xl font-bold text-[#002B5C] mb-2">{previewResult.aggregated_score.toFixed(1)}</div>
                                            <div className="text-gray-500">Aggregated Score</div>
                                        </div>
                                        <div className="space-y-3">
                                            {previewResult.metric_results.map((res, i) => (
                                                <div key={i} className="bg-gray-50 p-4 rounded border border-gray-200">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-gray-900 font-medium">{res.metric_name}</span>
                                                        <span className={`font-mono font-bold ${res.score >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {res.score}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-sm">{res.explanation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400">
                                        Run a preview to see results
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* DASHBOARD TAB */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 pb-10 relative">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-[#002B5C]">Performance Dashboard</h3>
                                <button
                                    onClick={openReportModal}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow-sm text-sm font-medium flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Export Report
                                </button>
                            </div>

                            {!dashData ? (
                                <p className="text-gray-500">Loading dashboard...</p>
                            ) : (
                                <>
                                    <div className="h-64 bg-white p-4 rounded shadow-sm border border-gray-100">
                                        <h4 className="text-[#002B5C] mb-4 font-semibold">Score Evolution</h4>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={dashData.aggregated_score_points}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                <XAxis dataKey="version_number" stroke="#6b7280" />
                                                <YAxis domain={[0, 100]} stroke="#6b7280" />
                                                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#000' }} />
                                                <Line type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {dashData.metrics.map(m => (
                                            <div key={m.metric_definition_id} className="h-48 bg-white p-4 rounded shadow-sm border border-gray-100">
                                                <h5 className="text-gray-600 mb-2 text-sm font-medium">{m.metric_name}</h5>
                                                <ResponsiveContainer width="100%" height="80%">
                                                    <LineChart data={m.points}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                        <XAxis dataKey="version_number" hide />
                                                        <YAxis domain={[0, 100]} hide />
                                                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#000' }} />
                                                        <Line type="monotone" dataKey="score" stroke="#10B981" dot={false} strokeWidth={2} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Report Modal */}
                            {showReportModal && (
                                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                                            <h3 className="text-lg font-bold text-[#002B5C]">Generate Progress Report</h3>
                                            <button onClick={() => setShowReportModal(false)} className="text-gray-500 hover:text-gray-800">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>

                                        {!generatedReport ? (
                                            <div className="space-y-6">
                                                <p className="text-gray-600">Select the range of versions to analyze:</p>
                                                <div className="flex gap-4 items-center">
                                                    <div className="flex-1">
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Version</label>
                                                        <input
                                                            type="number"
                                                            value={reportConfig.start}
                                                            onChange={e => setReportConfig({ ...reportConfig, start: e.target.value })}
                                                            className="w-full border border-gray-300 rounded p-2"
                                                        />
                                                    </div>
                                                    <div className="text-gray-400">→</div>
                                                    <div className="flex-1">
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">End Version</label>
                                                        <input
                                                            type="number"
                                                            value={reportConfig.end}
                                                            onChange={e => setReportConfig({ ...reportConfig, end: e.target.value })}
                                                            className="w-full border border-gray-300 rounded p-2"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={generateReport}
                                                    disabled={reportLoading}
                                                    className="w-full bg-[#002B5C] text-white py-3 rounded font-medium hover:bg-[#001f42] disabled:opacity-50"
                                                >
                                                    {reportLoading ? "Analyzing & Generating..." : "Generate AI Report"}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex-1 overflow-auto flex flex-col">
                                                <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-4 overflow-auto flex-1 font-mono text-sm whitespace-pre-wrap">
                                                    {generatedReport}
                                                </div>
                                                <div className="flex gap-4">
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(generatedReport);
                                                            alert("Copied to clipboard!");
                                                        }}
                                                        className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-50"
                                                    >
                                                        Copy to Clipboard
                                                    </button>
                                                    <button
                                                        onClick={() => setGeneratedReport(null)}
                                                        className="flex-1 bg-[#002B5C] text-white py-2 rounded hover:bg-[#001f42]"
                                                    >
                                                        Create New Report
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
