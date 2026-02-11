import { Suspense } from "react";

import AuthCallbackPageClient from "./auth-callback-page-client";

const AuthCallbackFallback = () => {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm">Finalizando autenticacao...</p>
    </main>
  );
};

const AuthCallbackPage = () => {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackPageClient />
    </Suspense>
  );
};

export default AuthCallbackPage;
