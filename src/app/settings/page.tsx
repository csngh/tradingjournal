import { Settings as SettingsIcon } from "lucide-react";
import { getAllTags, getAppSettings } from "@/lib/data";
import { listTimezones } from "@/lib/timezone";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, tags] = await Promise.all([getAppSettings(), getAllTags()]);
  const timezones = listTimezones();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--text)]">
        <SettingsIcon size={20} className="text-[var(--accent)]" />
        Settings
      </h1>
      <SettingsClient
        currentTimezone={settings.timezone}
        timezones={timezones}
        currentCountBreakeven={settings.countBreakeven}
        tags={tags}
      />
    </div>
  );
}
