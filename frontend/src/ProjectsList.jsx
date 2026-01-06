import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { fetchWithAuth } from "./AuthContext";
import Layout from "./Layout";

export default function ProjectsList() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [, setLocation] = useLocation();

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, []);

    useEffect(() => {
        fetchWithAuth("/api/v1/projects/")
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setProjects(data);
                    } else {
                        console.error("Expected array but got:", data);
                        setProjects([]);
                    }
                } else {
                    console.error("Failed to fetch projects", res.status);
                    // Handle 401 specifically if needed, though fetchWithAuth might.
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setProjects([]);
                setLoading(false);
            });
    }, []);

    const handleDeleteProject = async (e, pId) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this project?")) return;

        try {
            const res = await fetchWithAuth(`/api/v1/projects/${pId}`, { method: "DELETE" });
            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== pId));
            } else {
                alert("Failed to delete project");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting project");
        }
        setOpenMenuId(null);
    };

    return (
        <Layout title="All Projects">
            <div className="max-w-6xl mx-auto">
                {/* Controls */}
                <div className="flex justify-between items-center mb-8">
                    <div className="relative w-96">
                        <input
                            type="text"
                            placeholder="Search by project name..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="flex gap-4">
                        <Link href="/projects/new">
                            <button className="bg-[#002B5C] hover:bg-[#001f42] text-white px-6 py-2 rounded-md transition-colors text-sm font-medium">
                                + New Project
                            </button>
                        </Link>
                    </div>
                </div>

                {loading ? (
                    <div className="text-gray-400">Loading projects...</div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-lg border border-gray-200 border-dashed">
                        <p className="text-gray-400 mb-4">No projects found.</p>
                        <Link href="/projects/new">
                            <span className="text-[#002B5C] font-semibold hover:underline cursor-pointer">Create your first project</span>
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-visible">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <div className="col-span-6">Project Name</div>
                            <div className="col-span-4">Description</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        {/* Rows */}
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => setLocation(`/projects/${project.id}`)}
                                className={`grid grid-cols-12 gap-4 px-6 py-5 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors cursor-pointer group relative ${openMenuId === project.id ? "z-50" : "z-0"}`}
                            >
                                <div className="col-span-6 font-semibold text-[#002B5C] text-lg">
                                    {project.name}
                                </div>
                                <div className="col-span-4 text-sm text-gray-500 truncate pr-4">
                                    {project.description}
                                </div>
                                <div className="col-span-2 flex justify-end gap-2 relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(openMenuId === project.id ? null : project.id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                        </svg>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {openMenuId === project.id && (
                                        <div className="absolute right-0 mt-8 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-10 animate-in fade-in zoom-in-95 duration-100">
                                            <button
                                                onClick={(e) => handleDeleteProject(e, project.id)}
                                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Delete Project
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
