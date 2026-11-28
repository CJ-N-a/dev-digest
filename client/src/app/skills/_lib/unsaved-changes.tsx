/* unsaved-changes.tsx — "leave with unsaved changes?" guard shared by the
   /skills master-detail: the editor reports its dirty state, the list (and
   anything else that navigates away) asks before leaving. Also arms the
   browser's beforeunload prompt while dirty. */
"use client";

import React from "react";

interface UnsavedChangesApi {
  /** Editor → guard: whether there are unsaved edits right now. */
  setDirty: (dirty: boolean) => void;
  /** true = OK to leave (clean, or the user confirmed). */
  confirmLeave: () => boolean;
}

const NOOP: UnsavedChangesApi = { setDirty: () => {}, confirmLeave: () => true };
const Ctx = React.createContext<UnsavedChangesApi>(NOOP);

export function UnsavedChangesProvider({ message, children }: { message: string; children: React.ReactNode }) {
  const dirtyRef = React.useRef(false);

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const api = React.useMemo<UnsavedChangesApi>(
    () => ({
      setDirty: (dirty) => {
        dirtyRef.current = dirty;
      },
      confirmLeave: () => {
        if (!dirtyRef.current) return true;
        const ok = window.confirm(message);
        if (ok) dirtyRef.current = false;
        return ok;
      },
    }),
    [message],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useUnsavedChanges(): UnsavedChangesApi {
  return React.useContext(Ctx);
}

/** Report a component's dirty state to the guard (cleared on unmount). */
export function useReportDirty(dirty: boolean) {
  const { setDirty } = useUnsavedChanges();
  React.useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
}
