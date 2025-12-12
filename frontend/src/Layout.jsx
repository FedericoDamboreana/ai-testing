import { Link, useLocation } from "wouter";

export default function Layout({ children, title }) {
    const [location] = useLocation();

    const navItems = [
        { label: "Projects", path: "/" },
        { label: "Settings", path: "/settings" },
    ];

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

                <div className="p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-xs font-bold text-white">
                            JS
                        </div>
                        <div>
                            <div className="text-sm font-medium">Jane Stanley</div>
                            <div className="text-xs text-blue-300">Admin</div>
                        </div>
                    </div>
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
