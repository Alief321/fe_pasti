import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, AlertCircle, CheckSquare, Sparkles, PanelLeftClose, PanelLeftOpen, Code2, LogOut, Users } from 'lucide-react';

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
    <aside className={`relative flex h-full flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-72'}`}>
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-5">
        {isCollapsed ? (
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30">
            <Sparkles size={18} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              {/* <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400"></p> */}
              <h1 className="text-lg font-bold text-slate-900">PASTI</h1>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          aria-label={isCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-4">
        {menus.map((menu) => {
          const isActive = location.pathname === menu.path;

          return (
            <Link
              key={menu.path}
              to={menu.path}
              className={`group flex items-center rounded-2xl px-3 py-3 transition-all ${isActive ? 'bg-sky-50 text-sky-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} ${isCollapsed ? 'justify-center' : 'gap-3'}`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? 'bg-white text-sky-700 shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>{menu.icon}</span>
              {!isCollapsed && <span className="text-sm font-medium">{menu.name}</span>}
            </Link>
          );
        })}
      </nav>

      {isAuthenticated && (
        <div className="mx-3 mb-4 mt-auto">
          <Link to="/logout" className={`group flex items-center rounded-2xl px-3 py-3 text-slate-600 transition hover:bg-red-50 hover:text-red-600 ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <LogOut size={18} />
            </span>
            {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
          </Link>
        </div>
      )}
    </aside>
  );
}
