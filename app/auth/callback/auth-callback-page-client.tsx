"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useAction } from "next-safe-action/hooks";

import { linkCustomerToBarbershopFromCookie } from "@/actions/link-customer-to-barbershop-from-cookie";

const getSafeCallbackUrl = (callbackUrl: string | null) => {
  if (!callbackUrl) {
    return "/";
  }

  if (!callbackUrl.startsWith("/")) {
    return "/";
  }

  if (callbackUrl.startsWith("//")) {
    return "/";
  }

  return callbackUrl;
};

const AuthCallbackPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRunRef = useRef(false);
  const callbackUrl = useMemo(() => {
    return getSafeCallbackUrl(searchParams.get("callbackUrl"));
  }, [searchParams]);

  const { executeAsync } = useAction(linkCustomerToBarbershopFromCookie);

  useEffect(() => {
    if (hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;

    const runPostAuthFlow = async () => {
      try {
        await executeAsync();
      } catch {
        // No-op.
      } finally {
        router.replace(callbackUrl);
      }
    };

    void runPostAuthFlow();
  }, [callbackUrl, executeAsync, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Finalizando autenticacao...
      </div>
    </main>
  );
};

export default AuthCallbackPage;
