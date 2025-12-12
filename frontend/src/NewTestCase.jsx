import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import Layout from "./Layout";

export default function NewTestCase() {
    const [match, params] = useRoute("/projects/:id/testcases/new");
    const projectId = params?.id;

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [, setLocation] = useLocation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`http://localhost:8000/api/v1/projects/${projectId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description }),
            });

            if (res.ok) {
                const data = await res.json();
                setLocation(`/testcases/${data.id}`);
            } else {
                alert("Failed to create test case");
            }
        } catch (err) {
            console.error(err);
            alert("Error creating test case");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="New Test Case">
            <div className="max-w-2xl mx-auto mt-10">
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Test Case Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                            placeholder="e.g. Greeting Tests"
                        />
                    </div>

                    <div className="mb-8">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 h-32 bg-white"
                            placeholder="Description of the test scenario..."
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setLocation(`/projects/${projectId}`)}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium shadow-sm transition-colors disabled:opacity-50"
                        >
                            {loading ? "Creating..." : "Create Test Case"}
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
}
