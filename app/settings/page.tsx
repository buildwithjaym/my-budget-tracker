import AppShell from "@/components/app-shell";
import SettingsManager from "@/components/settings/setting-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const revalidate = 0;

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const fallbackName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "";

  return (
    <AppShell>
      <SettingsManager
        userId={user.id}
        userEmail={user.email ?? ""}
        initialProfile={
          profile ?? {
            id: user.id,
            full_name: fallbackName,
            avatar_url: null,
            created_at: null,
          }
        }
      />
    </AppShell>
  );
}