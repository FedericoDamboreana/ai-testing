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
                <div className="flex border-b border-gray-700 mb-6">
                    {['examples', 'metrics', 'evaluate', 'dashboard'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 capitalize font-medium transition-colors ${activeTab === tab
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-white'
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
                            <div className="bg-gray-800 p-6 rounded border border-gray-700">
                                <h3 className="text-lg font-medium text-white mb-4">Golden Examples</h3>
                                <p className="text-gray-400 mb-4">Define examples of good/bad behavior to guide the metric design.</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <textarea className="bg-gray-900 border border-gray-600 rounded p-3 text-white h-32" placeholder="Input (User Prompt)"></textarea>
                                    <textarea className="bg-gray-900 border border-gray-600 rounded p-3 text-white h-32" placeholder="Ideal Output (Baseline)"></textarea>
                                </div>
                                <button className="mt-4 bg-gray-700 text-white px-4 py-2 rounded">Save Example (Stub)</button>
                            </div>
                        </div>
                    )}

                    {/* METRICS TAB */}
                    {activeTab === 'metrics' && (
                        <div className="max-w-3xl space-y-6">
                            <div className="bg-gray-800 p-6 rounded border border-gray-700">
                                <h3 className="text-lg font-medium text-white mb-4">Metric Design</h3>
                                <label className="block text-sm text-gray-400 mb-2">What do you want to measure?</label>
                                <textarea
                                    value={userIntent}
                                    onChange={e => setUserIntent(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white h-24 mb-4"
                                    placeholder="e.g. Ensure the bot is polite and never gives financial advice."
                                ></textarea>
                                <button
                                    onClick={generateMetrics}
                                    disabled={designLoading}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded shadow transition-colors"
                                >
                                    {designLoading ? "Generating..." : "Generate Metrics"}
                                </button>
                            </div>

                            {metricProposal && (
                                <div className="bg-gray-800 p-6 rounded border border-gray-700 animate-fade-in">
                                    <h4 className="text-white font-medium mb-4">Proposed Metrics</h4>
                                    <div className="space-y-4 mb-6">
                                        {JSON.parse(metricProposal.llm_proposed_metrics).map((m, i) => (
                                            <div key={i} className="bg-gray-900 p-4 rounded border border-gray-600">
                                                <div className="flex justify-between">
                                                    <span className="font-bold text-blue-400">{m.name}</span>
                                                    <span className="text-xs bg-gray-700 px-2 py-1 rounded text-white">{m.metric_type}</span>
                                                </div>
                                                <p className="text-gray-300 text-sm mt-1">{m.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-blue-900/30 p-4 rounded border border-blue-800 mb-6">
                                        <h5 className="text-blue-200 text-sm font-bold mb-1">Gap Analysis</h5>
                                        <p className="text-blue-100 text-sm">{metricProposal.gap_analysis}</p>
                                    </div>
                                    <button
                                        onClick={confirmMetrics}
                                        disabled={designLoading}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded font-medium"
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
                                <div className="bg-gray-800 p-4 rounded border border-gray-700 flex-1 flex flex-col">
                                    <h3 className="text-white font-medium mb-3">Input Output</h3>
                                    <textarea
                                        value={evalOutput}
                                        onChange={e => setEvalOutput(e.target.value)}
                                        className="flex-1 w-full bg-gray-900 border border-gray-600 rounded p-3 text-white resize-none font-mono"
                                        placeholder="Paste the LLM output you want to evaluate here..."
                                    ></textarea>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={runPreview}
                                        disabled={evalLoading}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded"
                                    >
                                        Preview Score
                                    </button>
                                    <button
                                        onClick={commitEval}
                                        disabled={!previewResult || evalLoading}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Commit & Save
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-900 p-6 rounded border border-gray-800 overflow-auto">
                                <h3 className="text-gray-400 uppercase text-xs font-bold tracking-wider mb-4">Results Preview</h3>
                                {previewResult ? (
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <div className="text-5xl font-bold text-white mb-2">{previewResult.aggregated_score.toFixed(1)}</div>
                                            <div className="text-gray-500">Aggregated Score</div>
                                        </div>
                                        <div className="space-y-3">
                                            {previewResult.metric_results.map((res, i) => (
                                                <div key={i} className="bg-gray-800 p-4 rounded border border-gray-700">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-white font-medium">{res.metric_name}</span>
                                                        <span className={`font-mono font-bold ${res.score >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {res.score}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-300 text-sm">{res.explanation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-600">
                                        Run a preview to see results
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* DASHBOARD TAB */}
                    {activeTab === 'dashboard' && dashData && (
                        <div className="space-y-8 pb-10">
                            <div className="h-64 bg-gray-800 p-4 rounded border border-gray-700">
                                <h4 className="text-white mb-4">Score Evolution</h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={dashData.aggregated_score_points}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="version_number" stroke="#9CA3AF" />
                                        <YAxis domain={[0, 100]} stroke="#9CA3AF" />
                                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                                        <Line type="monotone" dataKey="score" stroke="#60A5FA" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {dashData.metrics.map(m => (
                                    <div key={m.metric_definition_id} className="h-48 bg-gray-800 p-4 rounded border border-gray-700">
                                        <h5 className="text-gray-300 mb-2">{m.metric_name}</h5>
                                        <ResponsiveContainer width="100%" height="80%">
                                            <LineChart data={m.points}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                <XAxis dataKey="version_number" hide />
                                                <YAxis domain={[0, 100]} hide />
                                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                                                <Line type="monotone" dataKey="score" stroke="#34D399" dot={false} strokeWidth={2} />
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
