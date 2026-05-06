"use client";

import type { Profile } from "@/app/settings/page";
import { supabase } from "@/lib/supabase/client";
import {
  Camera,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  Shield,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  userId: string;
  userEmail: string;
  initialProfile: Profile;
};

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim() || "User";

  return source
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getAvatarPath(userId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const timestamp = Date.now();

  return `${userId}/avatar-${timestamp}.${extension}`;
}

function isValidImage(file: File) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  return allowedTypes.includes(file.type);
}

function addCacheBuster(url: string | null | undefined) {
  if (!url) return "";

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}t=${Date.now()}`;
}

export default function SettingsManager({
  userId,
  userEmail,
  initialProfile,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [fullName, setFullName] = useState(initialProfile.full_name ?? "");

  /**
   * IMPORTANT:
   * Do not call Date.now() here.
   * Initial client render must match the server render to avoid hydration mismatch.
   */
  const [avatarPreview, setAvatarPreview] = useState(
    initialProfile.avatar_url ?? ""
  );

  const [avatarError, setAvatarError] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const initials = useMemo(
    () => getInitials(fullName, userEmail),
    [fullName, userEmail]
  );

  const isBusy = savingProfile || uploadingAvatar || removingAvatar;

  const hasProfileChanges =
    fullName.trim() !== (profile.full_name ?? "").trim();

  const canRemoveAvatar = Boolean(profile.avatar_url || avatarPreview);

  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSelectAvatar(file: File | null) {
    if (!file) return;

    if (!isValidImage(file)) {
      toast.error("Invalid image type", {
        description: "Please upload a JPG, PNG, or WEBP image.",
      });
      resetFileInput();
      return;
    }

    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error("Image is too large", {
        description: "Please upload an image smaller than 2MB.",
      });
      resetFileInput();
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setSelectedFile(file);
    setAvatarPreview(previewUrl);
    setAvatarError(false);

    toast.success("Image selected", {
      description: "Click Save Photo to upload your new profile picture.",
    });
  }

  async function handleSaveProfile() {
    const cleanName = fullName.trim();

    if (!cleanName) {
      toast.error("Missing full name", {
        description: "Please enter your full name.",
      });
      return;
    }

    setSavingProfile(true);

    const toastId = toast.loading("Saving profile...", {
      description: "Updating your profile information.",
    });

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: cleanName,
          avatar_url: profile.avatar_url,
        },
        {
          onConflict: "id",
        }
      )
      .select("id, full_name, avatar_url, created_at")
      .single();

    if (error) {
      toast.error("Profile update failed", {
        id: toastId,
        description: error.message,
      });
      setSavingProfile(false);
      return;
    }

    const nextProfile = data as Profile;

    setProfile(nextProfile);
    setFullName(nextProfile.full_name ?? "");

    /**
     * No cache buster here because saving the name does not change the image.
     */
    setAvatarPreview(nextProfile.avatar_url ?? "");
    setAvatarError(false);

    toast.success("Profile saved", {
      id: toastId,
      description: "Your profile information was updated successfully.",
    });

    setSavingProfile(false);
  }

  async function handleUploadAvatar() {
    if (!selectedFile) {
      toast.error("No image selected", {
        description: "Choose a profile picture first.",
      });
      return;
    }

    setUploadingAvatar(true);

    const toastId = toast.loading("Uploading photo...", {
      description: "Please wait while your profile picture is uploaded.",
    });

    const filePath = getAvatarPath(userId, selectedFile);

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: selectedFile.type,
      });

    if (uploadError) {
      toast.error("Photo upload failed", {
        id: toastId,
        description: uploadError.message,
      });
      setUploadingAvatar(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    if (!publicUrl) {
      toast.error("Photo URL failed", {
        id: toastId,
        description: "The image uploaded, but no public URL was returned.",
      });
      setUploadingAvatar(false);
      return;
    }

    const cleanName = fullName.trim() || profile.full_name || "";

    const { data, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: cleanName,
          avatar_url: publicUrl,
        },
        {
          onConflict: "id",
        }
      )
      .select("id, full_name, avatar_url, created_at")
      .single();

    if (profileError) {
      toast.error("Profile photo save failed", {
        id: toastId,
        description: profileError.message,
      });
      setUploadingAvatar(false);
      return;
    }

    const nextProfile = data as Profile;

    setProfile(nextProfile);
    setFullName(nextProfile.full_name ?? "");

    /**
     * Cache buster is safe here because this happens after hydration.
     */
    setAvatarPreview(addCacheBuster(nextProfile.avatar_url));
    setAvatarError(false);
    setSelectedFile(null);
    resetFileInput();

    toast.success("Photo updated", {
      id: toastId,
      description: "Your newest profile picture is now displayed.",
    });

    setUploadingAvatar(false);
  }

  async function handleRemoveAvatar() {
    if (!canRemoveAvatar) {
      toast.error("No photo to remove", {
        description: "You do not have a saved profile picture yet.",
      });
      return;
    }

    setRemovingAvatar(true);

    const toastId = toast.loading("Removing photo...", {
      description: "Updating your profile picture.",
    });

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: fullName.trim() || profile.full_name,
          avatar_url: null,
        },
        {
          onConflict: "id",
        }
      )
      .select("id, full_name, avatar_url, created_at")
      .single();

    if (error) {
      toast.error("Remove failed", {
        id: toastId,
        description: error.message,
      });
      setRemovingAvatar(false);
      return;
    }

    const nextProfile = data as Profile;

    setProfile(nextProfile);
    setAvatarPreview("");
    setAvatarError(false);
    setSelectedFile(null);
    resetFileInput();

    toast.success("Photo removed", {
      id: toastId,
      description: "Your profile picture was removed successfully.",
    });

    setRemovingAvatar(false);
  }

  function handleResetProfile() {
    setFullName(profile.full_name ?? "");
    setAvatarPreview(profile.avatar_url ?? "");
    setAvatarError(false);
    setSelectedFile(null);
    resetFileInput();
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <p className="text-sm font-medium text-emerald-400">
          Account Settings
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Settings
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Manage your display name and profile picture.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-4xl font-bold text-emerald-300 shadow-2xl shadow-black/30">
                {avatarPreview && !avatarError ? (
                  <img
                    src={avatarPreview}
                    alt={`${fullName || "User"} profile picture`}
                    className="h-full w-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  initials
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Choose profile picture"
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) =>
                handleSelectAvatar(event.target.files?.[0] ?? null)
              }
            />

            <h2 className="mt-5 text-xl font-bold text-white">
              {fullName.trim() || "Your Profile"}
            </h2>

            <p className="mt-1 text-sm text-slate-400">{userEmail}</p>

            <div className="mt-5 grid w-full gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                Choose Photo
              </button>

              <button
                type="button"
                onClick={handleUploadAvatar}
                disabled={!selectedFile || isBusy}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {uploadingAvatar ? "Uploading..." : "Save Photo"}
              </button>

              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={isBusy || !canRemoveAvatar}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {removingAvatar ? "Removing..." : "Remove Photo"}
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              JPG, PNG, or WEBP. Maximum file size: 2MB.
            </p>

            {selectedFile && (
              <p className="mt-2 text-xs text-emerald-300">
                New photo selected. Click Save Photo to apply it.
              </p>
            )}

            {avatarError && (
              <p className="mt-2 text-xs text-yellow-300">
                The saved image could not be loaded. Check if your avatars
                bucket is public.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">
                Profile Information
              </h2>
              <p className="text-sm text-slate-400">
                This name will be used in your account display and report
                downloads.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-slate-300">
                  Full Name
                </label>

                <div className="relative mt-2">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                    disabled={savingProfile}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">
                  Email Address
                </label>

                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={userEmail}
                    disabled
                    className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-white/5 px-10 py-3 text-sm text-slate-400 outline-none"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Email is managed by your authentication account.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleResetProfile}
                  disabled={isBusy || (!hasProfileChanges && !selectedFile)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset
                </button>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile || !hasProfileChanges}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">
                Account Status
              </h2>
              <p className="text-sm text-slate-400">
                Your account is connected to your protected financial records.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={<Shield className="h-5 w-5" />}
                title="Protected Account"
                description="Your records are linked only to your authenticated user ID."
              />

              <InfoCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Profile Ready"
                description="Your newest name and avatar can be used across the dashboard."
              />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
        {icon}
      </div>

      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}



//Bucket name: avatars
//Bucket public: yes
//Allowed app upload types: image/jpeg, image/png, image/webp
//File path format: userId/avatar-timestamp.extension
//profiles.avatar_url: public URL from getPublicUrl()