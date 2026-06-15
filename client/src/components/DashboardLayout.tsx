import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getDevLoginUrl, getLoginUrl, isDevAuthConfigured, isOAuthConfigured } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Building2, ClipboardList, LayoutDashboard, LogIn, LogOut, PanelLeft, Snowflake, ListChecks, Users, ShieldCheck, Thermometer } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { PendingApprovalBanner } from "./PendingApprovalBanner";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const menuItems = [
  { icon: LayoutDashboard, label: "Обзор", path: "/" },
  { icon: Building2, label: "Организации", path: "/organizations" },
  { icon: ClipboardList, label: "Протоколы", path: "/protocols" },
  { icon: Thermometer, label: "Управление датчиками", path: "/sensors" },
  { icon: ListChecks, label: "Шаблоны вопросов", path: "/settings/templates" },
];

const adminMenuItems = [
  { icon: ShieldCheck, label: "Компании", path: "/admin/companies" },
  { icon: Users, label: "Все пользователи", path: "/admin/users" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user, refresh } = useAuth();
  const authConfigured = isOAuthConfigured();
  const devAuthConfigured = isDevAuthConfigured();
  const [adminPassword, setAdminPassword] = useState("");
  const passwordLogin = trpc.auth.passwordLogin.useMutation({
    onSuccess: async () => {
      toast.success("Вход выполнен");
      await refresh();
      window.location.href = "/";
    },
    onError: error => toast.error(error.message || "Не удалось войти"),
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
        {/* Left: marketing panel */}
        <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_oklch(0.42_0.11_256)_0%,_oklch(0.22_0.05_256)_70%)]">
          <div className="flex items-center gap-3 z-10">
            <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur">
              <Snowflake className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-medium opacity-80">GxP Validation</div>
              <div className="text-lg font-semibold tracking-tight">ColdChain Portal</div>
            </div>
          </div>
          <div className="z-10 space-y-4 max-w-md">
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              Протоколы IQ · OQ · PV
              <span className="block text-white/70">за одну сессию</span>
            </h2>
            <p className="text-white/70 leading-relaxed">
              Автоматическое формирование профессиональных протоколов квалификации и валидации
              холодильного оборудования в соответствии с практиками GDP / GSP.
            </p>
          </div>
          <div className="z-10 text-xs text-white/50">
            © {new Date().getFullYear()} ColdChain Validation Portal
          </div>
          {/* decorative */}
          <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute right-20 top-20 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Right: sign-in card */}
        <div className="flex items-center justify-center p-6 bg-background">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Готов к работе
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Вход в портал</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Используйте аккаунт Google для безопасного входа. На первом входе профиль будет
                создан автоматически — ваши данные изолированы и доступны только вам.
              </p>
            </div>
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              disabled={!authConfigured}
              size="lg"
              className="w-full h-11 shadow-sm"
            >
              {authConfigured ? "Войти через Google" : "OAuth не настроен"}
            </Button>
            <form
              className="space-y-3"
              onSubmit={event => {
                event.preventDefault();
                passwordLogin.mutate({ password: adminPassword });
              }}
            >
              <Input
                type="password"
                value={adminPassword}
                onChange={event => setAdminPassword(event.target.value)}
                placeholder="Пароль администратора"
                autoComplete="current-password"
                className="h-11"
              />
              <Button
                type="submit"
                variant={authConfigured ? "outline" : "default"}
                size="lg"
                className="w-full h-11"
                disabled={!adminPassword.trim() || passwordLogin.isPending}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {passwordLogin.isPending ? "Входим..." : "Войти как администратор"}
              </Button>
            </form>
            {devAuthConfigured && (
              <Button
                onClick={() => (window.location.href = getDevLoginUrl())}
                variant="outline"
                size="lg"
                className="w-full h-11"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Войти локально
              </Button>
            )}
            {!authConfigured && !devAuthConfigured && (
              <p className="text-xs text-amber-600">
                Для входа задайте VITE_OAUTH_PORTAL_URL, VITE_APP_ID и OAUTH_SERVER_URL.
              </p>
            )}
            {!authConfigured && devAuthConfigured && (
              <p className="text-xs text-amber-600">
                Google OAuth не настроен. Для тестирования доступен локальный вход.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Продолжая, вы подтверждаете, что несёте ответственность за корректность данных,
              используемых для формирования регуляторных документов.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin";
  const allItems = [...menuItems, ...(isAdmin ? adminMenuItems : [])];
  const activeMenuItem = allItems.find(item => location === item.path || location.startsWith(item.path + "/"));
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <button
                  onClick={() => setLocation("/")}
                  className="flex items-center gap-2 min-w-0 text-left"
                >
                  <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Snowflake className="h-4 w-4" />
                  </div>
                  <div className="leading-tight min-w-0">
                    <div className="text-[13px] font-semibold tracking-tight truncate">
                      ColdChain Portal
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      Валидация GDP / GSP
                    </div>
                  </div>
                </button>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-2 gap-0.5">
              {menuItems.map(item => {
                const isActive =
                  location === item.path ||
                  (item.path !== "/" && location.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            {isAdmin && (
              <>
                {!isCollapsed && (
                  <div className="px-4 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Администратор</p>
                  </div>
                )}
                <SidebarMenu className="px-2 pb-2 gap-0.5">
                  {adminMenuItems.map(item => {
                    const isActive =
                      location === item.path ||
                      (item.path !== "/" && location.startsWith(item.path));
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-9 transition-all font-normal"
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "—"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Выйти</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Меню"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1"><PendingApprovalBanner />{children}</main>
      </SidebarInset>
    </>
  );
}
