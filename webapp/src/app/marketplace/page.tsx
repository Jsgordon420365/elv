// ver 20260714135900.0

import { redirect } from "next/navigation";

export default function MarketplaceRedirect() {
    redirect("/workflow/independent-contractor");
}

// Version history
// 20260714135900.0 - Removed the Stripe-backed demo path and redirected to the locally granted workflow entitlement.
