import { requireAuthenticatedUser } from "@/lib/rbac";

const AuthenticatedLayout = async ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  await requireAuthenticatedUser();

  return children;
};

export default AuthenticatedLayout;
