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
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [previewResult, setPreviewResult] = useState(null);
    const [evalLoading, setEvalLoading] = useState(false);
    const [fileProcessing, setFileProcessing] = useState(false);
    const fileInputRef = useRef(null);

    // Helper to extract text (Reused from NewTestCase)
    const extractText = async (file) => {
        let text = "";
        if (file.type === "application/pdf") {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map((item) => item.str).join(" ") + "\\n";
            }
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            text = result.value;
        } else if (file.name.toLowerCase().endsWith(".doc") || file.type === "application/msword") {
            // Backend extraction for legacy .doc
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/v1/tools/text-extraction", {
                method: "POST",
                body: formData
            });
            if (!res.ok) throw new Error("Failed to extract text from .doc");
            const data = await res.json();
            text = data.text;
        } else {
            // Plain text
            text = await file.text();
        }
        return { name: file.name, content: text };
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setFileProcessing(true);
        try {
            const newFiles = await Promise.all(files.map(extractText));
            setUploadedFiles(prev => [...prev, ...newFiles]);
        } catch (err) {
            console.error("File parse error", err);
            alert("Error parsing file. Ensure it is a valid text, PDF, or Docx file.");
        } finally {
            setFileProcessing(false);
            // Reset input so same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const removeFile = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Dashboard State
    const [dashData, setDashData] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportConfig, setReportConfig] = useState({ start: 1, end: 1 });
    const [generatedReport, setGeneratedReport] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);

    useEffect(() => {
        if (id) {
            fetch(`/api/v1/testcases/${id}`)
                .then(res => res.json())
                .then(setTestCase)
                .catch(console.error);

            loadDashboard();
        }
    }, [id]);

    const loadDashboard = () => {
        if (!id) return;
        fetch(`/api/v1/testcases/${id}/runs`)
            .then(res => res.json())
            .then(runs => {
                fetch(`/api/v1/testcases/${id}/dashboard`)
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
        if (uploadedFiles.length === 0) {
            alert("Please upload at least one file.");
            return;
        }
        setEvalLoading(true);
        try {
            const res = await fetch(`/api/v1/testcases/${id}/evaluate/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outputs: uploadedFiles.map(f => f.content) })
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
            const res = await fetch(`/api/v1/testcases/${id}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_version: parseInt(reportConfig.start),
                    end_version: parseInt(reportConfig.end),
                    format: "docx"
                })
            });
            if (!res.ok) throw new Error("Failed to generate report");

            // Handle file download
            const blob = await res.blob();
            // Try to extract filename from content-disposition
            const disposition = res.headers.get('Content-Disposition');
            let filename = `Report_TestCase_${id}.docx`;
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            setGeneratedReport("Report downloaded successfully! Check your downloads folder.");
        } catch (e) {
            console.error(e);
            alert("Error generating report");
        }
        setReportLoading(false);
    };

    const deleteMetric = async (metricId) => {
        if (!confirm("Are you sure you want to delete this metric? This cannot be undone.")) return;
        try {
            const res = await fetch(`/api/v1/metrics/${metricId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                // Remove from local state
                setTestCase(prev => ({
                    ...prev,
                    metrics: prev.metrics.filter(m => m.id !== metricId)
                }));
            } else {
                alert("Failed to delete metric");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting metric");
        }
    };

    const commitEval = async () => {
        if (uploadedFiles.length === 0) {
            alert("Please upload at least one file.");
            return;
        }
        setEvalLoading(true);
        try {
            await fetch(`/api/v1/testcases/${id}/evaluate/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    outputs: uploadedFiles.map(f => f.content),
                    notes: "Manual run via UI with files: " + uploadedFiles.map(f => f.name).join(", ")
                })
            });
            alert("Evaluation Committed! Version bumped.");
            setPreviewResult(null);
            setUploadedFiles([]);
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
                                        <div key={i} className="bg-white p-4 rounded border border-gray-200 hover:border-blue-300 transition-colors relative group">
                                            <div className="flex justify-between items-start mb-2 pr-8">
                                                <span className="font-bold text-gray-800">{m.name}</span>
                                                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{m.metric_type}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">{m.description}</p>
                                            <div className="text-xs text-gray-500 flex gap-4">
                                                <span>Target: {m.target_direction}</span>
                                                {m.scale_type === 'bounded' && <span>Scale: {m.scale_min}-{m.scale_max}</span>}
                                            </div>
                                            <button
                                                onClick={() => deleteMetric(m.id)}
                                                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete Metric"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
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
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-[#002B5C] font-medium">Files to Evaluate</h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
                                                disabled={fileProcessing}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                {fileProcessing ? "Processing..." : "Add Files"}
                                            </button>
                                            <input
                                                type="file"
                                                hidden
                                                multiple
                                                ref={fileInputRef}
                                                accept=".txt,.pdf,.docx,.doc"
                                                onChange={handleFileUpload}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded p-4 overflow-auto">
                                        {uploadedFiles.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                                <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                <p>No files uploaded yet.</p>
                                                <p className="text-xs">Upload .txt, .pdf, or .docx files to begin evaluation.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {uploadedFiles.map((file, index) => (
                                                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="bg-blue-100 text-blue-700 p-2 rounded">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                            </div>
                                                            <div className="truncate">
                                                                <div className="font-medium text-gray-700 truncate text-sm" title={file.name}>{file.name}</div>
                                                                <div className="text-xs text-gray-400">{file.content.length} chars</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeFile(index)}
                                                            className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                                                            title="Remove file"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={runPreview}
                                        disabled={evalLoading || uploadedFiles.length === 0}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded border border-gray-300 font-medium disabled:opacity-50 transition-colors"
                                    >
                                        Preview Score
                                    </button>
                                    <button
                                        onClick={commitEval}
                                        disabled={!previewResult || evalLoading}
                                        className="flex-1 bg-[#002B5C] hover:bg-[#001f42] text-white py-3 rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
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
                                                    {reportLoading ? "Generating..." : "Download Word Report"}
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
