import { useState, useEffect } from "react";
import Layout from "./Layout";
import { fetchWithAuth } from "./AuthContext";

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preferredModel, setPreferredModel] = useState("gpt-4o");
    const [user, setUser] = useState(null);

    const availableModels = [
        { id: "gpt-5.2", name: "GPT-5.2 (Latest & Greatest)" },
        { id: "gpt-5", name: "GPT-5 (Standard)" },
        { id: "o3", name: "o3 (High Reasoning)" },
        { id: "o3-mini", name: "o3-mini (Fast Reasoning)" }
    ];

    useEffect(() => {
        fetchWithAuth("/api/v1/users/me")
            .then(res => res.json())
            .then(data => {
                setUser(data);
                if (data.preferred_model) {
                    setPreferredModel(data.preferred_model);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetchWithAuth("/api/v1/users/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preferred_model: preferredModel })
            });
            if (res.ok) {
                alert("Settings saved!");
            } else {
                alert("Failed to save settings");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving settings");
        }
        setSaving(false);
    };

    if (loading) return <Layout title="Settings">Loading...</Layout>;

    return (
        <Layout title="Settings">
            <div className="max-w-2xl bg-white p-8 rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-xl font-semibold text-[#002B5C] mb-6">Model Configuration</h3>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred LLM Model</label>
                    <p className="text-xs text-gray-500 mb-3">
                        Select the model used for metric generation and evaluation.
                        Changing this affects subsequent operations.
                    </p>
                    <div className="grid gap-3">
                        {availableModels.map(model => (
                            <label
                                key={model.id}
                                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${preferredModel === model.id
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 hover:border-blue-300"
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="model"
                                    value={model.id}
                                    checked={preferredModel === model.id}
                                    onChange={(e) => setPreferredModel(e.target.value)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-900">{model.name}</span>
                                    <span className="block text-xs text-gray-500">{model.id}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#002B5C] text-white px-4 py-2 rounded shadow-sm hover:bg-[#001f42] disabled:opacity-50 font-medium"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </Layout>
    );
}
