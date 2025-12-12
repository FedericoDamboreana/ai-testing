import { useEffect, useState } from "react";
import { Link } from "wouter";
import Layout from "./Layout";

export default function ProjectsList() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:8000/api/v1/projects/")
            .then((res) => res.json())
            .then((data) => {
                setProjects(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

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
                        <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-600 text-sm hover:bg-gray-50 flex items-center gap-2">
                            Filter by status
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
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
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
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
                                className="grid grid-cols-12 gap-4 px-6 py-5 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors group"
                            >
                                <div className="col-span-6 font-semibold text-[#002B5C] text-lg">
                                    {project.name}
                                </div>
                                <div className="col-span-4 text-sm text-gray-500 truncate pr-4">
                                    {project.description}
                                </div>
                                <div className="col-span-2 flex justify-end gap-2">
                                    <Link href={`/projects/${project.id}`}>
                                        <button className="px-3 py-1 border border-blue-200 text-blue-600 rounded text-xs hover:bg-blue-50 font-medium">
                                            Open
                                        </button>
                                    </Link>
                                    <button className="w-8 h-8 flex items-center justify-center text-blue-900 hover:bg-gray-100 rounded-full">
                                        <span className="text-xl leading-none">+</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
