import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import Layout from "./Layout";

export default function ProjectDetail() {
    const [match, params] = useRoute("/projects/:id");
    const id = params?.id;

    const [project, setProject] = useState(null);
    const [testCases, setTestCases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        Promise.all([
            fetch(`http://localhost:8000/api/v1/projects/${id}`).then(res => res.json()),
            fetch(`http://localhost:8000/api/v1/projects/${id}/testcases`).then(res => res.json())
        ]).then(([projData, tcData]) => {
            setProject(projData);
            setTestCases(tcData);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [id]);

    if (loading) return <Layout title="Loading..."><div className="text-gray-400">Loading...</div></Layout>;
    if (!project) return <Layout title="Error"><div className="text-red-400">Project not found</div></Layout>;

    return (
        <Layout title={project.name}>
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Project Header */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-2">About</h3>
                    <p className="text-gray-400">{project.description || "No description provided."}</p>
                </div>

                {/* Test Cases Section */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-white">Test Cases</h3>
                        <Link href={`/projects/${id}/testcases/new`}>
                            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded shadow transition-colors text-sm">
                                + New Test Case
                            </button>
                        </Link>
                    </div>

                    {testCases.length === 0 ? (
                        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700 border-dashed">
                            <p className="text-gray-400 mb-4">No test cases yet.</p>
                            <Link href={`/projects/${id}/testcases/new`}>
                                <span className="text-blue-400 hover:underline cursor-pointer">Create your first test case</span>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {testCases.map(tc => (
                                <Link key={tc.id} href={`/testcases/${tc.id}`}>
                                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-blue-500 hover:bg-gray-750 cursor-pointer transition-all flex justify-between items-center group">
                                        <div>
                                            <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                                                {tc.name}
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">{tc.description}</div>
                                        </div>
                                        <span className="text-gray-600 group-hover:text-blue-400">→</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
