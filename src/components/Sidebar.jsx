import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, AlertCircle, CheckSquare, Sparkles, PanelLeftClose, PanelLeftOpen, Code2, LogIn, LogOut, Users } from 'lucide-react';

export default function Sidebar({ isCollapsed, onToggle, isAuthenticated }) {
  const location = useLocation();
  const publicMenus = [
    { name: 'Dashboard', path: '/', icon: <Home size={18} /> },
    { name: 'Penyelesaian LK', path: '/penyelesaian', icon: <CheckSquare size={18} /> },
  ];
  const protectedMenus = [
    ...publicMenus,
    { name: 'Daftar Survei', path: '/survei', icon: <ClipboardList size={18} /> },
    { name: 'Daftar Anomali', path: '/anomali', icon: <AlertCircle size={18} /> },
    { name: 'SQL Query Builder', path: '/query-builder', icon: <Code2 size={18} /> },
    { name: 'Manajemen User', path: '/users', icon: <Users size={18} /> },
  ];
  const menus = isAuthenticated ? protectedMenus : publicMenus;

  return (
    <aside 
      className={`fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] transition-all duration-300 md:relative 
      ${isCollapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0 w-72'}`}
    >
      <div className="flex h-[76px] shrink-0 items-center justify-center border-b border-slate-200/80 px-4">
        {isCollapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30 transition hover:scale-105"
            aria-label="Buka sidebar"
            title="Buka Sidebar"
          >
            <Sparkles size={18} />
          </button>
        ) : (
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30">
                <Sparkles size={18} />
              </div>
              <h1 className="text-lg font-bold text-slate-900 whitespace-nowrap">PASTI</h1>
            </div>
            
            <button
              type="button"
              onClick={onToggle}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              aria-label="Tutup sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Menghilangkan scrollbar tapi tetap bisa discroll */}
      <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {menus.map((menu) => {
          const isActive = location.pathname === menu.path;

          return (
            <Link
              key={menu.path}
              to={menu.path}
              title={isCollapsed ? menu.name : undefined}
              className={`group flex items-center rounded-2xl py-3 transition-all ${isActive ? 'bg-sky-50 text-sky-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} ${isCollapsed ? 'md:justify-center px-0' : 'px-3 gap-3'}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-white text-sky-700 shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>{menu.icon}</span>
              <span className={`text-sm font-medium whitespace-nowrap ${isCollapsed ? 'hidden' : 'block'}`}>{menu.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 mt-auto shrink-0 space-y-2">
        {isAuthenticated ? (
          <Link to="/logout" title={isCollapsed ? 'Logout' : undefined} className={`group flex items-center rounded-2xl py-3 text-slate-600 transition hover:bg-red-50 hover:text-red-600 ${isCollapsed ? 'md:justify-center px-0' : 'px-3 gap-3'}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <LogOut size={18} />
            </span>
            <span className={`text-sm font-medium whitespace-nowrap ${isCollapsed ? 'hidden' : 'block'}`}>Logout</span>
          </Link>
        ) : (
          <Link to="/login" title={isCollapsed ? 'Login' : undefined} className={`group flex items-center rounded-2xl py-3 text-slate-600 transition hover:bg-sky-50 hover:text-sky-700 ${isCollapsed ? 'md:justify-center px-0' : 'px-3 gap-3'}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <LogIn size={18} />
            </span>
            <span className={`text-sm font-medium whitespace-nowrap ${isCollapsed ? 'hidden' : 'block'}`}>Login</span>
          </Link>
        )}
      </div>
    </aside>
  );
}