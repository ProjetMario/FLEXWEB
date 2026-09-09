"use client";
import { useState } from "react";
export default function AppointmentDate() {
  const [value, setValue] = useState("");
  const date = value ? new Date(value) : null;
  return (
    <label className="block text-sm">
      Date du rendez-vous (heure de cet appareil)
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-1 block w-full rounded-lg border p-2"
      />
      <input
        type="hidden"
        name="date"
        value={
          date && Number.isFinite(date.getTime()) ? date.toISOString() : ""
        }
      />
    </label>
  );
}
