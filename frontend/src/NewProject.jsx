import { useState } from "react";
import { useLocation } from "wouter";
import Layout from "./Layout";

export default function NewProject() {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [_, setLocation] = useLocation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("http://localhost:8000/api/v1/projects/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description }),
            });

            if (res.ok) {
                const data = await res.json();
                setLocation(`/projects/${data.id}`);
            } else {
                alert("Failed to create project");
            }
        } catch (err) {
            console.error(err);
            alert("Error creating project");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="New Project">
            <div className="max-w-2xl mx-auto mt-10">
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Project Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                            placeholder="e.g. Finance Chatbot Eval"
                        />
                    </div>

                    <div className="mb-8">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 h-32 bg-white"
                            placeholder="What is this project testing?"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setLocation("/")}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-[#002B5C] hover:bg-[#001f42] text-white px-6 py-2 rounded-md font-medium shadow-sm transition-colors disabled:opacity-50"
                        >
                            {loading ? "Creating..." : "Create Project"}
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
}
