import { useEffect, useState, useRef } from "react";
import { Link, useRoute, useLocation } from "wouter";
import Layout from "./Layout";

export default function ProjectDetail() {
    const [match, params] = useRoute("/projects/:id");
    const [, setLocation] = useLocation();
    const id = params?.id;

    const [project, setProject] = useState(null);
    const [testCases, setTestCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, []);

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

    const handleDeleteTestCase = async (e, tcId) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this test case?")) return;

        try {
            const res = await fetch(`http://localhost:8000/api/v1/testcases/${tcId}`, { method: "DELETE" });
            if (res.ok) {
                setTestCases(prev => prev.filter(tc => tc.id !== tcId));
            } else {
                alert("Failed to delete test case");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting test case");
        }
        setOpenMenuId(null);
    };

    if (loading) return <Layout title="Loading..."><div className="text-gray-400">Loading...</div></Layout>;
    if (!project) return <Layout title="Error"><div className="text-red-400">Project not found</div></Layout>;

    return (
        <Layout title={project.name}>
            <div className="space-y-8">

                {/* Project Header */}
                <div>
                    <Link href="/projects">
                        <button className="text-gray-500 hover:text-gray-800 mb-4 flex items-center gap-1 text-sm font-medium">
                            ← Back to Projects
                        </button>
                    </Link>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-[#002B5C] mb-2">About</h3>
                        <p className="text-gray-500">{project.description || "No description provided."}</p>
                    </div>
                </div>

                {/* Test Cases Section */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-[#002B5C]">Test Cases</h3>
                        <Link href={`/projects/${id}/testcases/new`}>
                            <button className="bg-[#002B5C] hover:bg-[#001f42] text-white px-4 py-2 rounded shadow-sm transition-colors text-sm font-medium">
                                + New Test Case
                            </button>
                        </Link>
                    </div>

                    {testCases.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 border-dashed">
                            <p className="text-gray-400 mb-4">No test cases yet.</p>
                            <Link href={`/projects/${id}/testcases/new`}>
                                <span className="text-[#002B5C] font-semibold hover:underline cursor-pointer">Create your first test case</span>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {testCases.map(tc => (
                                <div
                                    key={tc.id}
                                    onClick={() => setLocation(`/testcases/${tc.id}`)}
                                    className="bg-white p-4 rounded-lg border border-gray-100 hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all flex justify-between items-center group relative"
                                >
                                    <div>
                                        <div className="font-semibold text-[#002B5C] group-hover:text-blue-600 transition-colors">
                                            {tc.name}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">{tc.description}</div>
                                    </div>

                                    {/* Actions */}
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === tc.id ? null : tc.id);
                                            }}
                                            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                                        >
                                            {/* Three dots icon */}
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                            </svg>
                                        </button>

                                        {/* Dropdown Menu */}
                                        {openMenuId === tc.id && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-10 animate-in fade-in zoom-in-95 duration-100">
                                                <button
                                                    onClick={(e) => handleDeleteTestCase(e, tc.id)}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout >
    );
}
