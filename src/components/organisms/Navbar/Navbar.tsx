"use client";
import { useState } from "react";
import {
  Bell,
  Search,
  Sun,
  Moon,
  LogOut,
  Settings,
  User,
  HelpCircle,
  Menu,
} from "lucide-react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { programs } from "@/lib/programsConfig";

export default function Navbar({ user }: { user: any }) {
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const { toggleSidebar, toggleMobileSidebar, isMobile } = useSidebar();
  const router = useRouter();

  // Filter programs based on search term (exclude main dashboard)
  const filteredPrograms =
    searchTerm.trim().length === 0
      ? []
      : programs
          .filter((p) => p.id !== "main")
          .filter(
            (p) =>
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (p.description ?? "")
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
          );

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark");
    }
  };

  // Get initials if no picture
  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    return parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : parts[0][0] + (parts[0][1] || "");
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 grid grid-cols-[auto_1fr_auto] items-center px-6">
      {/* Search + Hamburger */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => {
            if (isMobile) toggleMobileSidebar();
            else toggleSidebar();
          }}
          aria-label="Toggle sidebar"
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="relative w-full max-w-xs flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search programs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              setTimeout(() => {
                setSearchFocused(false);
                setSearchTerm("");
              }, 150);
            }}
            className="outline-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1 text-sm text-gray-800 dark:text-gray-200 w-full"
          />
          {searchFocused && filteredPrograms.length > 0 && (
            <div
              className="absolute top-full left-0 z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg text-sm"
              onMouseDown={(e) => {
                // Prevent the input's onBlur from firing when interacting with dropdown
                e.preventDefault();
              }}
            >
              {filteredPrograms.map((program) => (
                <a
                  key={program.id}
                  href={program.basePath}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(program.basePath);
                    setSearchTerm("");
                    setSearchFocused(false);
                  }}
                  className="block px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <div className="font-medium text-gray-800 dark:text-gray-100">
                    {program.name}
                  </div>
                  {program.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {program.description}
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-5 relative justify-end">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          {darkMode ? (
            <Sun className="w-5 h-5 text-yellow-400" />
          ) : (
            <Moon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {/* Notifications */}
        <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-pointer" />

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 flex-nowrap focus:outline-none"
          >
            {user?.image ? (
              <Image
                src={user.image}
                alt="User"
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
                {getInitials(user?.name || user?.email || "U")}
              </div>
            )}
            <span className="ml-1 font-medium text-gray-700 dark:text-gray-200 hidden md:inline-block max-w-[8rem] truncate">
              {user?.name || "User"}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <p className="font-medium text-gray-800 dark:text-gray-200">
                  {user?.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
              <ul className="py-2">
                <li>
                  <a className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <User className="w-4 h-4" /> Edit Profile
                  </a>
                </li>
                <li>
                  <a className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <Settings className="w-4 h-4" /> Account Settings
                  </a>
                </li>
                <li>
                  <a className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <HelpCircle className="w-4 h-4" /> Support
                  </a>
                </li>
              </ul>
              <div className="border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
