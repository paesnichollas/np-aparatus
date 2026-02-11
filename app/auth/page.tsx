import { Suspense } from "react";

import AuthPageClient from "./auth-page-client";

const AuthPageFallback = () => {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm">Carregando autenticacao...</p>
    </main>
  );
};

const AuthPage = () => {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageClient />
    </Suspense>
  );
};

export default AuthPage;
