import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Layout from "./Layout";

export default function TestCaseDetail() {
    const [match, params] = useRoute("/testcases/:id");
    const id = params?.id;
    const [activeTab, setActiveTab] = useState("examples");
    const [testCase, setTestCase] = useState(null);

    // Metric Design State
    const [userIntent, setUserIntent] = useState("");
    const [designLoading, setDesignLoading] = useState(false);
    const [metricProposal, setMetricProposal] = useState(null);

    // Evaluation State
    const [evalOutput, setEvalOutput] = useState("");
    const [previewResult, setPreviewResult] = useState(null);
    const [evalLoading, setEvalLoading] = useState(false);

    // Dashboard State
    const [dashData, setDashData] = useState(null);

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
        fetch(`http://localhost:8000/api/v1/testcases/${id}/dashboard`)
            .then(res => res.json())
            .then(setDashData)
            .catch(console.error);
    };

    const generateMetrics = async () => {
        setDesignLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/v1/testcases/${id}/metric-design`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_intent: userIntent })
            });
            const data = await res.json();
            setMetricProposal(data);
        } catch (e) { console.error(e); alert("Error generating metrics"); }
        setDesignLoading(false);
    };

    const confirmMetrics = async () => {
        if (!metricProposal) return;
        setDesignLoading(true);
        try {
            await fetch(`http://localhost:8000/api/v1/testcases/${id}/metric-design/${metricProposal.id}/confirm`, { method: 'POST' });
            alert("Metrics Confirmed!");
            setMetricProposal(null);
            setActiveTab('evaluate');
        } catch (e) { console.error(e); alert("Error confirming metrics"); }
        setDesignLoading(false);
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

    if (!testCase) return <Layout title="Loading..."><div className="text-gray-400">Loading...</div></Layout>;

    return (
        <Layout title={testCase.name}>
            <div className="flex flex-col h-full">
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
                    {/* EXAMPLES TAB */}
                    {activeTab === 'examples' && (
                        <div className="max-w-3xl space-y-6">
                            <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                                <h3 className="text-lg font-medium text-[#002B5C] mb-4">Golden Examples</h3>
                                <p className="text-gray-500 mb-4">Define examples of good/bad behavior to guide the metric design.</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <textarea className="bg-gray-50 border border-gray-200 rounded p-3 text-gray-900 h-32 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Input (User Prompt)"></textarea>
                                    <textarea className="bg-gray-50 border border-gray-200 rounded p-3 text-gray-900 h-32 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ideal Output (Baseline)"></textarea>
                                </div>
                                <button className="mt-4 bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200">Save Example (Stub)</button>
                            </div>
                        </div>
                    )}

                    {/* METRICS TAB */}
                    {activeTab === 'metrics' && (
                        <div className="max-w-3xl space-y-6">
                            <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
                                <h3 className="text-lg font-medium text-[#002B5C] mb-4">Metric Design</h3>
                                <label className="block text-sm text-gray-500 mb-2">What do you want to measure?</label>
                                <textarea
                                    value={userIntent}
                                    onChange={e => setUserIntent(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded p-3 text-gray-900 h-24 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="e.g. Ensure the bot is polite and never gives financial advice."
                                ></textarea>
                                <button
                                    onClick={generateMetrics}
                                    disabled={designLoading}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded shadow-sm transition-colors"
                                >
                                    {designLoading ? "Generating..." : "Generate Metrics"}
                                </button>
                            </div>

                            {metricProposal && (
                                <div className="bg-white p-6 rounded shadow-sm border border-gray-100 animate-fade-in">
                                    <h4 className="text-[#002B5C] font-medium mb-4">Proposed Metrics</h4>
                                    <div className="space-y-4 mb-6">
                                        {JSON.parse(metricProposal.llm_proposed_metrics).map((m, i) => (
                                            <div key={i} className="bg-gray-50 p-4 rounded border border-gray-200">
                                                <div className="flex justify-between">
                                                    <span className="font-bold text-[#002B5C]">{m.name}</span>
                                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-700">{m.metric_type}</span>
                                                </div>
                                                <p className="text-gray-600 text-sm mt-1">{m.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-6">
                                        <h5 className="text-blue-800 text-sm font-bold mb-1">Gap Analysis</h5>
                                        <p className="text-blue-700 text-sm">{metricProposal.gap_analysis}</p>
                                    </div>
                                    <button
                                        onClick={confirmMetrics}
                                        disabled={designLoading}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-medium shadow-sm"
                                    >
                                        Confirm Metrics
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* EVALUATE TAB */}
                    {activeTab === 'evaluate' && (
                        <div className="grid grid-cols-2 gap-8 h-full">
                            <div className="flex flex-col gap-4">
                                <div className="bg-white p-4 rounded shadow-sm border border-gray-100 flex-1 flex flex-col">
                                    <h3 className="text-[#002B5C] font-medium mb-3">Input Output</h3>
                                    <textarea
                                        value={evalOutput}
                                        onChange={e => setEvalOutput(e.target.value)}
                                        className="flex-1 w-full bg-gray-50 border border-gray-200 rounded p-3 text-gray-900 resize-none font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="Paste the LLM output you want to evaluate here..."
                                    ></textarea>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={runPreview}
                                        disabled={evalLoading}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded border border-gray-300 font-medium"
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

                            <div className="bg-white p-6 rounded shadow-sm border border-gray-100 overflow-auto">
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
                    {activeTab === 'dashboard' && dashData && (
                        <div className="space-y-8 pb-10">
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

                            <div className="grid grid-cols-2 gap-4">
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
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
