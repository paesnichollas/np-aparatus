import { BotMessageSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "./ui/button";
import MenuSheet from "./menu-sheet";
import ThemeToggle from "./theme-toggle";

interface HeaderProps {
  logoUrl?: string | null;
  homeHref?: string;
  showDirectoryLinks?: boolean;
}

const Header = ({
  logoUrl,
  homeHref = "/",
  showDirectoryLinks = true,
}: HeaderProps) => {
  const sanitizedLogoUrl = logoUrl?.trim();
  const isDefaultLogo = !sanitizedLogoUrl;
  const logoSrc = sanitizedLogoUrl ?? "/logo.svg";

  return (
    <header className="bg-background flex items-center justify-between px-5 py-6">
      <Link href={homeHref}>
        <Image
          src={logoSrc}
          alt="Aparatus"
          width={91}
          height={24}
          className={isDefaultLogo ? "dark:brightness-0 dark:invert" : ""}
        />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link href="/chat">
          <Button variant="outline" size="icon">
            <BotMessageSquare className="size-5" />
          </Button>
        </Link>
        <MenuSheet
          homeHref={homeHref}
          showDirectoryLinks={showDirectoryLinks}
        />
      </div>
    </header>
  );
};

export default Header;
