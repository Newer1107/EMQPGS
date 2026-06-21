"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EditUserForm } from "./edit-dialog";

type UserData = {
  id: string;
  name: string;
  email: string;
  status: string;
  homeDepartment?: { id: string; name: string } | null;
  firstResponsibility?: string | null;
  responsibilities: string[];
};

type DepartmentOption = { id: string; name: string };

export function EditUserFormWrapper({ user, departments }: { user: UserData; departments: DepartmentOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <EditUserForm user={user} departments={departments} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

