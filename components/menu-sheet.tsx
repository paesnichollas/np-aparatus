"use client";

import {
  CalendarDays,
  Home,
  LogIn,
  LogOut,
  MenuIcon,
  Shield,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

const categories = [
  { label: "Cabelo", search: "cabelo" },
  { label: "Barba", search: "barba" },
  { label: "Acabamento", search: "acabamento" },
  { label: "Sobrancelha", search: "sobrancelha" },
  { label: "Massagem", search: "massagem" },
  { label: "Hidratacao", search: "hidratacao" },
];

interface MenuSheetProps {
  homeHref?: string;
  showDirectoryLinks?: boolean;
}

const MenuSheet = ({
  homeHref = "/",
  showDirectoryLinks = true,
}: MenuSheetProps) => {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const userRole = (user as { role?: string } | undefined)?.role;

  const handleLogout = async () => {
    const { error } = await authClient.signOut();

    if (error) {
      toast.error(error.message);
    }
  };

  const isLoggedIn = Boolean(user);
  const canAccessOwnerPanel =
    !userRole || userRole === "OWNER" || userRole === "ADMIN";
  const canAccessAdminPanel = userRole === "ADMIN";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <SheetHeader className="border-border border-b px-5 py-6 text-left">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-6">
          <div className="flex items-center justify-between px-5">
            {user ? (
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarImage src={user.image ?? ""} alt={user.name} />
                  <AvatarFallback>
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold">{user.name}</span>
                  <span className="text-muted-foreground text-sm">{user.email}</span>
                </div>
              </div>
            ) : (
              <>
                <p className="font-semibold">Ola. Faca seu login!</p>
                <Button asChild className="gap-3 rounded-full">
                  <Link href="/auth">
                    Login
                    <LogIn className="size-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-col">
            <SheetClose asChild>
              <Link
                href={homeHref}
                className="flex items-center gap-3 px-5 py-3 text-sm font-medium"
              >
                <Home className="size-4" />
                Inicio
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/bookings"
                className="flex items-center gap-3 px-5 py-3 text-sm font-medium"
              >
                <CalendarDays className="size-4" />
                Agendamentos
              </Link>
            </SheetClose>
            {isLoggedIn && canAccessOwnerPanel && (
              <SheetClose asChild>
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto justify-start rounded-none px-5 py-3 text-sm font-medium"
                >
                  <Link href="/owner">
                    <ShieldCheck className="size-4" />
                    Painel do owner
                  </Link>
                </Button>
              </SheetClose>
            )}
            {isLoggedIn && canAccessAdminPanel && (
              <SheetClose asChild>
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto justify-start rounded-none px-5 py-3 text-sm font-medium"
                >
                  <Link href="/admin">
                    <Shield className="size-4" />
                    Painel admin
                  </Link>
                </Button>
              </SheetClose>
            )}
          </div>

          <div className="border-border border-b" />

          {showDirectoryLinks && (
            <div className="flex flex-col gap-1">
              {categories.map((category) => (
                <SheetClose key={category.search} asChild>
                  <Link
                    href={`/barbershops?search=${category.search}`}
                    className="px-5 py-3 text-sm font-medium"
                  >
                    {category.label}
                  </Link>
                </SheetClose>
              ))}
            </div>
          )}

          {isLoggedIn && (
            <>
              <div className="border-border border-b" />
              <Button
                variant="ghost"
                className="justify-left w-fit text-left"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                Sair da conta
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MenuSheet;
