import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Plus, Bell, LogOut, User, Settings as SettingsIcon, Smartphone } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAdminAuth, adminSignOut, roleLabel } from "@/lib/adminAuth";
import { AdminSidebar } from "./AdminSidebar";

/**
 * Sticky top bar: mobile menu trigger, global search, quick-create,
 * notifications and the admin profile menu.
 */
export function AdminHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const session = useAdminAuth();
  const account = session?.account;
  const initials = account?.name
    ? account.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "AD";

  const handleSignOut = () => {
    adminSignOut();
    toast.success("Sessão encerrada");
    navigate("/admin/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 border-border/60 p-0">
          <AdminSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Global search */}
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar usuários, treinos, exercícios…"
          className="h-10 rounded-xl border-border bg-secondary pl-10 text-sm"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Quick create */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="hidden h-10 gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90 sm:flex">
              <Plus className="h-4 w-4" /> Criar novo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Criar novo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Usuário</DropdownMenuItem>
            <DropdownMenuItem>Treino</DropdownMenuItem>
            <DropdownMenuItem>Exercício</DropdownMenuItem>
            <DropdownMenuItem>Cupom</DropdownMenuItem>
            <DropdownMenuItem>Notificação</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="icon" variant="ghost" className="sm:hidden" aria-label="Criar novo">
          <Plus className="h-5 w-5" />
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="relative" aria-label="Notificações">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex-col items-start gap-0.5">
              <span className="text-sm font-medium">2 tickets de alta prioridade</span>
              <span className="text-xs text-muted-foreground">Suporte • agora</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex-col items-start gap-0.5">
              <span className="text-sm font-medium">Receita mensal atingiu a meta 🎉</span>
              <span className="text-xs text-muted-foreground">Financeiro • há 2h</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex-col items-start gap-0.5">
              <span className="text-sm font-medium">184 usuários em risco de churn</span>
              <span className="text-xs text-muted-foreground">Retenção • hoje</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-secondary">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight md:block">
                <p className="text-sm font-semibold">{account?.name ?? "Admin"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {account ? roleLabel[account.role] : "Operação"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span>{account?.name ?? "Administrador"}</span>
              <span className="text-xs font-normal text-muted-foreground">{account?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
              <User className="mr-2 h-4 w-4" /> Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
              <SettingsIcon className="mr-2 h-4 w-4" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/")}>
              <Smartphone className="mr-2 h-4 w-4" /> Voltar ao app
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
