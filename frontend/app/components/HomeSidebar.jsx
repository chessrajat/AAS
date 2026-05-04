"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ChevronUp,
  Cpu,
  FolderKanban,
  LogOut,
  Moon,
  Pickaxe,
  ShieldUser,
  Sun,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "../stores/authStore";

export default function HomeSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const canManageUsers = useAuthStore((state) => state.canManageUsers);
  const permissionsLoaded = useAuthStore((state) => state.permissionsLoaded);
  const resolveUserManagementAccess = useAuthStore(
    (state) => state.resolveUserManagementAccess,
  );
  const logoutWithApi = useAuthStore((state) => state.logoutWithApi);
  const { resolvedTheme, setTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isThemeMounted, setIsThemeMounted] = useState(false);
  const isProjects = pathname === "/" || pathname.startsWith("/projects/");
  const isModels = pathname === "/models";
  const isTraining = pathname === "/training";
  const isUsers = pathname === "/users";
  const isDarkTheme = resolvedTheme === "dark";

  useEffect(() => {
    setIsThemeMounted(true);
  }, []);

  useEffect(() => {
    if (!accessToken || permissionsLoaded) {
      return;
    }
    resolveUserManagementAccess();
  }, [accessToken, permissionsLoaded, resolveUserManagementAccess]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    await logoutWithApi();
    setIsLoggingOut(false);
    toast.success("Logged out");
    router.replace("/login");
  };

  const handleThemeToggle = () => {
    setTheme(isDarkTheme ? "light" : "dark");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-2 px-3 py-4">
          <div className="flex items-center gap-2 text-sm font-bold uppercase text-foreground">
            <Image src="/app-icon.svg" alt="" width={28} height={28} className="border border-border" />
            <span className="group-data-[collapsible=icon]:hidden">AAS</span>
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isProjects}>
                    <Link href="/">
                      <FolderKanban />
                      <span>Projects</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isModels}>
                    <Link href="/models">
                      <Cpu />
                      <span>Models</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isTraining}>
                    <Link href="/training">
                      <Pickaxe />
                      <span>Training</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {canManageUsers ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isUsers}>
                      <Link href="/users">
                        <ShieldUser />
                        <span>User Management</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                onClick={handleThemeToggle}
                title={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
              >
                {isThemeMounted && isDarkTheme ? <Sun /> : <Moon />}
                <span>
                  {isThemeMounted && isDarkTheme ? "Light theme" : "Dark theme"}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <UserCircle2 />
                    <span>Profile</span>
                    <ChevronUp className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-44">
                  <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
                    <LogOut />
                    <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarRail />
    </>
  );
}
