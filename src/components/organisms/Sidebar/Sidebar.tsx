"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { NavItem } from "@/lib/navigationTypes";
import { getProgramForPath } from "@/lib/programsConfig";
import { HorizontaLDots } from "@/icons/index";
import type { AppRole } from "@/lib/programsConfig";

function renderIcon(icon: any, name: string) {
  if (!icon) return null;
  if (typeof icon === "object" && icon.src) {
    return <Image src={icon.src} alt={name} width={20} height={20} />;
  }
  if (typeof icon === "string") {
    return <Image src={icon} alt={name} width={20} height={20} />;
  }
  if (typeof icon === "function" || React.isValidElement(icon)) {
    const IconComp = icon as any;
    try {
      return <IconComp className="w-5 h-5" />;
    } catch (e) {
      return null;
    }
  }
  return null;
}

const AppSidebar: React.FC<{ userRole?: AppRole }> = ({ userRole }) => {
  const {
    isExpanded,
    isMobileOpen,
    isMobile,
    isHovered,
    setIsHovered,
    toggleMobileSidebar,
  } = useSidebar();
  const pathname = usePathname();

  // Get the current program based on pathname
  const program = getProgramForPath(pathname);

  // Filter nav items based on user role - hide adminOnly items for non-admins
  const navItems = program.navItems.filter(
    (item) => !item.adminOnly || userRole === "admin",
  );

  // Split items into regular and admin-only for grouping
  const regularItems = navItems.filter((item) => !item.adminOnly);
  const adminItems = navItems.filter((item) => item.adminOnly);

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others",
  ) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group block w-full text-left ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`flex items-center transition-colors duration-150 w-full text-left ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800"
                } ${
                  !isExpanded && !isHovered
                    ? "justify-center px-0 py-0 rounded-lg w-9 h-9"
                    : "px-3 py-2 rounded-lg"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5`}
                >
                  {renderIcon(nav.icon, nav.name)}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text ml-3`}>{nav.name}</span>
                )}
              </span>
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group block w-full text-left ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`flex items-center transition-colors duration-150 w-full text-left ${
                    isActive(nav.path)
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800"
                  } ${
                    !isExpanded && !isHovered
                      ? "justify-center px-0 py-0 rounded-lg w-9 h-9"
                      : "px-3 py-2 rounded-lg"
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5`}
                  >
                    {renderIcon(nav.icon, nav.name)}
                  </span>
                  {(isExpanded || isHovered || isMobileOpen) && (
                    <span className={`menu-item-text ml-3`}>{nav.name}</span>
                  )}
                </span>
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {},
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    let submenuMatched = false;
    navItems.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path)) {
            setOpenSubmenu({
              type: "main",
              index,
            });
            submenuMatched = true;
          }
        });
      }
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive, navItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const mobileTransformClass = isMobile
    ? isMobileOpen
      ? "translate-x-0"
      : "-translate-x-full"
    : "";

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 print:hidden"
          onClick={() => toggleMobileSidebar()}
          aria-hidden
        />
      )}

      <aside
        className={`flex-none flex flex-col px-5 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 transition-all duration-300 ease-in-out z-50 border-r border-gray-200 transform print:hidden ${mobileTransformClass} ${
          isMobile
            ? "fixed left-0 top-0 bottom-0 w-[290px]"
            : `sticky top-0 h-screen ${
                isExpanded || isMobileOpen
                  ? "w-[290px]"
                  : isHovered
                    ? "w-[290px]"
                    : "w-[90px]"
              }`
        }`}
        onMouseEnter={() => !isExpanded && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`py-8 flex justify-center items-center`}>
          <Link href="/">
            {isExpanded || isHovered || isMobileOpen ? (
              <>
                <Image
                  className="dark:hidden"
                  src="/logo.svg"
                  alt="Logo"
                  width={150}
                  height={40}
                />
                <Image
                  className="hidden dark:block"
                  src="/logo.svg"
                  alt="Logo"
                  width={150}
                  height={40}
                />
              </>
            ) : (
              <Image src="/logo.svg" alt="Logo" width={32} height={32} />
            )}
          </Link>
        </div>
        <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
          <nav className="mb-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    !isExpanded && !isHovered
                      ? "lg:justify-center"
                      : "justify-start"
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen
                    ? "Menu"
                    : renderIcon(HorizontaLDots, "dots")}
                </h2>
                {renderMenuItems(regularItems, "main")}
              </div>
              {adminItems.length > 0 && (
                <div className="mt-2">
                  <h2
                    className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                      !isExpanded && !isHovered
                        ? "lg:justify-center"
                        : "justify-start"
                    }`}
                  >
                    {isExpanded || isHovered || isMobileOpen
                      ? "Admin"
                      : renderIcon(HorizontaLDots, "dots")}
                  </h2>
                  {renderMenuItems(adminItems, "main")}
                </div>
              )}
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
