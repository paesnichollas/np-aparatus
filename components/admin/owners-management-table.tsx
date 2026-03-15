"use client";

import { ChangeEvent, memo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getValidationErrorMessageWithNested } from "@/lib/action-errors";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { adminSetBarbershopAccessAction } from "@/actions/admin-set-barbershop-access";
import { adminPromoteToOwnerAndAssignBarbershopAction } from "@/actions/admin-promote-to-owner-and-assign-barbershop";
import { adminUpdateUserRoleAction } from "@/actions/admin-update-user-role";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OwnersManagementTableProps {
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: "CUSTOMER" | "OWNER" | "ADMIN";
    barbershopId: string | null;
    isActive: boolean;
    ownedBarbershop: {
      id: string;
      name: string;
      isActive: boolean;
    } | null;
  }>;
  barbershopOptions: Array<{
    id: string;
    name: string;
  }>;
}

type OwnerUser = OwnersManagementTableProps["users"][number];
type UpdatableRole = "CUSTOMER" | "ADMIN";
type BarbershopAccessParams = {
  userId: string;
  barbershopId: string;
};

type OwnerUserRowProps = {
  barbershopDatalistId: string;
  isCurrentRowBusy: boolean;
  onSetBarbershopAccess: (
    params: BarbershopAccessParams & { isActive: boolean },
  ) => void;
  onPromoteToOwner: (userId: string) => void;
  onSelectedBarbershopChange: (userId: string, value: string) => void;
  onUpdateRole: (userId: string, role: UpdatableRole) => void;
  selectedBarbershopId: string;
  user: OwnerUser;
};

const OwnerUserRow = memo(
  ({
    barbershopDatalistId,
    isCurrentRowBusy,
    onSetBarbershopAccess,
    onPromoteToOwner,
    onSelectedBarbershopChange,
    onUpdateRole,
    selectedBarbershopId,
    user,
  }: OwnerUserRowProps) => {
    const ownedBarbershop = user.ownedBarbershop;

    const handleSetAdminRole = useCallback(() => {
      onUpdateRole(user.id, "ADMIN");
    }, [onUpdateRole, user.id]);

    const handleSetCustomerRole = useCallback(() => {
      onUpdateRole(user.id, "CUSTOMER");
    }, [onUpdateRole, user.id]);

    const handleBarbershopStatusChange = useCallback(() => {
      if (!ownedBarbershop) {
        return;
      }

      onSetBarbershopAccess({
        userId: user.id,
        barbershopId: ownedBarbershop.id,
        isActive: !ownedBarbershop.isActive,
      });
    }, [onSetBarbershopAccess, ownedBarbershop, user.id]);

    const handleBarbershopInputChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        onSelectedBarbershopChange(user.id, event.target.value);
      },
      [onSelectedBarbershopChange, user.id],
    );

    const handlePromoteToOwnerClick = useCallback(() => {
      onPromoteToOwner(user.id);
    }, [onPromoteToOwner, user.id]);

    return (
      <TableRow>
        <TableCell>
          <div className="space-y-1">
            <p className="font-medium">{user.name}</p>
            <p className="text-muted-foreground text-xs">{user.email}</p>
          </div>
        </TableCell>
        <TableCell>{user.role}</TableCell>
        <TableCell>
          <Badge variant={user.isActive ? "secondary" : "destructive"}>
            {user.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </TableCell>
        <TableCell>{ownedBarbershop?.name ?? "Sem ownership"}</TableCell>
        <TableCell>
          {ownedBarbershop ? (
            <Badge variant={ownedBarbershop.isActive ? "secondary" : "destructive"}>
              {ownedBarbershop.isActive ? "Ativa" : "Inativa"}
            </Badge>
          ) : (
            "-"
          )}
        </TableCell>
        <TableCell>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {user.role !== "ADMIN" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isCurrentRowBusy}
                  onClick={handleSetAdminRole}
                  data-testid={`admin-set-role-admin-${user.id}`}
                >
                  Tornar ADMIN
                </Button>
              ) : null}

              {user.role !== "CUSTOMER" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isCurrentRowBusy}
                  onClick={handleSetCustomerRole}
                  data-testid={`admin-set-role-customer-${user.id}`}
                >
                  Tornar CUSTOMER
                </Button>
              ) : null}
            </div>

            {ownedBarbershop ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant={ownedBarbershop.isActive ? "destructive" : "outline"}
                    size="sm"
                    disabled={isCurrentRowBusy}
                    data-testid={`admin-toggle-barbershop-access-${user.id}`}
                  >
                    {ownedBarbershop.isActive
                      ? "Desabilitar acesso"
                      : "Reativar acesso"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {ownedBarbershop.isActive
                        ? "Desabilitar acesso da barbearia?"
                        : "Reativar acesso da barbearia?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {ownedBarbershop.isActive
                        ? "Esta ação desabilita a barbearia, o owner e todos os clientes vinculados, além de encerrar sessões ativas."
                        : "Esta ação reativa a barbearia, o owner e todos os clientes vinculados."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBarbershopStatusChange}>
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}

            {user.role === "CUSTOMER" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="ID da barbearia"
                  value={selectedBarbershopId}
                  list={barbershopDatalistId}
                  onChange={handleBarbershopInputChange}
                  disabled={isCurrentRowBusy}
                  className="w-full md:max-w-72"
                  data-testid={`admin-owner-barbershop-input-${user.id}`}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={isCurrentRowBusy}
                  onClick={handlePromoteToOwnerClick}
                  data-testid={`admin-promote-owner-${user.id}`}
                >
                  Tornar OWNER
                </Button>
              </div>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
    );
  },
);

OwnerUserRow.displayName = "OwnerUserRow";

const OwnersManagementTable = ({
  users,
  barbershopOptions,
}: OwnersManagementTableProps) => {
  const router = useRouter();
  const [selectedBarbershopByUserId, setSelectedBarbershopByUserId] = useState<
    Record<string, string>
  >({});
  const [currentMutationUserId, setCurrentMutationUserId] = useState<string | null>(
    null,
  );

  const { executeAsync: executeUpdateUserRole, isPending: isUpdatingUserRole } =
    useAction(adminUpdateUserRoleAction);
  const {
    executeAsync: executePromoteToOwner,
    isPending: isPromotingToOwner,
  } = useAction(adminPromoteToOwnerAndAssignBarbershopAction);
  const {
    executeAsync: executeSetBarbershopAccess,
    isPending: isSettingBarbershopAccess,
  } = useAction(adminSetBarbershopAccessAction);

  const isBusy =
    isUpdatingUserRole ||
    isPromotingToOwner ||
    isSettingBarbershopAccess;

  const handleUpdateRole = useCallback(
    async (userId: string, role: UpdatableRole) => {
      setCurrentMutationUserId(userId);

      const result = await executeUpdateUserRole({
        userId,
        role,
      });

      const validationError = getValidationErrorMessageWithNested(result.validationErrors);

      if (validationError) {
        toast.error(validationError);
        setCurrentMutationUserId(null);
        return;
      }

      if (result.serverError || !result.data) {
        toast.error("Falha ao atualizar papel do usuário.");
        setCurrentMutationUserId(null);
        return;
      }

      toast.success("Papel do usuário atualizado.");
      setCurrentMutationUserId(null);
      router.refresh();
    },
    [executeUpdateUserRole, router],
  );

  const handlePromoteToOwner = useCallback(
    async (userId: string) => {
      const selectedBarbershopId = selectedBarbershopByUserId[userId]?.trim();

      if (!selectedBarbershopId) {
        toast.error("Informe a barbearia para promover o usuário a owner.");
        return;
      }

      setCurrentMutationUserId(userId);

      const result = await executePromoteToOwner({
        userId,
        barbershopId: selectedBarbershopId,
        allowTransfer: true,
      });

      const validationError = getValidationErrorMessageWithNested(result.validationErrors);

      if (validationError) {
        toast.error(validationError);
        setCurrentMutationUserId(null);
        return;
      }

      if (result.serverError || !result.data) {
        toast.error("Falha ao promover usuário para owner.");
        setCurrentMutationUserId(null);
        return;
      }

      toast.success("Usuário promovido para owner com sucesso.");
      setCurrentMutationUserId(null);
      router.refresh();
    },
    [executePromoteToOwner, router, selectedBarbershopByUserId],
  );

  const handleSetBarbershopAccess = useCallback(
    async ({
      userId,
      barbershopId,
      isActive,
    }: BarbershopAccessParams & { isActive: boolean }) => {
      setCurrentMutationUserId(userId);

      const result = await executeSetBarbershopAccess({
        barbershopId,
        isActive,
      });

      const validationError = getValidationErrorMessageWithNested(result.validationErrors);

      if (validationError) {
        toast.error(validationError);
        setCurrentMutationUserId(null);
        return;
      }

      if (result.serverError || !result.data) {
        toast.error(
          isActive
            ? "Falha ao reativar acesso da barbearia."
            : "Falha ao desabilitar acesso da barbearia.",
        );
        setCurrentMutationUserId(null);
        return;
      }

      toast.success(
        isActive
          ? "Acesso da barbearia reativado."
          : "Acesso da barbearia desabilitado.",
      );
      setCurrentMutationUserId(null);
      router.refresh();
    },
    [executeSetBarbershopAccess, router],
  );

  const handleSelectedBarbershopChange = useCallback(
    (userId: string, value: string) => {
      setSelectedBarbershopByUserId((currentState) => ({
        ...currentState,
        [userId]: value,
      }));
    },
    [],
  );

  return (
    <>
      <datalist id="admin-barbershop-options">
        {barbershopOptions.map((barbershop) => (
          <option key={barbershop.id} value={barbershop.id}>
            {barbershop.name}
          </option>
        ))}
      </datalist>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Status usuário</TableHead>
            <TableHead>Barbearia owner</TableHead>
            <TableHead>Status barbearia</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
          <TableBody>
            {users.length > 0 ? (
            users.map((user) => (
              <OwnerUserRow
                key={user.id}
                user={user}
                isCurrentRowBusy={isBusy && currentMutationUserId === user.id}
                selectedBarbershopId={selectedBarbershopByUserId[user.id] ?? ""}
                barbershopDatalistId="admin-barbershop-options"
                onUpdateRole={handleUpdateRole}
                onPromoteToOwner={handlePromoteToOwner}
                onSetBarbershopAccess={handleSetBarbershopAccess}
                onSelectedBarbershopChange={handleSelectedBarbershopChange}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground text-sm">
                Nenhum usuário encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
};

export default OwnersManagementTable;
