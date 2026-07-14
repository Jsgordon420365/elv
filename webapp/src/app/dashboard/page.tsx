// ver 20260714135900.0

import { redirect } from "next/navigation";

export default function DashboardRedirect() {
    redirect("/vault");
}

// Version history
// 20260714135900.0 - Redirected the legacy server-entitlement dashboard to the local encrypted vault in demo mode.
