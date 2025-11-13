"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import {
  BoxCubeIcon,
  CalenderIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  DollarLineIcon,
  CopyIcon,
  PlugInIcon,
  TableIcon,
  ShootingStarIcon,
} from "../icons/index";

// Helper to render an icon which may be:
// - a string URL
// - an imported asset object with a `.src` property
// - a React component (function)
function renderIcon(icon: any, name: string) {
  if (!icon) return null;
  // Imported asset (next static) often comes as { src, height, width, blurDataURL }
  if (typeof icon === "object" && icon.src) {
    return <img src={icon.src} alt={name} className="w-5 h-5" />;
  }
  if (typeof icon === "string") {
    return <img src={icon} alt={name} className="w-5 h-5" />;
  }
  if (typeof icon === "function" || React.isValidElement(icon)) {
    // If it's a component, render it.
    const IconComp = icon as any;
    try {
      // Pass sizing classes to the SVG React component when possible
      return <IconComp className="w-5 h-5" />;
    } catch (e) {
      return null;
    }
  }
  return null;
}

type NavItem = {
  name: string;
  icon: any;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: GridIcon,
    name: "Dashboard",
    path: "/dashboard",
  },
  {
    icon: ShootingStarIcon,
    name: "Users Profiles",
    path: "/profile",
  },
  {
    icon: CopyIcon,
    name: "Slabs Price List",
    path: "/slabsPriceList",
  },

  {
    name: "Forms",
    icon: ListIcon,
    subItems: [{ name: "Form Elements", path: "/form-elements", pro: false }],
  },
  {
    name: "Tables",
    icon: TableIcon,
    subItems: [{ name: "Basic Tables", path: "/basic-tables", pro: false }],
  },
  {
    name: "Pages",
    icon: PageIcon,
    subItems: [
      { name: "Blank Page", path: "/blank", pro: false },
      { name: "404 Error", path: "/error-404", pro: false },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: PieChartIcon,
    name: "Charts",
    subItems: [
      { name: "Line Chart", path: "/line-chart", pro: false },
      { name: "Bar Chart", path: "/bar-chart", pro: false },
    ],
  },
  {
    icon: BoxCubeIcon,
    name: "UI Elements",
    subItems: [
      { name: "Alerts", path: "/alerts", pro: false },
      { name: "Avatar", path: "/avatars", pro: false },
      { name: "Badge", path: "/badge", pro: false },
      { name: "Buttons", path: "/buttons", pro: false },
      { name: "Images", path: "/images", pro: false },
      { name: "Videos", path: "/videos", pro: false },
    ],
  },
  {
    icon: PlugInIcon,
    name: "Authentication",
    subItems: [
      { name: "Sign In", path: "/signin", pro: false },
      { name: "Sign Up", path: "/signup", pro: false },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    isMobile,
    isHovered,
    setIsHovered,
    toggleMobileSidebar,
  } = useSidebar();
  const pathname = usePathname();

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
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
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => path === pathname;
  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    // Check if the current path matches any submenu item
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    // If no submenu item matches, close the open submenu
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
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

  // For mobile we animate with translateX so the sidebar slides in/out
  const mobileTransformClass = isMobile
    ? isMobileOpen
      ? "translate-x-0"
      : "-translate-x-full"
    : "";

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => toggleMobileSidebar()}
          aria-hidden
        />
      )}

      <aside
        className={`flex-none flex flex-col px-5 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 transform ${mobileTransformClass} ${
          // On mobile we position it fixed to overlay the content so translateX works
          isMobile
            ? "fixed left-0 top-0 bottom-0 w-[290px]"
            : isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
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
                {renderMenuItems(navItems, "main")}
              </div>

              <div className="">
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    !isExpanded && !isHovered
                      ? "lg:justify-center"
                      : "justify-start"
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen
                    ? "Others"
                    : renderIcon(HorizontaLDots, "dots")}
                </h2>
                {renderMenuItems(othersItems, "others")}
              </div>
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
