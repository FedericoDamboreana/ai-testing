import { Link, useLocation } from "wouter";
import { useAuth } from "./AuthContext";

export default function Layout({ children, title }) {
    const [location] = useLocation();
    const { user, logout } = useAuth();

    const navItems = [
        { label: "Projects", path: "/" },
        { label: "Settings", path: "/settings" },
    ];

    if (!user) return null; // Or skeleton

    const initials = user.full_name ? user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) : user.email.substring(0, 2).toUpperCase();

    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
            {/* Sidebar - Deep Navy */}
            <aside className="w-64 bg-[#002B5C] text-white flex flex-col">
                <div className="p-8">
                    <h1 className="text-2xl font-bold tracking-tight">
                        AI Eval
                    </h1>
                    <p className="text-blue-200 text-xs mt-1">by Replace</p>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map((item) => (
                        <Link key={item.path} href={item.path}>
                            <div
                                className={`block px-4 py-3 rounded-md transition-all cursor-pointer text-sm font-medium ${(location === item.path || (item.path !== "/" && location.startsWith(item.path)))
                                    ? "bg-blue-800/50 text-white border-l-4 border-blue-400"
                                    : "text-blue-100 hover:bg-blue-900/50 hover:text-white"
                                    } `}
                            >
                                {item.label}
                            </div>
                        </Link>
                    ))}
                </nav>

                <div className="p-6 border-t border-blue-800">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-xs font-bold text-white">
                            {initials}
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm font-medium truncate w-32" title={user.full_name || user.email}>{user.full_name || "User"}</div>
                            <div className="text-xs text-blue-300 truncate w-32" title={user.email}>{user.email}</div>
                        </div>
                    </div>
                    <button onClick={logout} className="text-xs text-blue-300 hover:text-white flex items-center gap-1 w-full mt-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main Content - Light */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#F8F9FA]">
                {/* Header - Transparent/Minimal */}
                <header className="h-20 flex items-center px-10 border-b border-gray-200 bg-white">
                    <h2 className="text-2xl font-bold text-[#002B5C]">{title}</h2>
                </header>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-auto p-10">
                    {children}
                </div>
            </main>
        </div>
    );
}

