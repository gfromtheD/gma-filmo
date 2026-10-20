"use client";

import { useState, type FormEvent } from "react";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useUsernameAvailability } from "@/hooks/use-username-availability";
import { normalizeUsername, usernameChangeStatus, usernameProblem, type UsernameSaveError } from "@/lib/profiles/username";

/**
 * Estado de la edición del @ de la cuenta (la comparten Ajustes y el editor de perfil): borrador, comprobación en
 * vivo de formato y disponibilidad, y guardado. Los textos y la forma las pone quien lo usa.
 */
export function useUsernameEditor() {
  const { username, usernameChanges, updateUsername } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraftValue] = useState("");
  const [error, setError] = useState<UsernameSaveError | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const candidate = normalizeUsername(draft);
  const availability = useUsernameAvailability(candidate, username);
  const { remaining, nextChange } = usernameChangeStatus(usernameChanges);
  const problem = candidate === "" ? null : usernameProblem(candidate);
  const shownError: UsernameSaveError | null = error ?? problem ?? (availability === "taken" ? "taken" : null);
  const canSave = candidate !== "" && candidate !== username && !problem && availability !== "taken" && !isSaving;

  function start() {
    setDraftValue(username);
    setError(null);
    setSaved(false);
    setIsEditing(true);
  }

  function cancel() {
    setIsEditing(false);
  }

  function setDraft(value: string) {
    setDraftValue(value);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    const result = await updateUsername(candidate);
    setIsSaving(false);
    if (result) { setError(result); return; }
    setSaved(true);
    setIsEditing(false);
  }

  return {
    username, remaining, nextChange, isEditing, draft, candidate, availability, shownError, canSave, isSaving, saved,
    start, cancel, setDraft, submit,
  };
}
