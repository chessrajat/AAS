"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, ShieldUser, Trash2 } from "lucide-react";
import { toast } from "sonner";

import HomeSidebar from "../../components/HomeSidebar";
import { useAuthStore } from "../../stores/authStore";
import { useApiStore } from "../../stores/apiStore";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ROLE_OPTIONS = ["owner", "admin", "manager", "annotator", "viewer"];

const EMPTY_FORM = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  role: "viewer",
  password: "",
  is_active: true,
  is_staff: false,
};

export default function UsersPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const canManageUsers = useAuthStore((state) => state.canManageUsers);
  const permissionsLoaded = useAuthStore((state) => state.permissionsLoaded);
  const resolveUserManagementAccess = useAuthStore(
    (state) => state.resolveUserManagementAccess,
  );
  const {
    users,
    isLoadingUsers,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  } = useApiStore();
  const redirectedForAccessRef = useRef(false);

  const [searchValue, setSearchValue] = useState("");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_FORM);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const run = async () => {
      let allowed = canManageUsers;
      if (!permissionsLoaded) {
        allowed = await resolveUserManagementAccess();
      }

      if (!allowed) {
        if (!redirectedForAccessRef.current) {
          toast.error("You do not have access to User Management.");
          redirectedForAccessRef.current = true;
        }
        router.replace("/");
        return;
      }
      fetchUsers(accessToken);
    };

    run();
  }, [
    accessToken,
    canManageUsers,
    permissionsLoaded,
    router,
    resolveUserManagementAccess,
    fetchUsers,
  ]);

  const filteredUsers = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) {
      return users;
    }
    return users.filter((user) => {
      const haystack = [
        user.username,
        user.email,
        user.first_name,
        user.last_name,
        user.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [searchValue, users]);

  const resetForm = () => {
    setUserForm(EMPTY_FORM);
    setEditingUser(null);
  };

  const openCreateUserModal = () => {
    resetForm();
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user) => {
    setEditingUser(user);
    setUserForm({
      username: user.username || "",
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role || "viewer",
      password: "",
      is_active: Boolean(user.is_active),
      is_staff: Boolean(user.is_staff),
    });
    setIsUserModalOpen(true);
  };

  const handleFormChange = (field, value) => {
    setUserForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveUser = async (event) => {
    event.preventDefault();
    if (!userForm.username.trim()) {
      toast.error("Username is required.");
      return;
    }
    if (!editingUser && !userForm.password.trim()) {
      toast.error("Password is required for new users.");
      return;
    }

    const payload = {
      username: userForm.username.trim(),
      email: userForm.email.trim(),
      first_name: userForm.first_name.trim(),
      last_name: userForm.last_name.trim(),
      role: userForm.role,
      is_active: userForm.is_active,
      is_staff: userForm.is_staff,
    };

    if (userForm.password.trim()) {
      payload.password = userForm.password.trim();
    }

    setIsSavingUser(true);
    const result = editingUser
      ? await updateUser(editingUser.id, payload)
      : await createUser(payload);
    setIsSavingUser(false);

    if (!result.ok) {
      toast.error(editingUser ? "User update failed" : "User creation failed", {
        description: result.error || "Please try again.",
      });
      return;
    }

    toast.success(editingUser ? "User updated" : "User created");
    setIsUserModalOpen(false);
    resetForm();
  };

  const handleOpenDeleteUser = (user) => {
    setUserToDelete(user);
    setIsDeleteUserOpen(true);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) {
      return;
    }
    const result = await deleteUser(userToDelete.id);
    if (!result.ok) {
      toast.error("User delete failed", {
        description: result.error || "Please try again.",
      });
      return;
    }
    toast.success("User deleted");
    setIsDeleteUserOpen(false);
    setUserToDelete(null);
  };

  return (
    <SidebarProvider>
      <HomeSidebar />
      <SidebarInset>
        <header className="flex items-center justify-between border-b border-slate-200/60 bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Administration
              </p>
              <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
            </div>
          </div>
          <Dialog
            open={isUserModalOpen}
            onOpenChange={(open) => {
              setIsUserModalOpen(open);
              if (!open) {
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="default" onClick={openCreateUserModal}>
                <Plus />
                New User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingUser ? "Edit user" : "Create user"}</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSaveUser}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="user-username">Username</Label>
                    <Input
                      id="user-username"
                      value={userForm.username}
                      onChange={(event) => handleFormChange("username", event.target.value)}
                      placeholder="jane.doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={userForm.email}
                      onChange={(event) => handleFormChange("email", event.target.value)}
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-first-name">First name</Label>
                    <Input
                      id="user-first-name"
                      value={userForm.first_name}
                      onChange={(event) => handleFormChange("first_name", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-last-name">Last name</Label>
                    <Input
                      id="user-last-name"
                      value={userForm.last_name}
                      onChange={(event) => handleFormChange("last_name", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Role</Label>
                    <NativeSelect
                      id="user-role"
                      value={userForm.role}
                      onChange={(event) => handleFormChange("role", event.target.value)}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <NativeSelectOption key={role} value={role}>
                          {role}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-password">
                      Password {editingUser ? "(optional)" : ""}
                    </Label>
                    <Input
                      id="user-password"
                      type="password"
                      value={userForm.password}
                      onChange={(event) => handleFormChange("password", event.target.value)}
                      placeholder={editingUser ? "Leave blank to keep current password" : ""}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={userForm.is_active}
                      onChange={(event) =>
                        handleFormChange("is_active", event.target.checked)
                      }
                    />
                    Active account
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={userForm.is_staff}
                      onChange={(event) =>
                        handleFormChange("is_staff", event.target.checked)
                      }
                    />
                    Staff user
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsUserModalOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSavingUser}>
                    {isSavingUser
                      ? "Saving..."
                      : editingUser
                        ? "Update user"
                        : "Create user"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <div className="flex-1 space-y-6 bg-slate-50 px-6 py-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ShieldUser className="size-4 text-slate-500" />
              {users.length} total users
            </div>
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by username, email, role..."
              className="sm:max-w-xs"
            />
          </div>

          {isLoadingUsers ? (
            <Card className="border-dashed border-slate-200/70 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">Loading users...</p>
            </Card>
          ) : filteredUsers.length === 0 ? (
            <Card className="border-dashed border-slate-200/70 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">
                No users found. Try a different search or create a new user.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="border-slate-200/70 bg-white p-5 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                          {user.first_name || user.last_name
                            ? `${user.first_name} ${user.last_name}`.trim()
                            : user.username}
                        </h2>
                        <p className="text-sm text-slate-500">@{user.username}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => openEditUserModal(user)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleOpenDeleteUser(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p>{user.email || "No email set"}</p>
                      <p className="capitalize">Role: {user.role || "viewer"}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <span>{user.is_active ? "Active" : "Inactive"}</span>
                      <span>•</span>
                      <span>{user.is_staff ? "Staff" : "Standard"}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <AlertDialog
          open={isDeleteUserOpen}
          onOpenChange={(open) => {
            setIsDeleteUserOpen(open);
            if (!open) {
              setUserToDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove {userToDelete?.username || "this user"}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteUser}>
                Confirm delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
