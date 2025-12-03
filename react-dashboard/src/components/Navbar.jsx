import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
    const location = useLocation();

    // 현재 경로가 활성화되었는지 확인하는 헬퍼 함수
    const isActive = (path) => location.pathname === path;

    return (
        <header className="px-4 py-4 md:px-8 lg:px-12 bg-[#101923] shadow-md border-b border-gray-800">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center space-x-8">
                    {/* Logo */}
                    <Link to="/" className="flex items-center space-x-2 group">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-7 h-7 text-blue-500 group-hover:text-blue-400 transition-colors">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9.75 9.75m0 0l-3 7.5c0 .712.118 1.412.358 2.072m3.193-9.52c.24-.66.358-1.36.358-2.072M2.25 18.75l7.5-3m6.75 3l7.5-3m-15-6l7.5-3m7.5 3l-7.5 3m-12 3.75v-1.5a1.5 1.5 0 013 0v1.5m-3 0V21a3 3 0 003 3h.75m-9-6h2.25m-1.5 0H7.5m-1.5 0V5.25A2.25 2.25 0 017.5 3h.75m0-1.5h.75m-7.5 0h.75M9 16.5V21a3 3 0 003 3h.75m-9-6h2.25m-1.5 0H7.5m-1.5 0V5.25A2.25 2.25 0 017.5 3h.75m0-1.5h.75M9 16.5V21a3 3 0 003 3h.75" />
                        </svg>
                        <h4 className="text-xl font-bold text-white tracking-tight">Attention</h4>
                    </Link>

                    {/* Navigation Links */}
                    <nav className="hidden md:flex items-center space-x-1">
                        <Link
                            to="/session"
                            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${isActive('/session')
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            세션 시작
                        </Link>
                        <Link
                            to="/reports"
                            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${isActive('/reports')
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            보고서 확인
                        </Link>
                    </nav>
                </div>

                {/* Right Side (Optional: User Profile, etc.) */}
                <div className="flex items-center">
                    {/* Mobile Menu Button could go here */}
                </div>
            </div>
        </header>
    );
}

export default Navbar;
